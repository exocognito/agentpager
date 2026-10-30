import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// Who asked ("Codex") and the project its decisions are grouped under on the phone (docs/v2/03-binary-surface.md §2).
// A harness is known by a marker in its environment, else by its process name. Verified: CLAUDECODE (Claude Code,
// 29 Oct 2026). The others are each harness's documented or observed variable and are checked again when the binary
// is built; an agent can always pass --app.
const MARKERS: [string, string][] = [['CLAUDECODE', 'Claude Code'], ['CODEX_SANDBOX', 'Codex'], ['CODEX_HOME', 'Codex'], ['CURSOR_TRACE_ID', 'Cursor'], ['PI_CODING_AGENT', 'pi']];
const NAMES: [RegExp, string][] = [[/^claude$/i, 'Claude Code'], [/^Claude$/, 'Claude'], [/codex/i, 'Codex'], [/^pi$/, 'pi'], [/cursor/i, 'Cursor']];
// MCP clients name themselves when they connect. A Claude Desktop chat calls tools as local-agent-mode-<server>
// (verified 30 Oct 2026: every tool call of 145 in the lab); its claude-ai client only lists them.
const CLIENTS: [RegExp, string][] = [[/claude-code/i, 'Claude Code'], [/^local-agent-mode-/, 'Claude Desktop'], [/claude/i, 'Claude'], [/codex/i, 'Codex'], [/cursor/i, 'Cursor'], [/^pi/i, 'pi']];

// The harness whose waiting the binary knows how to word (docs/v2/03-binary-surface.md §6). Only a positive
// identification counts: over MCP the client's own name, from a shell CLAUDECODE=1 with no other harness's
// marker inherited around it. Anything else is null and gets the words every agent gets.
export type Harness = 'claude-code' | 'claude-desktop';
export const HARNESS_APP: Record<Harness, string> = { 'claude-code': 'Claude Code', 'claude-desktop': 'Claude Desktop' };
export function harness(mcpClient?: string): Harness | null {
  if (mcpClient !== undefined) return /^claude-code$/i.test(mcpClient) ? 'claude-code' : /^local-agent-mode-/.test(mcpClient) ? 'claude-desktop' : null;
  if (process.env.CLAUDECODE !== '1') return null;
  return MARKERS.some(([variable, app]) => app !== 'Claude Code' && process.env[variable]) ? null : 'claude-code';
}

export function detectApp(mcpClient?: string): string {
  if (mcpClient) for (const [re, app] of CLIENTS) if (re.test(mcpClient)) return app;
  for (const [variable, app] of MARKERS) if (process.env[variable]) return app;
  try {
    const parent = execFileSync('ps', ['-o', 'comm=', '-p', String(process.ppid)], { encoding: 'utf8' }).trim();
    for (const [re, app] of NAMES) if (re.test(path.basename(parent))) return app;
  } catch { /* no ps: the default */ }
  return 'Agent';
}

// The git repository's name, else the working folder's.
export function detectProject(cwd = process.cwd()): string {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (top) return path.basename(top);
  } catch { /* not a repository */ }
  const name = path.basename(cwd);
  return !name || cwd === homedir() ? 'general' : name;
}

// This binary's absolute path, for an MCP entry or a command an agent runs from a shell without our PATH.
// The compiled binary is process.execPath; run from source, the agentpager on PATH, else the bare name.
export function self(): string {
  if (path.basename(process.execPath) === 'agentpager') return process.execPath;
  try { return realpathSync(execFileSync('which', ['agentpager'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { return 'agentpager'; }
}
