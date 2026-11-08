import { test } from 'node:test';
import { fixture, assert, token, C, decode, pause, asQuestion, asClient, question, type AgentCreds } from './support.ts';

// What finishing does to an agent's decisions (pager.ts › finish, decision; B25.13 and B32.11 in
// blueprint/areas/2-agents.md, B5.17 in 5-answering.md), on the real local service. A decision with no answer closes
// unanswered when its agent finishes: the phone reads it marked closed, still among the agent's open decisions with its
// status open (so the m5 app reads it), and nothing can answer, wait for or acknowledge it. An answer that landed before
// the finish stays the answer, and the agent can still collect and acknowledge it.

type Fixture = Awaited<ReturnType<typeof fixture>>;
const BAR_MS = 1_000;
// The pager as the phone gets it, before it opens anything.
const wire = (f: Fixture, p: { pagerId: string; phone: string }) => f.ok(C.PagerInbox, `/api/pagers/${p.pagerId}`, { phone: p.phone });
const finish = (f: Fixture, a: AgentCreds) => f.ok(C.Finished, `/api/agents/${a.agent.agentId}/finish`, { method: 'POST', agent: a.agentKey });
const answerRoute = (a: AgentCreds, decisionId: string) => `/api/agents/${a.agent.agentId}/cards/${decisionId}/answer`;
// A refusal of a decision that closed unanswered, as its agent and the phone get it: its tag, its words and its record.
function closedRefusal(r: { status: number; value: unknown }) {
  assert.equal(r.status, 409, JSON.stringify(r.value));
  const body = decode(C.DecisionClosedRefusal, r.value);
  assert.equal(body.message, C.DECISION_CLOSED_MESSAGE);
  return body.closed;
}
// A wait as the command holds one (GET …/answer?wait=), and when its reply came; `settled` says whether it has yet.
function hold(f: Fixture, a: AgentCreds, decisionId: string, seconds: number) {
  const started = Date.now();
  let settled = false;
  const done = f.request(`${answerRoute(a, decisionId)}?wait=${seconds}`, { agent: a.agentKey }).then(r => ({ ...r, at: Date.now() })).finally(() => { settled = true; });
  return { done, started, settled: () => settled };
}

