import { test } from 'node:test';
import { fixture, assert, token, C, pause, pagerKeys, question } from './support.ts';

test('pagers and agents: the phone makes a pager, every connect is a new agent, the phone reads them all', { timeout: 180_000 }, async () => {
  const f = await fixture('pagers');
  try {
    // A phone makes a pager with a key, a well-formed number, and the public key the number's fingerprint names.
    const keys = pagerKeys(), phone = token();
    const create = (data: unknown, key: string | null = phone) => ({ data, ...(key ? { phone: key } : {}) });
    await f.refused(401, 'Unauthorized', '/api/pagers', create({ number: keys.number, publicKey: keys.publicKey, autoOff: 'never' }, null));
    await f.refused(400, 'InvalidInput', '/api/pagers', create({ number: keys.number, publicKey: keys.publicKey }));
    await f.refused(400, 'InvalidInput', '/api/pagers', create({ number: keys.number, publicKey: keys.publicKey, autoOff: 'never', name: 'Work' })); // the name stays on the phone
    const mismatch = await f.refused(400, 'InvalidInput', '/api/pagers', create({ number: keys.number, publicKey: pagerKeys().publicKey, autoOff: 'never' }));
    assert.match(mismatch.reason ?? '', /fingerprint/);
    const made = await f.ok(C.PagerReply, '/api/pagers', create({ number: keys.number, publicKey: keys.publicKey, autoOff: 'never' }));
    assert.deepEqual({ ...made.pager, createdAt: '' }, { pagerId: keys.pagerId, on: true, autoOff: 'never', offAt: null, offSince: null, createdAt: '' });
    await f.refused(409, 'PagerExists', '/api/pagers', create({ number: keys.number, publicKey: keys.publicKey, autoOff: 'never' }, token()));
    // The same phone making it again, as after a lost reply, gets the same pager back, with the turn-off choice it asks
    // for now (the owner may have changed it after the failure).
    const again = await f.ok(C.PagerReply, '/api/pagers', create({ number: keys.number, publicKey: keys.publicKey, autoOff: 'never' }));
    assert.deepEqual(again.pager, made.pager);
    const changed = await f.ok(C.PagerReply, '/api/pagers', create({ number: keys.number, publicKey: keys.publicKey, autoOff: '24h' }));
    assert.equal(changed.pager.autoOff, '24h');
    assert.ok(changed.pager.offAt && Date.parse(changed.pager.offAt) > Date.now(), 'turns off 24 h from now');
    await f.ok(C.PagerReply, `/api/pagers/${keys.pagerId}/settings`, { phone, data: { autoOff: 'never' } });
    assert.deepEqual((await f.pager(keys.pagerId, phone)).agents, []);
    await f.refused(401, 'Unauthorized', `/api/pagers/${keys.pagerId}`, { phone: token() });
    await f.refused(404, 'UnknownPager', `/api/pagers/${pagerKeys().pagerId}`, { phone });

    // Each connect is a new agent, even with the same app and project.
    const a = await f.connect(keys.number, 'Codex', 'atomic-pages');
    assert.match(a.message, /new agent/); assert.match(a.message, /connecting again adds another agent/);
    assert.deepEqual([a.agent.app, a.agent.project, a.agent.finishedAt, a.agent.openCount], ['Codex', 'atomic-pages', null, 0]);
    const b = await f.connect(keys.number, 'Codex', 'atomic-pages');
    assert.notEqual(a.agent.agentId, b.agent.agentId);
    const c = await f.connect(keys.number, 'Claude Code', 'agentpager');
    const raw = await f.request('/api/agents', { data: f.connectBody(keys.number, 'Pi', 'raw') });
    assert.deepEqual(Object.keys(raw.value ?? {}).sort(), ['agent', 'agentKey', 'message'], 'nothing to show the owner');
    for (const bad of [pagerKeys().number, keys.number.slice(0, -1) + (keys.number.endsWith('A') ? 'B' : 'A'), 'not-a-number', 'ap1_' + 'x'.repeat(31)]) {
      await f.refused(410, 'NumberInvalid', '/api/agents', { data: f.connectBody(bad, 'Codex', 'nope') });
    }
    // Who asked and the project travel only sealed; the service can't check them, so the command does (I4.9).
    await f.refused(400, 'InvalidInput', '/api/agents', { data: { number: keys.number } });
    await f.refused(400, 'InvalidInput', '/api/agents', { data: { number: keys.number, identity: 'Codex' } });
    await f.refused(400, 'InvalidInput', '/api/agents', { data: { ...f.connectBody(keys.number), app: 'Codex', project: 'readable' } });

    // The usual exchange; the phone reads every agent's decisions with one call.
    const asked = await f.ask(a, 'Ship it?');
    await f.ask(c, 'Which docs first?');
    let seen = await f.pager(keys.pagerId, phone);
    assert.deepEqual(seen.agents.map(x => x.agent.agentId), [a.agent.agentId, b.agent.agentId, c.agent.agentId, seen.agents[3].agent.agentId], 'in connect order');
    assert.deepEqual(seen.agents.map(x => x.open.map(d => d.title)), [['Ship it?'], [], ['Which docs first?'], []]);
    assert.equal(seen.agents[0].agent.openCount, 1);
    const receipt = await f.answer(a.agent.agentId, phone, asked.decisionId);
    const read = await f.read(a, asked.decisionId, 2);
    if (read.status !== 'answered') throw new Error('unanswered');
    assert.equal(read.answer.answerId, receipt.answerId);
    await f.ack(a, asked.decisionId, receipt.answerId, 'Shipping now.');
    seen = await f.pager(keys.pagerId, phone);
    assert.equal(seen.agents[0].answered[0].acknowledgement?.nextSteps, 'Shipping now.');
    // Another phone's key reads nothing and answers nothing; an agent's key is no phone key.
    await f.refused(401, 'Unauthorized', `/api/agents/${c.agent.agentId}/cards/${seen.agents[2].open[0].decisionId}/answer`, { phone: token(), data: { requestId: token(), choice: { kind: 'option', number: 1 } } });
    await f.refused(401, 'Unauthorized', `/api/agents/${a.agent.agentId}`, { agent: c.agentKey });
    // Status: the agent and whether its pager is on.
    const status = await f.ok(C.AgentStatus, `/api/agents/${a.agent.agentId}`, { agent: a.agentKey });
    assert.deepEqual([status.agent.agentId, status.pager.on], [a.agent.agentId, true]);
    await f.refused(404, 'UnknownAgent', `/api/agents/${token()}`, { agent: a.agentKey });

    // Ten unanswered decisions per agent; answering one frees a slot.
    const busy = await f.connect(keys.number, 'Codex', 'busy');
    const open = [];
    for (let n = 1; n <= C.MAX_OPEN_DECISIONS; n++) open.push(await f.ask(busy, `Question ${n}`));
    const full = await f.refused(409, 'TooManyOpenDecisions', `/api/agents/${busy.agent.agentId}/cards`, { agent: busy.agentKey, data: await f.sealed(busy, question('Eleventh')) });
    assert.equal(full.limit, 10); assert.match(full.message, /10 unanswered decisions from you/);
    await f.answer(busy.agent.agentId, phone, open[0].decisionId);
    await f.ask(busy, 'Eleventh, after an answer');

    // Finishing: the phone sees it; the agent asks nothing more, but still reads and acknowledges.
    const late = await f.ask(c, 'Before finishing?');
    const finished = await f.ok(C.Finished, `/api/agents/${c.agent.agentId}/finish`, { method: 'POST', agent: c.agentKey });
    assert.deepEqual(await f.ok(C.Finished, `/api/agents/${c.agent.agentId}/finish`, { method: 'POST', agent: c.agentKey }), finished, 'finishing twice is harmless');
    assert.match((await f.refused(409, 'AgentFinished', `/api/agents/${c.agent.agentId}/cards`, { agent: c.agentKey, data: await f.sealed(c, question()) })).message, /connect again/);
    const lateReceipt = await f.answer(c.agent.agentId, phone, late.decisionId, { kind: 'feedback', text: 'Not now.' });
    await f.ack(c, late.decisionId, lateReceipt.answerId, 'Leaving it.');
    assert.equal((await f.pager(keys.pagerId, phone)).agents[2].agent.finishedAt, finished.finishedAt);
    await f.artifact('pager.json', await f.pager(keys.pagerId, phone));
  } finally { await f.stop(); }
});

