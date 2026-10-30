import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fixture, assert } from '../../app/test/support.ts';

// The compiled binary (pnpm build), not the source: CLI and MCP against a local server. Skipped until it is built.
const bin = fileURLToPath(new URL('../dist/agentpager', import.meta.url));
test('the compiled binary connects, reports status and serves MCP', { timeout: 180_000, skip: !existsSync(bin) && 'build it first: pnpm --filter @agentpager/cli build' }, async () => {
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
    assert.equal(JSON.parse(sh('status', '--agent', id, '--json')).result.pagerOn, true);
    await client.connect(new StdioClientTransport({ command: bin, args: ['mcp'], env, stderr: 'ignore' }));
    assert.equal((await client.listTools()).tools.length, 9);
    const r = await client.callTool({ name: 'connect', arguments: { number: p.number, project: 'binary' } });
    const content = Array.isArray(r.content) ? r.content : [];
    assert.match(String(content[0]?.text), /\(project binary, as Claude Code\)/);
  } finally { await client.close(); await f.stop(); }
});