test('B25.13 An agent that finishes asks nothing more, and its open decisions close unanswered and can\'t be answered; it still waits for and acknowledges the answers already sent, and finishing again changes nothing', { timeout: 180_000 }, async () => {
  const f = await fixture('finish');
  try {
    const { p, a } = await f.connected('Codex', 'finishing');
    const other = await f.connect(p.number, 'Claude Code', 'finishing');
    // Before it finishes: an answer acknowledged, one collected and not acknowledged, one not collected, and two
    // decisions with no answer, the first with a page attached. Another agent on the pager has one open too.
    const acked = await f.ask(a, 'Answered and acknowledged?'), collected = await f.ask(a, 'Answered and collected?'), uncollected = await f.ask(a, 'Answered, not collected?');
    const q = question('Open: first?'), withPage = asQuestion({ ...q, card: { ...q.card, markdown: q.card.markdown.replace('Both are ready to start.', 'Both are ready to start. [Notes](notes.md)') }, attachments: [{ name: 'notes.md', type: 'text/markdown', text: '# Notes\nBoth plans.' }] });
    const first = await f.ok(C.Asked, `/api/agents/${a.agent.agentId}/cards`, { agent: a.agentKey, data: await f.sealed(a, withPage) });
    const second = await f.ask(a, 'Open: second?'), theirs = await f.ask(other, 'Another agent\'s?');
    const ackedReceipt = await f.answer(a.agent.agentId, p.phone, acked.decisionId);
    await f.read(a, acked.decisionId);
    await f.ack(a, acked.decisionId, ackedReceipt.answerId, 'Done before finishing.');
    const collectedReceipt = await f.answer(a.agent.agentId, p.phone, collected.decisionId, { kind: 'feedback', text: 'Use staging first.' });
    await f.read(a, collected.decisionId);
    // The phone's answer, kept as it sent it, so it can send exactly the same request again, as after a lost reply.
    const resend = await f.sealedAnswer(a.agent.agentId, p.phone, uncollected.decisionId);
    const uncollectedReceipt = await f.ok(C.Receipt, answerRoute(a, uncollected.decisionId), { phone: p.phone, data: resend });
    const before = await wire(f, p);
    assert.equal(before.agents[0]?.agent.openCount, 2);

    const finished = await finish(f, a);
    const closed = { at: finished.finishedAt, reason: C.CLOSED_AGENT_FINISHED };
    assert.deepEqual(finished.closed, [first, second].map(d => ({ decisionId: d.decisionId, ...closed })), 'its two decisions with no answer, in ask order, closed as it finished');
    assert.deepEqual(await finish(f, a), finished, 'finishing again changes nothing and names the same ones');

    // The phone reads the finish and the two marked closed, still among the open ones with their status open; nothing
    // else it holds changed: every part, answer, collection and acknowledgement as it was, the other agent's too.
    const after = await wire(f, p);
    assert.deepEqual(after, {
      ...before,
      agents: before.agents.map(x => x.agent.agentId !== a.agent.agentId ? x : {
        agent: { ...x.agent, finishedAt: finished.finishedAt, lastActivityAt: finished.finishedAt, openCount: 0 },
        open: x.open.map(d => ({ ...d, closed })), answered: x.answered,
      }),
    }, 'the finish and the close marks, and nothing else');
    const opened = (await f.pager(p.pagerId, p.phone)).agents[0];
    assert.deepEqual(opened?.open.map(d => [d.title, d.status, d.closed]), [['Open: first?', 'open', closed], ['Open: second?', 'open', closed]], 'its brief still reads');
    // Its page still opens on the phone.
    const page = await fetch(`${f.origin}${answerRoute(a, first.decisionId).replace(/answer$/, 'files/0')}`, { headers: { ...asClient, 'x-phone-key': p.phone } });
    assert.equal(page.status, 200);
    // Its status lists them, and counts nothing open; the other agent's lists nothing.
    const status = await f.ok(C.AgentStatus, `/api/agents/${a.agent.agentId}`, { agent: a.agentKey });
    assert.deepEqual([status.agent.openCount, status.agent.finishedAt, status.closed], [0, finished.finishedAt, finished.closed]);
    const theirStatus = await f.ok(C.AgentStatus, `/api/agents/${other.agent.agentId}`, { agent: other.agentKey });
    assert.deepEqual([theirStatus.agent.openCount, 'closed' in theirStatus], [1, false]);

    // Nothing can answer, wait for or acknowledge a closed decision; each is refused in the agent's words, with when
    // and why it closed, and stores nothing.
    for (const d of [first, second]) {
      assert.deepEqual(closedRefusal(await f.request(answerRoute(a, d.decisionId), { phone: p.phone, data: await f.sealedAnswer(a.agent.agentId, p.phone, d.decisionId) })), closed, 'the phone\'s answer');
      assert.deepEqual(closedRefusal(await f.request(answerRoute(a, d.decisionId), { agent: a.agentKey })), closed, 'a read');
      const w = hold(f, a, d.decisionId, 20), r = await w.done;
      assert.deepEqual(closedRefusal(r), closed, 'a wait');
      assert.ok(r.at - w.started < BAR_MS, `a wait for it is told at once, not after ${r.at - w.started} ms`);
      assert.deepEqual(closedRefusal(await f.request(`/api/agents/${a.agent.agentId}/cards/${d.decisionId}/acknowledge`, { agent: a.agentKey, data: f.sealedAck(a, d.decisionId, token()) })), closed, 'an acknowledgement');
    }
    assert.deepEqual(await wire(f, p), after, 'the refusals stored nothing');
    await f.refused(409, 'AgentFinished', `/api/agents/${a.agent.agentId}/cards`, { agent: a.agentKey, data: await f.sealed(a, question('After finishing?')) });

    // The answers sent before it finished stay: the phone's resend of one gets its receipt; the agent collects the one
    // it hadn't and acknowledges both; the first acknowledgement still counts alone.
    assert.deepEqual(await f.ok(C.Receipt, answerRoute(a, uncollected.decisionId), { phone: p.phone, data: resend }), uncollectedReceipt);
    const late = await f.read(a, uncollected.decisionId);
    assert.equal(late.status === 'answered' && late.answer.answerId, uncollectedReceipt.answerId);
    await f.ack(a, uncollected.decisionId, uncollectedReceipt.answerId, 'Collected after finishing.');
    await f.ack(a, collected.decisionId, collectedReceipt.answerId, 'Staging first.');
    await f.refused(409, 'AlreadyAcknowledged', `/api/agents/${a.agent.agentId}/cards/${acked.decisionId}/acknowledge`, { agent: a.agentKey, data: f.sealedAck(a, acked.decisionId, ackedReceipt.answerId, 'Again.') });
    const end = (await f.pager(p.pagerId, p.phone)).agents;
    assert.deepEqual(end[0]?.answered.map(d => [d.title, d.status, d.acknowledgement?.nextSteps]).sort(), [
      ['Answered and acknowledged?', 'acknowledged', 'Done before finishing.'], ['Answered and collected?', 'acknowledged', 'Staging first.'], ['Answered, not collected?', 'acknowledged', 'Collected after finishing.'],
    ]);
    assert.ok(end[0]?.answered.every(d => d.closed === undefined), 'an answered decision never closes');
    // The other agent's decision is its own: still open, and answerable (I18.2).
    await f.answer(other.agent.agentId, p.phone, theirs.decisionId);
    const theirRead = await f.read(other, theirs.decisionId);
    assert.equal(theirRead.status, 'answered');
    await f.artifact('pager.json', await f.pager(p.pagerId, p.phone));
  } finally { await f.stop(); }
});

