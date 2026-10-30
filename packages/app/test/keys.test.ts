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
    const { p, a } = await f.connected('Claude Code', 'keys');
    const aid = a.agent.agentId, asked = await f.ask(a, 'Ship it?'), did = asked.decisionId;
    const agentCalls: Array<[string, string, { method?: string; data?: unknown }]> = [
      ['ask a blank title', `/api/agents/${aid}/cards`, { data: { title: '', card: { type: 'brief' } } }],
      ['ask with an unknown field', `/api/agents/${aid}/cards`, { data: { title: 'Ok?', bogus: 1 } }],
      ['read with a bad wait', `/api/agents/${aid}/cards/${did}/answer?wait=forever`, { method: 'GET' }],
      ['acknowledge without an answer id', `/api/agents/${aid}/cards/${did}/acknowledge`, { data: { nextSteps: 'Go.' } }],
      ['finish with a field', `/api/agents/${aid}/finish`, { data: { now: true } }],
      ['read a malformed decision id', `/api/agents/${aid}/cards/not-a-decision/answer`, { method: 'GET' }],
      ['acknowledge a malformed decision id', `/api/agents/${aid}/cards/not-a-decision/acknowledge`, { data: { answerId: did, nextSteps: 'Go.' } }],
    ];
    for (const [label, route, opts] of agentCalls) {
      await f.refused(401, 'Unauthorized', route, { ...opts, agent: token() }).catch(e => { throw new Error(`${label}: ${e}`); });
      await f.refused(400, 'InvalidInput', route, { ...opts, agent: a.agentKey }).catch(e => { throw new Error(`${label}, right key: ${e}`); });
    }
    const phoneCalls: Array<[string, string, unknown]> = [
      ['answer with no choice', `/api/agents/${aid}/cards/${did}/answer`, { requestId: token() }],
      ['an unknown auto-off', `/api/pagers/${p.pagerId}/settings`, { autoOff: 'forever' }],
      ['a malformed device token', `/api/pagers/${p.pagerId}/push`, { token: 1 }],
      ['delete with a field', `/api/pagers/${p.pagerId}/delete`, { now: true }],
      ['answer a malformed decision id', `/api/agents/${aid}/cards/not-a-decision/answer`, { requestId: token(), choice: { kind: 'option', number: 1 } }],
    ];
    for (const [label, route, data] of phoneCalls) {
      await f.refused(401, 'Unauthorized', route, { data, phone: token() }).catch(e => { throw new Error(`${label}: ${e}`); });
      await f.refused(400, 'InvalidInput', route, { data, phone: p.phone }).catch(e => { throw new Error(`${label}, right key: ${e}`); });
    }
    // A malformed attachment name or decision id is refused only to the pager's own phone key.
    for (const route of [`/api/agents/${aid}/cards/${did}/files/..%2Fpager`, `/api/agents/${aid}/cards/not-a-decision/files/a.png`]) {
      await f.refused(401, 'Unauthorized', route, { phone: token() });
      await f.refused(400, 'InvalidInput', route, { phone: p.phone });
    }
    // A phone makes a pager only with a key.
    await f.refused(401, 'Unauthorized', '/api/pagers', { data: { autoOff: 'forever' } });
    await f.refused(400, 'InvalidInput', '/api/pagers', { data: { autoOff: 'forever' }, phone: token() });

    // MCP: the tool call is decoded only for routing, so the agent checks the key before the question.
    await client.connect(new StreamableHTTPClientTransport(new URL(f.origin + '/mcp')));
    const tool = async (name: string, args: Record<string, unknown>) => {
      const reply = decode(TextResult, await client.callTool({ name, arguments: args }));
      assert.equal(reply.isError, true, JSON.stringify(reply));
      return decode(ErrorBody, JSON.parse(reply.content[0].text)).error;
    };
    const bad = { title: '', card: { type: 'brief' } };
    assert.equal(await tool('ask', { agentId: aid, agentKey: token(), question: bad }), 'Unauthorized');
    assert.equal(await tool('ask', { agentId: aid, agentKey: a.agentKey, question: bad }), 'InvalidInput');
    assert.equal(await tool('ack', { agentId: aid, agentKey: token(), decisionId: did, acknowledgement: { nextSteps: 'Go.' } }), 'Unauthorized');
    assert.equal(await tool('ack', { agentId: aid, agentKey: a.agentKey, decisionId: did, acknowledgement: { nextSteps: 'Go.' } }), 'InvalidInput');
    // The wait goes to the agent as sent, so it too is checked after the key, as strictly as its schema.
    assert.equal(await tool('wait', { agentId: aid, agentKey: token(), decisionId: did, waitSeconds: 0 }), 'Unauthorized');
    assert.equal(await tool('wait', { agentId: aid, agentKey: a.agentKey, decisionId: did, waitSeconds: 0 }), 'InvalidInput');
    assert.equal(await tool('wait', { agentId: aid, agentKey: a.agentKey, decisionId: did, waitSeconds: '5' }), 'InvalidInput');
    // So does a malformed decision id.
    assert.equal(await tool('wait', { agentId: aid, agentKey: token(), decisionId: 'not/a decision' }), 'Unauthorized');
    assert.equal(await tool('wait', { agentId: aid, agentKey: a.agentKey, decisionId: 'not/a decision' }), 'InvalidInput');
    assert.equal(await tool('ack', { agentId: aid, agentKey: token(), decisionId: 'nope', acknowledgement: { answerId: did, nextSteps: 'Go.' } }), 'Unauthorized');
    assert.equal(await tool('ack', { agentId: aid, agentKey: a.agentKey, decisionId: 'nope', acknowledgement: { answerId: did, nextSteps: 'Go.' } }), 'InvalidInput');
    // A malformed key is no key, and a missing field is named only to the agent itself.
    assert.equal(await tool('ask', { agentId: aid, agentKey: 'short', question: bad }), 'Unauthorized');
    assert.equal(await tool('ask', { agentId: aid, agentKey: token() }), 'Unauthorized');
    assert.equal(await tool('ack', { agentId: aid, agentKey: token(), decisionId: did }), 'Unauthorized');
    assert.equal(await tool('status', { agentId: aid, agentKey: token() }), 'Unauthorized');
    // A missing question or acknowledgement is named, not reported as an empty body.
    const missing = async (name: string, args: Record<string, unknown>) => JSON.parse(decode(TextResult, await client.callTool({ name, arguments: args })).content[0].text).message;
    assert.match(await missing('ask', { agentId: aid, agentKey: a.agentKey }), /question: is missing/);
    assert.match(await missing('ack', { agentId: aid, agentKey: a.agentKey, decisionId: did }), /acknowledgement: is missing/);
    // tools/list describes only briefs for a new card.
    const ask = (await client.listTools()).tools.find(t => t.name === 'ask');
    assert.ok(ask && JSON.stringify(ask.inputSchema).includes('"brief"'));
    assert.equal(JSON.stringify(ask.inputSchema).includes('"generic"'), false, 'ask offers no emoji cards');
  } finally { await client.close(); await f.stop(); }
});
