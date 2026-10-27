import { test } from 'node:test';
import { fixture, assert, token, C, pause, question } from './support.ts';

test('server clock: pairing window, end time, then forgotten after retention', { timeout: 180_000 }, async () => {
  const f = await fixture('lifecycle-clock', { windowMs: 8_000, lifetimeMs: 16_000, retainMs: 6_000 });
  try {
    const unpaired = await f.create('Pi · never paired');
    const waitingPhone = token(), waiting = await f.phoneCreate(waitingPhone);
    const { s, phone, session } = await f.paired('Claude Code · times out');
    if (session.status !== 'active') throw new Error('not active');
    await pause(Date.parse(unpaired.session.endsAt) - Date.now() + 1_000);

    const timedOut = await f.refused(410, 'PagerEnded', `/api/sessions/${unpaired.session.sessionId}`, { agent: unpaired.agentKey });
    assert.equal(timedOut.endReason, 'timedOut'); assert.equal(timedOut.endedAt, unpaired.session.endsAt, 'it ended at its end time');
    await f.refused(410, 'LinkInvalid', `/api/start/${unpaired.link.code}`);
    await f.refused(410, 'LinkInvalid', `/api/start/${waiting.link.code}/join`, { data: { name: 'Too late' } });
    await f.refused(404, 'UnknownSession', `/api/sessions/${waiting.session.sessionId}/cards`, { phone: waitingPhone });
    // The paired pager outlives the window, but its link code does not.
    assert.equal((await f.inbox(s.session.sessionId, phone)).session.status, 'active');
    await f.refused(410, 'LinkInvalid', `/api/start/${s.link.code}`);

    await pause(Date.parse(session.endsAt) - Date.now() + 1_000);
    const ended = await f.inbox(s.session.sessionId, phone);
    assert.deepEqual(ended, { session: { sessionId: s.session.sessionId, name: 'Claude Code · times out', status: 'ended', endedAt: session.endsAt, endReason: 'timedOut' }, open: [], answered: [] });
    assert.equal((await f.refused(410, 'PagerEnded', `/api/sessions/${s.session.sessionId}/cards`, { agent: s.agentKey, data: question() })).endReason, 'timedOut');

    await pause(Date.parse(session.endsAt) + f.lifetimes.retainMs - Date.now() + 1_000);
    await f.refused(404, 'UnknownSession', `/api/sessions/${s.session.sessionId}/cards`, { phone });
    await f.refused(404, 'UnknownSession', `/api/sessions/${s.session.sessionId}`, { agent: s.agentKey });
    await f.artifact('clock.json', { timedOut, ended });
  } finally { await f.stop(); }
});

