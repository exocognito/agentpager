import { test } from 'node:test';
import { fixture, assert, token, C, question, pagerKeys } from './support.ts';
import { loadBrief } from '../fixtures/briefs/load.ts';

// Every client names itself in C.CLIENT_HEADER. An agent's call that doesn't, as the m4 command's didn't, or that
// names a protocol older than the service accepts, is refused as UpdateRequired with how to update. It is refused
// before its key or its input is read, so a wrong key and invalid input get the same refusal, and nothing is stored.
// (The local server holds a request until its whole body has arrived, so that is what shows "before" here.)
const OLD = [null, '', 'cli/0 9849671', 'agentpager 9849671', 'cli/1'];
type Call = [string, string, { method?: string; data?: unknown; agent?: string }];

test('an agent call from an old command is told to update on every route, before its key or input is read, and changes nothing', { timeout: 180_000 }, async () => {
  const f = await fixture('clients');
  try {
    const { p, a } = await f.connected('Codex', 'clients');
    const aid = a.agent.agentId, cards = `/api/agents/${aid}/cards`;
    const asked = await f.ask(a, 'Before the update?');
    const receipt = await f.answer(aid, p.phone, asked.decisionId), did = asked.decisionId;
    const before = await f.pager(p.pagerId, p.phone);
    const calls: Call[] = [
      ['connect', '/api/agents', { data: { number: p.number, app: 'Codex', project: 'old' } }],
      ['connect with invalid input', '/api/agents', { data: { number: 'nope', bogus: 1 } }],
      ['status', `/api/agents/${aid}`, { agent: a.agentKey }],
      ['status with a wrong key', `/api/agents/${aid}`, { agent: token() }],
      ['status of no such agent', `/api/agents/${token()}`, { agent: a.agentKey }],
      ['ask', cards, { agent: a.agentKey, data: question('From an old command?') }],
      ['ask as the m4 command did, with no decision id', cards, { agent: a.agentKey, data: { title: 'From m4?', card: question().card } }],
      ['ask with a wrong key and invalid input', cards, { agent: token(), data: { title: '' } }],
      ['read the answer', `${cards}/${did}/answer`, { agent: a.agentKey }],
      ['wait for the answer', `${cards}/${did}/answer?wait=1`, { agent: a.agentKey }],
      ['wait with a bad wait', `${cards}/${did}/answer?wait=forever`, { agent: a.agentKey }],
      ['read a malformed decision id', `${cards}/not-a-decision/answer`, { agent: a.agentKey }],
      ['acknowledge', `${cards}/${did}/acknowledge`, { agent: a.agentKey, data: { answerId: receipt.answerId, nextSteps: 'From an old command.' } }],
      ['acknowledge with a wrong key and invalid input', `${cards}/${did}/acknowledge`, { agent: token(), data: { nextSteps: '' } }],
      ['finish', `/api/agents/${aid}/finish`, { method: 'POST', agent: a.agentKey }],
      ['finish with a field', `/api/agents/${aid}/finish`, { agent: a.agentKey, data: { now: true } }],
    ];
    const words = `This agentpager command is too old for this server, so nothing reached your owner. Update it: build it again as ${f.origin}/start describes (in an existing clone, git pull first), or if you can't, tell your owner it needs updating. Then connect again with your owner's pager number.`;
    for (const [label, route, opts] of calls) for (const client of OLD) {
      const e = await f.refused(400, 'UpdateRequired', route, { ...opts, client }).catch(e => { throw new Error(`${label}, client ${JSON.stringify(client)}: ${e}`); });
      assert.equal(e.message, words, label);
    }
    // Nothing it sent changed anything: no agent, decision, collection, acknowledgement or finish.
    assert.deepEqual(await f.pager(p.pagerId, p.phone), before, 'the pager reads as before');


    // The same calls from the current command work as before.
    const now = await f.read(a, did);
    assert.equal(now.status === 'answered' && now.answer.answerId, receipt.answerId);
    await f.ack(a, did, receipt.answerId);
    // Routes that aren't the API's are still no route, whoever asks.
    for (const client of [null, C.clientVersion('cli', 'dev')]) await f.refused(404, 'NotFound', '/api/sessions', { data: {}, client });
  } finally { await f.stop(); }
});

