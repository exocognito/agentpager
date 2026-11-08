import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Schema } from 'effect';
import pngjs from 'pngjs';
import { fixture, release, assert, C, token, until, app, question, asQuestion, asClient, pause } from './support.ts';
import { fromBase64url, open, seal } from '../../contract/envelope.ts';
import { decodePart, encodePart } from '../../contract/parts.ts';

// The move to one store per pager (M6, blueprint/milestones/M6-tidy.md, Sam's answer 1), from what M5's own service
// stored: m5's service, from its tag, makes every kind of state dev and prod can hold today on fresh local storage,
// with the upgrade baseline recorded by baseline.mjs and m5's command; then this code's service starts on the same
// storage. Every pager reads back the same, the baseline passes every check `--verify` makes, and on the moved data
// the phone answers the baseline's open decision and m5's command collects and acknowledges it.
//
// Some states take M5's clocks days to reach, or a deploy landing between two steps. Those are made below the
// service, on the stopped storage (each `surgery`): a pager deleted while its agents were still to forget, one of them
// still as m4 stored it; an agent forgotten while its pager still listed it, and one its pager stopped listing before
// it forgot itself; an agent whose 30 idle days are up; an answer whose warning is due; and an old agent's own alarm
// coming due. The local scheduler keeps each object's alarm in its namespace's metadata.sqlite (_cf_ALARM) and in the
// object's own file (_cf_METADATA, key 1), in nanoseconds.

