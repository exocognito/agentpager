import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// setup writes only into the home it is given: a throwaway one here, with no claude or codex on PATH.
const main = fileURLToPath(new URL('../src/main.ts', import.meta.url));
test('setup adds the MCP entry to Claude Desktop and Cursor configs, idempotently; --print changes nothing', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-setup-'));
  const desktop = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  mkdirSync(path.dirname(desktop), { recursive: true }); mkdirSync(path.join(home, '.cursor'));
  writeFileSync(desktop, JSON.stringify({ mcpServers: { other: { command: 'other' } }, theme: 'dark' }));
  const run = (...args: string[]) => execFileSync(process.execPath, ['--experimental-strip-types', main, 'setup', ...args], { env: { HOME: home, PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
  assert.match(run('--print'), /Claude Desktop: .* would add[\s\S]*Cursor: .* would add/);
  assert.equal(JSON.parse(readFileSync(desktop, 'utf8')).mcpServers.agentpager, undefined, '--print changed nothing');
  assert.match(run(), /Claude Desktop: .* added the agentpager MCP server \(restart Claude Desktop\)/);
  const config = JSON.parse(readFileSync(desktop, 'utf8'));
  assert.deepEqual(config, { mcpServers: { other: { command: 'other' }, agentpager: { command: 'agentpager', args: ['mcp'] } }, theme: 'dark' }, 'other settings kept');
  assert.deepEqual(JSON.parse(readFileSync(path.join(home, '.cursor', 'mcp.json'), 'utf8')).mcpServers.agentpager, { command: 'agentpager', args: ['mcp'] });
  assert.match(run(), /Claude Desktop: .* already set up[\s\S]*Cursor: .* already set up/);
});
