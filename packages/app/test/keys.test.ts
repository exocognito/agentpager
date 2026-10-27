import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Schema } from 'effect';
import { fixture, assert, token, decode, ErrorBody } from './support.ts';

const TextResult = Schema.Struct({ content: Schema.Array(Schema.Struct({ type: Schema.Literal('text'), text: Schema.String })), isError: Schema.optional(Schema.Boolean) });

// I4: a wrong key is refused as unauthorized even when the input is also invalid. Each call below is sent with
// invalid input twice: with a wrong key it is Unauthorized, and with the right key the same input is InvalidInput.
test('a wrong key wins over invalid input, over HTTP and MCP', { timeout: 180_000 }, async () => {
  const f = await fixture('keys');
  const client = new Client({ name: 'AgentPager keys', version: '1' });
  try {
    const { s, phone } = await f.paired('Claude Code · keys');
    const sid = s.session.sessionId, asked = await f.ask(s, 'Ship it?'), did = asked.decisionId;
    const agentCalls: Array<[string, string, { method?: string; data?: unknown }]> = [
      ['ask a blank title', `/api/sessions/${sid}/cards`, { data: { title: '', card: { type: 'brief' } } }],
      ['ask with an unknown field', `/api/sessions/${sid}/cards`, { data: { title: 'Ok?', bogus: 1 } }],
      ['read with a bad wait', `/api/sessions/${sid}/cards/${did}/answer?wait=forever`, { method: 'GET' }],
      ['acknowledge without an answer id', `/api/sessions/${sid}/cards/${did}/acknowledge`, { data: { nextSteps: 'Go.' } }],
    ];
    for (const [label, route, opts] of agentCalls) {
      await f.refused(401, 'Unauthorized', route, { ...opts, agent: token() }).catch(e => { throw new Error(`${label}: ${e}`); });
      await f.refused(400, 'InvalidInput', route, { ...opts, agent: s.agentKey }).catch(e => { throw new Error(`${label}, right key: ${e}`); });
    }
    const phoneCalls: Array<[string, string, unknown]> = [
      ['answer with no choice', `/api/sessions/${sid}/cards/${did}/answer`, { requestId: token() }],
      ['an unknown lifetime', `/api/sessions/${sid}/lifetime`, { lifetime: 'forever' }],
      ['a malformed device token', `/api/sessions/${sid}/push`, { token: 1 }],
    ];
    for (const [label, route, data] of phoneCalls) {
      await f.refused(401, 'Unauthorized', route, { data, phone: token() }).catch(e => { throw new Error(`${label}: ${e}`); });
      await f.refused(400, 'InvalidInput', route, { data, phone }).catch(e => { throw new Error(`${label}, right key: ${e}`); });
    }
    // Ending takes no fields: a wrong key is refused before the body is read, and with the right key a field is refused.
    await f.refused(401, 'Unauthorized', `/api/sessions/${sid}/end`, { data: { now: true }, phone: token() });
    await f.refused(400, 'InvalidInput', `/api/sessions/${sid}/end`, { data: { now: true }, phone });
    await f.refused(401, 'Unauthorized', `/api/sessions/${sid}/finish`, { data: { now: true }, agent: token() });
    await f.refused(400, 'InvalidInput', `/api/sessions/${sid}/finish`, { data: { now: true }, agent: s.agentKey });
    // A phone makes a pager only with a key; a link its phone made pairs only that phone.
    await f.refused(401, 'Unauthorized', '/api/pagers', { data: { lifetime: 'forever' } });
    await f.refused(400, 'InvalidInput', '/api/pagers', { data: { lifetime: 'forever' }, phone: token() });
    const owner = token(), made = await f.phoneCreate(owner, '24h');
    await f.join(made.link.code, 'Codex · keys');
    const pair = `/api/start/${made.link.code}/pair`;
    await f.refused(401, 'Unauthorized', pair, { data: { code: 'nope' } });
    await f.refused(401, 'Unauthorized', pair, { data: { code: 'nope' }, phone: token() });
    await f.refused(400, 'InvalidInput', pair, { data: { code: 'nope' }, phone: owner });
    // A paired pager answers another phone AlreadyPaired, whatever its body.
    const live = `/api/start/${s.link.code}/pair`;
    await f.refused(409, 'AlreadyPaired', live, { data: { code: 'nope' }, phone: token() });
    await f.refused(400, 'InvalidInput', live, { data: { code: 'nope' }, phone });

    // MCP: the tool call is decoded only for routing, so the pager checks the key before the question.
    await client.connect(new StreamableHTTPClientTransport(new URL(f.origin + '/mcp')));
    const tool = async (name: string, args: Record<string, unknown>) => {
      const reply = decode(TextResult, await client.callTool({ name, arguments: args }));
      assert.equal(reply.isError, true, JSON.stringify(reply));
      return decode(ErrorBody, JSON.parse(reply.content[0].text)).error;
    };
    const bad = { title: '', card: { type: 'brief' } };
    assert.equal(await tool('ask_card', { sessionId: sid, agentKey: token(), question: bad }), 'Unauthorized');
    assert.equal(await tool('ask_card', { sessionId: sid, agentKey: s.agentKey, question: bad }), 'InvalidInput');
    assert.equal(await tool('acknowledge_card', { sessionId: sid, agentKey: token(), decisionId: did, acknowledgement: { nextSteps: 'Go.' } }), 'Unauthorized');
    assert.equal(await tool('acknowledge_card', { sessionId: sid, agentKey: s.agentKey, decisionId: did, acknowledgement: { nextSteps: 'Go.' } }), 'InvalidInput');
    // The wait goes to the pager as sent, so it too is checked after the key, as strictly as its schema.
    assert.equal(await tool('wait_for_card_answer', { sessionId: sid, agentKey: token(), decisionId: did, waitSeconds: 0 }), 'Unauthorized');
    assert.equal(await tool('wait_for_card_answer', { sessionId: sid, agentKey: s.agentKey, decisionId: did, waitSeconds: 0 }), 'InvalidInput');
    assert.equal(await tool('wait_for_card_answer', { sessionId: sid, agentKey: s.agentKey, decisionId: did, waitSeconds: '5' }), 'InvalidInput');
    // A malformed key is no key, and a missing field is named only to the pager's own agent.
    assert.equal(await tool('ask_card', { sessionId: sid, agentKey: 'short', question: bad }), 'Unauthorized');
    assert.equal(await tool('ask_card', { sessionId: sid, agentKey: token() }), 'Unauthorized');
    assert.equal(await tool('acknowledge_card', { sessionId: sid, agentKey: token(), decisionId: did }), 'Unauthorized');
    // A missing question or acknowledgement is named, not reported as an empty body.
    const missing = async (name: string, args: Record<string, unknown>) => JSON.parse(decode(TextResult, await client.callTool({ name, arguments: args })).content[0].text).message;
    assert.match(await missing('ask_card', { sessionId: sid, agentKey: s.agentKey }), /question: is missing/);
    assert.match(await missing('acknowledge_card', { sessionId: sid, agentKey: s.agentKey, decisionId: did }), /acknowledgement: is missing/);
    // tools/list describes only briefs for a new card.
    const ask = (await client.listTools()).tools.find(t => t.name === 'ask_card');
    assert.ok(ask && JSON.stringify(ask.inputSchema).includes('"brief"'));
    assert.equal(JSON.stringify(ask.inputSchema).includes('"generic"'), false, 'ask_card no longer offers emoji cards');
  } finally { await client.close(); await f.stop(); }
});
