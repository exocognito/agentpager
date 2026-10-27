import { test } from 'node:test';
import { fixture, assert, token, C, decode, wrongCode, emojiCard } from './support.ts';

test('agent-made link: create, palette, pair by code, ask before pairing, answer, ack', { timeout: 180_000 }, async () => {
  const f = await fixture('pairing-agent-link');
  try {
    const s = await f.create('Claude Code · blueprint', '7d');
    assert.equal(s.session.status, 'unpaired'); assert.equal(s.session.lifetime, '7d'); assert.equal(s.session.triesLeft, 3);
    assert.equal(s.link.url, `${f.origin}/start/${s.link.code}`, 'links carry the caller origin');
    assert.equal(s.link.qrUrl, `${s.link.url}/qr.svg`);
    assert.equal(Date.parse(s.session.endsAt) - Date.parse(s.session.createdAt), f.lifetimes.windowMs, 'unpaired pager ends with its pairing window');
    // The agent prints the code as plain text with names.
    const [a, b, c] = s.pairingCode.names;
    assert.ok(s.pairingCode.text.includes(`in this order:\n${s.pairingCode.emojis.join(' ')}\n(1. ${a}    2. ${b}    3. ${c})`), s.pairingCode.text);
    const info = await f.info(s.link.code);
    assert.equal(info.palette.length, C.PALETTE_SIZE); assert.equal(new Set(info.palette.map(p => p.emoji)).size, C.PALETTE_SIZE);
    for (const e of s.pairingCode.emojis) assert.ok(info.palette.some(p => p.emoji === e), 'palette contains the code');
    for (const p of info.palette) assert.ok(C.PAIRING_EMOJIS.some(([emoji, name]) => emoji === p.emoji && name === p.name), 'palette comes from the curated set');
    assert.equal(info.name, 'Claude Code · blueprint'); assert.equal(info.status, 'unpaired');
    assert.equal(JSON.stringify(info).includes('pairingCode'), false, 'the phone is never told the code');

    // An agent may ask before pairing; the phone sees nothing until it pairs.
    const early = await f.ask(s, 'Asked before pairing');
    const phone = token();
    const wrong = await f.refused(400, 'WrongCode', `/api/start/${s.link.code}/pair`, { phone, data: { code: wrongCode(info.palette, s.pairingCode.emojis) } });
    assert.equal(wrong.triesLeft, 2);
    assert.equal((await f.info(s.link.code)).triesLeft, 2, 'tries are counted on the server');
    const paired = await f.pair(s.link.code, phone, s.pairingCode.emojis);
    assert.equal(paired.session.status, 'active');
    if (paired.session.status !== 'active') throw new Error('not active');
    assert.equal(Date.parse(paired.session.endsAt) - Date.parse(paired.session.pairedAt ?? ''), f.lifetimes.lifetimeMs, 'lifetime counts from pairing');
    assert.deepEqual((await f.pair(s.link.code, phone, s.pairingCode.emojis)).session.status, 'active', 'the same phone replays success');
    await f.refused(409, 'AlreadyPaired', `/api/start/${s.link.code}/pair`, { phone: token(), data: { code: s.pairingCode.emojis } });
    await f.refused(409, 'AlreadyJoined', `/api/start/${s.link.code}/join`, { data: { name: 'Second agent' } });
    const status = await f.ok(C.AgentStatus, `/api/sessions/${s.session.sessionId}`, { agent: s.agentKey });
    assert.equal(status.pairingCode, null, 'the code is gone from status once paired');

    const inbox = await f.inbox(s.session.sessionId, phone);
    assert.deepEqual(inbox.open.map(d => d.decisionId), [early.decisionId]);
    const second = await f.ask(s, 'Second');
    const receipt = await f.answer(s.session.sessionId, phone, early.decisionId, { kind: 'option', number: 1 });
    const read = await f.read(s, early.decisionId, 2);
    assert.equal(read.status, 'answered'); if (read.status !== 'answered') throw new Error('unanswered');
    assert.equal(read.answer.answerId, receipt.answerId);
    await f.ack(s, early.decisionId, receipt.answerId, 'Running the first plan now.');
    await f.answer(s.session.sessionId, phone, second.decisionId, { kind: 'feedback', text: 'Make it shorter.' });
    const after = await f.inbox(s.session.sessionId, phone);
    assert.equal(after.open.length, 0);
    assert.deepEqual(after.answered.map(d => d.decisionId), [second.decisionId, early.decisionId], 'newest answer first');
    assert.equal(after.answered[1].status, 'acknowledged'); assert.equal(after.answered[1].acknowledgement?.nextSteps, 'Running the first plan now.');
    assert.equal(after.answered[0].status, 'feedback');
    await f.artifact('agent-link.json', { created: { ...s, agentKey: '[redacted]' }, info, after });
  } finally { await f.stop(); }
});

