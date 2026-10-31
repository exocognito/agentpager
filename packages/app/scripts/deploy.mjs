import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

// Secrets exist only in memory and the one wrangler child's environment. Never log an op result or exception.
try {
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Commit the candidate and clean the tree before deploy.');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const serviceToken = readFileSync(path.join(homedir(), 'Agents/.secrets/op-service-account.token'), 'utf8').trim();
  // The Cloudflare token's item, by id so a rename in 1Password can't break the deploy ("Cloudflare agentpager.me").
  let item;
  try { item = JSON.parse(execFileSync('op', ['item', 'get', 'k2rptzp2jwfoxsqvrguxxizsgi', '--vault', 'Yolo Sam', '--format', 'json'], { env: { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: serviceToken }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 })); }
  catch { throw new Error('Vault credential lookup failed (output withheld).'); }
  const field = name => item.fields.find(f => f.label === name || f.id === name)?.value;
  const credential = field('credential'), account = field('account_id');
  if (!credential || !account) throw new Error('Vault fields missing.');
  // The APNs key (alerts, D7) reaches only the Worker secret, through wrangler's stdin.
  let apns;
  try { apns = JSON.parse(execFileSync('op', ['item', 'get', 'AgentPager APN.p8 key', '--vault', 'Yolo Sam', '--format', 'json'], { env: { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: serviceToken }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 })); }
  catch { throw new Error('APNs key lookup failed (output withheld).'); }
  const apnsKey = apns.fields.find(f => f.id === 'credential')?.value;
  if (!apnsKey) throw new Error('APNs key field missing.');
  const cf = async (route, init = {}) => {
    const response = await fetch('https://api.cloudflare.com/client/v4' + route, { ...init, headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' } });
    const value = await response.json();
    if (!response.ok || !value.success) throw new Error(`Cloudflare operation failed: ${route} (${response.status}); owner may need to grant scoped access.`);
    return value.result;
  };
  const zones = await cf('/zones?name=agentpager.me');
  if (zones.length !== 1) throw new Error('Expected the agentpager.me zone.');
  console.log(`Deploy candidate ${sha}; Worker ownerpager; account ${account}; zone agentpager.me (${zones[0].id})`);
  const out = mkdtempSync(path.join(tmpdir(), 'agentpager-deploy-'));
  execFileSync(process.execPath, ['scripts/build.mjs'], { env: { ...process.env, AGENTPAGER_BUILD_DIR: out }, stdio: 'inherit', timeout: 120_000 });
  const deploy = spawnSync('pnpm', ['exec', 'wrangler', 'deploy', '--config', path.join(out, 'wrangler.json')], { env: { ...process.env, CLOUDFLARE_API_TOKEN: credential, CLOUDFLARE_ACCOUNT_ID: account }, encoding: 'utf8', timeout: 180_000 });
  const output = `${deploy.stdout || ''}${deploy.stderr || ''}`.replaceAll(credential, '[REDACTED]').replaceAll(serviceToken, '[REDACTED]');
  console.log(output);
  if (deploy.status !== 0) throw new Error('Wrangler deploy failed.');
  const secret = spawnSync('pnpm', ['exec', 'wrangler', 'secret', 'put', 'APNS_KEY_P8', '--name', 'ownerpager'], { input: apnsKey, env: { ...process.env, CLOUDFLARE_API_TOKEN: credential, CLOUDFLARE_ACCOUNT_ID: account }, encoding: 'utf8', timeout: 120_000 });
  console.log(`${secret.stdout || ''}${secret.stderr || ''}`.replaceAll(apnsKey, '[REDACTED]').replaceAll(credential, '[REDACTED]').replaceAll(serviceToken, '[REDACTED]'));
  if (secret.status !== 0) throw new Error('Setting the APNs key secret failed.');
  const domains = await cf(`/accounts/${account}/workers/domains`);
  if (!domains.some(d => d.hostname === 'agentpager.me' && d.service === 'ownerpager')) throw new Error('Custom domain binding missing.');
  const dns = await cf(`/zones/${zones[0].id}/dns_records?name=agentpager.me`);
  if (!dns.some(d => d.name === 'agentpager.me' && d.proxied)) throw new Error('Proxied apex DNS record missing.');
  console.log('Verified custom domain, DNS:', JSON.stringify(dns.map(d => ({ type: d.type, name: d.name, proxied: d.proxied }))));
  const namespaces = await cf(`/accounts/${account}/workers/durable_objects/namespaces`);
  const placement = namespaces.filter(n => n.script === 'ownerpager');
  for (const name of ['Agent', 'Registry']) if (!placement.some(n => n.class === name && n.use_sqlite === true)) throw new Error(`${name} is not a SQLite namespace on ownerpager.`);
  console.log('Durable Object placement:', JSON.stringify(placement));
  const settings = await cf(`/accounts/${account}/workers/scripts/ownerpager/settings`);
  const bindings = settings.bindings.filter(b => b.type === 'durable_object_namespace');
  for (const [name, className] of [['AGENT', 'Agent'], ['REGISTRY', 'Registry']]) if (!bindings.some(b => b.name === name && b.class_name === className && placement.some(n => n.id === b.namespace_id && n.class === className))) throw new Error(`Incorrect ${name} binding.`);
  console.log('Bindings:', JSON.stringify(bindings));
  if (!settings.bindings.some(b => b.type === 'secret_text' && b.name === 'APNS_KEY_P8')) throw new Error('The Worker secret APNS_KEY_P8 is missing, so no alerts go out.');
  for (let n = 0; n < 30; n++) {
    const response = await fetch('https://agentpager.me/start');
    if (response.headers.get('x-agentpager-build') === sha) { console.log(`Verified HTTPS candidate ${sha}`); process.exit(0); }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('HTTPS did not report the candidate build.');
} catch (error) { console.error(error instanceof Error ? error.message : 'Deploy failed'); process.exit(1); }
