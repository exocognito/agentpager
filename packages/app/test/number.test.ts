import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Schema } from 'effect';
import { fixture, assert, token, C, decode, ErrorBody } from './support.ts';

const TextResult = Schema.Struct({ content: Schema.Array(Schema.Struct({ type: Schema.Literal('text'), text: Schema.String })), isError: Schema.optional(Schema.Boolean) });

test('pager number: agents open paired pagers with it, the phone lists them, a new number retires the old', { timeout: 180_000 }, async () => {
  const f = await fixture('pager-number');
  const client = new Client({ name: 'AgentPager acceptance', version: '1' });
  try {
    const phone = token();
    await f.refused(401, 'Unauthorized', '/api/numbers', { method: 'POST' });
    await f.refused(401, 'Unauthorized', '/api/numbers');
    const { number } = await f.ok(C.NumberMade, '/api/numbers', { method: 'POST', phone });
    const list = async (key = phone) => (await f.ok(C.NumberPagers, '/api/numbers', { phone: key })).sessionIds;
    const page = (n: string, name = 'Claude Code · numbered') => f.ok(C.Paged, `/api/numbers/${n}/pagers`, { data: { name } });
    assert.deepEqual(await list(), []);

    // An agent with the number opens a pager that is already paired to this phone: no link, no code.
    const a = await f.ok(C.Paged, `/api/numbers/${number}/pagers`, { data: { name: 'Claude Code · agentpager', lifetime: '7d' } });
    assert.equal(a.session.status, 'active'); assert.equal(a.session.lifetime, '7d'); assert.equal(a.session.name, 'Claude Code · agentpager');
    assert.equal(Date.parse(a.session.endsAt) - Date.parse(a.session.pairedAt ?? ''), f.lifetimes.lifetimeMs, 'lifetime counts from opening');
    const raw = await f.request(`/api/numbers/${number}/pagers`, { data: { name: 'Pi · raw reply' } });
    assert.deepEqual(Object.keys(raw.value ?? {}).sort(), ['agentKey', 'session'], 'nothing to show the owner');
    const status = await f.ok(C.AgentStatus, `/api/sessions/${a.session.sessionId}`, { agent: a.agentKey });
    assert.equal(status.session.status, 'active'); assert.equal(status.pairingCode, null);
    const rawId = decode(C.Paged, raw.value).session.sessionId;
    assert.deepEqual(await list(), [rawId, a.session.sessionId], 'newest first');
    assert.deepEqual(await list(token()), [], 'another phone key lists nothing');
    await f.refused(401, 'Unauthorized', `/api/sessions/${a.session.sessionId}/cards`, { phone: token() });

    // The usual exchange, with the phone's number key as the pager's phone key.
    const asked = await f.ask(a, 'Ship it?');
    assert.deepEqual((await f.inbox(a.session.sessionId, phone)).open.map(d => d.decisionId), [asked.decisionId]);
    const receipt = await f.answer(a.session.sessionId, phone, asked.decisionId);
    const read = await f.read(a, asked.decisionId, 2);
    assert.equal(read.status, 'answered'); if (read.status !== 'answered') throw new Error('unanswered');
    assert.equal(read.answer.answerId, receipt.answerId);
    await f.ack(a, asked.decisionId, receipt.answerId, 'Shipping now.');

    await f.refused(410, 'NumberInvalid', `/api/numbers/${token()}/pagers`, { data: { name: 'Nobody' } });
    await f.refused(400, 'InvalidInput', `/api/numbers/${number}/pagers`, { data: { name: 'Extra', surprise: true } });
    await f.refused(400, 'InvalidInput', `/api/numbers/${number}/pagers`, { data: {} });

    // MCP page_owner is the same call.
    await client.connect(new StreamableHTTPClientTransport(new URL(f.origin + '/mcp')));
    const tools = await client.listTools();
    assert.match(tools.tools.find(t => t.name === 'page_owner')?.description ?? '', /paired already/);
    const call = async (args: Record<string, unknown>) => decode(TextResult, await client.callTool({ name: 'page_owner', arguments: args }));
    const b = await call({ number, name: 'Codex · over MCP' });
    assert.notEqual(b.isError, true, JSON.stringify(b));
    const bPaged = decode(C.Paged, JSON.parse(b.content[0].text));
    assert.equal(bPaged.session.lifetime, '24h');
    const bad = await call({ number: token(), name: 'Codex · wrong number' });
    assert.equal(bad.isError, true); assert.equal(decode(ErrorBody, JSON.parse(bad.content[0].text)).error, 'NumberInvalid');

    // A new number retires the old one at once; pagers already open keep working and stay listed.
    const other = token(), otherNumber = (await f.ok(C.NumberMade, '/api/numbers', { method: 'POST', phone: other })).number;
    const { number: rotated } = await f.ok(C.NumberMade, '/api/numbers', { method: 'POST', phone, data: {} });
    assert.notEqual(rotated, number);
    await f.refused(410, 'NumberInvalid', `/api/numbers/${number}/pagers`, { data: { name: 'Old number' } });
    const c = await page(rotated);
    assert.deepEqual(await list(), [c.session.sessionId, bPaged.session.sessionId, rawId, a.session.sessionId]);
    await f.ask(a, 'Still here after the change?');
    const d = await page(otherNumber, 'Pi · other phone');
    assert.deepEqual(await list(other), [d.session.sessionId], "one phone's change leaves another's number alone");
    await f.artifact('number.json', { listed: await list(), tool: tools.tools.find(t => t.name === 'page_owner')?.description });
  } finally { await client.close(); await f.stop(); }
});
