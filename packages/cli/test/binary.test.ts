import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fixture, assert } from '../../app/test/support.ts';

// The compiled binary (pnpm build), not the source: CLI and MCP against a local server. Skipped until it is built.
const bin = fileURLToPath(new URL('../dist/agentpager', import.meta.url)), cli = fileURLToPath(new URL('..', import.meta.url));
// It runs the whole exchange encrypted under Bun's crypto: the key check, the identity, a card with a page and an
// image, the answer it opens, and the acknowledgement.
test('the compiled binary connects, asks, waits, acknowledges, reports status and serves MCP', { timeout: 180_000, skip: !existsSync(bin) && 'build it first: pnpm --filter @agentpager/cli build' }, async () => {
  const f = await fixture('cli-binary');
  const env = { ...process.env, AGENTPAGER_HOME: mkdtempSync(path.join(tmpdir(), 'agentpager-bin-')), AGENTPAGER_SERVER: f.origin };
  const client = new Client({ name: 'claude-code', version: '1' });
  try {
    const p = await f.makePager();
    const sh = (...args: string[]) => execFileSync(bin, args, { env, encoding: 'utf8' });
    assert.match(sh('version'), /^agentpager [0-9a-f]{7}\n$/);
    const out = sh('connect', p.number, '--app', 'pi', '--project', 'binary');
    const id = out.match(/agent (ap-[a-z0-9]{4})/)?.[1] ?? '';
    assert.match(sh('status', '--agent', id), /Pager: on/);
    const work = mkdtempSync(path.join(tmpdir(), 'agentpager-bin-card-'));
    copyFileSync(path.join(cli, '..', 'app', 'fixtures', 'briefs', 'D1-pricing', 'a-cards.png'), path.join(work, 'shot.png'));
    writeFileSync(path.join(work, 'card.yaml'), 'title: Built with Bun?\ndetail: The binary seals it.\ncontext:\n  summary: "Ready. ![Shot](shot.png)"\n  more: {title: Why, body: Because.}\noptions:\n  - {label: Yes, title: Yes, prioritizes: speed}\n  - {label: No, title: No, prioritizes: care}\nrecommendation: {option: A, why: Ready.}\nattachments: [shot.png]\n');
    const decision = JSON.parse(sh('ask', '--agent', id, path.join(work, 'card.yaml'), '--json')).result.decision;
    const seen = (await f.pager(p.pagerId, p.phone)).agents.flatMap(a => a.open).find(d => d.title === 'Built with Bun?');
    assert.ok(seen, 'the phone opens the card');
    assert.deepEqual(seen.attachments?.map(a => a.name), ['shot.png', 'background.md']);
    const agentId = (await f.pager(p.pagerId, p.phone)).agents.find(a => a.open.length)?.agent.agentId ?? '';
    await f.answer(agentId, p.phone, seen.decisionId, { kind: 'feedback', text: 'Opened by Bun.' });
    assert.match(sh('wait', '--agent', id, decision), /"Opened by Bun\."/);
    assert.match(sh('ack', '--agent', id, decision, 'Sealed by Bun.'), /^Acknowledged\./);
    assert.equal((await f.pager(p.pagerId, p.phone)).agents.flatMap(a => a.answered).find(d => d.decisionId === seen.decisionId)?.acknowledgement?.nextSteps, 'Sealed by Bun.');
    assert.equal(JSON.parse(sh('status', '--agent', id, '--json')).result.pagerOn, true);
    await client.connect(new StdioClientTransport({ command: bin, args: ['mcp'], env, stderr: 'ignore' }));
    assert.equal((await client.listTools()).tools.length, 9);
    const r = await client.callTool({ name: 'connect', arguments: { number: p.number, project: 'binary' } });
    const content = Array.isArray(r.content) ? r.content : [];
    assert.match(String(content[0]?.text), /\(project binary, as Claude Code\)/);
    // setup names the binary by its full path, so a GUI app without the shell's PATH can start it.
    const home = mkdtempSync(path.join(tmpdir(), 'agentpager-bin-setup-'));
    mkdirSync(path.join(home, '.cursor'));
    execFileSync(bin, ['setup'], { env: { HOME: home, PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(readFileSync(path.join(home, '.cursor', 'mcp.json'), 'utf8')).mcpServers.agentpager, { command: realpathSync(bin), args: ['mcp'] });
  } finally { await client.close(); await f.stop(); }
});