test('off: nothing gets through and nothing is queued; the phone keeps everything; on again, answerable again', { timeout: 180_000 }, async () => {
  const f = await fixture('pager-off');
  try {
    const { p, a } = await f.connected('Codex', 'off');
    const asked = await f.ask(a, 'Before off?');
    const off = await f.settings(p.pagerId, p.phone, { on: false });
    assert.equal(off.pager.on, false); assert.equal(off.pager.offAt, null); assert.ok(off.pager.offSince);
    const agentId = a.agent.agentId, cards = `/api/agents/${agentId}/cards`;
    const refusals = [
      await f.refused(409, 'PagerOff', '/api/agents', { data: f.connectBody(p.number, 'Codex', 'off') }),
      await f.refused(409, 'PagerOff', cards, { agent: a.agentKey, data: await f.sealed(a, question('While off?')) }),
      await f.refused(409, 'PagerOff', `${cards}/${asked.decisionId}/answer?wait=1`, { agent: a.agentKey }),
      await f.refused(409, 'PagerOff', `/api/agents/${agentId}/finish`, { method: 'POST', agent: a.agentKey }),
      await f.refused(409, 'PagerOff', `${cards}/${asked.decisionId}/answer`, { phone: p.phone, data: await f.sealedAnswer(agentId, p.phone, asked.decisionId, { kind: 'option', number: 1 }) }),
    ];
    for (const r of refusals) assert.match(r.message, /^This pager is turned off\. Your message was not delivered\./);
    // A wrong key is still refused as unauthorized first.
    await f.refused(401, 'Unauthorized', cards, { agent: token(), data: question() });
    assert.equal((await f.ok(C.AgentStatus, `/api/agents/${agentId}`, { agent: a.agentKey })).pager.on, false, 'status says so');
    // The phone reads everything while off; nothing sent while off arrived.
    const seen = await f.pager(p.pagerId, p.phone);
    assert.equal(seen.pager.on, false);
    assert.deepEqual(seen.agents.map(x => x.open.map(d => d.title)), [['Before off?']]);
    await f.settings(p.pagerId, p.phone, { on: false });
    assert.equal((await f.pager(p.pagerId, p.phone)).pager.offSince, off.pager.offSince, 'turning off twice keeps the time');

    const on = await f.settings(p.pagerId, p.phone, { on: true });
    assert.deepEqual([on.pager.on, on.pager.offSince, on.pager.offAt], [true, null, null]);
    const receipt = await f.answer(agentId, p.phone, asked.decisionId);
    await f.ack(a, asked.decisionId, receipt.answerId);
    await f.ask(a, 'After on?');
    await f.refused(400, 'InvalidInput', `/api/pagers/${p.pagerId}/settings`, { phone: p.phone, data: { on: 'yes' } });
    await f.refused(401, 'Unauthorized', `/api/pagers/${p.pagerId}/settings`, { phone: token(), data: { on: 'yes' } });
  } finally { await f.stop(); }
});

