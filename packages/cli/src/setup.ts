import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Result } from './commands.ts';

// Writes the MCP server entry for every harness found: Claude Code and Codex through their own commands, Claude
// Desktop and Cursor through their config files. Idempotent. `--print` says what it would change and changes nothing.
const ENTRY = { command: 'agentpager', args: ['mcp'] };
const has = (bin: string) => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };
const run = (bin: string, args: string[]) => { try { return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return null; } };

const isObject = (v: unknown): v is { [key: string]: unknown } => typeof v === 'object' && v !== null && !Array.isArray(v);
// A config that is there but isn't plain JSON (comments, trailing commas, half written) is left alone: setup never
// rewrites what it can't read whole. The new file replaces the old in one step.
function jsonConfig(file: string, print: boolean): string | null {
  if (!existsSync(path.dirname(file))) return null;
  let config: { [key: string]: unknown } = {};
  if (existsSync(file)) {
    let parsed: unknown;
    try { const text = readFileSync(file, 'utf8'); parsed = text.trim() === '' ? {} : JSON.parse(text); } catch { parsed = null; }
    if (!isObject(parsed) || (parsed.mcpServers !== undefined && !isObject(parsed.mcpServers))) {
      return `${file}: it isn't plain JSON, so it was left alone. Add "agentpager": ${JSON.stringify(ENTRY)} to its mcpServers yourself`;
    }
    config = parsed;
  }
  const servers = isObject(config.mcpServers) ? config.mcpServers : {};
  if (JSON.stringify(servers.agentpager) === JSON.stringify(ENTRY)) return `${file}: already set up`;
  if (!print) {
    const temp = `${file}.agentpager-${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify({ ...config, mcpServers: { ...servers, agentpager: ENTRY } }, null, 2) + '\n');
    renameSync(temp, file);
  }
  return `${file}: ${print ? 'would add' : 'added'} the agentpager MCP server`;
}

export function setup(print: boolean): Result {
  const home = homedir(), lines: string[] = [];
  if (has('claude')) {
    if (run('claude', ['mcp', 'get', 'agentpager'])) lines.push('Claude Code: already set up');
    else if (print) lines.push('Claude Code: would run claude mcp add --scope user agentpager -- agentpager mcp');
    else lines.push(run('claude', ['mcp', 'add', '--scope', 'user', 'agentpager', '--', 'agentpager', 'mcp']) === null ? 'Claude Code: claude mcp add failed; run it by hand' : 'Claude Code: added the agentpager MCP server');
  }
  if (has('codex')) {
    if (run('codex', ['mcp', 'get', 'agentpager'])) lines.push('Codex: already set up');
    else if (print) lines.push('Codex: would run codex mcp add agentpager -- agentpager mcp');
    else lines.push(run('codex', ['mcp', 'add', 'agentpager', '--', 'agentpager', 'mcp']) === null ? 'Codex: codex mcp add failed; run it by hand' : 'Codex: added the agentpager MCP server');
  }
  const desktop = jsonConfig(path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'), print);
  if (desktop) lines.push('Claude Desktop: ' + desktop + (print ? '' : ' (restart Claude Desktop)'));
  const cursor = jsonConfig(path.join(home, '.cursor', 'mcp.json'), print);
  if (cursor) lines.push('Cursor: ' + cursor);
  return { code: 0, text: lines.length ? lines.join('\n') : 'No harness found: Claude Code, Codex, Claude Desktop or Cursor. Agents can still run the agentpager command.' };
}
