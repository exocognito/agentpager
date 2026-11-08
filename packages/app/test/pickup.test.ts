import { test } from 'node:test';
import { fixture, apple, device, registered, assert, token, C, pause, until, openAnswer, type AgentCreds } from './support.ts';

// When an answer counts as picked up (B32.12, blueprint/areas/2-agents.md), on the real local service: only once the
// agent's command says it has received it, after reading and opening it, or once the agent acknowledges it. A command
// says so only at C.PICKUP_PROTOCOL; a call at protocol 2, as from the m6.1 command, picks the answer up by reading it,
// as before. The not-picked-up warning (B5.13, B17.8) follows: one alert per answer that no agent picked up in time, and
// a decision picked up after it goes back to waiting. Local pickup time 3 s; the words say 3 min.

type Fixture = Awaited<ReturnType<typeof fixture>>;
const PICKUP_MS = 3_000;
const NEW = C.clientVersion('cli', 'local', C.PICKUP_PROTOCOL), OLD = C.clientVersion('cli', '9fbb490');
const cards = (a: AgentCreds, decisionId: string) => `/api/agents/${a.agent.agentId}/cards/${decisionId}`;
// A read as a command at protocol 3 makes one, opened with the agent's own key.
async function look(f: Fixture, a: AgentCreds, decisionId: string, wait?: number) {
  const r = await f.ok(C.AnswerStatus, `${cards(a, decisionId)}/answer${wait ? `?wait=${wait}` : ''}`, { agent: a.agentKey, client: NEW });
  assert.equal(r.status, 'answered');
  return r.status === 'answered' ? { answerId: r.answer.answerId, choice: openAnswer(a, decisionId, r.answer.answer) } : null;
}
const received = (f: Fixture, a: AgentCreds, decisionId: string, answerId: string) =>
  f.ok(C.Received, `${cards(a, decisionId)}/received`, { agent: a.agentKey, client: NEW, data: { answerId } });
// The decision as the phone reads it.
async function seen(f: Fixture, p: { pagerId: string; phone: string }, decisionId: string) {
  const d = (await f.pager(p.pagerId, p.phone)).agents.flatMap(x => [...x.open, ...x.answered]).find(x => x.decisionId === decisionId);
  assert.ok(d, `the phone reads ${decisionId}`);
  return d;
}
// What the phone shows of an answered decision: waiting for the agent, or not picked up (AppModel.swift's rule).
const shows = (d: { warnedAt?: string; collectedAt?: string }) => d.warnedAt !== undefined && d.collectedAt === undefined ? 'not picked up' : 'waiting';