test('owner end, agent finish, lifetime counted from now, ten open decisions', { timeout: 180_000 }, async () => {
  const f = await fixture('lifecycle-actions', { windowMs: 60_000, lifetimeMs: 120_000, retainMs: 60_000 });
  try {
    // Owner ends: decisions cleared, the agent's next call names the reason, the phone keeps name/reason/time.
    const one = await f.paired('Claude Code · ended by owner');
    const card = await f.ask(one.s);
    await f.answer(one.s.session.sessionId, one.phone, card.decisionId);
    const end = await f.ok(C.SessionReply, `/api/sessions/${one.s.session.sessionId}/end`, { method: 'POST', phone: one.phone });
    assert.equal(end.session.status, 'ended');
    const endedInbox = await f.inbox(one.s.session.sessionId, one.phone);
    assert.deepEqual(endedInbox.open, []); assert.deepEqual(endedInbox.answered, []);
    assert.deepEqual(endedInbox.session, end.session);
    if (endedInbox.session.status !== 'ended') throw new Error('not ended');
    assert.equal(endedInbox.session.endReason, 'ownerEnded'); assert.equal(endedInbox.session.name, 'Claude Code · ended by owner');
    const agentNext = await f.refused(410, 'PagerEnded', `/api/sessions/${one.s.session.sessionId}/cards/${card.decisionId}/answer`, { agent: one.s.agentKey });
    assert.equal(agentNext.endReason, 'ownerEnded'); assert.match(agentNext.message, /owner ended/);
    assert.equal((await f.refused(410, 'PagerEnded', `/api/sessions/${one.s.session.sessionId}/cards/${card.decisionId}/answer`, { phone: one.phone, data: { requestId: token(), choice: { kind: 'option', number: 1 } } })).name, 'Claude Code · ended by owner');
    assert.deepEqual(await f.ok(C.SessionReply, `/api/sessions/${one.s.session.sessionId}/end`, { method: 'POST', phone: one.phone }), end, 'ending twice is harmless');
    await f.refused(410, 'PagerEnded', `/api/sessions/${one.s.session.sessionId}/lifetime`, { phone: one.phone, data: { lifetime: '7d' } });
    await f.refused(401, 'Unauthorized', `/api/sessions/${one.s.session.sessionId}/cards`, { phone: token() });

    // Agent finishes: the pager ends with that reason, for both sides.
    const two = await f.paired('Codex · finishes');
    const finished = await f.ok(C.Finished, `/api/sessions/${two.s.session.sessionId}/finish`, { method: 'POST', agent: two.s.agentKey });
    const seen = await f.inbox(two.s.session.sessionId, two.phone);
    assert.deepEqual(seen.session, { sessionId: two.s.session.sessionId, name: 'Codex · finishes', status: 'ended', endedAt: finished.endedAt, endReason: 'agentFinished' });
    assert.equal((await f.refused(410, 'PagerEnded', `/api/sessions/${two.s.session.sessionId}`, { agent: two.s.agentKey })).endReason, 'agentFinished');
    const early = await f.create('Pi · finishes unpaired');
    await f.ok(C.Finished, `/api/sessions/${early.session.sessionId}/finish`, { method: 'POST', agent: early.agentKey });
    await f.refused(410, 'LinkInvalid', `/api/start/${early.link.code}`);

    // Lifetime: counted from now once paired; before pairing it is remembered for pairing.
    const three = await f.paired('Claude Code · lifetime', '24h');
    if (three.session.status !== 'active') throw new Error('not active');
    await pause(1_500);
    const before = Date.now();
    const changed = await f.ok(C.SessionReply, `/api/sessions/${three.s.session.sessionId}/lifetime`, { phone: three.phone, data: { lifetime: '30d' } });
    if (changed.session.status !== 'active') throw new Error('not active');
    assert.equal(changed.session.lifetime, '30d');
    const fromNow = Date.parse(changed.session.endsAt) - before;
    assert.ok(fromNow >= f.lifetimes.lifetimeMs - 50 && fromNow <= f.lifetimes.lifetimeMs + 1_000, `endsAt is counted from now (${fromNow})`);
    assert.ok(Date.parse(changed.session.endsAt) > Date.parse(three.session.endsAt));
    await f.refused(400, 'InvalidInput', `/api/sessions/${three.s.session.sessionId}/lifetime`, { phone: three.phone, data: { lifetime: 'never' } });
    const waitingPhone = token(), waiting = await f.phoneCreate(waitingPhone);
    const remembered = await f.ok(C.SessionReply, `/api/sessions/${waiting.session.sessionId}/lifetime`, { phone: waitingPhone, data: { lifetime: '7d' } });
    if (remembered.session.status === 'ended') throw new Error('ended');
    assert.equal(remembered.session.lifetime, '7d'); assert.equal(remembered.session.endsAt, waiting.session.endsAt, 'the pairing window still ends it');

    // At most ten open decisions; answering one frees a slot.
    const four = await f.paired('Claude Code · busy');
    const asked = [];
    for (let n = 1; n <= C.MAX_OPEN_DECISIONS; n++) asked.push(await f.ask(four.s, `Question ${n}`));
    const full = await f.refused(409, 'TooManyOpenDecisions', `/api/sessions/${four.s.session.sessionId}/cards`, { agent: four.s.agentKey, data: question('Eleventh') });
    assert.equal(full.limit, 10); assert.match(full.message, /10 open decisions/);
    await f.answer(four.s.session.sessionId, four.phone, asked[0].decisionId);
    await f.ask(four.s, 'Eleventh, after an answer');
    assert.equal((await f.inbox(four.s.session.sessionId, four.phone)).open.length, 10);
    await f.artifact('actions.json', { end, finished, changed, full });
  } finally { await f.stop(); }
});
