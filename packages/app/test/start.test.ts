import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fixture, assert, token, sha, pause } from './support.ts';

test('/start documents, read-only /start/<code> for agents and browsers, old connect links fail', { timeout: 180_000 }, async () => {
  const f = await fixture('start-pages');
  try {
    const general = await fetch(f.origin + '/start');
    assert.equal(general.status, 200); assert.match(general.headers.get('content-type') ?? '', /text\/markdown/);
    const doc = await general.text();
    for (const needle of ['start_session', 'join_session', 'ask_card', 'wait_for_card_answer', 'acknowledge_card', 'finish_session', 'link.qrText', 'pairingCode.text', `${f.origin}/mcp`, `${f.origin}/api/sessions`, 'PagerEnded']) assert.ok(doc.includes(needle), needle);
    assert.equal(doc.includes('connect='), false);

    const old = await fetch(`${f.origin}/start?connect=${token()}`);
    assert.equal(old.status, 410); assert.match(await old.text(), /Old AgentPager connect links no longer work/);

    const phone = token(), made = await f.phoneCreate(phone, '7d');
    const before = await f.info(made.link.code);
    const agentRead = await fetch(made.link.url);
    assert.match(agentRead.headers.get('content-type') ?? '', /text\/markdown/);
    const agentText = await agentRead.text();
    assert.ok(agentText.includes(`join_session {"code":"${made.link.code}"`)); assert.ok(agentText.includes(`${f.origin}/api/start/${made.link.code}/join`));
    assert.ok(agentText.includes('pairingCode.text'));
    const browsers: Array<Record<string, string>> = [{ 'sec-fetch-dest': 'document' }, { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) Safari/604.1' }];
    for (const headers of browsers) {
      const page = await fetch(made.link.url, { headers });
      assert.match(page.headers.get('content-type') ?? '', /text\/html/);
      const html = await page.text();
      assert.ok(html.includes(`href="agentpager://start/${made.link.code}"`)); assert.ok(html.includes('Open in AgentPager'));
      assert.ok(html.includes('join_session'), 'an agent that gets the HTML still finds its instructions');
    }
    const svg = await fetch(made.link.qrUrl);
    assert.match(svg.headers.get('content-type') ?? '', /image\/svg\+xml/); assert.match(await svg.text(), /<svg/);
    // Reading changed nothing: the pager still waits for its one agent, with all tries left.
    assert.deepEqual(await f.info(made.link.code), before);
    assert.equal((await f.inbox(made.session.sessionId, phone)).session.status, 'waiting');
    const joined = await f.join(made.link.code, 'Codex · after reading');
    assert.equal(joined.session.status, 'unpaired');
    assert.equal((await fetch(`${f.origin}/start/not-a-code`)).status, 400);

    for (const p of ['/', '/start', made.link.url.replace(f.origin, ''), '/missing', '/api/missing']) {
      const r = await fetch(f.origin + p); assert.equal(r.headers.get('x-agentpager-build'), sha, p); assert.equal(r.headers.get('cache-control'), 'no-store'); await r.arrayBuffer();
    }
    const mcpGet = await fetch(f.origin + '/mcp'); assert.equal(mcpGet.status, 405); await mcpGet.arrayBuffer();
    const note = await fetch(f.origin + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
    assert.equal(note.status, 202);
    await f.artifact('start.md', doc); await f.artifact('start-code.md', agentText);
  } finally { await f.stop(); }
});

test('keys and link codes are stored only as SHA-256 digests', { timeout: 180_000 }, async () => {
  const f = await fixture('storage-hashing');
  try {
    const { s, phone } = await f.paired('Claude Code · hashing');
    const phone2 = token(), made = await f.phoneCreate(phone2);
    const joined = await f.join(made.link.code);
    await f.ask(s);
    await pause(1_500); // let workerd flush SQLite pages and WAL
    const files: string[] = [];
    const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
    walk(path.join(f.persist, 'v3', 'do'));
    const bytes = Buffer.concat(files.map(p => readFileSync(p)));
    for (const secret of [s.agentKey, phone, s.link.code, phone2, made.link.code, joined.agentKey]) assert.equal(bytes.includes(Buffer.from(secret)), false, 'no plain key or link code at rest');
    const digest = (v: string) => createHash('sha256').update(v).digest('hex');
    for (const secret of [s.agentKey, phone, joined.agentKey, phone2]) assert.ok(bytes.includes(Buffer.from(digest(secret))), 'the digest is what is stored');
    assert.ok(bytes.includes(Buffer.from(digest(made.link.code))), 'the registry keys link codes by digest');
    await f.artifact('storage.json', { files: files.map(p => path.relative(f.persist, p)), bytes: bytes.length });
  } finally { await f.stop(); }
});