test('B32.12 A wait whose command went away picks nothing up: the owner is warned once, and when the command later says it received the answer, the decision goes back to waiting', { timeout: 180_000 }, async () => {
  const { sent, close } = await apple();
  const f = await fixture('pickup-gone', { autoOffMs: 0, idleMs: 0, pickupMs: PICKUP_MS }), register = registered(f);
  try {
    const p = await f.makePager(), phone = device();
    await register(p.pagerId, p.phone, phone);
    const a = await f.connect(p.number, 'Claude Code', 'pickup');
    const warnings = () => sent(phone).filter(d => d.payload.kind === 'warning').map(d => d.payload.decisionId);

    // A wait killed mid-wait: its request dropped, then the answer comes during the rest of its hold. Nothing tells the
    // held wait that its caller went, so it still finds the answer, and replies to no one.
    const killed = await f.ask(a, 'Killed mid-wait?');
    const stop = new AbortController();
    const cut = fetch(`${f.origin}${cards(a, killed.decisionId)}/answer?wait=20`, { headers: { authorization: `Bearer ${a.agentKey}`, [C.CLIENT_HEADER]: NEW }, signal: stop.signal }).then(r => r.status, () => 0);
    await pause(1_000);
    stop.abort();
    assert.equal(await cut, 0, 'the wait\'s command went away');
    await pause(500);
    const k = await f.answer(a.agent.agentId, p.phone, killed.decisionId);
    // A wait that had the answer, but whose command never said it received it: one that exited with the reply on its
    // way, or something that only looks, such as a watcher.
    const looked = await f.ask(a, 'Read, never received?');
    const held = look(f, a, looked.decisionId, 20);
    await pause(500);
    const l = await f.answer(a.agent.agentId, p.phone, looked.decisionId, { kind: 'option', number: 1 });
    assert.deepEqual(await held, { answerId: l.answerId, choice: { kind: 'option', number: 1 } }, 'the wait had the answer');

    // Neither is picked up, so each is warned about once, after the pickup time.
    for (const id of [killed.decisionId, looked.decisionId]) assert.equal((await seen(f, p, id)).collectedAt, undefined, 'a read at protocol 3 picks nothing up');
    await until(async () => warnings(), w => w.length === 2, 30_000);
    assert.deepEqual(warnings().sort(), [killed.decisionId, looked.decisionId].sort(), 'one warning for each');
    for (const [id, receipt] of [[killed.decisionId, k], [looked.decisionId, l]] as const) {
      const d = await seen(f, p, id);
      assert.ok(d.warnedAt && Date.parse(d.warnedAt) - Date.parse(receipt.sentAt) >= PICKUP_MS, `warned at ${d.warnedAt}, not before the pickup time`);
      assert.deepEqual([d.status, shows(d)], ['answered', 'not picked up']);
    }

    // A restart, as a deploy, warns about nothing again.
    await f.restart();
    // Late, the command says it received one: that decision goes back to waiting, with its warning kept on record.
    const late = await received(f, a, killed.decisionId, k.answerId);
    const back = await seen(f, p, killed.decisionId);
    assert.equal(back.collectedAt, late.collectedAt);
    assert.ok(back.warnedAt && Date.parse(late.collectedAt) >= Date.parse(back.warnedAt), 'picked up after the warning');
    assert.deepEqual([back.status, shows(back)], ['answered', 'waiting']);
    // The other's acknowledgement picks it up too, with no word that it was received first.
    const acked = await f.ack(a, looked.decisionId, l.answerId);
    const done = await seen(f, p, looked.decisionId);
    assert.deepEqual([done.status, done.collectedAt, shows(done)], ['acknowledged', acked.acknowledgedAt, 'waiting']);
    await pause(PICKUP_MS + 1_500);
    assert.equal(warnings().length, 2, 'one alert per answer, across a restart and a late pickup');
  } finally {
    await f.stop();
    close();
  }
});

test('B32.12 A command that says it received the answer in time picks it up once: no warning, saying it again changes nothing, and it is no activity; an acknowledgement alone picks it up too', { timeout: 180_000 }, async () => {
  const { sent, close } = await apple();
  const f = await fixture('pickup-received', { autoOffMs: 0, idleMs: 0, pickupMs: PICKUP_MS }), register = registered(f);
  try {
    const p = await f.makePager(), phone = device();
    await register(p.pagerId, p.phone, phone);
    const a = await f.connect(p.number, 'Codex', 'pickup');
    const asked = await f.ask(a, 'Received in time?'), alone = await f.ask(a, 'Acknowledged alone?');
    const r1 = await f.answer(a.agent.agentId, p.phone, asked.decisionId), r2 = await f.answer(a.agent.agentId, p.phone, alone.decisionId);
    assert.equal((await look(f, a, asked.decisionId))?.answerId, r1.answerId);
    assert.equal((await seen(f, p, asked.decisionId)).collectedAt, undefined, 'read, not yet received');
    const activity = (await f.pager(p.pagerId, p.phone)).agents[0]?.agent.lastActivityAt;

    // Said once, again after a lost reply, and several times at once: one pickup, at the first time, every reply the same.
    const first = await received(f, a, asked.decisionId, r1.answerId);
    assert.deepEqual([first.decisionId, first.answerId], [asked.decisionId, r1.answerId]);
    const again = await Promise.all([1, 2, 3, 4].map(() => received(f, a, asked.decisionId, r1.answerId)));
    for (const r of again) assert.deepEqual(r, first, 'saying it again gets the same reply');
    const d1 = await seen(f, p, asked.decisionId);
    assert.deepEqual([d1.collectedAt, d1.warnedAt, d1.status], [first.collectedAt, undefined, 'answered'], 'picked up, and not acknowledged');
    assert.equal((await f.pager(p.pagerId, p.phone)).agents[0]?.agent.lastActivityAt, activity, 'received is no activity, as reading is none');

    // The acknowledgement alone, after a read: picked up when it was acknowledged. Saying it was received after that
    // changes nothing.
    assert.equal((await look(f, a, alone.decisionId))?.answerId, r2.answerId);
    const acked = await f.ack(a, alone.decisionId, r2.answerId);
    assert.equal((await seen(f, p, alone.decisionId)).collectedAt, acked.acknowledgedAt);
    assert.equal((await received(f, a, alone.decisionId, r2.answerId)).collectedAt, acked.acknowledgedAt);

    await pause(PICKUP_MS + 2_000);
    for (const id of [asked.decisionId, alone.decisionId]) assert.equal((await seen(f, p, id)).warnedAt, undefined, 'never warned');
    assert.equal(sent(phone).filter(d => d.payload.kind === 'warning').length, 0, 'no warning alert');
    assert.equal((await received(f, a, asked.decisionId, r1.answerId)).collectedAt, first.collectedAt, 'still the first time');
  } finally {
    await f.stop();
    close();
  }
});

