import { test } from 'node:test';
import { createServer } from 'node:http';
import { readdirSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { generateKeyPairSync, verify } from 'node:crypto';
import { Schema } from 'effect';
import { fixture, assert, token, until, decode, question, C } from './support.ts';

// A stand-in for Apple's push service: it records each alert, checks the provider token, and answers each device
// token as `replies` says (200 unless set).
const Payload = Schema.Struct({
  aps: Schema.Struct({
    alert: Schema.Struct({ title: Schema.String, body: Schema.String }), sound: Schema.Literal('default'), 'thread-id': Schema.String,
    'content-available': Schema.Literal(1), 'interruption-level': Schema.Literal('time-sensitive', 'active'),
  }),
  kind: Schema.Literal('decision', 'acknowledgement', 'warning'), pagerId: Schema.String, agentId: Schema.String, decisionId: Schema.String,
});
type Delivery = { device: string; headers: Record<string, string>; payload: typeof Payload.Type };
const Ok = Schema.Struct({ ok: Schema.Literal(true) });

async function apple() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const deliveries: Delivery[] = [], replies = new Map<string, { status: number; reason: string }>();
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      const [head, claims, signature] = (req.headers.authorization ?? '').replace(/^bearer /, '').split('.');
      const genuine = !!signature && verify('sha256', Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'));
      const header = JSON.parse(Buffer.from(head ?? '', 'base64url').toString() || '{}'), claim = JSON.parse(Buffer.from(claims ?? '', 'base64url').toString() || '{}');
      if (!genuine || header.alg !== 'ES256' || header.kid !== 'KEY1234567' || claim.iss !== 'TEAM123456') { res.writeHead(403); res.end(JSON.stringify({ reason: 'InvalidProviderToken' })); return; }
      const device = (req.url ?? '').replace('/3/device/', '');
      deliveries.push({ device, headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])), payload: decode(Payload, JSON.parse(raw)) });
      const reply = replies.get(device) ?? { status: 200, reason: '' };
      res.writeHead(reply.status); res.end(reply.status === 200 ? '' : JSON.stringify({ reason: reply.reason }));
    });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('port');
  // The key as it sits in the vault: one line, its breaks turned to spaces.
  process.env.APNS_KEY_P8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, ' ');
  process.env.APNS_KEY_ID = 'KEY1234567'; process.env.APNS_TEAM_ID = 'TEAM123456'; process.env.APNS_TOPIC = 'me.agentpager.app.dev';
  process.env.APNS_ORIGIN = `http://127.0.0.1:${address.port}`;
  return { replies, sent: (to: string) => deliveries.filter(d => d.device === to), close: () => server.close() };
}
// The decision ids the Registry holds, read from its stored database once the server has stopped.
function registryClaims(persist: string) {
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.sqlite')) files.push(p); } };
  walk(path.join(persist, 'v3', 'do'));
  let tables = 0, rows = 0;
  for (const file of files) {
    const db = new DatabaseSync(file);
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='decisions_v2'").get()) { tables++; rows += Number(db.prepare('SELECT count(*) AS n FROM decisions_v2').get()?.n); }
    db.close();
  }
  return { tables, rows };
}
const device = () => Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
const registered = (f: Awaited<ReturnType<typeof fixture>>) => (pagerId: string, phone: string, deviceToken: string) => f.ok(Ok, `/api/pagers/${pagerId}/push`, { phone, data: { token: deviceToken, environment: 'sandbox' } });

