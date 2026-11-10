import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLOSED_AGENT_FINISHED, DECISION_CLOSED_MESSAGE } from '../../contract/exchange.ts';
import { keyPair, seal } from '../../contract/envelope.ts';
import { newKeys } from '../src/seal.ts';

// A decision that closed unanswered because its agent finished (M6, blueprint/milestones/M6-tidy.md, Sam's answers 2
// and 4): the command's words for it in wait, ack, status, history, finish and agents, from the replies the service
// will send (packages/contract/exchange.ts › Closed, DecisionClosed). The service doesn't send them yet, so a server of
// the test's own sends them here. The `m5` command and the `m5` schemas, from their tag, read the same replies: a wait,
// even one with no end, stops at the refusal and prints its words, and status and finish read as they did.
const cli = fileURLToPath(new URL('..', import.meta.url)), repo = path.resolve(cli, '../..');
const home = mkdtempSync(path.join(tmpdir(), 'agentpager-closed-'));
process.env.AGENTPAGER_HOME = home; delete process.env.AGENTPAGER_SERVER; delete process.env.AGENTPAGER_PAGER;
for (const v of ['CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_THREAD_ID', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT']) delete process.env[v];
const op = await import('../src/commands.ts');
const store = await import('../src/store.ts');

const pagerId = '0'.repeat(32), agentId = 'A'.repeat(32), finishedAt = '2026-11-07T18:00:00.000Z', askedAt = '2026-11-07T17:00:00.000Z';
const first = 'F'.repeat(32), second = 'S'.repeat(32), answered = 'N'.repeat(32), lost = 'L'.repeat(32);
const identity = seal(keyPair().publicKey, 'identity', { pagerId }, new Uint8Array(40));

// What the service will send for this agent: its decisions first and second closed when it finished, answered has its
// answer, and lost closed too but this machine never recorded asking it. reason: why they closed; record: whether a
// refusal carries its record.
const served: { reason: string; record: boolean; finishClosed?: string[] } = { reason: CLOSED_AGENT_FINISHED, record: true, finishClosed: [first, second, lost] };
const requests: string[] = [];
const closedOf = (id: string) => ({ decisionId: id, at: finishedAt, reason: served.reason });
function reply(req: IncomingMessage, res: ServerResponse) {
  const route = `${req.method} ${req.url}`;
  requests.push(route);
  const json = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const agent = { agentId, identity, createdAt: askedAt, finishedAt, lastActivityAt: finishedAt, openCount: 0 };
  const closed = new RegExp(`^GET /api/agents/${agentId}/cards/(${first}|${second})/answer`).exec(route);
  if (closed) return json(409, { error: 'DecisionClosed', message: DECISION_CLOSED_MESSAGE, ...(served.record ? { closed: { at: finishedAt, reason: served.reason } } : {}) });
  if (route === `GET /api/agents/${agentId}`) return json(200, { agent, pager: { on: true }, closed: [first, second, lost].map(closedOf) });
  if (route === `POST /api/agents/${agentId}/finish`) return json(200, { finishedAt, ...(served.finishClosed ? { closed: served.finishClosed.map(closedOf) } : {}) });
  json(404, { error: 'NotFound', message: 'No such route. Read /start.' });
}
const server = createServer(reply);
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(), origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
test.after(() => new Promise(resolve => server.close(resolve)));

// An agent with three decisions asked from this machine, as connect and ask write it.
function agent(id: string) {
  const own = newKeys();
  const decisions = {
    d_aaaa: { id: first, title: 'Ship tonight?', options: ['Ship', 'Wait'], askedAt },
    d_bbbb: { id: second, title: 'Tell Maya?', options: ['Now', 'Later'], askedAt },
    d_cccc: { id: answered, title: 'Keep the cache?', options: ['Keep', 'Drop'], askedAt, answered: true },
  };
  store.saveAgent({ id, server: origin, pager: pagerId, agentId, agentKey: 'K'.repeat(32), privateKey: own.privateKey, pagerKey: newKeys().publicKey, app: 'Codex', project: 'closed', createdAt: askedAt, rulesShownAt: askedAt, cardsSinceRules: 0, decisions });
  for (const [short, d] of Object.entries(decisions)) store.appendHistory(pagerId, { at: askedAt, event: 'asked', agent: id, app: 'Codex', project: 'closed', decision: short, title: d.title, options: d.options, recommended: 1 });
  store.appendHistory(pagerId, { at: askedAt, event: 'answered', agent: id, decision: 'd_cccc', choice: 1 });
  return id;
}
const closedEvents = (id: string) => store.readHistory(pagerId).filter(e => e.event === 'closed' && e.agent === id).map(e => [e.decision, e.at, e.reason]);
const marks = (id: string) => Object.entries(store.loadAgent(id)?.decisions ?? {}).filter(([, d]) => d.closed).map(([k]) => k);

// B32.11, the command's side: the service's refusal ends the wait (its own test, with the service's, comes with the line).
test('B32.11 a wait for a decision that closed unanswered ends, telling the agent so, and a wait with no end stops too', { timeout: 30_000 }, async () => {
  const id = agent('ap-wait');
  const words = (short: string, title: string) => `Closed unanswered. "${title}" (${short}) closed when agent ${id} finished, before your owner answered it, so no answer will come.\nDon't wait for it again. To ask about new work, connect again.`;
  const waited = await op.wait(id, 'd_aaaa', { seconds: 1 });
  assert.deepEqual(waited, { code: 2, text: words('d_aaaa', 'Ship tonight?'), json: { status: 'closed', reason: CLOSED_AGENT_FINISHED, closedAt: finishedAt } });
  const before = requests.length;
  const forever = await op.wait(id, 'd_bbbb', { forever: true });
  assert.deepEqual([forever.code, forever.text, requests.length - before], [2, words('d_bbbb', 'Tell Maya?'), 1], 'one read, then it stops');
  // A Claude Code agent's background wait ends the same way: nothing tells it to keep waiting.
  process.env.CLAUDECODE = '1';
  try { assert.equal((await op.wait(id, 'd_aaaa', { forever: true })).text, words('d_aaaa', 'Ship tonight?')); } finally { delete process.env.CLAUDECODE; }
  // Marked on this machine, and in the history once each, however often it is met.
  assert.deepEqual(marks(id), ['d_aaaa', 'd_bbbb']);
  assert.deepEqual(closedEvents(id), [['d_aaaa', finishedAt, CLOSED_AGENT_FINISHED], ['d_bbbb', finishedAt, CLOSED_AGENT_FINISHED]]);
  // There is nothing to acknowledge either.
  const acked = await op.ack(id, 'd_aaaa', 'Shipping it.');
  assert.deepEqual([acked.code, acked.text], [2, `Closed unanswered. "Ship tonight?" (d_aaaa) closed when agent ${id} finished, before your owner answered it, so no answer will come.\nThere is no answer to acknowledge. To ask about new work, connect again.`]);
  assert.ok(!requests.some(r => r.includes('/acknowledge')), 'nothing was sent to acknowledge');
});

test('status, history and agents show what closed unanswered, apart from what is open', async () => {
  const id = agent('ap-stat');
  const status = await op.status(id);
  // lost was never recorded here, so it is named by the service's id.
  assert.deepEqual([status.code, status.text], [0, [
    `Agent ${id} · Codex · closed`, 'Pager: on', 'Open decisions: 0', 'Answered, not yet acknowledged: d_cccc', `Closed unanswered when this agent finished: d_aaaa, d_bbbb, ${lost}`,
  ].join('\n')]);
  assert.deepEqual(status.json, { agent: id, pagerOn: true, open: 0, waiting: [], unacknowledged: ['d_cccc'], closed: ['d_aaaa', 'd_bbbb', lost] });
  assert.deepEqual(marks(id), ['d_aaaa', 'd_bbbb']);
  assert.deepEqual(closedEvents(id).map(([d]) => d), ['d_aaaa', 'd_bbbb'], 'only what this machine asked is in its history');
  const history = op.history(id).text.split('\n');
  for (const [title, outcome] of [['Ship tonight?', 'Options: Ship / Wait → closed unanswered when its agent finished'], ['Tell Maya?', 'Options: Now / Later → closed unanswered when its agent finished'], ['Keep the cache?', 'Options: Keep / Drop → option A "Keep"']]) {
    assert.equal(history[history.indexOf(`  ${title}`) + 1], `  ${outcome}`, title);
  }
  assert.ok(op.agents().text.split('\n').some(row => row.startsWith(`${id}  pager 00000000  closed · Codex`) && row.endsWith(' 0 open')), op.agents().text);
});

test('finish says how many open decisions it closed, when the service says', async () => {
  const head = (id: string) => `Finished. Your owner's phone shows ${id} as finished; it asks nothing more. Its decisions stay on the phone.`;
  const two = agent('ap-fin2');
  served.finishClosed = [first, second];
  assert.deepEqual(await op.finish(two), { code: 0, text: `${head(two)}\nFinishing closed its 2 open decisions unanswered: d_aaaa, d_bbbb. Your owner can't answer them now, and a wait for them ends.`, json: { closed: ['d_aaaa', 'd_bbbb'] } });
  assert.deepEqual(closedEvents(two).map(([d]) => d), ['d_aaaa', 'd_bbbb']);
  // Finishing again names the same ones, and records nothing twice.
  assert.equal((await op.finish(two)).code, 0);
  assert.deepEqual(closedEvents(two).map(([d]) => d), ['d_aaaa', 'd_bbbb']);
  const one = agent('ap-fin1');
  served.finishClosed = [first];
  assert.equal((await op.finish(one)).text, `${head(one)}\nFinishing closed its open decision unanswered: d_aaaa. Your owner can't answer it now, and a wait for it ends.`);
  served.finishClosed = [];
  assert.deepEqual(await op.finish(agent('ap-fin0')), { code: 0, text: `${head('ap-fin0')}\nIt had no open decisions to close.`, json: { closed: [] } });
  // A service from before it says nothing of them, and neither does the command.
  served.finishClosed = undefined;
  assert.deepEqual(await op.finish(agent('ap-finm')), { code: 0, text: head('ap-finm'), json: undefined });
  served.finishClosed = [first, second, lost];
});

test('a reason the command doesn\'t know still closes the decision, without saying why; a refusal without its record keeps the service\'s words', async () => {
  const id = agent('ap-whys');
  served.reason = 'agentForgotten';
  try {
    // ap-wait's d_aaaa closed when its agent finished; this agent's d_aaaa, the same short id, closed for another reason,
    // and each agent's history shows its own.
    const waited = await op.wait(id, 'd_aaaa', { forever: true });
    assert.deepEqual([waited.code, waited.text], [2, 'Closed unanswered. "Ship tonight?" (d_aaaa) closed, before your owner answered it, so no answer will come.\nDon\'t wait for it again.']);
    assert.equal((await op.status(id)).text.split('\n').at(-1), `Closed unanswered: d_aaaa, d_bbbb, ${lost}`);
    assert.ok(op.history(id).text.includes('Options: Ship / Wait → closed unanswered\n'), op.history(id).text);
  } finally { served.reason = CLOSED_AGENT_FINISHED; }
  served.record = false;
  try { assert.deepEqual(await op.wait(agent('ap-bare'), 'd_aaaa', { forever: true }), { code: 2, text: DECISION_CLOSED_MESSAGE }); } finally { served.record = true; }
  assert.deepEqual(marks('ap-bare'), [], 'nothing marked from a refusal it can\'t read');
});

// The `m5` release's command and contract, from the tag: a clone sharing this repository's objects, with its packages
// installed offline. Kept in the system's temp folder by the tag's commit, and made again only if it isn't ready.
function m5() {
  const commit = execFileSync('git', ['rev-parse', '--verify', 'm5^{commit}'], { cwd: repo, encoding: 'utf8' }).trim();
  const dir = path.join(tmpdir(), `agentpager-m5-clients-${commit}`), ready = path.join(dir, '.agentpager-ready');
  if (!existsSync(ready)) {
    if (existsSync(dir)) throw new Error(`${dir} is a clone left half made; move it to the Trash and run again.`);
    execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', repo, dir]);
    execFileSync('git', ['-C', dir, 'checkout', '-q', '--detach', commit]);
    execFileSync('pnpm', ['install', '--offline', '--frozen-lockfile'], { cwd: dir, stdio: 'ignore', timeout: 120_000 });
    writeFileSync(ready, commit);
  }
  // The m5 contract with the Schema it was built with, so this test decodes with that release's own.
  writeFileSync(path.join(dir, 'packages/contract/m5-reader.ts'), 'export { Schema } from "effect";\nexport * from "./exchange.ts";\n');
  return dir;
}
// The `m5` command from source, as its tests run it; it never runs longer than limitMs.
function m5Command(dir: string, args: string[], limitMs = 20_000): Promise<{ code: number | null; out: string }> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--experimental-strip-types', path.join(dir, 'packages/cli/src/main.ts'), ...args], { cwd: home, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AGENTPAGER_HOME: home } });
    let out = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { out += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), limitMs);
    child.on('close', code => { clearTimeout(timer); resolve({ code, out }); });
  });
}