test('B32.12 Only an agent\'s own key says it received its own decision\'s answer, naming that answer; anything else is refused and picks nothing up', { timeout: 180_000 }, async () => {
  const f = await fixture('pickup-refused', { autoOffMs: 0, idleMs: 0, pickupMs: PICKUP_MS });
  try {
    const { p, a } = await f.connected('Codex', 'pickup');
    const b = await f.connect(p.number, 'Claude Code', 'same pager'), other = await f.connected('Codex', 'other pager');
    const asked = await f.ask(a, 'Whose answer?'), open = await f.ask(a, 'Not answered yet?');
    const r = await f.answer(a.agent.agentId, p.phone, asked.decisionId);
    const bAsked = await f.ask(b, 'Another agent\'s?'), rb = await f.answer(b.agent.agentId, p.phone, bAsked.decisionId);
    const route = (agentId: string, decisionId: string) => `/api/agents/${agentId}/cards/${decisionId}/received`;
    const say = (agentId: string, key: string, decisionId: string, data: unknown = { answerId: r.answerId }) => ({ route: route(agentId, decisionId), opts: { agent: key, client: NEW, data } });
    const refusals: [string, number, string, { route: string; opts: Parameters<Fixture['request']>[1] }][] = [
      ['a wrong key', 401, 'Unauthorized', say(a.agent.agentId, token(), asked.decisionId)],
      ['no key', 401, 'Unauthorized', { route: route(a.agent.agentId, asked.decisionId), opts: { client: NEW, data: { answerId: r.answerId } } }],
      ['another agent\'s key, on this agent', 401, 'Unauthorized', say(a.agent.agentId, b.agentKey, asked.decisionId)],
      ['another agent on the same pager, naming this agent\'s decision', 404, 'UnknownDecision', say(b.agent.agentId, b.agentKey, asked.decisionId)],
      ['an agent on another pager, naming this agent\'s decision', 404, 'UnknownDecision', say(other.a.agent.agentId, other.a.agentKey, asked.decisionId)],
      ['this agent, naming another agent\'s decision and answer', 404, 'UnknownDecision', say(a.agent.agentId, a.agentKey, bAsked.decisionId, { answerId: rb.answerId })],
      ['a decision that doesn\'t exist', 404, 'UnknownDecision', say(a.agent.agentId, a.agentKey, token())],
      ['a decision with no answer', 409, 'NotAnswered', say(a.agent.agentId, a.agentKey, open.decisionId)],
      ['an answer id that isn\'t its answer\'s', 409, 'AnswerMismatch', say(a.agent.agentId, a.agentKey, asked.decisionId, { answerId: token() })],
      ['another agent\'s answer id', 409, 'AnswerMismatch', say(a.agent.agentId, a.agentKey, asked.decisionId, { answerId: rb.answerId })],
      ['no answer id', 400, 'InvalidInput', say(a.agent.agentId, a.agentKey, asked.decisionId, {})],
      ['a field it doesn\'t take', 400, 'InvalidInput', say(a.agent.agentId, a.agentKey, asked.decisionId, { answerId: r.answerId, at: 'now' })],
      ['a malformed decision id', 400, 'InvalidInput', say(a.agent.agentId, a.agentKey, 'not-a-decision')],
    ];
    for (const [label, status, tag, call] of refusals) await f.refused(status, tag, call.route, call.opts).catch(e => { throw new Error(`${label}: ${e}`); });
    await f.refused(404, 'NotFound', route(a.agent.agentId, asked.decisionId), { method: 'GET', agent: a.agentKey, client: NEW });
    // None picked anything up: each answer is warned about at its time.
    for (const [x, id] of [[p, asked.decisionId], [p, bAsked.decisionId]] as const) {
      const d = await until(() => seen(f, x, id), d => d.warnedAt !== undefined, 30_000);
      assert.equal(d.collectedAt, undefined, `${id} was picked up by a refused call`);
    }
    // While the pager is off nothing gets through, this too; on again, it does.
    await f.settings(p.pagerId, p.phone, { on: false });
    await f.refused(409, 'PagerOff', route(a.agent.agentId, asked.decisionId), { agent: a.agentKey, client: NEW, data: { answerId: r.answerId } });
    assert.equal((await seen(f, p, asked.decisionId)).collectedAt, undefined, 'nothing picked up while off');
    await f.settings(p.pagerId, p.phone, { on: true });
    assert.ok((await received(f, a, asked.decisionId, r.answerId)).collectedAt);
    // A decision that closed unanswered, when its agent finished, has no answer to receive. One answered before the
    // finish keeps its answer, which its agent can still receive (B25.13).
    const kept = await f.ask(a, 'Answered before the finish?'), rk = await f.answer(a.agent.agentId, p.phone, kept.decisionId);
    await f.ok(C.Finished, `/api/agents/${a.agent.agentId}/finish`, { method: 'POST', agent: a.agentKey });
    const closed = await f.refused(409, 'DecisionClosed', route(a.agent.agentId, open.decisionId), { agent: a.agentKey, client: NEW, data: { answerId: r.answerId } });
    assert.equal(closed.closed?.reason, C.CLOSED_AGENT_FINISHED);
    assert.equal((await received(f, a, kept.decisionId, rk.answerId)).collectedAt, (await seen(f, p, kept.decisionId)).collectedAt);
  } finally { await f.stop(); }
});

