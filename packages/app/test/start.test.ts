import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fixture, assert, token, sha, pause } from './support.ts';

test('/start and /mcp tell an arriving agent to install the agentpager command; numbers only', { timeout: 180_000 }, async () => {
  const f = await fixture('start-pages');
  try {
    const general = await fetch(f.origin + '/start');
    assert.equal(general.status, 200); assert.match(general.headers.get('content-type') ?? '', /text\/markdown/);
    const doc = await general.text();
    for (const needle of ['agentpager setup', 'retired', 'git clone https://github.com/exocognito/agentpager', 'pnpm --filter @agentpager/cli build']) assert.ok(doc.includes(needle), needle);
    // The binary defaults to agentpager.me, so another server names itself in the command.
    assert.ok(doc.includes(`    ~/.local/bin/agentpager connect <number> --server ${f.origin}\n`), 'the command names this server');
    assert.ok(doc.includes('mkdir -p ~/.local/bin') && doc.includes('~/.local/bin/agentpager version') && doc.includes('stop and tell your owner'));
    for (const gone of ['curl', '/api/', 'agentKey', 'session', 'pairing']) assert.equal(doc.includes(gone), false, gone);
    // The hosted MCP server is retired: any request there gets the same page, as 410.
    for (const init of [{ method: 'GET' }, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) }]) {
      const mcp = await fetch(f.origin + '/mcp', init);
      assert.equal(mcp.status, 410); assert.equal(await mcp.text(), doc);
    }
    // v1 links and numbers are gone.
    for (const old of [`/start/${token()}`, `/api/start/${token()}`, `/api/numbers/${token()}/pagers`, '/api/sessions']) {
      const r = await fetch(f.origin + old, old.startsWith('/api/') ? { method: 'POST', body: '{}' } : {});
      assert.equal(r.status, 404, old); await r.arrayBuffer();
    }
    const app = await fetch(f.origin + '/app', { redirect: 'manual' }); assert.equal(app.status, 302, 'the old web app address leads to the front page'); assert.equal(app.headers.get('location'), f.origin + '/'); await app.arrayBuffer();
    for (const p of ['/', '/app', '/start', '/mcp', '/missing', '/api/missing']) {
      const r = await fetch(f.origin + p); assert.equal(r.headers.get('x-agentpager-build'), sha, p); assert.equal(r.headers.get('cache-control'), 'no-store'); await r.arrayBuffer();
    }
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