test('phone-made link: phone creates, one agent joins, others refused, phone pairs', { timeout: 180_000 }, async () => {
  const f = await fixture('pairing-phone-link');
  try {
    const phone = token();
    await f.refused(401, 'Unauthorized', '/api/pagers', { data: { lifetime: '30d' } });
    const made = await f.phoneCreate(phone, '30d');
    assert.equal(made.session.status, 'waiting'); assert.equal(made.session.name, null); assert.equal(made.session.lifetime, '30d');
    assert.equal(made.link.url, `${f.origin}/start/${made.link.code}`);
    const waiting = await f.inbox(made.session.sessionId, phone);
    assert.equal(waiting.session.status, 'waiting');
    await f.refused(409, 'WaitingForAgent', `/api/start/${made.link.code}/pair`, { phone, data: { code: ['🦊', '🦊', '🦊'] } });
    await f.refused(401, 'Unauthorized', `/api/sessions/${made.session.sessionId}/cards`, { phone: token() });

    const joins = await Promise.all([1, 2, 3].map(n => f.request(`/api/start/${made.link.code}/join`, { data: { name: `Codex · racer ${n}` } })));
    assert.deepEqual(joins.map(j => j.status).sort(), [200, 409, 409], 'exactly one join takes the pager');
    const winner = joins.find(j => j.status === 200);
    if (!winner) throw new Error('no winner');
    const j = decode(C.Joined, winner.value);
    assert.equal(j.session.status, 'unpaired'); assert.equal(j.session.sessionId, made.session.sessionId);
    assert.match(j.pairingCode.text, /in this order:/);
    const listed = await f.inbox(made.session.sessionId, phone);
    assert.equal(listed.session.status, 'unpaired'); assert.equal(listed.session.name, j.session.name);
    // Another phone holding the leaked link cannot use up the owner's tries.
    await f.refused(401, 'Unauthorized', `/api/start/${made.link.code}/pair`, { phone: token(), data: { code: j.pairingCode.emojis } });
    assert.equal((await f.info(made.link.code)).triesLeft, 3);
    const p = await f.pair(made.link.code, phone, j.pairingCode.emojis);
    assert.equal(p.session.status, 'active');
    if (p.session.status !== 'active') throw new Error('not active');
    assert.equal(p.session.lifetime, '30d', 'the phone-chosen lifetime applies at pairing');
    assert.equal(Date.parse(p.session.endsAt) - Date.parse(p.session.pairedAt ?? ''), f.lifetimes.lifetimeMs);
    const card = await f.ask(j, 'From the joined agent');
    assert.deepEqual((await f.inbox(made.session.sessionId, phone)).open.map(d => d.decisionId), [card.decisionId]);
    await f.artifact('phone-link.json', { made: { ...made, link: { ...made.link, qrText: '[qr]' } }, joinStatuses: joins.map(x => x.status) });
  } finally { await f.stop(); }
});

test('three wrong codes end the pager as pairing failed; the agent hears it next call', { timeout: 180_000 }, async () => {
  const f = await fixture('pairing-failed');
  try {
    const s = await f.create('Pi · wrong codes');
    const info = await f.info(s.link.code), phone = token(), bad = wrongCode(info.palette, s.pairingCode.emojis);
    const route = `/api/start/${s.link.code}/pair`;
    assert.equal((await f.refused(400, 'WrongCode', route, { phone, data: { code: bad } })).triesLeft, 2);
    assert.equal((await f.refused(400, 'WrongCode', route, { phone: token(), data: { code: bad } })).triesLeft, 1, 'tries are per pager, not per phone');
    const failed = await f.refused(410, 'PagerEnded', route, { phone, data: { code: bad } });
    assert.equal(failed.endReason, 'pairingFailed');
    // The right code no longer helps: the link is gone.
    await f.refused(410, 'LinkInvalid', route, { phone, data: { code: s.pairingCode.emojis } });
    await f.refused(410, 'LinkInvalid', `/api/start/${s.link.code}`);
    const next = await f.refused(410, 'PagerEnded', `/api/sessions/${s.session.sessionId}/cards`, { agent: s.agentKey, data: emojiCard });
    assert.equal(next.endReason, 'pairingFailed'); assert.match(next.message, /Pairing failed/);
    await f.refused(401, 'Unauthorized', `/api/sessions/${s.session.sessionId}`, { agent: token() });
    await f.artifact('failed.json', { failed, next });
  } finally { await f.stop(); }
});