type Db = InstanceType<typeof DatabaseSync>;
const files = (dir: string): string[] => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? files(p) : [p]; });
const stores = (persist: string, kind: 'Agent' | 'Registry' | 'Pager') => files(path.join(persist, 'v3', 'do', `ownerpager-${kind}`)).filter(f => f.endsWith('.sqlite') && !f.endsWith('metadata.sqlite'));
function db<A>(file: string, run: (db: Db) => A): A { const d = new DatabaseSync(file); try { return run(d); } finally { d.close(); } }
// Whether an object wrote any table of its own: one that was asked about a pager that doesn't exist didn't.
const wrote = (persist: string, kind: 'Agent' | 'Pager', name: string) => stores(persist, kind).some(f => db(f, d => table(d, '__miniflare_do_name') && d.prepare('SELECT name FROM __miniflare_do_name').get()?.name === name
  && d.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\_%' ESCAPE '\\'").get()?.n !== 0));
const registryOf = (persist: string) => { const [file] = stores(persist, 'Registry'); assert.ok(file, 'the Registry'); return file; };
const table = (d: Db, name: string) => d.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name) !== undefined;
// An object's file, by the name the service gave it: an agent's id or a pager's. An object that deleted everything
// deleted its name too, so an agent's file is found before anything is erased.
const named = (persist: string, kind: 'Agent' | 'Pager', name: string) => {
  const file = stores(persist, kind).find(f => db(f, d => table(d, '__miniflare_do_name') && d.prepare('SELECT name FROM __miniflare_do_name').get()?.name === name));
  assert.ok(file, `the ${kind} store named ${name.slice(0, 6)}…`);
  return file;
};
// Rows as plain objects, so they compare with what a test writes.
const rows = (file: string, query: string, ...values: (string | number)[]) => db(file, d => d.prepare(query).all(...values).map(r => ({ ...r })));
// An object's alarm, set as the scheduler keeps it.
function alarmAt(persist: string, kind: 'Agent', file: string, ms: number) {
  const ns = BigInt(ms) * 1_000_000n, actor = path.basename(file, '.sqlite');
  db(file, d => d.prepare('INSERT INTO _cf_METADATA (key, value) VALUES (1, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(ns));
  const changed = db(path.join(persist, 'v3', 'do', `ownerpager-${kind}`, 'metadata.sqlite'), d => d.prepare('UPDATE _cf_ALARM SET scheduled_time=? WHERE actor_id=?').run(ns, actor).changes);
  assert.equal(Number(changed), 1, 'the scheduler had the object\'s alarm');
}
// An object's alarm, if it has one, in nanoseconds, which only a BigInt holds.
const alarmOf = (persist: string, kind: 'Agent' | 'Pager', file: string) => db(path.join(persist, 'v3', 'do', `ownerpager-${kind}`, 'metadata.sqlite'), d => {
  const q = d.prepare('SELECT scheduled_time FROM _cf_ALARM WHERE actor_id=?');
  q.setReadBigInts(true);
  const r = q.get(path.basename(file, '.sqlite'));
  return r ? { ...r } : undefined;
});
// The agent M5 stored, as its agent_v3 row holds it.
const Meta = Schema.Struct({ agentId: Schema.String, pagerId: Schema.String, lastActivityAt: Schema.String }, { key: Schema.String, value: Schema.Unknown });
const metaOf = (file: string) => db(file, d => {
  if (!table(d, 'agent_v3')) return null;
  const raw = d.prepare('SELECT json FROM agent_v3 WHERE id=1').get()?.json;
  return typeof raw === 'string' ? Schema.decodeUnknownSync(Meta)(JSON.parse(raw)) : null;
});
const setMeta = (file: string, change: (m: typeof Meta.Type) => typeof Meta.Type) => db(file, d => {
  const raw = d.prepare('SELECT json FROM agent_v3 WHERE id=1').get()?.json;
  assert.equal(typeof raw, 'string');
  d.prepare('UPDATE agent_v3 SET json=? WHERE id=1').run(JSON.stringify(change(Schema.decodeUnknownSync(Meta)(JSON.parse(String(raw))))));
});
const holds = (persist: string, marker: string) => files(persist).some(f => readFileSync(f).includes(Buffer.from(marker)));
const ErrorTag = Schema.Struct({ error: Schema.String });
const tagOf = (value: unknown) => Schema.is(ErrorTag)(value) ? value.error : undefined;
const DAY = 24 * 3_600_000;
// An image that doesn't compress: 400 by 400 random pixels, about 640 KB.
function noise() { const png = new pngjs.PNG({ width: 400, height: 400 }); randomBytes(png.data.length).copy(png.data); return pngjs.PNG.sync.write(png); }
// A brief carrying three such images, about 1.9 MB of attachments, near the 3 MB a decision may carry.
const heavyQuestion = (title: string) => {
  const q = question(title), names = ['one', 'two', 'three'];
  return asQuestion({ ...q, card: { ...q.card, markdown: q.card.markdown.replace('Both are ready to start.\n', `Both are ready to start.\n\n${names.map(n => `![${n}](${n}.png)`).join('\n')}\n`) }, attachments: names.map(n => ({ name: `${n}.png`, type: 'image/png', base64: noise().toString('base64') })) });
};

// The upgrade baseline's record (scripts/baseline.mjs), as much of it as this test reads. Its keys are secrets: they
// stay in the test's own temp folder, and no message here names them.
const Record = Schema.Struct({
  binary: Schema.String, home: Schema.String,
  pager: Schema.Struct({ pagerId: Schema.String, privateKey: Schema.String, phoneKey: Schema.String }),
  agent: Schema.Struct({ id: Schema.String, agentId: Schema.String }),
  decisions: Schema.Struct({ open: Schema.Struct({ id: Schema.String, decisionId: Schema.String }) }),
});

test('the move from m5: every pager, agent and decision m5 stored reads back the same from its pager\'s own store, once, and m5\'s command and phone carry on', { timeout: 900_000 }, async () => {
  const m5 = release('m5');
  const dir = mkdtempSync(path.join(tmpdir(), 'agentpager-upgrade-')), persist = path.join(dir, 'persist'), baselines = path.join(dir, 'baselines');
  const baseline = (origin: string, ...more: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/baseline.mjs', '--stage', 'local', '--server', origin, '--tag', 'm5', ...more],
    { cwd: app, env: { ...process.env, AGENTPAGER_BASELINES: baselines }, encoding: 'utf8', timeout: 300_000 });

  // m5, with a short pickup clock: an answer nobody collects is warned about.
  let old = await fixture('upgrade-m5-warned', { autoOffMs: 0, idleMs: 0, pickupMs: 1_000 }, { app: m5, persist });
  const warned = await old.connected('Codex', 'warned');
  assert.equal((await old.request(`/api/pagers/${warned.p.pagerId}/push`, { phone: warned.p.phone, data: { token: 'ab'.repeat(32), environment: 'sandbox' } })).status, 200);
  const warnedAsk = await old.ask(warned.a, 'Warned about?');
  await old.answer(warned.a.agent.agentId, warned.p.phone, warnedAsk.decisionId);
  await until(() => old.pager(warned.p.pagerId, warned.p.phone), s => s.agents[0]?.answered[0]?.warnedAt !== undefined);
  const port = old.port;
  await old.stop();

  // m5 with production clocks on the same storage and address.
  old = await fixture('upgrade-m5', undefined, { app: m5, persist, port });
  const recorded = baseline(old.origin, '--binary', m5.binary);
  assert.equal(recorded.status, 0, `baseline.mjs: ${recorded.stdout}${recorded.stderr}`);
  const record = Schema.decodeUnknownSync(Record)(JSON.parse(readFileSync(path.join(baselines, 'local', 'm5', 'record.json'), 'utf8')));
  // An off pager with an auto-off choice and an alert target: an open decision, and an answer collected, not acknowledged.
  const off = await old.makePager('24h');
  assert.equal((await old.request(`/api/pagers/${off.pagerId}/push`, { phone: off.phone, data: { token: 'cd'.repeat(32), environment: 'production' } })).status, 200);
  const offAgent = await old.connect(off.number, 'Codex', 'off');
  const offOpen = await old.ask(offAgent, 'Open while off?'), offAnswered = await old.ask(offAgent, 'Answered before off?');
  const offReceipt = await old.answer(offAgent.agent.agentId, off.phone, offAnswered.decisionId);
  assert.equal((await old.read(offAgent, offAnswered.decisionId)).status, 'answered');
  await old.settings(off.pagerId, off.phone, { on: false });
  // A finished agent, its answer acknowledged and another decision left open; and an answer nobody has collected.
  const fin = await old.makePager();
  const done = await old.connect(fin.number, 'Claude Code', 'finished'), waiting = await old.connect(fin.number, 'pi', 'finished');
  const doneAcked = await old.ask(done, 'Finished: answered?');
  const doneOpen = await old.ask(done, 'Finished: left open?');
  const uncollected = await old.ask(waiting, 'Not collected yet?');
  const doneReceipt = await old.answer(done.agent.agentId, fin.phone, doneAcked.decisionId);
  await old.read(done, doneAcked.decisionId);
  await old.ack(done, doneAcked.decisionId, doneReceipt.answerId, 'Done before finishing.');
  await old.ok(C.Finished, `/api/agents/${done.agent.agentId}/finish`, { method: 'POST', agent: done.agentKey });
  const uncollectedReceipt = await old.answer(waiting.agent.agentId, fin.phone, uncollected.decisionId);
  // A pager with housekeeping part-way: agents forgotten in each order a cut-off can leave, and one whose time is up.
  const house = await old.makePager();
  const live = await old.connect(house.number, 'Codex', 'live'), forgot = await old.connect(house.number, 'Codex', 'forgotten, still listed');
  const unlisted = await old.connect(house.number, 'Codex', 'unlisted, not yet forgotten'), due = await old.connect(house.number, 'Codex', 'idle 31 days');
  for (const a of [live, forgot, unlisted, due]) await old.ask(a, `Asked by ${a.agent.project}?`);
  // A pager deleted with its agents still queued to forget, one of them still as m4 stored it.
  const gone = await old.makePager();
  const goneAgent = await old.connect(gone.number, 'Codex', 'deleted'), preSwitch = await old.connect(gone.number, 'Codex', 'deleted, from before the switch');
  await old.ask(goneAgent, 'Deleted before the move?');
  // A pager whose answer's warning comes due as the old agent's own alarm does.
  const late = await old.connected('Codex', 'warning due');
  const lateAsk = await old.ask(late.a, 'Warned after the move?');
  await old.answer(late.a.agent.agentId, late.p.phone, lateAsk.decisionId);
  // A pager whose move is refused the first time, at its second agent, once it has copied its first.
  const cutPager = await old.makePager();
  const cutFirst = await old.connect(cutPager.number, 'Codex', 'cut, first'), cutAgent = await old.connect(cutPager.number, 'Codex', 'cut');
  await old.ask(cutFirst, 'Copied before the refusal?');
  await old.ask(cutAgent, 'Moved at the second try?');
  // A pager heavy with attachments: two agents, each with four decisions of three images that don't compress, about
  // 15 MB in all. Each part is kept as the phone fetches it, to compare after the move.
  const heavy = await old.makePager(), heavyParts = new Map<string, string>();
  const part = async (origin: string, route: string) => { const r = await fetch(origin + route, { headers: { ...asClient, 'x-phone-key': heavy.phone } }); assert.equal(r.status, 200, route); return r.text(); };
  for (const n of [1, 2]) {
    const a = await old.connect(heavy.number, 'Codex', `heavy ${n}`);
    for (let d = 1; d <= 4; d++) {
      const asked = await old.ok(C.Asked, `/api/agents/${a.agent.agentId}/cards`, { agent: a.agentKey, data: await old.sealed(a, heavyQuestion(`Heavy ${n}.${d}?`)) });
      for (const slot of [0, 1, 2]) { const route = `/api/agents/${a.agent.agentId}/cards/${asked.decisionId}/files/${slot}`; heavyParts.set(route, await part(old.origin, route)); }
    }
  }
  // A pager deleted after the move, whose deletion is then cut off before the Registry erased its row.
  const doomed = await old.connected('Codex', 'deleted after the move');

  // What the phone reads of each, from m5's service.
  const read = async (f: typeof old, p: { pagerId: string; phone: string }) => { const r = await f.request(`/api/pagers/${p.pagerId}`, { phone: p.phone }); assert.equal(r.status, 200, JSON.stringify(r.value)); return r.value; };
  const baselinePager = { pagerId: record.pager.pagerId, phone: record.pager.phoneKey };
  const before = new Map<string, unknown>();
  for (const p of [baselinePager, warned.p, off, fin, house, late.p, cutPager, heavy, doomed.p]) before.set(p.pagerId, await read(old, p));
  await old.stop();

  // Below the service: what the old stores hold, kept to compare after the move, and the states made by hand.
  const registry = registryOf(persist);
  const registryRows = () => rows(registry, 'SELECT * FROM pagers_v2 ORDER BY pager_id');
  const agentFiles = new Map([record.agent.agentId, ...[warned.a, offAgent, done, waiting, live, forgot, unlisted, due, goneAgent, preSwitch, late.a, cutFirst, cutAgent, doomed.a].map(a => a.agent.agentId)].map(id => [id, named(persist, 'Agent', id)]));
  const oldAgent = (agentId: string) => { const file = agentFiles.get(agentId); assert.ok(file); return file; };
  const dump = (file: string) => ['agent_v3', 'decisions_v3', 'attachments_v3', 'answers_v3', 'acknowledgements_v3', 'pickups_v3', 'collections_v3', 'warnings_v3'].map(t => rows(file, `SELECT * FROM ${t} ORDER BY rowid`));
  // m5's delete, cut off before it reached the agents: the pager and its listing gone, its agents queued to forget.
  db(registry, d => {
    for (const a of [goneAgent, preSwitch]) d.prepare('INSERT INTO erase_v2 VALUES (?)').run(a.agent.agentId);
    d.prepare('DELETE FROM pager_agents_v3 WHERE pager_id=?').run(gone.pagerId);
    d.prepare('DELETE FROM pagers_v2 WHERE pager_id=?').run(gone.pagerId);
  });
  // The pre-switch agent's store back as m4 stored it: readable tables.
  const readable = ['Codex-before-the-switch Zq7', 'A question before the switch, readable Zq7'];
  db(oldAgent(preSwitch.agent.agentId), d => {
    d.exec(`PRAGMA foreign_keys = OFF; DROP TABLE agent_v3; DROP TABLE warnings_v3; DROP TABLE collections_v3; DROP TABLE pickups_v3; DROP TABLE acknowledgements_v3; DROP TABLE answers_v3; DROP TABLE attachments_v3; DROP TABLE decisions_v3;
      CREATE TABLE agent (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL); CREATE TABLE proposals (id TEXT PRIMARY KEY, json TEXT NOT NULL);`);
    d.prepare('INSERT INTO agent VALUES (1, ?)').run(JSON.stringify({ agentId: preSwitch.agent.agentId, pagerId: gone.pagerId, app: readable[0] }));
    d.prepare('INSERT INTO proposals VALUES (?, ?)').run(token(), JSON.stringify({ title: readable[1] }));
  });
  // Forgotten by m5, but its pager's listing of it stayed: its store holds nothing.
  db(oldAgent(forgot.agent.agentId), d => { for (const t of ['warnings_v3', 'collections_v3', 'pickups_v3', 'acknowledgements_v3', 'answers_v3', 'attachments_v3', 'decisions_v3', 'agent_v3']) d.exec(`DELETE FROM ${t}`); });
  // No longer listed, but its own forgetting was cut off: its alarm, which m5 set, comes due again.
  db(registry, d => d.prepare('DELETE FROM pager_agents_v3 WHERE agent_id=?').run(unlisted.agent.agentId));
  alarmAt(persist, 'Agent', oldAgent(unlisted.agent.agentId), Date.now());
  // Idle for 31 days: due to be forgotten as the move runs.
  setMeta(oldAgent(due.agent.agentId), m => ({ ...m, lastActivityAt: new Date(Date.now() - 31 * DAY).toISOString() }));
  // The answer's warning is due, and so is the old agent's alarm that carries it.
  db(oldAgent(late.a.agent.agentId), d => d.prepare('UPDATE pickups_v3 SET due=?').run(Date.now() - 1_000));
  alarmAt(persist, 'Agent', oldAgent(late.a.agent.agentId), Date.now());
  // An agent whose store names another pager than the one listing it: the move refuses it, and writes nothing.
  const cutFile = oldAgent(cutAgent.agent.agentId), elsewhere = '0'.repeat(32);
  setMeta(cutFile, m => ({ ...m, pagerId: elsewhere }));
  const keptRegistry = registryRows(), keptBaseline = dump(oldAgent(record.agent.agentId)), keptFinished = dump(oldAgent(done.agent.agentId));
  const lastActive = metaOf(oldAgent(record.agent.agentId))?.lastActivityAt;
  assert.ok(holds(persist, readable[0]), 'readable before the move');

  // This code's service, on the same storage and address.
  const f = await fixture('upgrade', undefined, { persist, port });
  try {
    // Every pager the phone read from m5 reads the same, but for the agents housekeeping has done with, and the
    // decision an agent that finished on m5 left with no answer, which reads as closed when it finished (B25.13).
    for (const p of [baselinePager, warned.p, off, heavy]) assert.deepEqual(await read(f, p), before.get(p.pagerId), `the pager ${p.pagerId.slice(0, 6)}… reads as m5 stored it`);
    const finBefore = Schema.decodeUnknownSync(C.PagerInbox)(before.get(fin.pagerId));
    assert.deepEqual(Schema.decodeUnknownSync(C.PagerInbox)(await read(f, fin)), {
      ...finBefore,
      agents: finBefore.agents.map(x => x.agent.finishedAt === null ? x : {
        agent: { ...x.agent, openCount: 0 }, open: x.open.map(d => ({ ...d, closed: { at: x.agent.finishedAt ?? '', reason: C.CLOSED_AGENT_FINISHED } })), answered: x.answered,
      }),
    }, 'the finished agent\'s open decision, closed when it finished; nothing else changed');
    assert.deepEqual(finBefore.agents.map(x => [x.agent.agentId, x.open.map(d => d.decisionId)]), [[done.agent.agentId, [doneOpen.decisionId]], [waiting.agent.agentId, []]]);
    const houseBefore = Schema.decodeUnknownSync(C.PagerInbox)(before.get(house.pagerId));
    assert.deepEqual(await read(f, house), { ...houseBefore, agents: houseBefore.agents.filter(x => x.agent.agentId === live.agent.agentId) }, 'only the agent housekeeping isn\'t done with');
    // The baseline passes every check --verify makes, only reading.
    const verified = baseline(f.origin, '--verify');
    assert.equal(verified.status, 0, `baseline.mjs --verify: ${verified.stdout}${verified.stderr}`);
    assert.match(verified.stdout, /ok the agentpager \w+ copy reads its agent's status: pager on/);
    // Every attachment of the heavy pager comes back as the same part.
    for (const [route, kept] of heavyParts) assert.equal(await part(f.origin, route), kept, `${route.slice(-60)} moved unchanged`);
    // The baseline's agent's last activity, and so its forget date, didn't move.
    assert.equal(Schema.decodeUnknownSync(C.PagerInbox)(await read(f, baselinePager)).agents[0].agent.lastActivityAt, lastActive);

    // The forgotten agents, whichever way: refused as unknown.
    for (const a of [forgot, unlisted, due]) await f.refused(404, 'UnknownAgent', `/api/agents/${a.agent.agentId}`, { agent: a.agentKey });
    // The deleted pager stays deleted: nothing of it comes back, and its agents are forgotten.
    await f.refused(404, 'UnknownPager', `/api/pagers/${gone.pagerId}`, { phone: gone.phone });
    await f.refused(410, 'NumberInvalid', `/api/pagers/${gone.pagerId}/key`);
    await f.refused(410, 'NumberInvalid', '/api/agents', { data: f.connectBody(gone.number) });
    await until(() => f.request(`/api/agents/${goneAgent.agent.agentId}`, { agent: goneAgent.agentKey }), r => r.status === 404 && tagOf(r.value) === 'UnknownAgent');
    // The answer whose warning was due is warned about, from the pager's store, once the old agent's alarm moved it.
    const warning = await until(() => f.pager(late.p.pagerId, late.p.phone), s => s.agents[0]?.answered[0]?.warnedAt !== undefined);
    const lateBefore = Schema.decodeUnknownSync(C.PagerInbox)(before.get(late.p.pagerId));
    assert.equal(warning.agents[0].answered[0].answer?.answerId, lateBefore.agents[0].answered[0].answer?.answerId);
    // The pager whose move is refused fails as the server's own failure, never as a pager that is gone.
    const refused = await f.request(`/api/pagers/${cutPager.pagerId}`, { phone: cutPager.phone });
    assert.deepEqual([refused.status, tagOf(refused.value)], [500, 'InternalError']);

    // On the moved data, m5's command waits for the baseline's open decision, the phone answers it, and the command
    // has the answer within a second of the send (PRODUCT.md's bar; wake.test.ts), then acknowledges it.
    const inbox = Schema.decodeUnknownSync(C.PagerInbox)(await read(f, baselinePager)), privateKey = fromBase64url(record.pager.privateKey) ?? new Uint8Array();
    const openOne = inbox.agents[0].open[0];
    assert.equal(openOne.decisionId, record.decisions.open.decisionId);
    const card = decodePart('card', open(privateKey, 'card', { pagerId: record.pager.pagerId, decisionId: openOne.decisionId }, openOne.card));
    const answer = seal(fromBase64url(card.answerKey) ?? new Uint8Array(), 'answer', { pagerId: record.pager.pagerId, decisionId: openOne.decisionId }, encodePart('answer', { choice: { kind: 'option', number: 2 } }));
    const recordDir = path.join(baselines, 'local', 'm5'), binary = path.join(recordDir, record.binary);
    const commandEnv = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', AGENTPAGER_HOME: path.join(recordDir, record.home) };
    const command = (...args: string[]) => {
      const r = spawnSync(binary, [...args, '--json'], { env: commandEnv, encoding: 'utf8', timeout: 90_000 });
      assert.equal(r.status, 0, `agentpager ${args[0]}: ${r.stdout}${r.stderr}`);
      return JSON.parse(r.stdout).result;
    };
    let waited = false;
    const m5Wait = new Promise<{ result: { status: string; option?: string }; at: number }>((resolve, reject) => {
      const c = spawn(binary, ['wait', '--agent', record.agent.id, record.decisions.open.id, '--json'], { env: commandEnv, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '';
      c.stdout.on('data', d => { out += d; }); c.stderr.on('data', d => { err += d; });
      const limit = setTimeout(() => c.kill(), 90_000);
      c.on('close', code => { clearTimeout(limit); waited = true; if (code === 0) resolve({ result: JSON.parse(out).result, at: Date.now() }); else reject(new Error(`agentpager wait: ${out}${err}`)); });
    });
    await pause(2_000);
    assert.equal(waited, false, 'm5\'s command holds its wait until the answer comes');
    const sent = Date.now();
    await f.ok(C.Receipt, `/api/agents/${record.agent.agentId}/cards/${openOne.decisionId}/answer`, { phone: record.pager.phoneKey, data: { requestId: token(), answer } });
    const collected = await m5Wait;
    assert.deepEqual([collected.result.status, collected.result.option], ['answered', 'B']);
    assert.ok(collected.at - sent < 1_000, `m5's command had the answer ${collected.at - sent} ms after the send`);
    command('ack', '--agent', record.agent.id, record.decisions.open.id, 'Answered after the move.');
    const after = Schema.decodeUnknownSync(C.PagerInbox)(await read(f, baselinePager)).agents[0].answered.find(d => d.decisionId === openOne.decisionId);
    assert.equal(after?.status, 'acknowledged');
    assert.equal(decodePart('acknowledgement', open(privateKey, 'acknowledgement', { pagerId: record.pager.pagerId, decisionId: openOne.decisionId }, after?.acknowledgement?.acknowledgement ?? '')).nextSteps, 'Answered after the move.');

    // The off pager: still off, nothing gets through; on again, its agent carries on where it was.
    await f.refused(409, 'PagerOff', `/api/agents/${offAgent.agent.agentId}/cards`, { agent: offAgent.agentKey, data: await f.sealed(offAgent, question('While off?')) });
    const on = await f.settings(off.pagerId, off.phone, { on: true });
    assert.ok(on.pager.offAt && Date.parse(on.pager.offAt) > Date.now() + 23 * 3_600_000, 'its auto-off counts from now');
    const again = await f.read(offAgent, offAnswered.decisionId);
    assert.equal(again.status === 'answered' && again.answer.answerId, offReceipt.answerId);
    const offAnswer = await f.answer(offAgent.agent.agentId, off.phone, offOpen.decisionId);
    assert.equal((await f.read(offAgent, offOpen.decisionId)).status, 'answered');
    await f.ack(offAgent, offOpen.decisionId, offAnswer.answerId, 'Carrying on after the move.');
    // The finished agent asks nothing more, and its acknowledgement stays the first; the other collects its answer.
    // The decision it left with no answer can't be answered, waited for or acknowledged.
    await f.refused(409, 'AgentFinished', `/api/agents/${done.agent.agentId}/cards`, { agent: done.agentKey, data: await f.sealed(done, question('After finishing?')) });
    const doneOpenRoute = `/api/agents/${done.agent.agentId}/cards/${doneOpen.decisionId}/answer`;
    for (const r of [
      await f.refused(409, 'DecisionClosed', doneOpenRoute, { phone: fin.phone, data: await f.sealedAnswer(done.agent.agentId, fin.phone, doneOpen.decisionId) }),
      await f.refused(409, 'DecisionClosed', `${doneOpenRoute}?wait=5`, { agent: done.agentKey }),
      await f.refused(409, 'DecisionClosed', doneOpenRoute.replace(/answer$/, 'acknowledge'), { agent: done.agentKey, data: f.sealedAck(done, doneOpen.decisionId, doneReceipt.answerId) }),
    ]) {
      assert.equal(r.message, C.DECISION_CLOSED_MESSAGE);
    }
    await f.refused(409, 'AlreadyAcknowledged', `/api/agents/${done.agent.agentId}/cards/${doneAcked.decisionId}/acknowledge`, { agent: done.agentKey, data: f.sealedAck(done, doneAcked.decisionId, doneReceipt.answerId, 'Again.') });
    const late2 = await f.read(waiting, uncollected.decisionId);
    assert.equal(late2.status === 'answered' && late2.answer.answerId, uncollectedReceipt.answerId);
    await f.ack(waiting, uncollected.decisionId, uncollectedReceipt.answerId, 'Collected after the move.');

    // A move refused is written nowhere: the pager's store holds nothing of it, and the old stores are as they were.
    const settled = new Map<string, unknown>();
    // The pager deleted after the move: deleted with its agent, and the Registry's row of it erased.
    await f.ok(Schema.Struct({ ok: Schema.Literal(true) }), `/api/pagers/${doomed.p.pagerId}/delete`, { method: 'POST', phone: doomed.p.phone });
    for (const p of [baselinePager, warned.p, off, fin, house, late.p]) settled.set(p.pagerId, await read(f, p));
    await f.stop();
    const cutStore = named(persist, 'Pager', cutPager.pagerId);
    assert.deepEqual([rows(cutStore, 'SELECT * FROM moved_v4').length, rows(cutStore, 'SELECT * FROM pager_v4').length], [0, 0], 'the refused move shows nothing: no mark, no pager');
    assert.equal(rows(cutStore, 'SELECT * FROM agents_v4').length, 1, 'what it copied before the refusal waits, unread, to be cleared');
    // Put right, the move runs again from the start, and the pager reads as m5 stored it, nothing copied twice.
    setMeta(cutFile, m => ({ ...m, pagerId: cutPager.pagerId }));
    // The deletion cut off before the Registry erased the pager's row, and before its alarm was set: the row back, the
    // erasure queued, no alarm.
    const doomedStore = named(persist, 'Pager', doomed.p.pagerId), doomedRow = keptRegistry.find(r => r.pager_id === doomed.p.pagerId);
    assert.ok(doomedRow);
    assert.equal(rows(registry, 'SELECT * FROM pagers_v2 WHERE pager_id=?', doomed.p.pagerId).length, 0, 'the delete erased the Registry\'s row');
    db(registry, d => d.prepare(`INSERT INTO pagers_v2 VALUES (${Object.keys(doomedRow).map(() => '?').join(', ')})`).run(...Object.values(doomedRow).map(v => typeof v === 'string' || typeof v === 'number' ? v : null)));
    db(doomedStore, d => { d.prepare("INSERT INTO erase_v4 VALUES ('pager', ?, ?)").run(doomed.p.pagerId, Date.now()); d.exec('DELETE FROM _cf_METADATA WHERE key=1'); });
    db(path.join(persist, 'v3', 'do', 'ownerpager-Pager', 'metadata.sqlite'), d => d.prepare('DELETE FROM _cf_ALARM WHERE actor_id=?').run(path.basename(doomedStore, '.sqlite')));
    await f.start();
    assert.deepEqual(await read(f, cutPager), before.get(cutPager.pagerId), 'the pager moved at its second try reads as m5 stored it');
    // Any call on the deleted pager's store, which still refuses the pager as gone, finds the erasure and arms it.
    await f.refused(410, 'NumberInvalid', `/api/pagers/${doomed.p.pagerId}/key`);
    await until(async () => rows(registry, 'SELECT * FROM pagers_v2 WHERE pager_id=?', doomed.p.pagerId).length, n => n === 0);
    // Moving again finds it done: after a restart every pager reads as it did.
    await f.restart();
    for (const [pagerId, value] of settled) {
      const p = [baselinePager, warned.p, off, fin, house, late.p].find(x => x.pagerId === pagerId);
      assert.ok(p);
      assert.deepEqual(await read(f, p), value, `the pager ${pagerId.slice(0, 6)}… after a restart`);
    }
    await f.stop();

    // Below the service, after the move.
    // Each moved pager's store is marked moved once, and holds the Registry's row as it was, alert target included.
    for (const p of [baselinePager, warned.p, off, fin, house, late.p, cutPager, heavy]) {
      const store = named(persist, 'Pager', p.pagerId);
      assert.deepEqual(rows(store, 'SELECT pager_id, from_registry FROM moved_v4'), [{ pager_id: p.pagerId, from_registry: 1 }]);
      const [mine] = rows(store, 'SELECT fingerprint, public_key, phone_hash, auto_off, off_since, push, created_at FROM pager_v4');
      const [theirs] = rows(registry, 'SELECT fingerprint, public_key, phone_hash, auto_off, off_since, push, created_at FROM pagers_v2 WHERE pager_id=?', p.pagerId);
      if (p.pagerId === off.pagerId) assert.deepEqual({ ...mine, off_since: null }, { ...theirs, off_since: null }, 'the off pager, turned on since');
      else assert.deepEqual(mine, theirs, `the pager ${p.pagerId.slice(0, 6)}…'s row`);
    }
    assert.equal(rows(named(persist, 'Pager', warned.p.pagerId), 'SELECT push FROM pager_v4')[0]?.push, JSON.stringify({ token: 'ab'.repeat(32), environment: 'sandbox' }));
    // Nothing is written for the deleted pager, nor for a pager no one made: the calls naming them stored nothing.
    assert.equal(wrote(persist, 'Pager', gone.pagerId), false, 'the deleted pager has no store');
    // The old stores keep what they held, unused: the Registry's rows, and the agents' rows, as before the move.
    assert.deepEqual(registryRows(), keptRegistry.filter(r => r.pager_id !== doomed.p.pagerId), 'the Registry\'s rows as m5 left them, but for the pager deleted since');
    assert.deepEqual(dump(oldAgent(record.agent.agentId)), keptBaseline, 'the baseline agent\'s old rows, untouched by the move and the calls since');
    assert.deepEqual(dump(oldAgent(done.agent.agentId)), keptFinished);
    // What was deleted or forgotten is gone from the old stores too: the deleted pager's agents, the one from before
    // the switch with its readable rows, and the agents housekeeping finished with.
    assert.equal(Number(rows(registry, 'SELECT count(*) AS n FROM erase_v2')[0]?.n), 0, 'nothing left queued to forget');
    for (const a of [goneAgent, preSwitch, unlisted, due]) assert.equal(metaOf(oldAgent(a.agent.agentId)), null, `${a.agent.project}: forgotten in its old store`);
    for (const m of readable) assert.ok(!holds(persist, m), 'nothing readable from before the switch');
    assert.deepEqual(rows(registry, 'SELECT agent_id FROM pager_agents_v3 WHERE pager_id=? ORDER BY agent_id', house.pagerId), [live, forgot].map(a => ({ agent_id: a.agent.agentId })).sort((x, y) => x.agent_id < y.agent_id ? -1 : 1), 'the Registry stops listing the agent the pager\'s store forgot');
    // An old agent's alarm moved its pager and stopped, since the pager's store holds the agent; another's, whose
    // pager doesn't, forgot what it held.
    assert.equal(alarmOf(persist, 'Agent', oldAgent(late.a.agent.agentId)), undefined, 'the held agent\'s old alarm is gone');
    assert.equal(alarmOf(persist, 'Agent', oldAgent(unlisted.agent.agentId)), undefined);
    await f.artifact('moved.json', { pagers: before.size, agents: [...before.values()].reduce((n: number, v) => n + Schema.decodeUnknownSync(C.PagerInbox)(v).agents.length, 0) });
  } finally { await f.stop(); }
});

// The paused clock (I17.6) on what dev holds: what m5 stored, some of it moved by M6's first build, which dev runs (one
// store per pager, #72, and the wake, #75, at 00d1cd9), whose stores have no record of time off. Each agent keeps the
// forget date it had, 30 days after its last activity, unless its pager is off now: then the time since the pager
// turned off counts from then, and the agent is kept for as long as the pager stays off. Last activity never changes.
// The m5 baseline, moved by the first build as dev's was, passes every check --verify makes, its agent still due 30
// days after its last activity. A move the first build began and was refused, which left its rows without the column,
// runs again from the start. Each state the old rule's clocks would take days to reach is made below the service.
const FIRST = '00d1cd95921784938fb90edb5902063a3e83dfbd';
test('I17.6 Agents moved by M6\'s first build and those not moved yet keep their forget dates, and an off pager\'s agents are kept while it is off and resume their clocks when it turns on', { timeout: 900_000 }, async () => {
  const m5 = release('m5'), first = release(FIRST);
  const dir = mkdtempSync(path.join(tmpdir(), 'agentpager-clock-')), persist = path.join(dir, 'persist'), baselines = path.join(dir, 'baselines');
  const baseline = (origin: string, ...more: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/baseline.mjs', '--stage', 'local', '--server', origin, '--tag', 'm5', ...more],
    { cwd: app, env: { ...process.env, AGENTPAGER_BASELINES: baselines }, encoding: 'utf8', timeout: 300_000 });
  const read = async (f: Awaited<ReturnType<typeof fixture>>, p: { pagerId: string; phone: string }) => { const r = await f.request(`/api/pagers/${p.pagerId}`, { phone: p.phone }); assert.equal(r.status, 200, JSON.stringify(r.value)); return Schema.decodeUnknownSync(C.PagerInbox)(r.value); };

  // On m5: the baseline, and pagers on and off with agents for each kind of clock.
  let old = await fixture('clock-m5', undefined, { app: m5, persist });
  const recorded = baseline(old.origin, '--binary', m5.binary);
  assert.equal(recorded.status, 0, `baseline.mjs: ${recorded.stdout}${recorded.stderr}`);
  const record = Schema.decodeUnknownSync(Record)(JSON.parse(readFileSync(path.join(baselines, 'local', 'm5', 'record.json'), 'utf8')));
  const baselinePager = { pagerId: record.pager.pagerId, phone: record.pager.phoneKey };
  // To be moved by the first build: a pager on, and one off.
  const movedOn = await old.makePager(), kept = await old.connect(movedOn.number, 'Codex', 'idle 29 days'), spent = await old.connect(movedOn.number, 'Codex', 'idle 31 days');
  const movedOff = await old.makePager(), pausedMoved = await old.connect(movedOff.number, 'Codex', 'moved, idle 11 days of 31'), spentMoved = await old.connect(movedOff.number, 'Codex', 'moved, idle 35 days of 55');
  // Not moved yet: a pager off, the same two clocks.
  const unmoved = await old.makePager(), pausedUnmoved = await old.connect(unmoved.number, 'Codex', 'not moved, idle 11 days of 31'), spentUnmoved = await old.connect(unmoved.number, 'Codex', 'not moved, idle 35 days of 55');
  // Its move refused by the first build at the second agent, once it had copied the first.
  const cut = await old.makePager(), cutFirst = await old.connect(cut.number, 'Codex', 'cut, first'), cutSecond = await old.connect(cut.number, 'Codex', 'cut, second');
  for (const a of [kept, spent, pausedMoved, spentMoved, pausedUnmoved, spentUnmoved, cutFirst, cutSecond]) await old.ask(a, `Asked by ${a.agent.project}?`);
  for (const p of [movedOff, unmoved]) await old.settings(p.pagerId, p.phone, { on: false });
  const port = old.port;
  await old.stop();
  const cutFile = named(persist, 'Agent', cutSecond.agent.agentId), unmovedFiles = [pausedUnmoved, spentUnmoved].map(a => named(persist, 'Agent', a.agent.agentId));
  setMeta(cutFile, m => ({ ...m, pagerId: '0'.repeat(32) }));

  // M6's first build on the same storage: the phone's reads move the baseline's pager and the two to move; the cut
  // pager's move is refused; the pager not moved yet isn't called.
  const mid = await fixture('clock-first', undefined, { app: first, persist, port });
  for (const p of [baselinePager, movedOn, movedOff]) await read(mid, p);
  assert.equal((await mid.request(`/api/pagers/${cut.pagerId}`, { phone: cut.phone })).status, 500);
  await mid.stop();

  // Below the service. The first build's stores have no column for time off, and the cut move's copied rows wait,
  // unread, without one either. The agents' last activities and the pagers' times off, set back by days.
  const pagerFile = (p: { pagerId: string }) => named(persist, 'Pager', p.pagerId);
  const columns = (file: string) => rows(file, "SELECT name FROM pragma_table_info('agents_v4')").map(r => r.name);
  for (const p of [baselinePager, movedOn, movedOff, cut]) assert.ok(columns(pagerFile(p)).length > 0 && !columns(pagerFile(p)).includes('off_ms'), 'the first build\'s agents, with no time off');
  assert.deepEqual([rows(pagerFile(cut), 'SELECT * FROM moved_v4').length, rows(pagerFile(cut), 'SELECT * FROM agents_v4').length], [0, 1], 'the refused move: no mark, its first agent copied');
  setMeta(cutFile, m => ({ ...m, pagerId: cut.pagerId }));
  const now = Date.now(), ago = (days: number) => new Date(now - days * DAY).toISOString(), offSince = now - 20 * DAY;
  const last = new Map(([[kept, 29], [spent, 31], [pausedMoved, 31], [spentMoved, 55], [pausedUnmoved, 31], [spentUnmoved, 55]] as const).map(([a, days]) => [a.agent.agentId, ago(days)]));
  for (const [p, agents] of [[movedOn, [kept, spent]], [movedOff, [pausedMoved, spentMoved]]] as const) {
    db(pagerFile(p), d => { for (const a of agents) d.prepare('UPDATE agents_v4 SET last_activity_at=? WHERE agent_id=?').run(last.get(a.agent.agentId) ?? '', a.agent.agentId); });
  }
  db(pagerFile(movedOff), d => d.prepare('UPDATE pager_v4 SET off_since=?').run(offSince));
  db(registryOf(persist), d => d.prepare('UPDATE pagers_v2 SET off_since=? WHERE pager_id=?').run(offSince, unmoved.pagerId));
  for (const [i, a] of [pausedUnmoved, spentUnmoved].entries()) setMeta(unmovedFiles[i] ?? '', m => ({ ...m, lastActivityAt: last.get(a.agent.agentId) ?? '' }));
  // The old store's own clock, which counted time off, comes due for the agent on the pager not moved yet.
  alarmAt(persist, 'Agent', unmovedFiles[0] ?? '', Date.now());
  const baselineLast = String(rows(pagerFile(baselinePager), 'SELECT last_activity_at FROM agents_v4')[0]?.last_activity_at);

  // This code. The old store's clock moves its pager, which holds the agent, so that clock stops and forgets nothing.
  const f = await fixture('clock', undefined, { persist, port });
  try {
    await until(async () => alarmOf(persist, 'Agent', unmovedFiles[0] ?? ''), alarm => alarm === undefined);
    const listed = async (p: { pagerId: string; phone: string }) => (await read(f, p)).agents.map(x => [x.agent.agentId, x.agent.lastActivityAt]);
    const as = (...agents: { agent: { agentId: string } }[]) => agents.map(a => [a.agent.agentId, last.get(a.agent.agentId)]);
    // Once what a forgotten agent's old stores held is erased, a call's end sets the pager's clock to what is due next.
    const settle = async (p: { pagerId: string; phone: string }) => { await until(async () => Number(rows(pagerFile(p), 'SELECT count(*) AS n FROM erase_v4')[0]?.n), n => n === 0); await read(f, p); };
    // On, the agent idle 31 days is forgotten, as before; off, both agents are kept, whatever the old rule counted.
    assert.deepEqual(await listed(movedOn), as(kept), 'on: the agent idle 31 days forgotten, the one idle 29 kept');
    assert.deepEqual(await listed(movedOff), as(pausedMoved, spentMoved), 'off, moved: both kept');
    assert.deepEqual(await listed(unmoved), as(pausedUnmoved, spentUnmoved), 'off, not moved: both kept');
    assert.deepEqual((await read(f, cut)).agents.map(x => x.agent.agentId), [cutFirst, cutSecond].map(a => a.agent.agentId), 'the refused move, run again from the start');
    for (const a of [pausedMoved, spentMoved, pausedUnmoved, spentUnmoved]) assert.equal((await f.request(`/api/agents/${a.agent.agentId}`, { agent: a.agentKey })).status, 200, `${a.agent.project}: known while its pager is off`);
    const verified = baseline(f.origin, '--verify');
    assert.equal(verified.status, 0, `baseline.mjs --verify: ${verified.stdout}${verified.stderr}`);
    assert.equal((await read(f, baselinePager)).agents[0]?.agent.lastActivityAt, baselineLast, 'the baseline\'s last activity as it was');
    await settle(movedOn);
    await f.stop();

    // Below: each agent's time off is 0, so each pager on keeps its next forget date, 30 days after its agent's last
    // activity; a pager off has no clock set at all.
    const offOf = (p: { pagerId: string }) => rows(pagerFile(p), 'SELECT agent_id, last_activity_at, off_ms FROM agents_v4 ORDER BY rowid');
    for (const p of [baselinePager, movedOn, movedOff, unmoved, cut]) for (const a of offOf(p)) assert.equal(a.off_ms, 0, `${String(a.agent_id).slice(0, 6)}…: no time off`);
    const alarm = (p: { pagerId: string }) => alarmOf(persist, 'Pager', pagerFile(p))?.scheduled_time;
    const ns = (at: string, extra = 0) => BigInt(Date.parse(at) + 30 * DAY + extra) * 1_000_000n;
    assert.equal(alarm(baselinePager), ns(baselineLast), 'the baseline\'s agent still due 30 days after its last activity');
    assert.equal(alarm(movedOn), ns(last.get(kept.agent.agentId) ?? ''), 'the agent idle 29 days due in a day');
    for (const p of [movedOff, unmoved]) assert.equal(alarm(p), undefined, 'a pager off sets no clock');

    // On again: the agent whose 30 days of the pager on ran out before it turned off is forgotten now; the other's
    // clock resumes with the 19 days it had left.
    await f.start();
    const turned = new Map<string, { on: number; onDone: number }>();
    for (const p of [movedOff, unmoved]) { const on = Date.now(); await f.settings(p.pagerId, p.phone, { on: true }); turned.set(p.pagerId, { on, onDone: Date.now() }); }
    assert.deepEqual(await listed(movedOff), as(pausedMoved), 'moved: the agent with no time left forgotten once on');
    assert.deepEqual(await listed(unmoved), as(pausedUnmoved), 'not moved: the same');
    for (const p of [movedOff, unmoved]) await settle(p);
    await f.stop();
    for (const [p, a] of [[movedOff, pausedMoved], [unmoved, pausedUnmoved]] as const) {
      const t = turned.get(p.pagerId), [row] = offOf(p);
      assert.ok(t && row);
      assert.deepEqual([row.agent_id, row.last_activity_at], [a.agent.agentId, last.get(a.agent.agentId)], 'last activity as it was');
      const off = Number(row.off_ms);
      assert.ok(off >= t.on - offSince && off <= t.onDone - offSince, `${a.agent.project}: the 20 days its pager was off`);
      assert.equal(alarm(p), ns(String(row.last_activity_at), off), 'due 30 days of its pager on after its last activity');
      assert.ok(Date.parse(String(row.last_activity_at)) + 30 * DAY + off - Date.now() > 18 * DAY, 'about 19 days from now');
    }
  } finally { await f.stop(); }
});