test('B32.12 A command at protocol 2, as the m6.1 command and every one before it, still picks an answer up when it reads it, so its owner is never warned', { timeout: 180_000 }, async () => {
  const f = await fixture('pickup-protocol-2', { autoOffMs: 0, idleMs: 0, pickupMs: PICKUP_MS });
  try {
    const { p, a } = await f.connected('Codex', 'pickup');
    const read = await f.ask(a, 'Read by an older command?'), waited = await f.ask(a, 'Waited for by an older command?');
    const r1 = await f.answer(a.agent.agentId, p.phone, read.decisionId);
    const once = await f.ok(C.AnswerStatus, `${cards(a, read.decisionId)}/answer`, { agent: a.agentKey, client: OLD });
    assert.equal(once.status === 'answered' && once.answer.answerId, r1.answerId);
    const held = f.ok(C.AnswerStatus, `${cards(a, waited.decisionId)}/answer?wait=20`, { agent: a.agentKey, client: OLD });
    await pause(500);
    const r2 = await f.answer(a.agent.agentId, p.phone, waited.decisionId);
    const got = await held;
    assert.equal(got.status === 'answered' && got.answer.answerId, r2.answerId);
    for (const [id, receipt] of [[read.decisionId, r1], [waited.decisionId, r2]] as const) {
      const d = await seen(f, p, id);
      assert.ok(d.collectedAt && Date.parse(d.collectedAt) >= Date.parse(receipt.sentAt), `picked up when it was read: ${d.collectedAt}`);
    }
    await pause(PICKUP_MS + 2_000);
    for (const id of [read.decisionId, waited.decisionId]) assert.equal((await seen(f, p, id)).warnedAt, undefined, 'never warned');
  } finally { await f.stop(); }
});
