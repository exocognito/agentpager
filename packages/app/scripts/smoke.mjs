import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageOf } from './stages.ts';
import { CLIENT_HEADER, clientVersion } from '../../contract/exchange.ts';
import { fromBase64url, keyPair, open, seal, toBase64url } from '../../contract/envelope.ts';
import { decodePart, encodePart } from '../../contract/parts.ts';

// The smoke run (METHOD.md › Tests and checks): node scripts/smoke.mjs --stage dev|prod checks that the stage serves
// this checkout's commit and that its Worker and its stores answer, from outside, paging no one and needing no phone. It
// leaves nothing behind: its one throwaway pager is deleted with its agent, and the upgrade check only reads. The full
// suites stay local. A failed step is tried once more; a second failure fails the run.
//   --stage local --server <url>   the same against a local server, without the checks only a deployed stage has
//                                  (HTTPS, the deploy's own verification), and with a local upgrade baseline
//   --baseline-tag <tag>           the release whose upgrade baseline it checks, m5 unless named
// The upgrade check (METHOD.md › The milestone loop, step 4) reads back the baseline baseline.mjs recorded on this
// stage (~/.agentpager-baselines/<stage>/<tag>, or under AGENTPAGER_BASELINES), whose keys are secrets: nothing of them
// is printed. It never changes the record.
const argv = process.argv, flag = name => { const at = argv.indexOf(name); return at === -1 ? undefined : argv[at + 1]; };
const local = flag('--stage') === 'local';
const stage = local ? { name: 'local' } : stageOf(argv);
const origin = local ? (flag('--server') ?? '').replace(/\/+$/, '') : `https://${stage.host}`, dev = stage.name === 'dev';
if (local && !/^https?:\/\/[^\s/]+$/.test(origin)) { console.log('A local smoke run names its server: --stage local --server http://127.0.0.1:8787.'); process.exit(2); }
const app = fileURLToPath(new URL('..', import.meta.url)), cli = path.join(app, '../cli');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
// Every line out passes through this: no pager number and no key-length string is ever printed.
const redact = text => String(text).replace(/ap1_[A-Za-z0-9_-]*/g, 'ap1_[redacted]').replace(/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/g, '[redacted]');
// A well-formed number no pager has: the binary sends it, and only the service can say it isn't in use.
const bogus = 'ap1_' + randomBytes(24).toString('base64url');
// A pager only this stage has, as the phone makes one (test/support.ts pagerKeys), with its private key and a phone key
// of its own. It has no alert target, so connecting to it pages no one, and it turns itself off after 24 hours if its
// delete fails.
function throwawayPager() {
  const k = keyPair(), publicKey = toBase64url(k.publicKey);
  const id = randomBytes(16), fingerprint = createHash('sha256').update(k.publicKey).digest().subarray(0, 8);
  return { pagerId: id.toString('hex'), publicKey, privateKey: k.privateKey, number: 'ap1_' + Buffer.concat([id, fingerprint]).toString('base64url'), phone: randomBytes(24).toString('base64url') };
}
// A connect's body, its identity sealed to a stranger's key: only the service's answer about the number matters.
const strangerConnect = number => ({ number, identity: seal(keyPair().publicKey, 'identity', { pagerId: '0'.repeat(32) }, encodePart('identity', { app: 'smoke', project: 'smoke', answerKey: toBase64url(keyPair().publicKey) })) });
// The smoke run's own calls name it as their client, as every client of the API does.
const asClient = { 'content-type': 'application/json', [CLIENT_HEADER]: clientVersion('smoke', sha.slice(0, 7)) };
const phoneCall = (key, route, data) => fetch(origin + route, { method: data === undefined ? 'GET' : 'POST', headers: { ...asClient, 'x-phone-key': key }, body: data === undefined || data === null ? undefined : JSON.stringify(data) });
const check = (ok, message) => { if (!ok) throw new Error(message); };
const candidate = response => check(response.headers.get('x-agentpager-build') === sha, `serves build ${response.headers.get('x-agentpager-build')}, not ${sha}`);
// start.ts heads every page for an agent with this on a dev server (B18.5), such as dev.agentpager.me.
const says = body => check(body.startsWith('# AgentPager (dev)\n') === dev, dev ? 'no dev mark' : 'says it is dev');

