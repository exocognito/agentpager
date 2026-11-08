import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { ZONE, stageOf, deployRefusal, hostRefusal, stageConfig, storageRefusal, checkSettled, allPages } from './stages.ts';

// node scripts/deploy.mjs --stage dev|prod deploys this checkout's commit to that stage (AGENTS.md › Stages).
// With --verify it deploys nothing and only checks what that stage runs, for the smoke run.
// Secrets exist only in memory and the one wrangler child's environment. Never log an op result or exception.
try {
  const stage = stageOf(process.argv), verifyOnly = process.argv.includes('--verify');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const sha = git('rev-parse', 'HEAD');
  if (!verifyOnly) {
    const refusal = deployRefusal(stage, { status: git('status', '--porcelain'), tags: git('tag', '--points-at', 'HEAD').split('\n').filter(Boolean), sha });
    if (refusal) throw new Error(refusal);
  }
  const serviceToken = readFileSync(path.join(homedir(), 'Agents/.secrets/op-service-account.token'), 'utf8').trim();
  // The Cloudflare token's item, by id so a rename in 1Password can't break the deploy ("Cloudflare agentpager.me").
  let item;
  try { item = JSON.parse(execFileSync('op', ['item', 'get', 'k2rptzp2jwfoxsqvrguxxizsgi', '--vault', 'Yolo Sam', '--format', 'json'], { env: { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: serviceToken }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 })); }
  catch { throw new Error('Vault credential lookup failed (output withheld).'); }
  const field = name => item.fields.find(f => f.label === name || f.id === name)?.value;
  const credential = field('credential'), account = field('account_id');
  if (!credential || !account) throw new Error('Vault fields missing.');
  const answer = async route => {
    const response = await fetch('https://api.cloudflare.com/client/v4' + route, { headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' } });
    const value = await response.json();
    if (!response.ok || !value.success) throw new Error(`Cloudflare operation failed: ${route} (${response.status}); owner may need to grant scoped access.`);
    return value;
  };
  const cf = async route => (await answer(route)).result;
  // Every page of a list (stages.ts › allPages), the first asked for as the route reads; `pages.read` counts them.
  const cfList = (route, pages = { read: 0 }) => allPages(page => { pages.read = page; return answer(page === 1 ? route : `${route}${route.includes('?') ? '&' : '?'}page=${page}`); });
  const zones = await cfList(`/zones?name=${ZONE}`);
  if (zones.length !== 1) throw new Error(`Expected the ${ZONE} zone.`);
  console.log(`${verifyOnly ? 'Verify' : 'Deploy candidate'} ${sha}; stage ${stage.name}; Worker ${stage.worker}; account ${account}; zone ${ZONE} (${zones[0].id}); https://${stage.host}`);
  if (!verifyOnly) {
    const taken = hostRefusal(stage, await cfList(`/accounts/${account}/workers/domains`), await cfList(`/zones/${zones[0].id}/dns_records?name=${stage.host}`));
    if (taken) throw new Error(`deploy:${stage.name} refused: ${taken}`);
    // The APNs key (alerts, D7) reaches only the Worker secret, through wrangler's stdin. Every stage gets the same key.
    let apns;
    try { apns = JSON.parse(execFileSync('op', ['item', 'get', 'AgentPager APN.p8 key', '--vault', 'Yolo Sam', '--format', 'json'], { env: { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: serviceToken }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 })); }
    catch { throw new Error('APNs key lookup failed (output withheld).'); }
    const apnsKey = apns.fields.find(f => f.id === 'credential')?.value;
    if (!apnsKey) throw new Error('APNs key field missing.');
    const out = mkdtempSync(path.join(tmpdir(), 'agentpager-deploy-'));
    execFileSync(process.execPath, ['scripts/build.mjs'], { env: { ...process.env, AGENTPAGER_BUILD_DIR: out }, stdio: 'inherit', timeout: 120_000 });
    // The same build for every stage; dev's config names its own Worker and domain.
    const configPath = path.join(out, 'wrangler.json'), built = JSON.parse(readFileSync(configPath, 'utf8')), config = stageConfig(built, stage);
    if (config !== built) writeFileSync(configPath, JSON.stringify(config, null, 2));
    const deploy = spawnSync('pnpm', ['exec', 'wrangler', 'deploy', '--config', configPath], { env: { ...process.env, CLOUDFLARE_API_TOKEN: credential, CLOUDFLARE_ACCOUNT_ID: account }, encoding: 'utf8', timeout: 180_000 });
    const output = `${deploy.stdout || ''}${deploy.stderr || ''}`.replaceAll(credential, '[REDACTED]').replaceAll(serviceToken, '[REDACTED]');
    console.log(output);
    if (deploy.status !== 0) throw new Error('Wrangler deploy failed.');
    const secret = spawnSync('pnpm', ['exec', 'wrangler', 'secret', 'put', 'APNS_KEY_P8', '--name', stage.worker], { input: apnsKey, env: { ...process.env, CLOUDFLARE_API_TOKEN: credential, CLOUDFLARE_ACCOUNT_ID: account }, encoding: 'utf8', timeout: 120_000 });
    console.log(`${secret.stdout || ''}${secret.stderr || ''}`.replaceAll(apnsKey, '[REDACTED]').replaceAll(credential, '[REDACTED]').replaceAll(serviceToken, '[REDACTED]'));
    if (secret.status !== 0) throw new Error('Setting the APNs key secret failed.');
  }
  const domains = await cfList(`/accounts/${account}/workers/domains`);
  if (!domains.some(d => d.hostname === stage.host && d.service === stage.worker)) throw new Error(`Custom domain binding ${stage.host} → ${stage.worker} missing.`);
  const dns = await cfList(`/zones/${zones[0].id}/dns_records?name=${stage.host}`);
  if (!dns.some(d => d.name === stage.host && d.proxied)) throw new Error(`Proxied DNS record for ${stage.host} missing.`);
  console.log('Verified custom domain, DNS:', JSON.stringify(dns.map(d => ({ type: d.type, name: d.name, proxied: d.proxied }))));
  // Every class a SQLite namespace of this Worker, every binding naming it, and the push key's secret set; asked again
  // while Cloudflare's reads lag the deploy.
  let seenStorage;
  await checkSettled(async () => {
    const pages = { read: 0 }, namespaces = await cfList(`/accounts/${account}/workers/durable_objects/namespaces`, pages);
    const settings = await cf(`/accounts/${account}/workers/scripts/${stage.worker}/settings`);
    seenStorage = { placement: namespaces.filter(n => n.script === stage.worker), bindings: settings.bindings.filter(b => b.type === 'durable_object_namespace'), of: namespaces.length, pages: pages.read };
    return storageRefusal(stage.worker, namespaces, settings.bindings);
  }, line => console.log(line));
  console.log(`Durable Object placement (of the account's ${seenStorage.of} namespaces, read in ${seenStorage.pages} pages):`, JSON.stringify(seenStorage.placement));
  console.log('Bindings:', JSON.stringify(seenStorage.bindings));
  // A new hostname's record takes Cloudflare a moment to serve, and a resolver that asks before then keeps the
  // negative answer for up to the zone's 30 minutes. So this machine asks only once public DNS answers.
  let resolved = false;
  for (let n = 0; n < 60 && !resolved; n++) {
    const answer = await fetch(`https://cloudflare-dns.com/dns-query?name=${stage.host}&type=AAAA`, { headers: { accept: 'application/dns-json' } }).then(r => r.json()).catch(() => ({}));
    resolved = Array.isArray(answer.Answer) && answer.Answer.length > 0;
    if (!resolved) await new Promise(r => setTimeout(r, 2000));
  }
  if (!resolved) throw new Error(`Public DNS has no record for ${stage.host} yet; run this again with --verify in a few minutes.`);
  let seen = 'no reply';
  for (let n = 0; n < 30; n++) {
    try {
      const response = await fetch(`https://${stage.host}/start`);
      seen = response.headers.get('x-agentpager-build') ?? `status ${response.status}`;
      if (seen === sha) { console.log(`Verified HTTPS candidate ${sha} at https://${stage.host}`); process.exit(0); }
    } catch (error) { seen = error instanceof Error ? `${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}` : 'request failed'; }
    await new Promise(r => setTimeout(r, 2000));
  }
  const local = seen.includes('ENOTFOUND') ? '; public DNS has it, so this machine\'s resolver may still hold an earlier negative answer, for up to 30 minutes' : '';
  throw new Error(`https://${stage.host} did not report the candidate build (last seen: ${seen}${local}).`);
} catch (error) { console.error(error instanceof Error ? error.message : 'Deploy failed'); process.exit(1); }