test('the m5 command reads every new reply: its wait with no end stops at the refusal, in the service\'s words', { timeout: 180_000 }, async () => {
  const dir = m5();
  const id = agent('ap-mfiv');
  const waited = await m5Command(dir, ['wait', '--agent', id, 'd_aaaa', '--forever']);
  assert.deepEqual(waited, { code: 2, out: DECISION_CLOSED_MESSAGE + '\n' });
  const status = await m5Command(dir, ['status', '--agent', id]);
  assert.deepEqual(status, { code: 0, out: [`Agent ${id} · Codex · closed`, 'Pager: on', 'Open decisions: 0 (d_aaaa, d_bbbb)', 'Answered, not yet acknowledged: d_cccc', ''].join('\n') });
  const finished = await m5Command(dir, ['finish', '--agent', id]);
  assert.deepEqual(finished, { code: 0, out: `Finished. Your owner's phone shows ${id} as finished; it asks nothing more. Its decisions stay on the phone.\n` });
  // An agent file this command marked loads in the m5 command, which keeps the marks when it writes the file.
  await op.status(id);
  assert.equal((await m5Command(dir, ['rules', '--agent', id])).code, 0);
  assert.deepEqual(marks(id), ['d_aaaa', 'd_bbbb']);
  assert.match(readFileSync(path.join(home, 'agents', `${id}.json`), 'utf8'), /"closed": true/);
});

