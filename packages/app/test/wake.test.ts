import { test } from 'node:test';
import { fixture, assert, token, C, decode, pause, openAnswer, type AgentCreds } from './support.ts';

// The service's side of the wait (pager.ts, wake.ts): a wait held in its pager's store, woken by what it waits for.
// PRODUCT.md's bar is that a waiting agent has the owner's answer within a second of the Undo window closing. The phone
// holds an answer through its Undo window and sends it once the window closes (I6), so on the service the bar runs from
// the phone's send: each test here measures from just before it.

type Fixture = Awaited<ReturnType<typeof fixture>>;
// A wait as the command holds one (GET …/answer?wait=), and when its reply came; `settled` says whether it has yet.
function hold(f: Fixture, a: AgentCreds, decisionId: string, seconds?: number) {
  const started = Date.now();
  let settled = false;
  const done = f.request(`/api/agents/${a.agent.agentId}/cards/${decisionId}/answer${seconds === undefined ? '' : `?wait=${seconds}`}`, { agent: a.agentKey })
    .then(r => ({ ...r, at: Date.now() }))
    .finally(() => { settled = true; });
  return { done, started, settled: () => settled };
}
// What a wait's reply says: the choice it opened to, with the answer's id, or pending.
function opened(a: AgentCreds, decisionId: string, r: { status: number; value: unknown }) {
  assert.equal(r.status, 200, JSON.stringify(r.value));
  const v = decode(C.AnswerStatus, r.value);
  return v.status === 'pending' ? { status: 'pending' as const } : { status: 'answered' as const, answerId: v.answer.answerId, choice: openAnswer(a, decisionId, v.answer.answer) };
}
const tagOf = (value: unknown) => typeof value === 'object' && value !== null && 'error' in value ? value.error : undefined;
const BAR_MS = 1_000;

test('B32.2 A wait returns the option chosen or the owner\'s note as soon as the phone sends it, or pending at the time it asked for', { timeout: 180_000 }, async () => {
  const f = await fixture('wake-replies');
  try {
    const { p, a } = await f.connected('Codex', 'wake');
    const [option, note, short, longest] = [await f.ask(a, 'Option?'), await f.ask(a, 'Note?'), await f.ask(a, 'Short?'), await f.ask(a, 'Longest?')];
    // The longest wait the service holds, on a decision no one answers: pending at its time, not before or long after.
    const long = hold(f, a, longest.decisionId, C.ANSWER_WAIT_MAX_SECONDS);

    const w1 = hold(f, a, option.decisionId, 20);
    await pause(500);
    assert.equal(w1.settled(), false, 'it holds until the answer comes');
    const sent1 = Date.now(), receipt1 = await f.answer(a.agent.agentId, p.phone, option.decisionId, { kind: 'option', number: 1 });
    const r1 = await w1.done;
    assert.deepEqual(opened(a, option.decisionId, r1), { status: 'answered', answerId: receipt1.answerId, choice: { kind: 'option', number: 1 } });
    assert.ok(r1.at - sent1 < BAR_MS, `the option came ${r1.at - sent1} ms after the send`);

    const w2 = hold(f, a, note.decisionId, 20);
    await pause(300);
    const sent2 = Date.now(), receipt2 = await f.answer(a.agent.agentId, p.phone, note.decisionId, { kind: 'feedback', text: 'Use the staging database first.' });
    const r2 = await w2.done;
    assert.deepEqual(opened(a, note.decisionId, r2), { status: 'answered', answerId: receipt2.answerId, choice: { kind: 'feedback', text: 'Use the staging database first.' } });
    assert.ok(r2.at - sent2 < BAR_MS, `the note came ${r2.at - sent2} ms after the send`);

    // Asked to return sooner: pending at its time. With no wait asked for, pending at once.
    const w3 = hold(f, a, short.decisionId, 2), r3 = await w3.done;
    assert.equal(opened(a, short.decisionId, r3).status, 'pending');
    assert.ok(r3.at - w3.started >= 2_000 && r3.at - w3.started < 2_900, `pending after ${r3.at - w3.started} ms`);
    const w4 = hold(f, a, short.decisionId), r4 = await w4.done;
    assert.equal(opened(a, short.decisionId, r4).status, 'pending');
    assert.ok(r4.at - w4.started < 500, `pending after ${r4.at - w4.started} ms`);
    // Nothing longer than the service holds, and nothing shorter than a second.
    for (const s of [0, C.ANSWER_WAIT_MAX_SECONDS + 1]) await f.refused(400, 'InvalidInput', `/api/agents/${a.agent.agentId}/cards/${short.decisionId}/answer?wait=${s}`, { agent: a.agentKey });

    const r5 = await long.done;
    assert.equal(opened(a, longest.decisionId, r5).status, 'pending');
    const held = r5.at - long.started;
    assert.ok(held >= C.ANSWER_WAIT_MAX_SECONDS * 1000 && held < C.ANSWER_WAIT_MAX_SECONDS * 1000 + 1_500, `the longest wait was pending after ${held} ms`);
    // Collected are only the answers its waits returned.
    const seen = (await f.pager(p.pagerId, p.phone)).agents[0], all = [...seen.open, ...seen.answered], d = (id: string) => all.find(x => x.decisionId === id);
    assert.deepEqual([option, note, short, longest].map(x => d(x.decisionId)?.collectedAt !== undefined), [true, true, false, false]);
    await f.artifact('timings.json', { option: r1.at - sent1, note: r2.at - sent2, short: r3.at - w3.started, longest: held });
  } finally { await f.stop(); }
});

