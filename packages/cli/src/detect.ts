import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

// Who asked ("Codex") and the project its decisions are grouped under on the phone (docs/v2/03-binary-surface.md §2).
// A harness is known by a marker in its environment, else by its process name. Verified: CLAUDECODE (Claude Code,
// 29 Oct 2026). The others are each harness's documented or observed variable and are checked again when the binary
// is built; an agent can always pass --app.
const MARKERS: [string, string][] = [['CLAUDECODE', 'Claude Code'], ['CODEX_SANDBOX', 'Codex'], ['CODEX_HOME', 'Codex'], ['CURSOR_TRACE_ID', 'Cursor'], ['PI_CODING_AGENT', 'pi']];
const NAMES: [RegExp, string][] = [[/^claude$/i, 'Claude Code'], [/^Claude$/, 'Claude'], [/codex/i, 'Codex'], [/^pi$/, 'pi'], [/cursor/i, 'Cursor']];
// MCP clients name themselves when they connect.
const CLIENTS: [RegExp, string][] = [[/claude-code/i, 'Claude Code'], [/claude/i, 'Claude'], [/codex/i, 'Codex'], [/cursor/i, 'Cursor'], [/^pi/i, 'pi']];

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
