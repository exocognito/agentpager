import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fixture, assert, token, until, C, apple, device, registered, openDecision, openIdentity, openAnswer, sealAnswer, asQuestion, type AgentCreds } from './support.ts';
import { briefsDir } from '../fixtures/briefs/load.ts';
import { fromBase64url, open } from '../../contract/envelope.ts';
import { decodePart } from '../../contract/parts.ts';
import { publicOf } from '../../cli/src/seal.ts';

// End-to-end encryption (6 Privacy): what the service holds, logs, replies and sends to Apple, read as bytes.
const files = (dir: string): string[] => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? files(p) : [p]; });
const png = readFileSync(path.join(briefsDir, 'D1-pricing', 'a-cards.png'));

// Every text the owner or an agent writes carries a marker; none may be found anywhere the service keeps or sends.
const M = {
  app: 'I20 app Zq7', project: 'I20 project Zq7', machine: 'i20-machine-zq7', title: 'I20 question Zq7?', detail: 'I20 detail Zq7.',
  brief: 'I20 brief prose Zq7', option: 'I20 option Zq7', page: 'I20 page prose Zq7', note: 'I20 owner note Zq7', ack: 'I20 next steps Zq7',
};
const card = (title: string) => ({
  requestId: token(), title, detail: M.detail,
  card: { type: 'brief', recommended: 1, options: [{ number: 1, title: M.option, label: 'Ship', prioritizes: 'speed' }, { number: 2, title: 'Wait a week', label: 'Wait', prioritizes: 'safety' }], markdown: `## Context\n${M.brief}\n[Background](notes.md)\n![Shot](shot.png)\n\n## Options\n\n## Recommendation: A\n**Why:** It is ready.\n` },
  attachments: [{ name: 'notes.md', type: 'text/markdown', text: `# Notes\n\n${M.page}\n` }, { name: 'shot.png', type: 'image/png', base64: png.toString('base64') }],
});

test('I20.1 The service stores, logs, replies and sends to Apple nothing readable of a decision, its attachments, who asked, the answer, a note or an acknowledgement', { timeout: 180_000 }, async () => {
  const push = await apple();
  const f = await fixture('privacy', { autoOffMs: 0, idleMs: 0, pickupMs: 2_000 }), register = registered(f);
  const replies: string[] = [];
  try {
    const p = await f.makePager(), mine = device();
    await register(p.pagerId, p.phone, mine);
    const a = await f.connect(p.number, M.app, M.project, M.machine);
    const cards = `/api/agents/${a.agent.agentId}/cards`;
    const one = await f.ok(C.Asked, cards, { agent: a.agentKey, data: await f.sealed(a, asQuestion(card(M.title))) });
    const two = await f.ok(C.Asked, cards, { agent: a.agentKey, data: await f.sealed(a, asQuestion(card(`${M.title} again`))) });
    const three = await f.ok(C.Asked, cards, { agent: a.agentKey, data: await f.sealed(a, asQuestion(card(`${M.title} unread`))) });
    // An option, a note, and an answer no agent picks up, which is warned about.
    const r1 = await f.answer(a.agent.agentId, p.phone, one.decisionId, { kind: 'option', number: 1 });
    await f.answer(a.agent.agentId, p.phone, two.decisionId, { kind: 'feedback', text: M.note });
    await f.answer(a.agent.agentId, p.phone, three.decisionId, { kind: 'option', number: 2 });
    const read = await f.read(a, one.decisionId);
    assert.deepEqual(read.status === 'answered' && read.answer.choice, { kind: 'option', number: 1 });
    const note = await f.read(a, two.decisionId);
    assert.deepEqual(note.status === 'answered' && note.answer.choice, { kind: 'feedback', text: M.note });
    await f.ack(a, one.decisionId, r1.answerId, M.ack);
    await until(async () => push.sent(mine).filter(d => d.payload.kind === 'warning'), w => w.length === 1, 30_000);
    // Every reply either end gets, as it came.
    for (const [route, opts] of [
      [`/api/pagers/${p.pagerId}`, { phone: p.phone }], [`/api/agents/${a.agent.agentId}`, { agent: a.agentKey }], [`/api/pagers/${p.pagerId}/key`, {}],
      [`${cards}/${one.decisionId}/answer`, { agent: a.agentKey }], [`${cards}/${two.decisionId}/answer`, { agent: a.agentKey }],
      ...[0, 1].map(slot => [`${cards}/${one.decisionId}/files/${slot}`, { phone: p.phone }] as const),
    ] as const) {
      const r = await fetch(f.origin + route, { headers: { [C.CLIENT_HEADER]: C.clientVersion('tests', 'local'), ...('phone' in opts ? { 'x-phone-key': opts.phone } : {}), ...('agent' in opts ? { authorization: `Bearer ${opts.agent}` } : {}) } });
      assert.equal(r.status, 200, route);
      replies.push(await r.text());
    }
    // The phone reads it all, so it was all there to read.
    const seen = await f.pager(p.pagerId, p.phone);
    assert.deepEqual([seen.agents[0].agent.app, seen.agents[0].agent.project, seen.agents[0].agent.machine], [M.app, M.project, M.machine]);
    assert.deepEqual(seen.agents[0].answered.map(d => d.title).sort(), [M.title, `${M.title} again`, `${M.title} unread`].sort());
    assert.equal(seen.agents[0].answered.find(d => d.decisionId === one.decisionId)?.acknowledgement?.nextSteps, M.ack);
    await f.stop();

    // The local store, every file of it; the server's own log; every reply; every alert as Apple got it.
    const place = (name: string, bytes: Buffer): [string, Buffer] => [name, bytes];
    const places: [string, Buffer][] = [
      ...files(f.persist).map(file => place(path.relative(f.persist, file), readFileSync(file))),
      place('server.log', readFileSync(path.join(f.evidence, 'server.log'))),
      ...replies.map((r, i) => place(`reply ${i}`, Buffer.from(r))),
      ...push.all().map((d, i) => place(`alert ${i} (${d.payload.kind})`, Buffer.from(d.raw))),
    ];
    assert.ok(push.all().length >= 4, 'a decision, an acknowledgement and a warning alerted');
    const needles: [string, Buffer][] = [
      ...Object.entries(M).map(([k, v]) => place(k, Buffer.from(v))),
      place('the image', png.subarray(64, 96)), place('the image as base64', Buffer.from(png.toString('base64').slice(100, 140))),
      place('an attachment name', Buffer.from('notes.md')), place('the agent\'s own public key', Buffer.from(publicOf(a.keys.privateKey))),
    ];
    for (const [where, bytes] of places) for (const [what, needle] of needles) assert.ok(!bytes.includes(needle), `${what} found in ${where}`);
  } finally { await f.stop(); push.close(); }
});