test('B32.11 A wait held for a decision ends as its agent finishes, telling the agent it closed unanswered; another agent\'s wait holds on', { timeout: 180_000 }, async () => {
  const f = await fixture('finish-waits');
  try {
    const { p, a } = await f.connected('Codex', 'finishing');
    const other = await f.connect(p.number, 'Claude Code', 'finishing');
    const one = await f.ask(a, 'Held?'), two = await f.ask(a, 'Held twice?'), theirs = await f.ask(other, 'Still held?');
    // Three waits on the finishing agent's two decisions, the longest the service holds; one on the other agent's.
    const waits = [hold(f, a, one.decisionId, C.ANSWER_WAIT_MAX_SECONDS), hold(f, a, two.decisionId, C.ANSWER_WAIT_MAX_SECONDS), hold(f, a, two.decisionId, C.ANSWER_WAIT_MAX_SECONDS)];
    const kept = hold(f, other, theirs.decisionId, 6);
    await pause(1_500);
    assert.ok([...waits, kept].every(w => !w.settled()), 'every wait holds');
    const sent = Date.now(), finished = await finish(f, a), closed = { at: finished.finishedAt, reason: C.CLOSED_AGENT_FINISHED };
    const ended = await Promise.all(waits.map(w => w.done));
    for (const r of ended) {
      assert.deepEqual(closedRefusal(r), closed);
      assert.ok(r.at - sent < BAR_MS, `the wait ended ${r.at - sent} ms after the finish was sent`);
    }
    // The finish reaches only its own agent's waits: the other holds to its time, and is pending.
    const k = await kept.done;
    assert.equal(k.status, 200);
    assert.deepEqual(decode(C.AnswerStatus, k.value), { status: 'pending' });
    assert.ok(k.at - kept.started >= 6_000, `the other agent's wait was pending after ${k.at - kept.started} ms`);
    // Nothing was collected or stored for the closed ones.
    const seen = (await f.pager(p.pagerId, p.phone)).agents[0];
    assert.deepEqual(seen?.open.map(d => [d.decisionId, d.answer, d.collectedAt, d.closed]), [[one.decisionId, undefined, undefined, closed], [two.decisionId, undefined, undefined, closed]]);
    await f.artifact('timings.json', ended.map(r => r.at - sent));
  } finally { await f.stop(); }
});

