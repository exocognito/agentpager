import { test } from 'node:test';
import { fixture, assert, token, until, question, C, apple, device, registered, openPreview } from './support.ts';

test('B17.11 alerts: a pager whose phone gave its token alerts when an agent asks and acknowledges, with only plain words and the preview the phone opens', { timeout: 180_000 }, async () => {
  const { replies, sent, close } = await apple();
  const f = await fixture('push'), register = registered(f);
  try {
    const p = await f.makePager(), mine = device();
    await f.refused(401, 'Unauthorized', `/api/pagers/${p.pagerId}/push`, { phone: token(), data: { token: mine, environment: 'sandbox' } });
    await f.refused(400, 'InvalidInput', `/api/pagers/${p.pagerId}/push`, { phone: p.phone, data: { token: 'not-hex', environment: 'sandbox' } });
    await f.refused(400, 'InvalidInput', `/api/pagers/${p.pagerId}/push`, { phone: p.phone, data: { token: mine, environment: 'staging' } });
    // The phone gives its token to the pager once; every agent that connects later alerts with it.
    await register(p.pagerId, p.phone, mine);
    const a = await f.connect(p.number, 'Claude Code', 'alerts');

    // A decision: time sensitive, collapsing on the decision. Its words are the preview the agent sealed, which the
    // phone opens to show who asked, the project, the question and the recommended option; Apple gets only the plain
    // fallback (B17.11).
    const asked = await f.ask(a, 'Ship it?');
    const [decisionAlert] = await until(async () => sent(mine), d => d.length === 1);
    const aps = decisionAlert.payload.aps;
    assert.deepEqual(aps.alert, { title: 'AgentPager', body: 'New decision' });
    assert.equal(aps['mutable-content'], 1, 'the phone may change it before it shows');
    assert.deepEqual(openPreview(decisionAlert.payload), { title: 'Ship it?', recommended: { letter: 'B', title: 'Second plan' }, app: 'Claude Code', project: 'alerts' });
    assert.equal(aps['interruption-level'], 'time-sensitive');
    assert.equal(aps['thread-id'], p.pagerId);
    assert.deepEqual([decisionAlert.payload.kind, decisionAlert.payload.pagerId, decisionAlert.payload.agentId, decisionAlert.payload.decisionId], ['decision', p.pagerId, a.agent.agentId, asked.decisionId]);
    assert.equal(decisionAlert.headers['apns-topic'], 'me.agentpager.app.dev');
    assert.equal(decisionAlert.headers['apns-push-type'], 'alert');
    assert.equal(decisionAlert.headers['apns-collapse-id'], asked.decisionId);
    const expires = Number(decisionAlert.headers['apns-expiration']) * 1000 - Date.now();
    assert.ok(expires > 23 * 3_600_000 && expires <= 24 * 3_600_000, 'never delivered more than a day late');

    // The agent's acknowledgement carries its words and is not time sensitive.
    const receipt = await f.answer(a.agent.agentId, p.phone, asked.decisionId);
    await f.ack(a, asked.decisionId, receipt.answerId, 'Shipping now.');
    const ackAlert = (await until(async () => sent(mine), d => d.length === 2))[1];
    assert.deepEqual(ackAlert.payload.aps.alert, { title: 'AgentPager', body: 'New acknowledgement' });
    assert.deepEqual(openPreview(ackAlert.payload), { nextSteps: 'Shipping now.', app: 'Claude Code', project: 'alerts', title: 'Ship it?' });
    assert.equal(ackAlert.payload.aps['interruption-level'], 'active');
    assert.equal(ackAlert.payload.kind, 'acknowledgement');

    // Apple failing an alert never refuses the agent.
    replies.set(mine, { status: 500, reason: 'InternalServerError' });
    await f.ask(a, 'Still there?');
    await until(async () => sent(mine), d => d.length === 3);

    // A token Apple says is gone is dropped: no more alerts until the phone gives one again.
    replies.set(mine, { status: 410, reason: 'Unregistered' });
    await f.ask(a, 'Gone?');
    await until(async () => sent(mine), d => d.length === 4);
    await f.ask(a, 'Anyone?');
    assert.equal(sent(mine).length, 4, 'no alert after Apple said the token is gone');
    const fresh = device();
    await register(p.pagerId, p.phone, fresh);
    const b = await f.connect(p.number, 'Codex', 'second agent');
    await f.ask(b, 'Back?');
    const back = await until(async () => sent(fresh), d => d.length === 1);
    assert.equal(openPreview(back[0].payload).project, 'second agent');

    // Off: nothing is sent, so nothing alerts.
    await f.settings(p.pagerId, p.phone, { on: false });
    await f.refused(409, 'PagerOff', `/api/agents/${b.agent.agentId}/cards`, { agent: b.agentKey, data: await f.sealed(b, question('While off?')) });
    assert.equal(sent(fresh).length, 1);
  } finally {
    await f.stop();
    close();
  }
});

