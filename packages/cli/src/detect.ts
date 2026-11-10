import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import path from 'node:path';
import { CODEX_CLIENT, wakeableThread } from './codex.ts';

// Who asked ("Codex") and the project its decisions are grouped under on the phone (B25, blueprint/areas/2-agents.md).
// A harness is known by a marker in its environment, else by its process name. A marker is a variable the app itself
// sets for the commands it runs, never one a person sets for the app: CODEX_HOME, where a person tells Codex to keep its
// files, is in every shell on their machine once they export it, in Claude Code's and pi's as much as in Codex's, and
// Codex doesn't set it in its own (below). Verified: CLAUDECODE (Claude Code, 29 Oct 2026); CODEX_THREAD_ID and
// CODEX_SANDBOX (Codex 0.163.0, 9 Nov 2026: `codex exec`, read-only and workspace-write, set CODEX_THREAD_ID,
// CODEX_SANDBOX=seatbelt and CODEX_SANDBOX_NETWORK_DISABLED=1 in the shell of each command, and CODEX_HOME only when the
// shell that started Codex had it; its source sets the thread for every command since February 2026, whatever the
// sandbox, and CODEX_SANDBOX only under macOS's sandbox); PI_CODING_AGENT (pi 1.4.0 sets it for itself as it starts, so
// every command it runs has it). CURSOR_TRACE_ID is Cursor's as others report it, not yet checked against a real
// Cursor. An agent can always pass --app.
const MARKERS: [string, string][] = [['CLAUDECODE', 'Claude Code'], ['CODEX_THREAD_ID', 'Codex'], ['CODEX_SANDBOX', 'Codex'], ['CURSOR_TRACE_ID', 'Cursor'], ['PI_CODING_AGENT', 'pi']];
const NAMES: [RegExp, string][] = [[/^claude$/i, 'Claude Code'], [/^Claude$/, 'Claude'], [/codex/i, 'Codex'], [/^pi$/, 'pi'], [/cursor/i, 'Cursor']];
// MCP clients name themselves when they connect. A Claude Desktop chat calls tools as local-agent-mode-<server>
// (verified 30 Oct 2026: every tool call of 145 in the lab); its claude-ai client only lists them.
const CLIENTS: [RegExp, string][] = [[/claude-code/i, 'Claude Code'], [/^local-agent-mode-/, 'Claude Desktop'], [/claude/i, 'Claude'], [/codex/i, 'Codex'], [/cursor/i, 'Cursor'], [/^pi/i, 'pi']];

// The app whose waiting the binary words for it (B33.1, blueprint/areas/2-agents.md), only when it can tell for certain.
// Over MCP, by the client's own name: Claude Code, a Claude Desktop chat (local-agent-mode-<server>), or Codex, which
// names the thread on each call (codex.ts). From a shell, by the one app whose marker is there: CLAUDECODE=1 for Claude
// Code, CODEX_THREAD_ID for Codex, and AGENTPAGER_WAKE for an app whose AgentPager adapter wakes it. Markers of two apps
// mean one runs inside the other, and nothing says which asked: neither is named. Anything else is null and gets the
// words every agent gets.
//
// AGENTPAGER_WAKE is `<app>:<session>`, set at each session start by the adapter that will wake the agent with the
// answer, for the commands the agent runs from its shell: `claude-code:<id>` by the Claude Code plugin's mod, `pi:<id>`
// by the pi extension, where the id is the app's own for the session (letters, digits, ".", "_" and "-", up to 128).
// The command records each decision asked under it (the record of what's waiting, store.ts), and tells the agent not
// to wait. It counts only from a shell: an MCP server keeps the variables it started with, which may name an earlier
// session. An adapter that won't wake a session, such as in `claude -p`, clears it for that session, since a session
// started inside another inherits its variables. pi names its own session in PI_SESSION_ID for every command its agent
// runs (pi 1.4.0), so a pi session's wake counts only where that names the same session: a pi started inside another
// without the extension, as a run in print mode, inherits the outer session's wake but not its PI_SESSION_ID, and a
// command with no PI_SESSION_ID (one the owner types into pi with `!`, or a pi from before it) says nothing of which
// session asked. Claude Code likewise names its own in CLAUDE_CODE_SESSION_ID (Claude Code 2.1.321: in the shell of
// every command its agent or a subagent of it runs, and of one the person types with `!`), so a Claude Code session's
// wake counts only where that names the same session: a Claude Code started inside another without the plugin
// inherits the outer session's wake but not its CLAUDE_CODE_SESSION_ID, and a command with none says nothing of which
// session asked.
export type Wake = { app: 'claude-code' | 'pi'; session: string };
export type Caller =
  | { app: 'claude-code'; wake: Wake | null }
  | { app: 'claude-desktop' }
  | { app: 'codex'; via: 'mcp' | 'shell'; thread: string | null }
  | { app: 'pi'; wake: Wake };