test('auto-off lands in the same off state; turning on starts its clock again', { timeout: 180_000 }, async () => {
  const f = await fixture('auto-off', { autoOffMs: 4_000, idleMs: 0 });
  try {
    const p = await f.makePager('24h');
    assert.ok(p.pager.offAt); assert.equal(p.pager.autoOff, '24h');
    const a = await f.connect(p.number);
    await f.ask(a, 'Before auto-off?');
    await pause(Date.parse(p.pager.offAt ?? '') - Date.now() + 500);
    const seen = await f.pager(p.pagerId, p.phone);
    assert.deepEqual([seen.pager.on, seen.pager.offSince, seen.pager.offAt], [false, p.pager.offAt, null], 'off since it was due');
    await f.refused(409, 'PagerOff', `/api/agents/${a.agent.agentId}/cards`, { agent: a.agentKey, data: await f.sealed(a, question()) });

    const on = await f.settings(p.pagerId, p.phone, { on: true });
    assert.ok(Date.parse(on.pager.offAt ?? '') > Date.now() + 2_000, 'counted from now');
    // Changing the setting while on counts from now; never clears it.
    assert.equal((await f.settings(p.pagerId, p.phone, { autoOff: 'never' })).pager.offAt, null);
    await pause(4_500);
    assert.equal((await f.pager(p.pagerId, p.phone)).pager.on, true, 'never turns off');
    // Set while off, the choice waits for the next turn on.
    await f.settings(p.pagerId, p.phone, { on: false });
    const later = await f.settings(p.pagerId, p.phone, { autoOff: '7d' });
    assert.deepEqual([later.pager.on, later.pager.autoOff, later.pager.offAt], [false, '7d', null]);
    assert.ok((await f.settings(p.pagerId, p.phone, { on: true })).pager.offAt);
  } finally { await f.stop(); }
});