// I6: an answer no agent collects within the pickup time gets one alert and a warning on its decision; collecting
// it later takes the warning off but is never an acknowledgement. Local pickup time 3 s; the words say 3 min.
test('not picked up: one alert and a warning when no agent collects an answer in time', { timeout: 180_000 }, async () => {
  const { sent, close } = await apple();
  const f = await fixture('pickup', { autoOffMs: 0, idleMs: 0, pickupMs: 3_000 }), register = registered(f);
  const decision = async (pagerId: string, phone: string, decisionId: string) => (await f.pager(pagerId, phone)).agents.flatMap(x => x.answered).find(d => d.decisionId === decisionId);
  try {
    const p = await f.makePager(), mine = device();
    await register(p.pagerId, p.phone, mine);
    const a = await f.connect(p.number, 'Claude Desktop', 'wake-lab', 'air');
    assert.equal((await f.pager(p.pagerId, p.phone)).agents[0]?.agent.machine, 'air', 'the phone sees which computer');

    // Collected in time: no warning, ever.
    const quick = await f.ask(a, 'Collected in time?');
    await f.answer(a.agent.agentId, p.phone, quick.decisionId);
    assert.equal((await f.read(a, quick.decisionId)).status, 'answered');
    // Not collected: one alert after the pickup time, and the decision says when.
    const slow = await f.ask(a, 'Ship it?');
    const receipt = await f.answer(a.agent.agentId, p.phone, slow.decisionId);
    const warning = (await until(async () => sent(mine).filter(d => d.payload.kind === 'warning'), w => w.length === 1, 30_000))[0];
    // It resends the decision's preview, which names who asked, the computer, the project and the question; the phone
    // words it as the warning. Apple gets only the plain fallback.
    assert.deepEqual(warning.payload.aps.alert, { title: 'AgentPager', body: 'Answer not picked up' });
    assert.equal(warning.payload.preview, sent(mine).find(d => d.payload.kind === 'decision' && d.payload.decisionId === slow.decisionId)?.payload.preview, 'the decision\'s own preview');
    assert.deepEqual(openPreview(warning.payload), { title: 'Ship it?', recommended: { letter: 'B', title: 'Second plan' }, app: 'Claude Desktop', project: 'wake-lab', machine: 'air' });
    assert.equal(warning.payload.decisionId, slow.decisionId);
    assert.equal(warning.payload.aps['interruption-level'], 'active');
    assert.equal(warning.headers['apns-collapse-id'], slow.decisionId);
    const warned = await decision(p.pagerId, p.phone, slow.decisionId);
    assert.ok(warned?.warnedAt && !warned.collectedAt, 'warned, not collected');
    assert.ok(Date.parse(warned.warnedAt) - Date.parse(receipt.sentAt) >= 3_000, 'not before the pickup time');
    assert.equal(warned.status, 'answered');
    const collected = await decision(p.pagerId, p.phone, quick.decisionId);
    assert.ok(collected?.collectedAt && !collected.warnedAt, 'collected, never warned');
    assert.equal(collected.status, 'answered', 'collected is not acknowledged');

    // Collected late: the warning stays on record, the collection is added, and nothing more alerts.
    await f.read(a, slow.decisionId);
    const late = await decision(p.pagerId, p.phone, slow.decisionId);
    assert.ok(late?.warnedAt && late.collectedAt, 'warned, then collected');
    await new Promise(r => setTimeout(r, 4_000));
    assert.equal(sent(mine).filter(d => d.payload.kind === 'warning').length, 1, 'one alert per answer');

    // While the pager is off no agent can read the answer, so there is nothing to warn about.
    const off = await f.ask(a, 'While it turns off?');
    await f.answer(a.agent.agentId, p.phone, off.decisionId);
    await f.settings(p.pagerId, p.phone, { on: false });
    await new Promise(r => setTimeout(r, 6_000));
    assert.equal((await decision(p.pagerId, p.phone, off.decisionId))?.warnedAt, undefined, 'no warning while off');
    assert.equal(sent(mine).filter(d => d.payload.kind === 'warning').length, 1, 'no alert while off');
  } finally {
    await f.stop();
    close();
  }
});

