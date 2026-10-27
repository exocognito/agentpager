import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Schema } from 'effect';
import jsQR from 'jsqr';
import { fixture, assert, token, C, decode, ErrorBody, question, emojiCard } from './support.ts';

const TextResult = Schema.Struct({ content: Schema.Array(Schema.Struct({ type: Schema.Literal('text'), text: Schema.String })), isError: Schema.optional(Schema.Boolean) });

test('official MCP SDK: start, show code, ask, wait, acknowledge, finish; join a phone link once', { timeout: 180_000 }, async () => {
  const f = await fixture('mcp');
  const client = new Client({ name: 'AgentPager acceptance', version: '1' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(f.origin + '/mcp')));
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(t => t.name).sort(), Object.keys(C.MCP_TOOLS).sort());
    const start = tools.tools.find(t => t.name === 'start_session');
    assert.match(start?.description ?? '', /link\.qrText/); assert.match(start?.description ?? '', /pairingCode\.text/);
    assert.match(tools.tools.find(t => t.name === 'join_session')?.description ?? '', /pairingCode\.text to your owner verbatim/);
    async function raw(name: string, args: Record<string, unknown>) { return decode(TextResult, await client.callTool({ name, arguments: args })); }
    async function call<A, I>(name: string, args: Record<string, unknown>, result: Schema.Schema<A, I>) {
      const reply = await raw(name, args); assert.notEqual(reply.isError, true, JSON.stringify(reply));
      return decode(result, JSON.parse(reply.content[0].text));
    }
    async function fails(name: string, args: Record<string, unknown>, tag: string) {
      const reply = await raw(name, args); assert.equal(reply.isError, true);
      const e = decode(ErrorBody, JSON.parse(reply.content[0].text)); assert.equal(e.error, tag); return e;
    }

    const s = await call('start_session', { name: 'Codex · MCP journey', lifetime: '7d' }, C.Created);
    assert.equal(s.session.lifetime, '7d'); assert.equal(s.link.url, `${f.origin}/start/${s.link.code}`);
    // The terminal QR scans to the exact link.
    const lines = s.link.qrText.split('\n'), scale = 8, width = lines[0].length * scale, height = lines.length * 2 * scale;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const glyph = lines[Math.floor(y / (scale * 2))][Math.floor(x / scale)], bottom = Math.floor(y / scale) % 2 === 1;
      if (glyph === '█' || (bottom ? glyph === '▄' : glyph === '▀')) { const i = (y * width + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 0; }
    }
    assert.equal(jsQR(pixels, width, height)?.data, s.link.url);
    const agent = { sessionId: s.session.sessionId, agentKey: s.agentKey };
    const asked = await call('ask_card', { ...agent, question: question('Which plan, over MCP?') }, C.Asked);
    const phone = token();
    await f.pair(s.link.code, phone, s.pairingCode.emojis);
    const pending = await call('wait_for_card_answer', { ...agent, decisionId: asked.decisionId, waitSeconds: 1 }, C.AnswerStatus);
    assert.deepEqual(pending, { status: 'pending' });
    const waiting = call('wait_for_card_answer', { ...agent, decisionId: asked.decisionId, waitSeconds: 20 }, C.AnswerStatus);
    const receipt = await f.answer(s.session.sessionId, phone, asked.decisionId, { kind: 'option', number: 2 });
    const answered = await waiting;
    assert.equal(answered.status, 'answered');
    if (answered.status !== 'answered') throw new Error('unanswered');
    assert.equal(answered.answer.answerId, receipt.answerId);
    // A refusal names the field and its limit, never the schema's dump.
    const long = await fails('acknowledge_card', { ...agent, decisionId: asked.decisionId, acknowledgement: { answerId: receipt.answerId, nextSteps: 'x'.repeat(281) } }, 'InvalidInput');
    assert.equal(long.message, 'The request was refused: acknowledgement.nextSteps: text may not exceed 280 characters');
    const ack = await call('acknowledge_card', { ...agent, decisionId: asked.decisionId, acknowledgement: { answerId: receipt.answerId, nextSteps: 'Going with the second plan.' } }, C.Acknowledgement);
    assert.equal((await f.inbox(s.session.sessionId, phone)).answered[0].acknowledgement?.acknowledgedAt, ack.acknowledgedAt);
    await fails('ask_card', { ...agent, question: { ...question(), surprise: true } }, 'InvalidInput');
    assert.match((await fails('ask_card', { ...agent, question: emojiCard }, 'InvalidInput')).message, /Emoji cards are retired/);
    await call('finish_session', agent, C.Finished);
    const after = await fails('ask_card', { ...agent, question: question() }, 'PagerEnded');
    assert.equal(after.endReason, 'agentFinished');
    await fails('wait_for_card_answer', { sessionId: s.session.sessionId, agentKey: token(), decisionId: asked.decisionId }, 'Unauthorized');

    const ownerPhone = token(), made = await f.phoneCreate(ownerPhone);
    const joined = await call('join_session', { code: made.link.code, name: 'Claude Code · joined over MCP' }, C.Joined);
    assert.match(joined.pairingCode.text, /in this order:/);
    await fails('join_session', { code: made.link.code, name: 'Claude Code · second' }, 'AlreadyJoined');
    await fails('join_session', { code: token(), name: 'Nobody' }, 'LinkInvalid');
    await f.pair(made.link.code, ownerPhone, joined.pairingCode.emojis);
    await call('ask_card', { sessionId: joined.session.sessionId, agentKey: joined.agentKey, question: question('Joined and paired') }, C.Asked);
    await f.artifact('mcp.json', { tools: tools.tools.map(t => ({ name: t.name, description: t.description })), pairingText: s.pairingCode.text });
  } finally { await client.close(); await f.stop(); }
});