export const HARNESS_APP: Record<'claude-code' | 'claude-desktop', string> = { 'claude-code': 'Claude Code', 'claude-desktop': 'Claude Desktop' };
export function wakeOf(value: string | undefined): Wake | null {
  const m = value === undefined ? null : /^(claude-code|pi):([A-Za-z0-9._-]{1,128})$/.exec(value);
  return m ? { app: m[1] === 'pi' ? 'pi' : 'claude-code', session: m[2] } : null;
}
// The markers each app sets in the shells it runs commands in. Codex's CODEX_SANDBOX counts as Codex being there, but
// only CODEX_THREAD_ID says which thread it is. A person's own CODEX_HOME counts for nothing (MARKERS, above).
const SHELL: [string, (env: NodeJS.ProcessEnv) => boolean][] = [
  ['claude-code', env => env.CLAUDECODE === '1' || wakeOf(env.AGENTPAGER_WAKE)?.app === 'claude-code'],
  ['codex', env => Boolean(env.CODEX_THREAD_ID || env.CODEX_SANDBOX)],
  ['pi', env => Boolean(env.PI_CODING_AGENT) || wakeOf(env.AGENTPAGER_WAKE)?.app === 'pi'],
  ['cursor', env => Boolean(env.CURSOR_TRACE_ID)],
];
export function identify(mcp?: { client?: string; meta?: unknown }, env: NodeJS.ProcessEnv = process.env): Caller | null {
  const wake = wakeOf(env.AGENTPAGER_WAKE);
  if (mcp?.client !== undefined) {
    const c = mcp.client;
    if (/^claude-code$/i.test(c)) return { app: 'claude-code', wake: null };
    if (/^local-agent-mode-/.test(c)) return { app: 'claude-desktop' };
    if (c === CODEX_CLIENT) return { app: 'codex', via: 'mcp', thread: wakeableThread({ meta: mcp.meta }) };
    return null;
  }
  const there = SHELL.filter(([, marked]) => marked(env)).map(([app]) => app);
  if (there.length !== 1) return null;
  if (there[0] === 'claude-code') return env.CLAUDECODE === '1' ? { app: 'claude-code', wake: wake?.app === 'claude-code' && env.CLAUDE_CODE_SESSION_ID === wake.session ? wake : null } : null;
  if (there[0] === 'codex') return env.CODEX_THREAD_ID ? { app: 'codex', via: 'shell', thread: wakeableThread({ env }) } : null;
  if (there[0] === 'pi') return wake?.app === 'pi' && env.PI_SESSION_ID === wake.session ? { app: 'pi', wake } : null;
  return null;
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

// The computer, by its short hostname ("air"), so the phone can say where an agent that went quiet is. Nothing when
// the name wouldn't pass the server's label rules (blank or over 60 characters).
export function detectMachine(): string | undefined {
  const name = hostname().split('.')[0]?.trim() ?? '';
  return name && name.length <= 60 && !/[<>]/.test(name) ? name : undefined;
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
