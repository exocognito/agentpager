import { test } from 'node:test';
import { fixture, assert, token, C, question, pagerKeys } from './support.ts';

// Every client names itself in C.CLIENT_HEADER. An agent's call that doesn't, as the m4 command's didn't, or that
// names a protocol older than the service accepts, as a command from before the encryption switch does (protocol 1),
// is refused as UpdateRequired with how to update. It is refused before its key or its input is read, so a wrong key
// and invalid input get the same refusal, and nothing is stored. (The local server holds a request until its whole
// body has arrived, so that is what shows "before" here.)
const OLD = [null, '', 'cli/0 9849671', 'agentpager 9849671', 'cli/1', 'cli/1 4e8dbf5'];
type Call = [string, string, { method?: string; data?: unknown; agent?: string }];

test('B25.14 An agent call from an old command is told to update on every route, before its key or input is read, and changes nothing', { timeout: 180_000 }, async () => {
  const f = await fixture('clients');
  try {
    const { p, a } = await f.connected('Codex', 'clients');
    const aid = a.agent.agentId, cards = `/api/agents/${aid}/cards`;
    const asked = await f.ask(a, 'Before the update?');
    const receipt = await f.answer(aid, p.phone, asked.decisionId), did = asked.decisionId;
    const before = await f.pager(p.pagerId, p.phone);
    const calls: Call[] = [
      ['read the pager\'s key', `/api/pagers/${p.pagerId}/key`, {}],
      ['connect', '/api/agents', { data: { number: p.number, app: 'Codex', project: 'old' } }],
      ['connect as this command does', '/api/agents', { data: f.connectBody(p.number, 'Codex', 'old') }],
      ['connect with invalid input', '/api/agents', { data: { number: 'nope', bogus: 1 } }],
      ['status', `/api/agents/${aid}`, { agent: a.agentKey }],
      ['status with a wrong key', `/api/agents/${aid}`, { agent: token() }],
      ['status of no such agent', `/api/agents/${token()}`, { agent: a.agentKey }],
      ['ask', cards, { agent: a.agentKey, data: await f.sealed(a, question('From an old command?')) }],
      ['ask with the card readable, as before the switch', cards, { agent: a.agentKey, data: question('From an old command?') }],
      ['ask as the m4 command did, with no decision id', cards, { agent: a.agentKey, data: { title: 'From m4?', card: question().card } }],
      ['ask with a wrong key and invalid input', cards, { agent: token(), data: { title: '' } }],
      ['read the answer', `${cards}/${did}/answer`, { agent: a.agentKey }],
      ['wait for the answer', `${cards}/${did}/answer?wait=1`, { agent: a.agentKey }],
      ['wait with a bad wait', `${cards}/${did}/answer?wait=forever`, { agent: a.agentKey }],
      ['read a malformed decision id', `${cards}/not-a-decision/answer`, { agent: a.agentKey }],
      ['acknowledge', `${cards}/${did}/acknowledge`, { agent: a.agentKey, data: f.sealedAck(a, did, receipt.answerId, 'From an old command.') }],
      ['acknowledge readably, as before the switch', `${cards}/${did}/acknowledge`, { agent: a.agentKey, data: { answerId: receipt.answerId, nextSteps: 'From an old command.' } }],
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

// Since the encryption switch, the phone's routes need the header too: an app from before it (m4, which sent none,
// or one that sends protocol 1) reads decisions it can't open and sends answers the agent can't. It is told to update
// on every route, and never that its pager is unknown, which would make it drop the pager and its keys for good.
test('the phone: an app from before the switch is told to update on every route, never that its pager is unknown', { timeout: 180_000 }, async () => {
  const f = await fixture('clients-phone');
  try {
    const { p, a } = await f.connected('Codex', 'phone');
    const asked = await f.ask(a, 'Read by an old app?');
    const did = asked.decisionId, decision = `/api/agents/${a.agent.agentId}/cards/${did}`;
    const routes = (pagerId: string, keys = pagerKeys()): Call[] => [
      ['make a pager', '/api/pagers', { data: { number: keys.number, publicKey: keys.publicKey, autoOff: 'never' } }],
      ['read the pager', `/api/pagers/${pagerId}`, {}],
      ['turn it off', `/api/pagers/${pagerId}/settings`, { data: { on: false } }],
      ['give its device token', `/api/pagers/${pagerId}/push`, { data: { token: 'ab'.repeat(32), environment: 'sandbox' } }],
      ['answer as before the switch', `${decision}/answer`, { data: { requestId: token(), choice: { kind: 'option', number: 1 } } }],
      ['read an attachment', `${decision}/files/0`, {}],
      ['delete it', `/api/pagers/${pagerId}/delete`, { method: 'POST' }],
    ];
    const before = await f.pager(p.pagerId, p.phone);
    const words = 'This AgentPager app is too old for this server. Update the app; your pagers stay on this phone.';
    for (const client of [null, 'ios/1 0.1+1', 'ios/0 0.1+1', 'AgentPager/0.1', '']) {
      for (const [label, route, opts] of routes(p.pagerId)) {
        const e = await f.refused(400, 'UpdateRequired', route, { ...opts, phone: p.phone, client }).catch(e => { throw new Error(`${label}, client ${JSON.stringify(client)}: ${e}`); });
        assert.equal(e.message, words, label);
      }
      // A pager that is gone is still told to update first: only an app the service accepts hears it is unknown.
      await f.refused(400, 'UpdateRequired', `/api/pagers/${pagerKeys().pagerId}`, { phone: p.phone, client });
    }
    assert.deepEqual(await f.pager(p.pagerId, p.phone), before, 'nothing changed');
    // The current app is served, and hears that a pager is gone only when it is.
    await f.refused(404, 'UnknownPager', `/api/pagers/${pagerKeys().pagerId}`, { phone: p.phone });
    await f.answer(a.agent.agentId, p.phone, did);
  } finally { await f.stop(); }
});