// A lost ask reply: the command asks again with the request id it chose. The owner gets one decision and one alert;
// another question with that request id is refused. Each alert goes out before its ask replies, so an ask that
// replies without adding to the alerts below sent none.
test('B27.9 The same ask again with its request id is one decision and one alert; another question with it is refused', { timeout: 180_000 }, async () => {
  const { sent, close } = await apple();
  const f = await fixture('push-again'), register = registered(f);
  try {
    const p = await f.makePager(), mine = device();
    await register(p.pagerId, p.phone, mine);
    const a = await f.connect(p.number, 'Codex', 'again');
    const cards = `/api/agents/${a.agent.agentId}/cards`, alerted = () => sent(mine).map(d => d.payload.decisionId);
    const open = async () => (await f.pager(p.pagerId, p.phone)).agents[0].open.map(d => d.decisionId);
    const plain = question('Ship it?'), ship = await f.sealed(a, plain), id = await C.decisionIdOf(a.agent.agentId, ship.requestId);
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: ship })).decisionId, id, 'named by the agent and its request id');
    assert.deepEqual(alerted(), [id]);
    // Again, as sent; and sealed again, as a later run of the command sends it, with new encrypted parts and the same
    // digest: the same decision, no alert, and the parts first stored stay.
    const resealed = await f.sealed(a, plain);
    assert.notEqual(resealed.card, ship.card);
    assert.equal(resealed.digest, ship.digest);
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: ship })).decisionId, id);
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: resealed })).decisionId, id);
    assert.deepEqual(alerted(), [id], 'one alert');
    assert.deepEqual(await open(), [id], 'one decision');
    const stored = await f.ok(C.PagerInbox, `/api/pagers/${p.pagerId}`, { phone: p.phone });
    assert.equal(stored.agents[0].open[0].card, ship.card, 'the card as first stored');
    // Another question, or the same one changed, with that request id is refused, and stores and alerts nothing.
    for (const data of [await f.sealed(a, { ...question('Something else?'), requestId: ship.requestId }), await f.sealed(a, { ...plain, detail: 'Now with a detail.' })]) {
      assert.match((await f.refused(409, 'RequestIdTaken', cards, { agent: a.agentKey, data })).message, /different question/);
    }
    // At the limit of open decisions it still finds its decision, while a new question is refused.
    const others = [];
    for (let n = 2; n <= C.MAX_OPEN_DECISIONS; n++) others.push((await f.ask(a, `Question ${n}`)).decisionId);
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: ship })).decisionId, id);
    await f.refused(409, 'TooManyOpenDecisions', cards, { agent: a.agentKey, data: await f.sealed(a, question('Eleventh?')) });
    assert.deepEqual(alerted(), [id, ...others], 'one alert per decision');
    // Answered, it is still the same decision, and stays answered.
    const receipt = await f.answer(a.agent.agentId, p.phone, id);
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: ship })).decisionId, id);
    const read = await f.read(a, id);
    assert.equal(read.status === 'answered' && read.answer.answerId, receipt.answerId);
    // While the pager is off it is refused like every ask (I17); on again, it finds its decision.
    await f.settings(p.pagerId, p.phone, { on: false });
    await f.refused(409, 'PagerOff', cards, { agent: a.agentKey, data: ship });
    await f.settings(p.pagerId, p.phone, { on: true });
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: ship })).decisionId, id);
    assert.deepEqual(alerted(), [id, ...others]);

    // Another agent, here or on another pager, asking with the same request id gets a decision of its own, under an id
    // of its own: no two agents' decisions share an id, which is how the phone tells them apart.
    const b = await f.connect(p.number, 'Claude Code', 'again'), q = await f.makePager('never', p.phone), c = await f.connect(q.number, 'Codex', 'elsewhere');
    const theirs = (await f.ok(C.Asked, `/api/agents/${b.agent.agentId}/cards`, { agent: b.agentKey, data: await f.sealed(b, plain) })).decisionId;
    const elsewhere = (await f.ok(C.Asked, `/api/agents/${c.agent.agentId}/cards`, { agent: c.agentKey, data: await f.sealed(c, plain) })).decisionId;
    assert.equal(new Set([id, theirs, elsewhere]).size, 3);
    assert.equal((await f.read(b, theirs)).status, 'pending', 'its own decision, unanswered');
    await f.refused(404, 'UnknownDecision', `/api/agents/${b.agent.agentId}/cards/${id}/answer`, { agent: b.agentKey });
    const seen = (await f.pager(p.pagerId, p.phone)).agents;
    assert.deepEqual(seen.map(x => [x.agent.agentId, [...x.open, ...x.answered].filter(d => d.title === 'Ship it?').map(d => [d.decisionId, d.status])]), [[a.agent.agentId, [[id, 'answered']]], [b.agent.agentId, [[theirs, 'open']]]]);
    await until(async () => sent(mine), d => d.length === others.length + 2);
    assert.deepEqual(alerted(), [id, ...others, theirs]);
  } finally {
    await f.stop();
    close();
  }
});