test('delete takes the agents and their decisions; housekeeping forgets an idle agent', { timeout: 180_000 }, async () => {
  const f = await fixture('delete-and-housekeeping', { autoOffMs: 0, idleMs: 6_000 });
  try {
    const { p, a } = await f.connected('Codex', 'delete');
    const asked = await f.ask(a, 'Deleted soon?');
    await f.refused(401, 'Unauthorized', `/api/pagers/${p.pagerId}/delete`, { method: 'POST', phone: token(), data: { now: true } });
    await f.refused(400, 'InvalidInput', `/api/pagers/${p.pagerId}/delete`, { method: 'POST', phone: p.phone, data: { now: true } });
    await f.request(`/api/pagers/${p.pagerId}/delete`, { method: 'POST', phone: p.phone });
    await f.refused(404, 'UnknownPager', `/api/pagers/${p.pagerId}`, { phone: p.phone });
    await f.refused(404, 'UnknownAgent', `/api/agents/${a.agent.agentId}/cards/${asked.decisionId}/answer`, { agent: a.agentKey });
    await f.refused(410, 'NumberInvalid', '/api/agents', { data: f.connectBody(p.number, 'Codex', 'delete') });

    // Idle for longer than housekeeping allows: forgotten, and its pager no longer lists it.
    const { p: q, a: idle } = await f.connected('Codex', 'idle');
    const active = await f.connect(q.number, 'Codex', 'active');
    for (let n = 0; n < 4; n++) { await pause(2_500); await f.ask(active, `Still here ${n}?`); }
    await f.refused(404, 'UnknownAgent', `/api/agents/${idle.agent.agentId}`, { agent: idle.agentKey });
    assert.deepEqual((await f.pager(q.pagerId, q.phone)).agents.map(x => x.agent.agentId), [active.agent.agentId]);
  } finally { await f.stop(); }
});