test('An answer reaches every wait on its decision within a second of the phone sending it once its Undo window closed, and is collected once', { timeout: 180_000 }, async () => {
  const f = await fixture('wake-bar');
  try {
    const { p, a } = await f.connected('Claude Code', 'wake');
    const asked = await f.ask(a, 'Undone, then sent?');
    // Two waits on one decision. The owner presses Send on B and Undo inside the window: the phone sends nothing, so
    // nothing reaches the service and both waits hold. Then the owner sends A, the choice after Undo.
    const first = hold(f, a, asked.decisionId, 20), second = hold(f, a, asked.decisionId, 20);
    await pause(1_500);
    assert.deepEqual([first.settled(), second.settled()], [false, false], 'nothing was sent in the Undo window, and both waits hold');
    const sent = Date.now(), receipt = await f.answer(a.agent.agentId, p.phone, asked.decisionId, { kind: 'option', number: 1 });
    const [r1, r2] = await Promise.all([first.done, second.done]);
    for (const r of [r1, r2]) {
      assert.deepEqual(opened(a, asked.decisionId, r), { status: 'answered', answerId: receipt.answerId, choice: { kind: 'option', number: 1 } });
      assert.ok(r.at - sent < BAR_MS, `a wait had the answer ${r.at - sent} ms after the send`);
    }
    // Collected once: the first collection's time stays.
    const collectedAt = async () => (await f.pager(p.pagerId, p.phone)).agents[0].answered.find(x => x.decisionId === asked.decisionId)?.collectedAt;
    const first_ = await collectedAt();
    assert.ok(first_ && Date.parse(first_) >= Date.parse(receipt.sentAt) && Date.parse(first_) <= Math.max(r1.at, r2.at), `collected at ${first_}`);

    // A wait that starts once the answer is already there returns it at once, and the collection stays the first.
    const late = hold(f, a, asked.decisionId, 20), r3 = await late.done;
    assert.deepEqual(opened(a, asked.decisionId, r3), { status: 'answered', answerId: receipt.answerId, choice: { kind: 'option', number: 1 } });
    assert.ok(r3.at - late.started < BAR_MS, `a wait started after the answer had it after ${r3.at - late.started} ms`);
    assert.equal(await collectedAt(), first_);

    // The bar, again and again: answers sent 100 to 900 ms into a wait.
    const trials: number[] = [];
    for (const delay of [100, 900, 300, 700, 500, 200, 800, 400]) {
      const d = await f.ask(a, `Sent ${delay} ms in?`), w = hold(f, a, d.decisionId, 20);
      await pause(delay);
      const at = Date.now(), r = await f.answer(a.agent.agentId, p.phone, d.decisionId), got = await w.done;
      assert.equal(opened(a, d.decisionId, got).status === 'answered' && r.answerId, r.answerId);
      trials.push(got.at - at);
    }
    assert.ok(trials.every(ms => ms < BAR_MS), `each answer reached its wait within a second: ${trials.join(', ')} ms`);
    await f.artifact('bar.json', { twoWaits: [r1.at - sent, r2.at - sent], startedAfter: r3.at - late.started, trials });
  } finally { await f.stop(); }
});