test('alerts: a pager whose phone gave its token alerts when an agent asks and acknowledges', { timeout: 180_000 }, async () => {
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

    // A decision: time sensitive, titled with who asked and the project, the question first, collapsing on the decision.
    const asked = await f.ask(a, 'Ship it?');
    const [decisionAlert] = await until(async () => sent(mine), d => d.length === 1);
    const aps = decisionAlert.payload.aps;
    assert.deepEqual(aps.alert, { title: 'Claude Code · alerts', body: 'Ship it?\nRecommended: B. Second plan' });
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
    assert.deepEqual(ackAlert.payload.aps.alert, { title: 'Claude Code · alerts', body: 'Shipping now.' });
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
    assert.equal(back[0].payload.aps.alert.title, 'Codex · second agent');

    // Off: nothing is sent, so nothing alerts.
    await f.settings(p.pagerId, p.phone, { on: false });
    await f.refused(409, 'PagerOff', `/api/agents/${b.agent.agentId}/cards`, { agent: b.agentKey, data: question('While off?') });
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
    assert.deepEqual(warning.payload.aps.alert, { title: 'Claude Desktop · wake-lab', body: 'Claude Desktop on air (wake-lab) hasn’t picked up your answer to “Ship it?” after 3 min. AgentPager can’t reach it: it may be asleep, closed or disconnected. Check in with it directly.' });
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

// A lost ask reply: the command asks again under the decision id it chose. The owner gets one decision and one alert;
// another question under that id is refused. Each alert goes out before its ask replies, so an ask that replies
// without adding to the alerts below sent none.
test('B27.9 The same ask again under its id is one decision and one alert; another question under it is refused', { timeout: 180_000 }, async () => {
  const { sent, close } = await apple();
  const f = await fixture('push-again'), register = registered(f);
  try {
    const p = await f.makePager(), mine = device();
    await register(p.pagerId, p.phone, mine);
    const a = await f.connect(p.number, 'Codex', 'again');
    const cards = `/api/agents/${a.agent.agentId}/cards`, alerted = () => sent(mine).map(d => d.payload.decisionId);
    const open = async () => (await f.pager(p.pagerId, p.phone)).agents[0].open.map(d => d.decisionId);
    const ship = question('Ship it?'), id = ship.decisionId;
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: ship })).decisionId, id, 'stored under the id the agent chose');
    assert.deepEqual(alerted(), [id]);
    // Again, and again with its fields in another order: the same decision, no alert.
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: ship })).decisionId, id);
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: { card: ship.card, title: ship.title, decisionId: id } })).decisionId, id);
    assert.deepEqual(alerted(), [id], 'one alert');
    assert.deepEqual(await open(), [id], 'one decision');
    // Another question, or the same one changed, under that id is refused, and stores and alerts nothing.
    for (const data of [{ ...question('Something else?'), decisionId: id }, { ...ship, detail: 'Now with a detail.' }]) {
      assert.match((await f.refused(409, 'DecisionIdTaken', cards, { agent: a.agentKey, data })).message, /taken/);
    }
    assert.deepEqual(alerted(), [id]);
    assert.deepEqual((await f.pager(p.pagerId, p.phone)).agents[0].open.map(d => [d.title, d.detail]), [['Ship it?', undefined]], 'the decision as first asked');

    // At the limit of open decisions it still finds its decision, while a new question is refused.
    const others = [];
    for (let n = 2; n <= C.MAX_OPEN_DECISIONS; n++) others.push((await f.ask(a, `Question ${n}`)).decisionId);
    assert.equal((await f.ok(C.Asked, cards, { agent: a.agentKey, data: ship })).decisionId, id);
    await f.refused(409, 'TooManyOpenDecisions', cards, { agent: a.agentKey, data: question('Eleventh?') });
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

    // No two agents on a pager share a decision id, since the phone tells decisions apart by id: another agent asking
    // under it is refused, and stores and alerts nothing. Under a new id it asks as usual.
    const b = await f.connect(p.number, 'Claude Code', 'again');
    const theirs = `/api/agents/${b.agent.agentId}/cards`;
    await f.refused(409, 'DecisionIdTaken', theirs, { agent: b.agentKey, data: ship });
    await f.refused(409, 'DecisionIdTaken', theirs, { agent: b.agentKey, data: { ...question('Mine?'), decisionId: others[0] } });
    assert.deepEqual(alerted(), [id, ...others], 'no alert');
    const own = await f.ok(C.Asked, theirs, { agent: b.agentKey, data: { ...ship, decisionId: token() } });
    const seen = (await f.pager(p.pagerId, p.phone)).agents;
    assert.deepEqual(seen.map(x => [x.agent.agentId, [...x.open, ...x.answered].filter(d => d.title === 'Ship it?').map(d => d.decisionId)]), [[a.agent.agentId, [id]], [b.agent.agentId, [own.decisionId]]]);
    await until(async () => sent(mine), d => d.length === others.length + 2);
    assert.deepEqual(alerted(), [id, ...others, own.decisionId]);
    // The claims go with the pager.
    await f.request(`/api/pagers/${p.pagerId}/delete`, { method: 'POST', phone: p.phone });
    await f.stop();
    assert.deepEqual(registryClaims(f.persist), { tables: 1, rows: 0 }, 'no decision ids kept for a deleted pager');
    void token;
  } finally {
    await f.stop();
    close();
  }
});