const results = [];
async function step(name, run) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { await run(); console.log(`ok ${name}${attempt > 1 ? ' (on retry)' : ''}`); results.push({ name, retried: attempt > 1, ok: true }); return; }
    catch (error) { console.log(redact(`${attempt === 1 ? 'retry' : 'FAILED'} ${name}: ${error instanceof Error ? error.message : String(error)}`)); }
  }
  results.push({ name, ok: false });
}

// The binary built from this commit, run under its own AGENTPAGER_HOME and nothing else of AGENTPAGER_*.
let built;
function binary() {
  if (!built) { execFileSync('sh', ['scripts/build.sh'], { cwd: cli, stdio: 'ignore', timeout: 120_000 }); built = path.join(cli, 'dist/agentpager'); }
  return built;
}
const envFor = (home, extra = {}) => ({ ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('AGENTPAGER_'))), AGENTPAGER_HOME: home, ...extra });
const runIn = (bin, home, extra = {}) => (...args) => spawnSync(bin, args, { cwd: path.dirname(bin), env: envFor(home, extra), encoding: 'utf8', timeout: 90_000 });
const said = r => `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();

console.log(`Smoke ${stage.name} at ${origin}, candidate ${sha}`);
await step(`/start tells an agent how to install and connect${dev ? ', and says dev' : ''}`, async () => {
  const response = await fetch(origin + '/start'), body = await response.text();
  check(response.status === 200, `status ${response.status}`); candidate(response); says(body);
  check(body.includes(`agentpager connect <number>${origin === 'https://agentpager.me' ? '' : ` --server ${origin}`}\n`), 'the connect command names the wrong server');
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
if (!local) await step('Plain HTTP moves to HTTPS or is refused, and HTTPS replies tell browsers to keep to it (I23.4)', async () => {
  const moved = await fetch(`http://${stage.host}/start?smoke=1`, { redirect: 'manual' });
  check(moved.status === 308 && moved.headers.get('location') === `${origin}/start?smoke=1`, `GET over plain HTTP: ${moved.status} ${moved.headers.get('location')}`); candidate(moved);
  const refused = await fetch(`http://${stage.host}/api/agents`, { method: 'POST', redirect: 'manual', headers: asClient, body: JSON.stringify(strangerConnect(bogus)) });
  const value = await refused.json();
  check(refused.status === 403 && value.error === 'HttpsRequired', `POST over plain HTTP: ${refused.status} ${value.error}`); candidate(refused);
  const secure = await fetch(origin + '/start');
  check(secure.headers.get('strict-transport-security') === 'max-age=31536000', `HSTS: ${secure.headers.get('strict-transport-security')}`); await secure.arrayBuffer();
});
await step('The service refuses a pager number it has never seen', async () => {
  const response = await fetch(origin + '/api/agents', { method: 'POST', headers: asClient, body: JSON.stringify(strangerConnect(bogus)) });
  const value = await response.json();
  check(response.status === 410 && value.error === 'NumberInvalid', `${response.status} ${value.error}`); candidate(response);
});
await step('An agent call that doesn\'t name its client, as an m4 command\'s, is told to update before anything is read', async () => {
  const response = await fetch(origin + '/api/agents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number: bogus, app: 'smoke', project: 'smoke' }) });
  const value = await response.json();
  check(response.status === 400 && value.error === 'UpdateRequired' && value.message.includes(`${origin}/start`), `${response.status} ${value.error}`); candidate(response);
});
await step('A phone call that doesn\'t name its client, as the m4 app\'s, is told to update, never that its pager is unknown', async () => {
  for (const headers of [{}, { [CLIENT_HEADER]: 'ios/1 0.1+1' }]) {
    const response = await fetch(`${origin}/api/pagers/${randomBytes(16).toString('hex')}`, { headers: { ...headers, 'x-phone-key': randomBytes(24).toString('base64url') } });
    const value = await response.json();
    check(response.status === 400 && value.error === 'UpdateRequired', `${JSON.stringify(headers)}: ${response.status} ${value.error}`); candidate(response);
  }
});
await step('The binary built from this commit checks a pager\'s key, asks it a card sealed end to end, and gets the answer and acknowledges it, under its own AGENTPAGER_HOME; the phone\'s read holds nothing readable', async () => {
  const bin = binary(), home = mkdtempSync(path.join(tmpdir(), 'agentpager-smoke-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-smoke-card-'));
  const run = runIn(bin, home);
  const version = run('version').stdout;
  check(version.includes(sha.slice(0, 7)), `the binary is ${version.trim()}`);
  const pager = throwawayPager();
  const made = await phoneCall(pager.phone, '/api/pagers', { number: pager.number, publicKey: pager.publicKey, autoOff: '24h' });
  check(made.status === 200, `making a throwaway pager: ${made.status} ${await made.text()}`);
  let failure;
  try {
    // Only this stage has the pager, so connecting proves the binary reached this stage.
    const connected = run('connect', pager.number, '--server', origin, '--app', 'smoke', '--project', 'smoke', '--json');
    check(connected.status === 0 && said(connected).includes('Connected as agent'), `connect: exit ${connected.status}: ${said(connected)}`);
    const id = JSON.parse(connected.stdout).result.agent;
    const refused = run('connect', bogus, '--server', origin);
    check(refused.status === 2 && said(refused).includes('This pager number is not in use'), `bogus connect: exit ${refused.status}: ${said(refused)}`);
    check(readdirSync(path.join(home, 'agents')).filter(f => f.endsWith('.json')).length === 1, 'the refused connect saved an agent');
    // A card whose words are a marker, which the phone's read must not hold.
    const marker = `Smoke ${randomBytes(6).toString('hex')}?`;
    writeFileSync(path.join(work, 'card.yaml'), `title: "${marker}"\ndetail: "The smoke run's card, sealed to its own pager."\ncontext:\n  summary: "Nobody is paged: this pager has no alert target."\noptions:\n  - {label: Yes, title: "${marker} Yes", prioritizes: speed}\n  - {label: No, title: No, prioritizes: care}\nrecommendation: {option: A, why: It is a smoke run.}\n`);
    const asked = run('ask', '--agent', id, path.join(work, 'card.yaml'), '--json');
    check(asked.status === 0, `ask: exit ${asked.status}: ${said(asked)}`);
    const short = JSON.parse(asked.stdout).result.decision;
    const read = await phoneCall(pager.phone, `/api/pagers/${pager.pagerId}`), text = await read.text();
    check(read.status === 200, `the phone's read: ${read.status}`); candidate(read);
    check(!text.includes(marker) && !text.includes('smoke run'), 'the phone\'s read holds the card readable');
    const inbox = JSON.parse(text), agent = inbox.agents[0], d = agent?.open[0];
    check(inbox.agents.length === 1 && agent.open.length === 1, `the pager lists ${inbox.agents.length} agents and ${agent?.open.length} open decisions`);
    const identity = decodePart('identity', open(pager.privateKey, 'identity', { pagerId: pager.pagerId }, agent.agent.identity));
    check(identity.project === 'smoke', 'the identity doesn\'t open to its project');
    const card = decodePart('card', open(pager.privateKey, 'card', { pagerId: pager.pagerId, decisionId: d.decisionId }, d.card));
    check(card.title === marker, 'the card doesn\'t open to the question asked');
    // As the phone takes a card: only when it names the key its agent's identity names.
    check(card.answerKey === identity.answerKey, 'the card names another key than its agent\'s identity');
    // The phone answers, sealed to the key inside the card.
    const answer = seal(fromBase64url(card.answerKey), 'answer', { pagerId: pager.pagerId, decisionId: d.decisionId }, encodePart('answer', { choice: { kind: 'option', number: 1 } }));
    const sent = await phoneCall(pager.phone, `/api/agents/${agent.agent.agentId}/cards/${d.decisionId}/answer`, { requestId: randomBytes(24).toString('base64url'), answer });
    check(sent.status === 200, `answering: ${sent.status} ${await sent.text()}`);
    const waited = run('wait', '--agent', id, short, '--json');
    check(waited.status === 0 && JSON.parse(waited.stdout).result.option === 'A', `wait: exit ${waited.status}: ${said(waited)}`);
    const acked = run('ack', '--agent', id, short, 'Smoke run done.');
    check(acked.status === 0, `ack: exit ${acked.status}: ${said(acked)}`);
    const after = await (await phoneCall(pager.phone, `/api/pagers/${pager.pagerId}`)).json(), done = after.agents[0].answered[0];
    check(done?.status === 'acknowledged' && decodePart('acknowledgement', open(pager.privateKey, 'acknowledgement', { pagerId: pager.pagerId, decisionId: d.decisionId }, done.acknowledgement.acknowledgement)).nextSteps === 'Smoke run done.', 'the acknowledgement doesn\'t open to the agent\'s words');
  } catch (error) { failure = error; }
  // Deleting the pager deletes its agent with it.
  const deleted = await phoneCall(pager.phone, `/api/pagers/${pager.pagerId}/delete`, null);
  if (failure) throw failure;
  check(deleted.status === 200, `deleting the throwaway pager: ${deleted.status} ${await deleted.text()}`);
});

// The upgrade from the last release, on dev (and a local server), where the baseline is recorded (METHOD.md › The
// milestone loop, step 4); prod is checked at the release by opening a real thing from before it (step 7). It is
// baseline.mjs --verify, which reads the record back: the pager, on, with the key its number names; its one agent; the
// open decision, still open; the acknowledged one, with its answer, collection and acknowledgement and both
// attachments byte for byte, every part opened with the record's keys; and the release's own command reading its
// agent's status. It connects nothing to the baseline's pager, answers and acknowledges nothing, counts as no activity
// and writes nothing in the record's folder, so every smoke run can repeat it and the next release finds the baseline
// as recorded. The baseline is picked by name, the last release's (m5), and moved on here once the next release's is
// recorded (step 7). M5's checks against m4, which proved its release's exception, ended with M5; the m4 folder stays
// on disk as it was, and nothing reads it.
const upgrade = stage.name !== 'prod', tag = flag('--baseline-tag') ?? 'm5';
if (upgrade) await step(`The ${tag} upgrade baseline still opens, only read: its pager with its key and number, both decisions with their parts and attachments, the answer and acknowledgement, and the ${tag} command's status for its agent`, async () => {
  const args = ['--experimental-strip-types', 'scripts/baseline.mjs', '--stage', stage.name, ...(local ? ['--server', origin] : []), '--tag', tag, '--verify'];
  const r = spawnSync(process.execPath, args, { cwd: app, encoding: 'utf8', timeout: 240_000 });
  for (const line of (r.stdout ?? '').split('\n').filter(Boolean)) console.log(redact(`  ${line}`));
  check(r.status === 0, `baseline.mjs --verify: exit ${r.status ?? r.signal}${r.stderr?.trim() ? `: ${r.stderr.trim().slice(-400)}` : ''}`);
});
if (!local) await step('The deploy\'s own verification', async () => {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/deploy.mjs', '--stage', stage.name, '--verify'], { cwd: app, stdio: 'inherit', timeout: 240_000 });
  check(r.status === 0, `exit ${r.status}`);
});

const passed = results.filter(r => r.ok), failed = results.filter(r => !r.ok);
console.log(`Smoke ${stage.name}: ${passed.length} passed (${passed.filter(r => r.retried).length} on retry), ${failed.length} failed.`);
process.exit(failed.length ? 1 : 0);