// One store per pager handles turning it off and every call on it one after the other, so a call either landed before
// the off, and shows with a time no later than the off's, or comes after it and is refused as off with nothing stored.
// Each round fires every kind of call that sends or collects something (asking, waiting for an answer, acknowledging,
// finishing, connecting, the phone's answer) in one burst, with the off sent in the middle of it, then reads what the
// pager holds as the phone does.
test('I17.2 A call that lands as the pager turns off is refused as off with nothing stored, or was stored before the off; none lands after it', { timeout: 300_000 }, async () => {
  const f = await fixture('off-race');
  try {
    const p = await f.makePager();
    const outcomes = { landed: 0, refused: 0 };
    for (let round = 1; round <= 6; round++) {
      // Fresh agents each round, each with a decision answered and collected (to acknowledge), one answered and not
      // collected (to collect), and one open (for the phone to answer).
      const agents = await Promise.all([1, 2, 3, 4].map(n => f.connect(p.number, 'Codex', `race ${round}.${n}`)));
      const prepared = await Promise.all(agents.map(async a => {
        const [toAck, toCollect, toAnswer] = [await f.ask(a, 'To acknowledge?'), await f.ask(a, 'To collect?'), await f.ask(a, 'To answer?')];
        const receipt = await f.answer(a.agent.agentId, p.phone, toAck.decisionId);
        await f.answer(a.agent.agentId, p.phone, toCollect.decisionId);
        assert.equal((await f.read(a, toAck.decisionId)).status, 'answered');
        const q = question(`Asked in round ${round}?`), asked = await C.decisionIdOf(a.agent.agentId, q.requestId);
        return { a, toAck, receipt, toCollect, toAnswer, ask: await f.sealed(a, q), asked, answer: await f.sealedAnswer(a.agent.agentId, p.phone, toAnswer.decisionId), ack: f.sealedAck(a, toAck.decisionId, receipt.answerId) };
      }));
      const cards = (x: typeof prepared[number]) => `/api/agents/${x.a.agent.agentId}/cards`;
      type Call = { kind: string; send: () => ReturnType<typeof f.request> };
      const calls: Call[] = prepared.flatMap(x => [
        { kind: 'ask', send: () => f.request(cards(x), { agent: x.a.agentKey, data: x.ask }) },
        { kind: 'collect', send: () => f.request(`${cards(x)}/${x.toCollect.decisionId}/answer`, { agent: x.a.agentKey }) },
        { kind: 'acknowledge', send: () => f.request(`${cards(x)}/${x.toAck.decisionId}/acknowledge`, { agent: x.a.agentKey, data: x.ack }) },
        { kind: 'answer', send: () => f.request(`${cards(x)}/${x.toAnswer.decisionId}/answer`, { phone: p.phone, data: x.answer }) },
      ]);
      // An agent of its own finishes, so its finish races only the off.
      const last = await f.connect(p.number, 'Codex', `race ${round} finishing`);
      calls.push({ kind: 'finish', send: () => f.request(`/api/agents/${last.agent.agentId}/finish`, { method: 'POST', agent: last.agentKey }) });
      for (let n = 0; n < 3; n++) calls.push({ kind: 'connect', send: () => f.request('/api/agents', { data: f.connectBody(p.number, 'Codex', `race ${round} connect ${n}`) }) });
      // Interleaved so each kind sits on both sides of the off.
      const order = calls.map((c, i) => ({ c, key: (i * 7919) % calls.length })).sort((x, y) => x.key - y.key).map(x => x.c);
      const half = Math.floor(order.length / 2);
      const before = order.slice(0, half).map(c => c.send());
      const off = f.settings(p.pagerId, p.phone, { on: false });
      const after = order.slice(half).map(c => c.send());
      const replies = await Promise.all([...before, ...after]);
      const offSince = Date.parse((await off).pager.offSince ?? '');
      const seen = await f.pager(p.pagerId, p.phone);
      const byId = new Map(seen.agents.map(x => [x.agent.agentId, x]));
      const kinds = [...order.slice(0, half), ...order.slice(half)];
      // Each reply is either the call done or refused as off.
      for (const [i, r] of replies.entries()) {
        const tag = typeof r.value === 'object' && r.value !== null && 'error' in r.value ? r.value.error : undefined;
        assert.ok(r.status === 200 || (r.status === 409 && tag === 'PagerOff'), `${kinds[i].kind}: ${r.status} ${JSON.stringify(r.value).slice(0, 200)}`);
        if (r.status === 200) outcomes.landed++; else outcomes.refused++;
      }
      const result = (send: () => unknown) => { const i = kinds.findIndex(c => c.send === send); return replies[i].status === 200; };
      const before_ = (at: string | undefined, what: string) => assert.ok(at && Date.parse(at) <= offSince, `${what} at ${at}, after the off at ${new Date(offSince).toISOString()}`);
      for (const [n, x] of prepared.entries()) {
        const mine = byId.get(x.a.agent.agentId), all = [...(mine?.open ?? []), ...(mine?.answered ?? [])], d = (id: string) => all.find(y => y.decisionId === id);
        const call = (kind: string) => calls.filter(c => c.kind === kind)[n].send;
        const asked = d(x.asked);
        if (result(call('ask'))) before_(asked?.askedAt, 'an ask that landed'); else assert.equal(asked, undefined, 'a refused ask stored nothing');
        const collected = d(x.toCollect.decisionId)?.collectedAt;
        if (result(call('collect'))) before_(collected, 'a collection that landed'); else assert.equal(collected, undefined, 'a refused read collected nothing');
        const acked = d(x.toAck.decisionId)?.acknowledgement;
        if (result(call('acknowledge'))) before_(acked?.acknowledgedAt, 'an acknowledgement that landed'); else assert.equal(acked, undefined, 'a refused acknowledgement stored nothing');
        const answered = d(x.toAnswer.decisionId)?.answer;
        if (result(call('answer'))) before_(answered?.sentAt, 'an answer that landed'); else assert.equal(answered, undefined, 'a refused answer stored nothing');
      }
      const finished = byId.get(last.agent.agentId)?.agent.finishedAt ?? undefined;
      const finish = calls.find(c => c.kind === 'finish');
      assert.ok(finish);
      if (result(finish.send)) before_(finished, 'a finish that landed'); else assert.equal(finished, undefined, 'a refused finish stored nothing');
      const connects = calls.filter(c => c.kind === 'connect').map(c => replies[kinds.indexOf(c)]);
      const joined = seen.agents.filter(x => x.agent.project.startsWith(`race ${round} connect`));
      assert.equal(joined.length, connects.filter(r => r.status === 200).length, 'one agent for each connect that landed, and none for a refused one');
      for (const x of joined) before_(x.agent.createdAt, 'a connect that landed');
      await f.settings(p.pagerId, p.phone, { on: true });
    }
    // The bursts straddled the off: calls landed as it turned off, and calls were refused.
    assert.ok(outcomes.landed > 0 && outcomes.refused > 0, `landed ${outcomes.landed}, refused ${outcomes.refused}`);
    await f.artifact('outcomes.json', outcomes);
  } finally { await f.stop(); }
});