// The answer and the finish land one after the other in the pager's store, so whichever lands first wins: an answer
// stored first stays the answer and the finish leaves it alone; a finish first closes the decision and the answer is
// refused, with nothing stored. Never both, and never neither.
test('B25.13 An answer and a finish that race: whichever lands first wins, so no answer is lost and no answered decision closes', { timeout: 240_000 }, async () => {
  const f = await fixture('finish-race');
  try {
    const p = await f.makePager();
    // The answer first: it stays, the finish closes only what has no answer, and the agent collects and acknowledges it.
    const a = await f.connect(p.number, 'Codex', 'answer first');
    const won = await f.ask(a, 'Answered first?'), left = await f.ask(a, 'Left open?');
    const receipt = await f.answer(a.agent.agentId, p.phone, won.decisionId);
    const finished = await finish(f, a);
    assert.deepEqual(finished.closed?.map(c => c.decisionId), [left.decisionId]);
    const read = await f.read(a, won.decisionId);
    assert.equal(read.status === 'answered' && read.answer.answerId, receipt.answerId);
    await f.ack(a, won.decisionId, receipt.answerId, 'It landed first.');

    // The finish first: the answer the phone had ready, as one still in its Undo window is, is refused, and nothing
    // is stored.
    const b = await f.connect(p.number, 'Codex', 'finish first');
    const lost = await f.ask(b, 'Finished first?');
    const ready = await f.sealedAnswer(b.agent.agentId, p.phone, lost.decisionId);
    const done = await finish(f, b), closed = { at: done.finishedAt, reason: C.CLOSED_AGENT_FINISHED };
    assert.deepEqual(done.closed, [{ decisionId: lost.decisionId, ...closed }]);
    assert.deepEqual(closedRefusal(await f.request(answerRoute(b, lost.decisionId), { phone: p.phone, data: ready })), closed);
    const kept = (await f.pager(p.pagerId, p.phone)).agents.find(x => x.agent.agentId === b.agent.agentId)?.open[0];
    assert.deepEqual([kept?.answer, kept?.closed], [undefined, closed], 'nothing stored');

    // At about the same moment: agents each with a wait held, the phone's answer and the agent's finish sent a few
    // milliseconds apart, from the answer 24 ms ahead to the finish 20 ms ahead, since a finish carries no body and
    // lands sooner. Each lands whole, one way or the other, and its wait agrees.
    const agents = await Promise.all(Array.from({ length: 12 }, (_, n) => f.connect(p.number, 'Codex', `race ${n}`)));
    const prepared = await Promise.all(agents.map(async x => {
      const d = await f.ask(x, `Race ${x.agent.agentId.slice(0, 4)}?`);
      return { x, d, body: await f.sealedAnswer(x.agent.agentId, p.phone, d.decisionId) };
    }));
    const waits = prepared.map(r => hold(f, r.x, r.d.decisionId, 30));
    await pause(1_000);
    const sends = prepared.map((r, n) => {
      const lead = (n - 6) * 4, after = (ms: number) => pause(Math.max(0, ms));
      return {
        answered: after(lead).then(() => f.request(answerRoute(r.x, r.d.decisionId), { phone: p.phone, data: r.body })),
        finished: after(-lead).then(() => f.request(`/api/agents/${r.x.agent.agentId}/finish`, { method: 'POST', agent: r.x.agentKey })),
      };
    });
    const outcomes = { answerFirst: 0, finishFirst: 0 };
    const seen = (await Promise.all(sends.map(async s => ({ answered: await s.answered, finished: await s.finished })))), waited = await Promise.all(waits.map(w => w.done));
    const read2 = await f.pager(p.pagerId, p.phone), byId = new Map(read2.agents.map(x => [x.agent.agentId, x]));
    for (const [n, r] of prepared.entries()) {
      const s = seen[n], w = waited[n], mine = byId.get(r.x.agent.agentId);
      assert.ok(s && w && mine);
      assert.equal(s.finished.status, 200, JSON.stringify(s.finished.value));
      const fin = decode(C.Finished, s.finished.value), d = [...mine.open, ...mine.answered].find(y => y.decisionId === r.d.decisionId);
      if (s.answered.status === 200) {
        outcomes.answerFirst++;
        const stored = decode(C.Receipt, s.answered.value);
        assert.deepEqual(fin.closed, [], 'the finish found it answered');
        assert.deepEqual([d?.status, d?.answer?.answerId, d?.closed], ['answered', stored.answerId, undefined]);
        assert.equal(w.status, 200);
        const got = decode(C.AnswerStatus, w.value);
        assert.equal(got.status === 'answered' && got.answer.answerId, stored.answerId, 'its wait had the answer');
      } else {
        outcomes.finishFirst++;
        const why = closedRefusal(s.answered);
        assert.deepEqual(fin.closed, [{ decisionId: r.d.decisionId, ...why }]);
        assert.deepEqual([d?.status, d?.answer, d?.closed], ['open', undefined, why]);
        assert.deepEqual(closedRefusal(w), why, 'its wait was told it closed');
      }
    }
    assert.equal(outcomes.answerFirst + outcomes.finishFirst, prepared.length);
    await f.artifact('outcomes.json', outcomes);
  } finally { await f.stop(); }
});