// Who can open what: the phone's key opens the identity, the card, each attachment and the acknowledgement, and the
// agent's key the answer. Neither opens the other's, and the service holds no private key at all.
test('B30.1 Each part opens only at the other end', { timeout: 120_000 }, async () => {
  const f = await fixture('privacy-ends');
  try {
    const p = await f.makePager(), a = await f.connect(p.number, 'Codex', 'ends');
    const asked = await f.ok(C.Asked, `/api/agents/${a.agent.agentId}/cards`, { agent: a.agentKey, data: await f.sealed(a, asQuestion(card('Who opens this?'))) });
    const receipt = await f.answer(a.agent.agentId, p.phone, asked.decisionId, { kind: 'feedback', text: 'Only you read this.' });
    await f.ack(a, asked.decisionId, receipt.answerId, 'Only the phone reads this.');
    const wire = await f.ok(C.PagerInbox, `/api/pagers/${p.pagerId}`, { phone: p.phone }), d = wire.agents[0].answered[0];
    const phone = fromBase64url(p.privateKey) ?? new Uint8Array(), agent = fromBase64url(a.keys.privateKey) ?? new Uint8Array();
    const at = { pagerId: p.pagerId, decisionId: asked.decisionId };
    const attachment = await (await fetch(`${f.origin}/api/agents/${a.agent.agentId}/cards/${asked.decisionId}/files/0`, { headers: { [C.CLIENT_HEADER]: C.clientVersion('tests', 'local'), 'x-phone-key': p.phone } })).text();
    const answered = await f.ok(C.AnswerStatus, `/api/agents/${a.agent.agentId}/cards/${asked.decisionId}/answer`, { agent: a.agentKey });
    assert.equal(answered.status, 'answered');
    const answer = answered.status === 'answered' ? answered.answer.answer : '';
    // The phone's.
    assert.equal(openIdentity(p.pagerId, wire.agents[0].agent.identity).project, 'ends');
    assert.equal(openDecision(p.pagerId, d).title, 'Who opens this?');
    assert.equal(new TextDecoder().decode(open(phone, 'attachment', { ...at, index: 0 }, attachment)), `# Notes\n\n${M.page}\n`);
    for (const [kind, part] of [['identity', wire.agents[0].agent.identity], ['card', d.card], ['acknowledgement', d.acknowledgement?.acknowledgement ?? '']] as const) {
      assert.throws(() => open(agent, kind, kind === 'identity' ? { pagerId: p.pagerId } : at, part), /can't be opened/, `the agent can't open the ${kind}`);
    }
    assert.throws(() => open(agent, 'attachment', { ...at, index: 0 }, attachment), /can't be opened/);
    // The agent's: the answer, sealed to the key inside its card.
    assert.deepEqual(openAnswer(a, asked.decisionId, answer), { kind: 'feedback', text: 'Only you read this.' });
    assert.throws(() => open(phone, 'answer', at, answer), /can't be opened/, 'the phone can\'t open the answer it sent');
    assert.equal(openDecision(p.pagerId, d).answerKey, publicOf(a.keys.privateKey), 'the card names the agent\'s own key');
  } finally { await f.stop(); }
});

// The service holds every part and could hand one back in another place: another decision, another pager, another
// attachment slot, or as another kind. The end that reads it refuses it every time.
test('B30.2 A part the service moves to another pager, decision, slot or kind is refused where it is read', { timeout: 120_000 }, async () => {
  const f = await fixture('privacy-moved');
  try {
    const p = await f.makePager(), q = await f.makePager('never', p.phone);
    const a = await f.connect(p.number, 'Codex', 'moved'), b = await f.connect(q.number, 'Codex', 'moved elsewhere');
    const ask = async (who: AgentCreds, title: string) => (await f.ok(C.Asked, `/api/agents/${who.agent.agentId}/cards`, { agent: who.agentKey, data: await f.sealed(who, asQuestion(card(title))) })).decisionId;
    const one = await ask(a, 'First?'), two = await ask(a, 'Second?'), there = await ask(b, 'On the other pager?');
    const r = await f.answer(a.agent.agentId, p.phone, one, { kind: 'option', number: 1 });
    await f.answer(a.agent.agentId, p.phone, two, { kind: 'option', number: 2 });
    await f.ack(a, one, r.answerId, 'Done.');
    const inbox = async (pagerId: string) => (await f.ok(C.PagerInbox, `/api/pagers/${pagerId}`, { phone: p.phone })).agents.flatMap(x => [...x.open, ...x.answered]);
    const mine = await inbox(p.pagerId), theirs = await inbox(q.pagerId);
    const d1 = mine.find(d => d.decisionId === one), d2 = mine.find(d => d.decisionId === two), dq = theirs.find(d => d.decisionId === there);
    assert.ok(d1 && d2 && dq && d1.acknowledgement && d1.answer && d2.answer);
    // As stored, each opens.
    for (const d of [d1, d2]) openDecision(p.pagerId, d);
    openDecision(q.pagerId, dq);
    // The phone refuses a card moved to another decision, from another pager, or an acknowledgement or a preview
    // passed off as a card, and an acknowledgement moved to another decision.
    for (const [label, pagerId, d] of [
      ['a card on another decision', p.pagerId, { ...d2, card: d1.card }],
      ['a card from another pager', p.pagerId, { ...d1, card: dq.card }],
      ['a card read as on another pager', q.pagerId, { ...dq, card: d1.card }],
      ['an acknowledgement as a card', p.pagerId, { ...d1, card: d1.acknowledgement.acknowledgement }],
      ['an acknowledgement on another decision', p.pagerId, { ...d2, status: 'acknowledged' as const, acknowledgement: { ...d1.acknowledgement, decisionId: two, answerId: d2.answer.answerId } }],
    ] as const) assert.throws(() => openDecision(pagerId, d), /can't be opened/, label);
    // Attachments: another slot, another decision.
    const fetchPart = async (decisionId: string, slot: number) => (await fetch(`${f.origin}/api/agents/${a.agent.agentId}/cards/${decisionId}/files/${slot}`, { headers: { [C.CLIENT_HEADER]: C.clientVersion('tests', 'local'), 'x-phone-key': p.phone } })).text();
    const key = fromBase64url(p.privateKey) ?? new Uint8Array(), slot0 = await fetchPart(one, 0);
    assert.ok(open(key, 'attachment', { pagerId: p.pagerId, decisionId: one, index: 0 }, slot0).length > 0);
    assert.throws(() => open(key, 'attachment', { pagerId: p.pagerId, decisionId: one, index: 1 }, slot0), /can't be opened/, 'another slot');
    assert.throws(() => open(key, 'attachment', { pagerId: p.pagerId, decisionId: two, index: 0 }, slot0), /can't be opened/, 'another decision');
    assert.throws(() => open(key, 'card', { pagerId: p.pagerId, decisionId: one }, slot0), /can't be opened/, 'an attachment as a card');
    // The agent refuses an answer moved to another of its decisions, or a part of another kind passed off as one.
    assert.throws(() => openAnswer(a, two, d1.answer?.answer ?? ''), /can't be opened/, 'an answer on another decision');
    assert.throws(() => openAnswer(a, one, d1.card), /can't be opened/, 'a card as an answer');
    // And an answer sealed by anyone but the phone that read the card: the service has the pager's public key, never
    // the agent's, which only the card carries.
    const forged = sealAnswer({ answerKey: p.publicKey }, p.pagerId, one, { kind: 'option', number: 2 });
    assert.throws(() => openAnswer(a, one, forged.answer), /can't be opened/, 'an answer sealed to the pager\'s key');
    assert.deepEqual(decodePart('answer', open(fromBase64url(a.keys.privateKey) ?? new Uint8Array(), 'answer', { pagerId: p.pagerId, decisionId: one }, d1.answer?.answer ?? '')).choice, { kind: 'option', number: 1 });
  } finally { await f.stop(); }
});