// The phone's routes don't need the header yet: an app from before it (m4) works as before. An app that names a
// protocol older than the service accepts is told to update, and never that its pager is unknown, which would make
// it drop the pager and its keys for good.
test('the phone: an app from before the header is served; an older one is told to update, never that its pager is unknown', { timeout: 180_000 }, async () => {
  const f = await fixture('clients-phone');
  try {
    const { p, a } = await f.connected('Codex', 'phone');
    const brief = { decisionId: token(), ...loadBrief('D2-checkout') } as { decisionId: string; attachments?: { name: string; text?: string }[] };
    const asked = await f.ok(C.Asked, `/api/agents/${a.agent.agentId}/cards`, { agent: a.agentKey, data: brief });
    const did = asked.decisionId, decision = `/api/agents/${a.agent.agentId}/cards/${did}`;
    const routes = (pagerId: string, keys = pagerKeys()): Call[] => [
      ['make a pager', '/api/pagers', { data: { number: keys.number, publicKey: keys.publicKey, autoOff: 'never' } }],
      ['read the pager', `/api/pagers/${pagerId}`, {}],
      ['turn it off', `/api/pagers/${pagerId}/settings`, { data: { on: false } }],
      ['give its device token', `/api/pagers/${pagerId}/push`, { data: { token: 'ab'.repeat(32), environment: 'sandbox' } }],
      ['answer', `${decision}/answer`, { data: { requestId: token(), choice: { kind: 'option', number: 1 } } }],
      ['read an attachment', `${decision}/files/design.md`, {}],
      ['delete it', `/api/pagers/${pagerId}/delete`, { method: 'POST' }],
    ];
    const before = await f.pager(p.pagerId, p.phone);
    for (const client of ['ios/0 0.1+1', 'AgentPager/0.1', '']) for (const [label, route, opts] of routes(p.pagerId)) {
      const e = await f.refused(400, 'UpdateRequired', route, { ...opts, phone: p.phone, client }).catch(e => { throw new Error(`${label}, client ${JSON.stringify(client)}: ${e}`); });
      assert.equal(e.message, 'This AgentPager app is too old for this server. Update the app; your pagers stay on this phone.', label);
    }
    // A pager that is gone is still told to update first: only an app the service accepts hears it is unknown.
    await f.refused(400, 'UpdateRequired', `/api/pagers/${pagerKeys().pagerId}`, { phone: p.phone, client: 'ios/0 0.1+1' });
    assert.deepEqual(await f.pager(p.pagerId, p.phone), before, 'nothing changed');

    // Without the header, as the m4 app, every route works as before.
    const m4 = { client: null };
    const other = pagerKeys();
    for (const [label, route, opts] of routes(p.pagerId, other)) {
      if (label === 'read an attachment') {
        const file = await fetch(f.origin + route, { headers: { 'x-phone-key': p.phone } });
        assert.deepEqual([file.status, await file.text()], [200, String(brief.attachments?.find(x => x.name === 'design.md')?.text)], label);
        continue;
      }
      const r = await f.request(route, { ...opts, phone: p.phone, ...m4 }).catch(e => { throw new Error(`${label}: ${e}`); });
      assert.equal(r.status, 200, `${label}: ${JSON.stringify(r.value)}`);
      if (label === 'turn it off') await f.settings(p.pagerId, p.phone, { on: true });
    }
    await f.refused(404, 'UnknownPager', `/api/pagers/${p.pagerId}`, { phone: p.phone, ...m4 });
    await f.ok(C.PagerInbox, `/api/pagers/${other.pagerId}`, { phone: p.phone, ...m4 });
  } finally { await f.stop(); }
});