test('Many waits on one pager: each has its own answer within a second of its send, and the rest hold to their time with nothing collected', { timeout: 240_000 }, async () => {
  const f = await fixture('wake-many');
  try {
    const p = await f.makePager();
    const agents = await Promise.all(Array.from({ length: 12 }, (_, n) => f.connect(p.number, 'Codex', `many ${n}`)));
    const asked = await Promise.all(agents.map(async a => ({ a, answered: await f.ask(a, 'Answered?'), left: await f.ask(a, 'Left open?') })));
    const answers = await Promise.all(asked.map(x => f.sealedAnswer(x.a.agent.agentId, p.phone, x.answered.decisionId, { kind: 'option', number: 1 + (agents.indexOf(x.a) % 2) })));
    // Two waits on each decision to be answered, one on each to be left open: 36 waits held at once.
    const waits = asked.map(x => ({ x, answered: [hold(f, x.a, x.answered.decisionId, 10), hold(f, x.a, x.answered.decisionId, 10)], left: hold(f, x.a, x.left.decisionId, 10) }));
    await pause(500);
    // The phone sends twelve answers in a burst, 50 ms apart.
    const sends = await Promise.all(waits.map(async (w, n) => {
      await pause(n * 50);
      const at = Date.now(), r = await f.request(`/api/agents/${w.x.a.agent.agentId}/cards/${w.x.answered.decisionId}/answer`, { phone: p.phone, data: answers[n] });
      assert.equal(r.status, 200, JSON.stringify(r.value));
      return { at, receipt: decode(C.Receipt, r.value) };
    }));
    const latencies: number[] = [];
    for (const [n, w] of waits.entries()) {
      const expected = { status: 'answered', answerId: sends[n].receipt.answerId, choice: { kind: 'option', number: 1 + (n % 2) } };
      for (const h of w.answered) {
        const r = await h.done;
        assert.deepEqual(opened(w.x.a, w.x.answered.decisionId, r), expected, 'each wait has its own decision\'s answer');
        latencies.push(r.at - sends[n].at);
      }
    }
    assert.ok(latencies.every(ms => ms < BAR_MS), `every answer reached its waits within a second: ${latencies.join(', ')} ms`);
    for (const w of waits) {
      const r = await w.left.done;
      assert.equal(opened(w.x.a, w.x.left.decisionId, r).status, 'pending');
      assert.ok(r.at - w.left.started >= 10_000, `a wait on an open decision ended after ${r.at - w.left.started} ms`);
    }
    const seen = await f.pager(p.pagerId, p.phone);
    for (const x of seen.agents) {
      assert.deepEqual(x.open.map(d => [d.title, d.collectedAt]), [['Left open?', undefined]]);
      assert.deepEqual(x.answered.map(d => [d.title, d.collectedAt !== undefined]), [['Answered?', true]]);
    }
    await f.artifact('many.json', { waits: 36, latencies });
  } finally { await f.stop(); }
});

test('I17.2 A held wait ends refused as off as soon as its pager turns off, by its owner or by its auto-off, and collects nothing', { timeout: 180_000 }, async () => {
  const f = await fixture('wake-off', { autoOffMs: 4_000, idleMs: 0 });
  try {
    // The owner turns it off.
    const owner = await f.makePager('never'), a = await f.connect(owner.number, 'Codex', 'off');
    const asked = await f.ask(a, 'Held as it turns off?'), w = hold(f, a, asked.decisionId, 20);
    await pause(500);
    const offAt = Date.now();
    await f.settings(owner.pagerId, owner.phone, { on: false });
    const r = await w.done;
    assert.deepEqual([r.status, tagOf(r.value)], [409, 'PagerOff']);
    assert.ok(r.at - offAt < BAR_MS, `refused ${r.at - offAt} ms after the off`);
    // Nothing was collected; on again, a new wait collects the answer.
    await f.settings(owner.pagerId, owner.phone, { on: true });
    const again = hold(f, a, asked.decisionId, 20);
    await pause(300);
    const receipt = await f.answer(a.agent.agentId, owner.phone, asked.decisionId);
    assert.deepEqual(opened(a, asked.decisionId, await again.done), { status: 'answered', answerId: receipt.answerId, choice: { kind: 'option', number: 2 } });

    // Its auto-off comes due while it holds.
    const auto = await f.makePager('24h'), b = await f.connect(auto.number, 'Codex', 'auto-off');
    const due = Date.parse(auto.pager.offAt ?? ''), bAsked = await f.ask(b, 'Held across auto-off?'), wb = hold(f, b, bAsked.decisionId, 20);
    const rb = await wb.done;
    assert.deepEqual([rb.status, tagOf(rb.value)], [409, 'PagerOff']);
    assert.ok(rb.at >= due && rb.at - due < BAR_MS, `refused ${rb.at - due} ms after the auto-off`);

    // Its auto-off is set while it holds, from a pager that never turned off by itself: it ends at the new time.
    const later = await f.makePager('never'), c = await f.connect(later.number, 'Codex', 'set while held');
    const cAsked = await f.ask(c, 'Held as auto-off is set?'), wc = hold(f, c, cAsked.decisionId, 20);
    await pause(500);
    const set = await f.settings(later.pagerId, later.phone, { autoOff: '24h' }), newDue = Date.parse(set.pager.offAt ?? '');
    const rc = await wc.done;
    assert.deepEqual([rc.status, tagOf(rc.value)], [409, 'PagerOff']);
    assert.ok(rc.at >= newDue && rc.at - newDue < BAR_MS, `refused ${rc.at - newDue} ms after the auto-off set while it held`);

    for (const [q, d] of [[auto, bAsked], [later, cAsked]] as const) {
      const x = (await f.pager(q.pagerId, q.phone)).agents[0];
      assert.deepEqual([x.open.map(o => o.decisionId), x.answered.length], [[d.decisionId], 0], 'still open, with nothing collected');
    }
    await f.artifact('off.json', { owner: r.at - offAt, autoOff: rb.at - due, setWhileHeld: rc.at - newDue });
  } finally { await f.stop(); }
});

