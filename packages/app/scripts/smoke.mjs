import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageOf } from './stages.ts';

// The smoke run (METHOD.md › Tests and checks): node scripts/smoke.mjs --stage dev|prod checks that the stage serves
// this checkout's commit and that its Worker and Registry answer, from outside, paging no one and needing no phone. It
// leaves nothing behind: its one pager is deleted with its agent.
// The full suites stay local. A failed step is tried once more; a second failure fails the run.
const stage = stageOf(process.argv), origin = `https://${stage.host}`, dev = stage.name !== 'prod';
const app = fileURLToPath(new URL('..', import.meta.url)), cli = path.join(app, '../cli');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
// A well-formed number no pager has: the binary sends it, and only the Registry can say it isn't in use.
const bogus = 'ap1_' + randomBytes(24).toString('base64url');
// A pager only this stage has, as the phone makes one (test/support.ts pagerKeys), with a phone key of its own. It has
// no alert target, so connecting to it pages no one, and it turns itself off after 24 hours if its delete fails.
function throwawayPager() {
  const publicKey = String(generateKeyPairSync('x25519').publicKey.export({ format: 'jwk' }).x);
  const id = randomBytes(16), fingerprint = createHash('sha256').update(Buffer.from(publicKey, 'base64url')).digest().subarray(0, 8);
  return { pagerId: id.toString('hex'), publicKey, number: 'ap1_' + Buffer.concat([id, fingerprint]).toString('base64url'), phone: randomBytes(24).toString('base64url') };
}
const check = (ok, message) => { if (!ok) throw new Error(message); };
const candidate = response => check(response.headers.get('x-agentpager-build') === sha, `serves build ${response.headers.get('x-agentpager-build')}, not ${sha}`);
// start.ts heads every page for an agent with this on any server but agentpager.me.
const says = body => check(body.startsWith('# AgentPager (dev)\n') === dev, dev ? 'no dev mark' : 'prod says it is dev');

const results = [];
async function step(name, run) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { await run(); console.log(`ok ${name}${attempt > 1 ? ' (on retry)' : ''}`); results.push({ name, retried: attempt > 1, ok: true }); return; }
    catch (error) { console.log(`${attempt === 1 ? 'retry' : 'FAILED'} ${name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  results.push({ name, ok: false });
}

console.log(`Smoke ${stage.name} at ${origin}, candidate ${sha}`);
await step(`/start tells an agent how to install and connect${dev ? ', and says dev' : ''}`, async () => {
  const response = await fetch(origin + '/start'), body = await response.text();
  check(response.status === 200, `status ${response.status}`); candidate(response); says(body);
  check(body.includes(`agentpager connect <number>${dev ? ` --server ${origin}` : ''}\n`), 'the connect command names the wrong server');
});
await step(`/ points an agent at /start${dev ? ', and says dev' : ''}`, async () => {
  const response = await fetch(origin + '/'), body = await response.text();
  check(response.status === 200, `status ${response.status}`); candidate(response); says(body);
  check(body.includes(`${origin}/start`), 'no link to /start');
});
await step('/ serves a browser the front page', async () => {
  const response = await fetch(origin + '/', { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (AgentPager smoke)' } }), body = await response.text();
  check(response.status === 200, `status ${response.status}`); candidate(response);
  check(body.includes('<div id="root"></div>') && body.includes('/assets/app.js'), 'not the front page');
});
await step('Plain HTTP moves to HTTPS or is refused, and HTTPS replies tell browsers to keep to it (I23.4)', async () => {
  const moved = await fetch(`http://${stage.host}/start?smoke=1`, { redirect: 'manual' });
  check(moved.status === 308 && moved.headers.get('location') === `${origin}/start?smoke=1`, `GET over plain HTTP: ${moved.status} ${moved.headers.get('location')}`); candidate(moved);
  const refused = await fetch(`http://${stage.host}/api/agents`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number: bogus, app: 'smoke', project: 'smoke' }) });
  const value = await refused.json();
  check(refused.status === 403 && value.error === 'HttpsRequired', `POST over plain HTTP: ${refused.status} ${value.error}`); candidate(refused);
  const secure = await fetch(origin + '/start');
  check(secure.headers.get('strict-transport-security') === 'max-age=31536000', `HSTS: ${secure.headers.get('strict-transport-security')}`); await secure.arrayBuffer();
});
await step('The Registry refuses a pager number it has never seen', async () => {
  const response = await fetch(origin + '/api/agents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number: bogus, app: 'smoke', project: 'smoke' }) });
  const value = await response.json();
  check(response.status === 410 && value.error === 'NumberInvalid', `${response.status} ${value.error}`); candidate(response);
});
await step('The binary built from this commit connects to a pager only this stage has, and is refused one no pager has, under its own AGENTPAGER_HOME', async () => {
  execFileSync('sh', ['scripts/build.sh'], { cwd: cli, stdio: 'ignore', timeout: 120_000 });
  const binary = path.join(cli, 'dist/agentpager'), home = mkdtempSync(path.join(tmpdir(), 'agentpager-smoke-'));
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('AGENTPAGER_'))), AGENTPAGER_HOME: home };
  const run = (...args) => spawnSync(binary, args, { env, encoding: 'utf8', timeout: 60_000 });
  const version = run('version').stdout;
  check(version.includes(sha.slice(0, 7)), `the binary is ${version.trim()}`);
  const pager = throwawayPager();
  const made = await fetch(origin + '/api/pagers', { method: 'POST', headers: { 'content-type': 'application/json', 'x-phone-key': pager.phone }, body: JSON.stringify({ number: pager.number, publicKey: pager.publicKey, autoOff: '24h' }) });
  check(made.status === 200, `making a throwaway pager: ${made.status} ${await made.text()}`);
  let failure;
  try {
    // Only this stage's Registry has the pager, so connecting proves the binary reached this stage.
    const connected = run('connect', pager.number, '--server', origin, '--app', 'smoke', '--project', 'smoke');
    check(connected.status === 0 && connected.stdout.includes('Connected as agent'), `connect: exit ${connected.status}: ${`${connected.stdout}${connected.stderr}`.trim()}`);
    const refused = run('connect', bogus, '--server', origin);
    check(refused.status === 2 && `${refused.stdout}${refused.stderr}`.includes('This pager number is not in use'), `bogus connect: exit ${refused.status}: ${`${refused.stdout}${refused.stderr}`.trim()}`);
    check(readdirSync(path.join(home, 'agents')).filter(f => f.endsWith('.json')).length === 1, 'the refused connect saved an agent');
  } catch (error) { failure = error; }
  // Deleting the pager deletes its agent with it.
  const deleted = await fetch(`${origin}/api/pagers/${pager.pagerId}/delete`, { method: 'POST', headers: { 'x-phone-key': pager.phone } });
  if (failure) throw failure;
  check(deleted.status === 200, `deleting the throwaway pager: ${deleted.status} ${await deleted.text()}`);
});
await step('The deploy\'s own verification', async () => {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/deploy.mjs', '--stage', stage.name, '--verify'], { cwd: app, stdio: 'inherit', timeout: 240_000 });
  check(r.status === 0, `exit ${r.status}`);
});

const passed = results.filter(r => r.ok), failed = results.filter(r => !r.ok);
console.log(`Smoke ${stage.name}: ${passed.length} passed (${passed.filter(r => r.retried).length} on retry), ${failed.length} failed.`);
process.exit(failed.length ? 1 : 0);
