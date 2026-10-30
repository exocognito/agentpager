import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Schema } from 'effect';
import { fixture, assert, token, C, decode, ErrorBody, question, emojiCard, pagerKeys } from './support.ts';

const TextResult = Schema.Struct({ content: Schema.Array(Schema.Struct({ type: Schema.Literal('text'), text: Schema.String })), isError: Schema.optional(Schema.Boolean) });

test('official MCP SDK: connect, ask, wait, acknowledge, status, finish', { timeout: 180_000 }, async () => {
  const f = await fixture('mcp');
  const client = new Client({ name: 'AgentPager acceptance', version: '1' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(f.origin + '/mcp')));
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(t => t.name).sort(), ['ack', 'ask', 'connect', 'finish', 'status', 'wait']);
    assert.match(tools.tools.find(t => t.name === 'connect')?.description ?? '', /new agent/);
    assert.match(tools.tools.find(t => t.name === 'ask')?.description ?? '', /PagerOff/);
    async function raw(name: string, args: Record<string, unknown>) { return decode(TextResult, await client.callTool({ name, arguments: args })); }
    async function call<A, I>(name: string, args: Record<string, unknown>, result: Schema.Schema<A, I>) {
      const reply = await raw(name, args); assert.notEqual(reply.isError, true, JSON.stringify(reply));
      return decode(result, JSON.parse(reply.content[0].text));
    }
    async function fails(name: string, args: Record<string, unknown>, tag: string) {
      const reply = await raw(name, args); assert.equal(reply.isError, true);
      const e = decode(ErrorBody, JSON.parse(reply.content[0].text)); assert.equal(e.error, tag); return e;
    }

    const p = await f.makePager();
    const connected = await call('connect', { number: p.number, app: 'Codex', project: 'MCP journey' }, C.Connected);
    assert.equal(connected.agent.project, 'MCP journey');
    await fails('connect', { number: pagerKeys().number, app: 'Codex', project: 'nope' }, 'NumberInvalid');
    const agent = { agentId: connected.agent.agentId, agentKey: connected.agentKey };
    const asked = await call('ask', { ...agent, question: question('Which plan, over MCP?') }, C.Asked);
    const pending = await call('wait', { ...agent, decisionId: asked.decisionId, waitSeconds: 1 }, C.AnswerStatus);
    assert.deepEqual(pending, { status: 'pending' });
    const waiting = call('wait', { ...agent, decisionId: asked.decisionId, waitSeconds: 20 }, C.AnswerStatus);
    const receipt = await f.answer(agent.agentId, p.phone, asked.decisionId, { kind: 'option', number: 2 });
    const answered = await waiting;
    if (answered.status !== 'answered') throw new Error('unanswered');
    assert.equal(answered.answer.answerId, receipt.answerId);
    // A refusal names the field and its limit, never the schema's dump.
    const long = await fails('ack', { ...agent, decisionId: asked.decisionId, acknowledgement: { answerId: receipt.answerId, nextSteps: 'x'.repeat(281) } }, 'InvalidInput');
    assert.equal(long.message, 'The request was refused: nextSteps: text may not exceed 280 characters');
    const ack = await call('ack', { ...agent, decisionId: asked.decisionId, acknowledgement: { answerId: receipt.answerId, nextSteps: 'Going with the second plan.' } }, C.Acknowledgement);
    assert.equal((await f.pager(p.pagerId, p.phone)).agents[0].answered[0].acknowledgement?.acknowledgedAt, ack.acknowledgedAt);
    await fails('ask', { ...agent, question: { ...question(), surprise: true } }, 'InvalidInput');
    assert.match((await fails('ask', { ...agent, question: emojiCard }, 'InvalidInput')).message, /Emoji cards are retired/);
    assert.equal((await call('status', agent, C.AgentStatus)).pager.on, true);

    // Off reaches MCP agents the same way.
    await f.settings(p.pagerId, p.phone, { on: false });
    assert.match((await fails('ask', { ...agent, question: question() }, 'PagerOff')).message, /not delivered/);
    assert.equal((await call('status', agent, C.AgentStatus)).pager.on, false);
    await f.settings(p.pagerId, p.phone, { on: true });
    await call('finish', agent, C.Finished);
    await fails('ask', { ...agent, question: question() }, 'AgentFinished');
    await fails('wait', { agentId: agent.agentId, agentKey: token(), decisionId: asked.decisionId }, 'Unauthorized');
    await f.artifact('mcp.json', { tools: tools.tools.map(t => ({ name: t.name, description: t.description })) });
  } finally { await client.close(); await f.stop(); }
});