test('A held wait ends at once when its pager is deleted, or when its agent is forgotten', { timeout: 180_000 }, async () => {
  const f = await fixture('wake-gone', { autoOffMs: 0, idleMs: 6_000 });
  try {
    const { p, a } = await f.connected('Codex', 'deleted');
    const asked = await f.ask(a, 'Held as the pager goes?'), w = hold(f, a, asked.decisionId, 20);
    await pause(500);
    const deletedAt = Date.now();
    assert.equal((await f.request(`/api/pagers/${p.pagerId}/delete`, { method: 'POST', phone: p.phone })).status, 200);
    const r = await w.done;
    assert.deepEqual([r.status, tagOf(r.value)], [410, 'PagerDeleted']);
    assert.ok(r.at - deletedAt < BAR_MS, `refused ${r.at - deletedAt} ms after the delete`);

    // Waiting isn't activity: an agent that only waits is forgotten at its time, and its wait ends then.
    const { a: idle } = await f.connected('Codex', 'forgotten');
    const idleAsked = await f.ask(idle, 'Held as the agent is forgotten?'), lastActive = Date.now(), wi = hold(f, idle, idleAsked.decisionId, 20);
    const ri = await wi.done;
    assert.deepEqual([ri.status, tagOf(ri.value)], [404, 'UnknownAgent']);
    const after = ri.at - lastActive;
    assert.ok(after >= 6_000 - 100 && after < 6_000 + 2_000, `refused ${after} ms after its last activity`);
    await f.artifact('gone.json', { deleted: r.at - deletedAt, forgotten: after });
  } finally { await f.stop(); }
});

test('B32.6 A wait cut off by a restart loses nothing: the next wait has the answer within a second of its send', { timeout: 240_000 }, async () => {
  const f = await fixture('wake-restart');
  try {
    const { p, a } = await f.connected('Codex', 'restart');
    const asked = await f.ask(a, 'Held across a restart?'), before = await f.ask(a, 'Answered while nothing waits?');
    const w = hold(f, a, asked.decisionId, 20), cut = w.done.then(x => x.status, () => 0);
    await pause(500);
    await f.restart();
    // The wait was cut off with the service: no reply, or the server's own failure, as the command sees a restart and
    // asks again.
    const ended = await cut;
    assert.ok(ended === 0 || ended >= 500, `a wait cut off by a restart ended ${ended}`);
    const again = hold(f, a, asked.decisionId, 20);
    await pause(500);
    const sent = Date.now(), receipt = await f.answer(a.agent.agentId, p.phone, asked.decisionId);
    const r = await again.done;
    assert.deepEqual(opened(a, asked.decisionId, r), { status: 'answered', answerId: receipt.answerId, choice: { kind: 'option', number: 2 } });
    assert.ok(r.at - sent < BAR_MS, `after the restart, the answer came ${r.at - sent} ms after the send`);

    // An answer sent while nothing waits stays, across a restart, for the next wait, which has it at once.
    const stored = await f.answer(a.agent.agentId, p.phone, before.decisionId, { kind: 'feedback', text: 'Kept.' });
    await f.restart();
    const next = hold(f, a, before.decisionId, 20), rn = await next.done;
    assert.deepEqual(opened(a, before.decisionId, rn), { status: 'answered', answerId: stored.answerId, choice: { kind: 'feedback', text: 'Kept.' } });
    assert.ok(rn.at - next.started < BAR_MS, `the stored answer came after ${rn.at - next.started} ms`);
    await f.refused(401, 'Unauthorized', `/api/agents/${a.agent.agentId}/cards/${asked.decisionId}/answer?wait=1`, { agent: token() });
  } finally { await f.stop(); }
});
