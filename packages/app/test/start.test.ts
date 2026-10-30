import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fixture, assert, token, sha, pause } from './support.ts';

test('/start documents connect, ask, wait, acknowledge and off; numbers only', { timeout: 180_000 }, async () => {
  const f = await fixture('start-pages');
  try {
    const general = await fetch(f.origin + '/start');
    assert.equal(general.status, 200); assert.match(general.headers.get('content-type') ?? '', /text\/markdown/);
    const doc = await general.text();
    for (const needle of ['connect {number, app, project}', 'ask {agentId, agentKey, question}', 'wait {agentId', 'ack {agentId', '`status`', '`finish`', 'ap1_', 'Decision briefs', '"type":"brief"', ':::option A', `${f.origin}/mcp`, `${f.origin}/api/agents`, 'PagerOff', 'PagerDeleted', 'InternalError', 'Ask for changes']) assert.ok(doc.includes(needle), needle);
    for (const gone of ['start_session', 'join_session', 'page_owner', 'pairingCode', 'link.qrText', 'session', 'lifetime']) assert.equal(doc.includes(gone), false, gone);
    // v1 links and numbers are gone.
    for (const old of [`/start/${token()}`, '/start?connect=x', `/api/start/${token()}`, `/api/numbers/${token()}/pagers`, '/api/sessions']) {
      const r = await fetch(f.origin + old, old.startsWith('/api/') ? { method: 'POST', body: '{}' } : {});
      assert.ok(r.status === 404 || old === '/start?connect=x', `${old}: ${r.status}`); await r.arrayBuffer();
    }

    const app = await fetch(f.origin + '/app', { redirect: 'manual' }); assert.equal(app.status, 302, 'the old web app address leads to the front page'); assert.equal(app.headers.get('location'), f.origin + '/'); await app.arrayBuffer();
    for (const p of ['/', '/app', '/start', '/missing', '/api/missing']) {
      const r = await fetch(f.origin + p); assert.equal(r.headers.get('x-agentpager-build'), sha, p); assert.equal(r.headers.get('cache-control'), 'no-store'); await r.arrayBuffer();
    }
    const mcpGet = await fetch(f.origin + '/mcp'); assert.equal(mcpGet.status, 405); await mcpGet.arrayBuffer();
    const note = await fetch(f.origin + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
    assert.equal(note.status, 202);
    await f.artifact('start.md', doc);
  } finally { await f.stop(); }
});

test('keys are stored only as SHA-256 digests', { timeout: 180_000 }, async () => {
  const f = await fixture('storage-hashing');
  try {
    const { p, a } = await f.connected('Claude Code', 'hashing');
    const b = await f.connect(p.number, 'Codex', 'hashing');
    await f.ask(a);
    await pause(1_500); // let workerd flush SQLite pages and WAL
    const files: string[] = [];
    const walk = (dir: string) => { for (const name of readdirSync(dir)) { const q = path.join(dir, name); if (statSync(q).isDirectory()) walk(q); else files.push(q); } };
    walk(path.join(f.persist, 'v3', 'do'));
    const bytes = Buffer.concat(files.map(q => readFileSync(q)));
    for (const secret of [a.agentKey, b.agentKey, p.phone]) assert.equal(bytes.includes(Buffer.from(secret)), false, 'no plain key at rest');
    const digest = (v: string) => createHash('sha256').update(v).digest('hex');
    for (const secret of [a.agentKey, b.agentKey, p.phone]) assert.ok(bytes.includes(Buffer.from(digest(secret))), 'the digest is what is stored');
    await f.artifact('storage.json', { files: files.map(q => path.relative(f.persist, q)), bytes: bytes.length });
  } finally { await f.stop(); }
});
