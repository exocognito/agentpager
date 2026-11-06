import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Schema } from 'effect';
import pngjs from 'pngjs';
import { AGENT_IDLE_MS, CLIENT_HEADER, PagerInbox, clientVersion } from '../src/contract.ts';
import { RELEASE_TAG, stageOf } from './stages.ts';

// The upgrade baseline (METHOD.md › The milestone loop, step 7): what a release stored on a stage, kept so the next
// milestone's smoke run can check what its upgrade does to it (step 4).
//
//   node scripts/baseline.mjs --stage dev|prod [--binary <path>] [--tag <name>]    records one (pnpm baseline:dev)
//   node scripts/baseline.mjs --stage dev|prod --tag <name> --verify               reads one back, changing nothing
//   --stage local --server <url>                                                   either, against a local server
//
// It makes a pager as the phone does, with no alert target and auto-off never, so it pages no one. The agentpager
// binary (--binary, else one built from this checkout) connects to it under its own AGENTPAGER_HOME and asks two
// cards; the phone answers the first and the binary collects and acknowledges it; the second stays open. It then reads
// the pager back over the phone's API. It never reads or writes ~/.agentpager, prints no number or key, and never
// overwrites a record. On dev and prod the tag must be a release tag (m4, m4.1) and the binary that tag's build. If a
// step fails, it deletes the pager it made and leaves the folder, marked failed, for the owner to move to the Trash.
//
// The record: ~/.agentpager-baselines/<stage>/<tag>/ (AGENTPAGER_BASELINES moves ~/.agentpager-baselines; it is
// refused inside ~/.agentpager or a git work tree). Folders are mode 700, files 600, the binary 700.
//   record.json   the record (format 1, below). Its keys are secrets (I23): never print, log or commit them.
//   agentpager    a copy of the binary that made it, so a later check runs the old command without rebuilding it
//   home/         that binary's AGENTPAGER_HOME: agents/<id>.json holds its agent's key, history/ its decisions
//   cards/        the two card.yaml files and the attachment, as sent
// record.json, with paths relative to its folder:
//   { format: 1, state: 'recording' | 'recorded' | 'failed' (only 'recorded' is a baseline; 'failed' had its pager deleted),
//     stage: 'dev', server: 'https://dev.agentpager.me', tag: 'm4',
//     binaryVersion: '9849671' (what `agentpager version` reports), serverBuild: the X-AgentPager-Build that made the pager,
//     recordedWith: this checkout's commit, recordedAt: ISO time,
//     pager: { pagerId, number, publicKey, privateKey, phoneKey, autoOff: 'never' }: publicKey and privateKey are the
//       X25519 pair's raw 32 bytes in base64url (JWK x and d), as the phone keeps them; phoneKey goes in x-phone-key,
//     agent: { id: the binary's short id (ap-xxxx), agentId: the service's }, home: 'home', binary: 'agentpager',
//     decisions: {
//       acknowledged: { id: 'd_xxxx', decisionId, title, answerId, option: 1, nextSteps,
//         attachments: [{ name, type, bytes, sha256 }] (a PNG, and the Markdown page context.more makes) },
//       open: { id: 'd_xxxx', decisionId, title, attachments: [] } } }
// The service forgets an agent idle for 30 days (blueprint/areas/1-pagers.md), and with it these decisions: a check
// must run within 30 days of recordedAt. --verify is no activity, so it doesn't extend that.
const argv = process.argv, flag = name => { const at = argv.indexOf(name); return at === -1 ? undefined : argv[at + 1]; };
const verifying = argv.includes('--verify'), local = flag('--stage') === 'local';
const app = fileURLToPath(new URL('..', import.meta.url)), cli = path.join(app, '../cli');
const git = (...args) => execFileSync('git', args, { cwd: app, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

// Every line out passes through redact: the keys this run knows, any pager number, and any token-length string,
// which is what agent keys, phone keys and pager keys are.
const secrets = new Set();
const redact = text => {
  let out = String(text);
  for (const s of secrets) out = out.split(s).join('[redacted]');
  return out.replace(/ap1_[A-Za-z0-9_-]*/g, 'ap1_[redacted]').replace(/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/g, '[redacted]');
};
const say = line => console.log(redact(line));
class Refused extends Error {}
const check = (ok, message) => { if (!ok) throw new Refused(message); };
function fail(error) {
  say(`FAILED ${error instanceof Refused ? error.message : error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
  process.exit(1);
}

// What to record, where, and with which tag; refused before anything is made.
let stage, origin, sha, tag, tagCommit, root, dir, recordFile;
try {
  stage = local ? { name: 'local' } : stageOf(argv);
  origin = local ? (flag('--server') ?? '').replace(/\/+$/, '') : `https://${stage.host}`;
  check(!local || /^https?:\/\/[^\s/]+$/.test(origin), 'A local baseline names its server: --stage local --server http://127.0.0.1:8787.');
  sha = git('rev-parse', 'HEAD');
  tag = flag('--tag') ?? git('tag', '--points-at', 'HEAD').split('\n').find(t => RELEASE_TAG.test(t));
  check(tag && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tag), 'Name the release: --tag m<n>, or check out its tag.');
  try { tagCommit = git('rev-parse', '--verify', '--quiet', `${tag}^{commit}`); } catch { tagCommit = null; }
  check(local || (RELEASE_TAG.test(tag) && tagCommit), `A ${stage.name} baseline is a release's: ${tag} isn't a release tag (m<n>, m<n>.<k>) in this repository.`);
  root = path.resolve(process.env.AGENTPAGER_BASELINES || path.join(homedir(), '.agentpager-baselines'));
  const real = path.join(homedir(), '.agentpager');
  check(root !== real && !root.startsWith(real + path.sep), `The baselines can't live in ${real}, which the owner's real agents use.`);
  let at = root; while (!existsSync(at)) at = path.dirname(at);
  check(spawnSync('git', ['-C', at, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' }).status !== 0, `The baselines can't live in a git work tree, where their keys could be committed: ${root}.`);
  dir = path.join(root, stage.name, tag); recordFile = path.join(dir, 'record.json');
} catch (error) { fail(error); }

// The binary runs under the baseline's own AGENTPAGER_HOME and nothing else of AGENTPAGER_*.
const env = home => ({ ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('AGENTPAGER_'))), AGENTPAGER_HOME: home });
function command(binary, home, args, extra = {}) {
  const r = spawnSync(binary, [...args, '--json'], { cwd: path.dirname(binary), env: { ...env(home), ...extra }, encoding: 'utf8', timeout: 90_000 });
  let reply = null;
  try { reply = JSON.parse(r.stdout); } catch { /* not the binary's JSON */ }
  check(r.status === 0 && reply?.code === 0, `agentpager ${args[0]}: exit ${r.status ?? r.signal}: ${(reply?.text ?? `${r.stdout ?? ''}${r.stderr ?? ''}`).trim().slice(0, 400)}`);
  return reply;
}
const versionOf = (binary, home) => command(binary, home, ['version']).text.replace(/^agentpager /, '').trim();

// It plays the phone, and names itself as every client of the API does (CLIENT_HEADER).
async function phone(record, route, data) {
  const response = await fetch(record.server + route, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'x-phone-key': record.pager.phoneKey, [CLIENT_HEADER]: clientVersion('baseline', sha.slice(0, 7)), ...(data === undefined || data === null ? {} : { 'content-type': 'application/json' }) },
    body: data === undefined || data === null ? undefined : JSON.stringify(data),
  });
  return response;
}
async function ok(response, what) {
  if (response.status !== 200) throw new Refused(`${what}: ${response.status} ${(await response.text()).slice(0, 400)}`);
  return response;
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function save(record) {
  const temp = `${recordFile}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
  chmodSync(temp, 0o600); renameSync(temp, recordFile);
}
const agentFile = record => JSON.parse(readFileSync(path.join(dir, record.home, 'agents', `${record.agent.id}.json`), 'utf8'));

// What the record says is on the stage, read as the phone reads it and by the binary that made it. Reads only.
async function readBack(record) {
  const lines = [];
  const inbox = Schema.decodeUnknownSync(PagerInbox)(await (await ok(await phone(record, `/api/pagers/${record.pager.pagerId}`), 'reading the pager')).json());
  check(inbox.pager.pagerId === record.pager.pagerId && inbox.pager.on && inbox.pager.autoOff === 'never', `the pager reads back ${inbox.pager.on ? 'on' : 'off'}, auto-off ${inbox.pager.autoOff}`);
  lines.push('the pager is on, auto-off never');
  check(inbox.agents.length === 1 && inbox.agents[0].agent.agentId === record.agent.agentId && !inbox.agents[0].agent.finishedAt, `the pager lists ${inbox.agents.length} agents, not its one agent`);
  const { agent, open, answered } = inbox.agents[0], { acknowledged, open: waiting } = record.decisions;
  lines.push(`one agent (${record.agent.id}), last active ${agent.lastActivityAt}`);
  check(open.length === 1 && open[0].decisionId === waiting.decisionId && open[0].status === 'open', `${open.length} open decisions, not ${waiting.id}`);
  lines.push(`one open decision (${waiting.id})`);
  const d = answered[0];
  check(answered.length === 1 && d && d.decisionId === acknowledged.decisionId && d.status === 'acknowledged' && d.answer?.answerId === acknowledged.answerId
    && d.answer.choice.kind === 'option' && d.answer.choice.number === acknowledged.option && d.collectedAt && d.acknowledgement?.nextSteps === acknowledged.nextSteps,
  `${answered.length} answered decisions, not ${acknowledged.id} answered, collected and acknowledged`);
  lines.push(`one acknowledged decision (${acknowledged.id}), its answer collected`);
  const listed = (d.attachments ?? []).map(a => `${a.name} ${a.type} ${a.bytes}`).sort().join(', ');
  check(listed === acknowledged.attachments.map(a => `${a.name} ${a.type} ${a.bytes}`).sort().join(', '), `its attachments read back as ${listed || 'none'}`);
  for (const a of acknowledged.attachments) {
    const file = await ok(await phone(record, `/api/agents/${record.agent.agentId}/cards/${acknowledged.decisionId}/files/${encodeURIComponent(a.name)}`), `fetching ${a.name}`);
    check(digest(Buffer.from(await file.arrayBuffer())) === a.sha256, `${a.name} came back changed`);
  }
  lines.push(`its attachments fetch unchanged (${acknowledged.attachments.map(a => a.name).join(', ')})`);
  const status = command(path.join(dir, record.binary), path.join(dir, record.home), ['status', '--agent', record.agent.id]).result;
  check(status.pagerOn && status.open === 1 && status.waiting.join() === waiting.id && status.unacknowledged.length === 0, `agentpager status: pager ${status.pagerOn ? 'on' : 'off'}, ${status.open} open`);
  lines.push(`the agentpager ${record.binaryVersion} copy reads its agent's status: pager on, ${waiting.id} open`);
  lines.push(`the agent is forgotten if idle until ${new Date(Date.parse(agent.lastActivityAt) + AGENT_IDLE_MS).toISOString()}`);
  return lines;
}

// The cards the binary asks. The first carries a PNG and, from context.more, a Markdown page.
const ANSWERED = `title: "Baseline: the decision that is answered"
detail: "Made by baseline.mjs so the next release's upgrade check has an acknowledged decision. Nobody is paged."
context:
  heading: an upgrade baseline
  summary: |
    packages/app/scripts/baseline.mjs made this pager and its agent with the agentpager
    command from ${tag}. The pager has no alert target, so nobody is paged.
  more:
    title: What the baseline is for
    body: |
      The next release's smoke run reads this pager after it deploys, to check what the
      upgrade did to what this release stored.
options:
  - label: Keep it
    title: Keep the baseline
    prioritizes: a record the upgrade check can use
    looks_like: baseline.png
  - label: Drop it
    title: Drop the baseline
    prioritizes: nothing left on the stage
recommendation:
  option: A
  why: The upgrade check needs it.
attachments: [baseline.png]
`;
const OPEN = `title: "Baseline: the decision that stays open"
detail: "Left open on purpose, so the next release's upgrade check has an open decision too."
context:
  summary: |
    Nobody answers this one: the baseline keeps it open.
options:
  - label: First
    title: The first option
    prioritizes: nothing, since it stays open
  - label: Second
    title: The second option
    prioritizes: nothing, since it stays open
recommendation:
  option: A
  why: Either; it stays open.
`;
function image() {
  const png = new pngjs.PNG({ width: 16, height: 16 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([0x2f, 0x6f, 0xeb, 0xff], i);
  return pngjs.PNG.sync.write(png);
}

async function record() {
  check(!existsSync(dir), `${dir} exists: a record is never overwritten. Read it back with --verify.`);
  const given = flag('--binary');
  let source;
  if (given) source = path.resolve(process.env.INIT_CWD || process.cwd(), given);
  else { execFileSync('sh', ['scripts/build.sh'], { cwd: cli, stdio: 'ignore', timeout: 120_000 }); source = path.join(cli, 'dist/agentpager'); }
  check(existsSync(source), `No binary at ${source}.`);
  // `version` reads no AGENTPAGER_HOME; this one doesn't exist.
  const binaryVersion = versionOf(source, path.join(root, '.no-home'));
  check(binaryVersion.length >= 7 && (local || tagCommit.startsWith(binaryVersion)), `The binary is ${binaryVersion}, not ${tag} (${tagCommit?.slice(0, 7)}).`);

  for (const d of [root, path.join(root, stage.name)]) { mkdirSync(d, { recursive: true, mode: 0o700 }); chmodSync(d, 0o700); }
  mkdirSync(dir, { mode: 0o700 });
  const binary = path.join(dir, 'agentpager'), home = path.join(dir, 'home'), cards = path.join(dir, 'cards');
  copyFileSync(source, binary); chmodSync(binary, 0o700);
  mkdirSync(home, { mode: 0o700 }); mkdirSync(cards, { mode: 0o700 });
  check(versionOf(binary, home) === binaryVersion, 'The copied binary reports another version.');

  // As the phone makes a pager (test/support.ts pagerKeys): an X25519 pair, a 16-byte id, and the number naming both.
  const jwk = generateKeyPairSync('x25519').privateKey.export({ format: 'jwk' });
  const id = randomBytes(16), fingerprint = createHash('sha256').update(Buffer.from(jwk.x, 'base64url')).digest().subarray(0, 8);
  const pager = { pagerId: id.toString('hex'), number: 'ap1_' + Buffer.concat([id, fingerprint]).toString('base64url'), publicKey: jwk.x, privateKey: jwk.d, phoneKey: randomBytes(24).toString('base64url'), autoOff: 'never' };
  for (const s of [pager.number, pager.publicKey, pager.privateKey, pager.phoneKey]) secrets.add(s);
  const r = { format: 1, state: 'recording', stage: stage.name, server: origin, tag, binaryVersion, serverBuild: null, recordedWith: sha, recordedAt: null, pager, agent: null, home: 'home', binary: 'agentpager', decisions: null };
  // Saved before the pager exists, so a run that dies still leaves the keys that delete it.
  save(r);
  say(`Baseline ${stage.name} ${tag} at ${origin}: agentpager ${binaryVersion}, into ${dir}`);
  try {
    const made = await ok(await phone(r, '/api/pagers', { number: pager.number, publicKey: pager.publicKey, autoOff: 'never' }), 'making the pager');
    r.serverBuild = made.headers.get('x-agentpager-build'); save(r);
    say(`ok made a pager as the phone does, with no alert target and auto-off never, on build ${r.serverBuild?.slice(0, 7)}`);

    const connected = command(binary, home, ['connect', '--server', origin, '--app', 'baseline', '--project', `${tag} baseline`], { AGENTPAGER_PAGER: pager.number });
    const file = JSON.parse(readFileSync(path.join(home, 'agents', `${connected.result.agent}.json`), 'utf8'));
    secrets.add(file.agentKey);
    r.agent = { id: connected.result.agent, agentId: file.agentId }; save(r);
    say(`ok agentpager ${binaryVersion} connected as ${r.agent.id} under its own AGENTPAGER_HOME`);

    const png = image();
    writeFileSync(path.join(cards, 'answered.yaml'), ANSWERED, { mode: 0o600 });
    writeFileSync(path.join(cards, 'open.yaml'), OPEN, { mode: 0o600 });
    writeFileSync(path.join(cards, 'baseline.png'), png, { mode: 0o600 });
    const first = command(binary, home, ['ask', '--agent', r.agent.id, path.join(cards, 'answered.yaml')]).result.decision;
    const second = command(binary, home, ['ask', '--agent', r.agent.id, path.join(cards, 'open.yaml')]).result.decision;
    const asked = agentFile(r).decisions;
    check(asked[first] && asked[second], 'the binary did not record both decisions');
    say(`ok it asked ${first}, with a PNG and a page, and ${second}`);

    // The phone answers the first with option A, as it would after reading it.
    const inbox = Schema.decodeUnknownSync(PagerInbox)(await (await ok(await phone(r, `/api/pagers/${pager.pagerId}`), 'reading the pager')).json());
    const shown = inbox.agents.find(a => a.agent.agentId === r.agent.agentId)?.open.find(d => d.decisionId === asked[first].id);
    check(shown, `the phone doesn't see ${first}`);
    const receipt = await (await ok(await phone(r, `/api/agents/${r.agent.agentId}/cards/${shown.decisionId}/answer`, { requestId: randomBytes(24).toString('base64url'), choice: { kind: 'option', number: 1 } }), 'answering')).json();
    say(`ok the phone answered ${first} with option A`);
    const waited = command(binary, home, ['wait', '--agent', r.agent.id, first]).result;
    check(waited.status === 'answered' && waited.option === 'A', `agentpager wait: ${waited.status} ${waited.option ?? ''}`);
    const nextSteps = 'Baseline recorded. Nothing more to do.';
    command(binary, home, ['ack', '--agent', r.agent.id, first, nextSteps]);
    say(`ok the binary collected the answer and acknowledged ${first}; ${second} stays open`);

    const attachments = (shown.attachments ?? []).map(a => ({ ...a, sha256: null }));
    const page = attachments.find(a => a.type === 'text/markdown');
    check(attachments.some(a => a.name === 'baseline.png' && a.type === 'image/png') && page, `${first} carries ${attachments.map(a => a.name).join(', ') || 'nothing'}, not a PNG and a page`);
    for (const a of attachments) {
      a.sha256 = a.name === 'baseline.png' ? digest(png) : digest(Buffer.from(await (await ok(await phone(r, `/api/agents/${r.agent.agentId}/cards/${shown.decisionId}/files/${encodeURIComponent(a.name)}`), `fetching ${a.name}`)).arrayBuffer()));
    }
    r.decisions = {
      acknowledged: { id: first, decisionId: asked[first].id, title: asked[first].title, answerId: receipt.answerId, option: 1, nextSteps, attachments },
      open: { id: second, decisionId: asked[second].id, title: asked[second].title, attachments: [] },
    };
    save(r);
    for (const line of await readBack(r)) say(`ok read back: ${line}`);
    r.state = 'recorded'; r.recordedAt = new Date().toISOString(); save(r);
    say(`Recorded the ${tag} baseline on ${stage.name} in ${dir}. Read it back with: node scripts/baseline.mjs --stage ${stage.name}${local ? ` --server ${origin}` : ''} --tag ${tag} --verify`);
  } catch (error) {
    // Nothing half-made stays on the stage: deleting the pager deletes its agent and decisions.
    let deleted = false;
    try { deleted = (await phone(r, `/api/pagers/${pager.pagerId}/delete`, null)).status === 200; } catch { /* reported below */ }
    r.state = 'failed'; save(r);
    say(deleted ? `The pager it made is deleted. Move ${dir} to the Trash before recording ${tag} again.`
      : `The pager it made may still be on ${stage.name}, and couldn't be deleted: its keys are in ${recordFile}.`);
    throw error;
  }
}

async function verify() {
  check(existsSync(recordFile), `No baseline at ${dir}.`);
  const r = JSON.parse(readFileSync(recordFile, 'utf8'));
  for (const s of [r.pager.number, r.pager.publicKey, r.pager.privateKey, r.pager.phoneKey]) secrets.add(s);
  check(r.format === 1 && r.state === 'recorded' && r.stage === stage.name && r.server === origin && r.tag === tag, `${recordFile} is ${r.state}, for ${r.stage} ${r.tag}, not a recorded baseline for ${stage.name} ${tag}.`);
  secrets.add(agentFile(r).agentKey);
  say(`Baseline ${stage.name} ${tag}, recorded ${r.recordedAt} with agentpager ${r.binaryVersion}, read back at ${new Date().toISOString()}`);
  for (const line of await readBack(r)) say(`ok ${line}`);
}

try { await (verifying ? verify() : record()); } catch (error) { fail(error); }