test('the m5 contract decodes every reply with the new fields', { timeout: 180_000 }, async () => {
  const dir = m5();
  const old = await import(pathToFileURL(path.join(dir, 'packages/contract/m5-reader.ts')).href), { Schema } = old;
  const closed = { at: finishedAt, reason: CLOSED_AGENT_FINISHED }, listed = [{ decisionId: first, ...closed }];
  const agentShape = { agentId, identity, createdAt: askedAt, finishedAt, lastActivityAt: finishedAt, openCount: 0 };
  const decision = { decisionId: first, status: 'open', card: seal(keyPair().publicKey, 'card', { pagerId, decisionId: first }, new Uint8Array(10)), attachments: [], askedAt, closed };
  const inbox = { pager: { pagerId, on: true, autoOff: 'never', offAt: null, offSince: null, createdAt: askedAt }, agents: [{ agent: agentShape, open: [decision], answered: [] }] };
  const read = Schema.decodeUnknownSync(old.PagerInbox)(inbox);
  assert.equal(read.agents[0].open[0].status, 'open', 'an m5 reader sees it as open');
  assert.equal('closed' in read.agents[0].open[0], false, 'and drops what it doesn\'t know');
  assert.deepEqual(Schema.decodeUnknownSync(old.AgentStatus)({ agent: agentShape, pager: { on: true }, closed: listed }), { agent: agentShape, pager: { on: true } });
  assert.deepEqual(Schema.decodeUnknownSync(old.Finished)({ finishedAt, closed: listed }), { finishedAt });
  // The m5 command takes a refusal by its tag and words alone, whatever its tag.
  assert.equal(Object.hasOwn(old.REFUSAL_STATUS, 'DecisionClosed'), false);
});
