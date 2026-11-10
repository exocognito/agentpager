import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { MARKETPLACE, PLUGIN, adapterDir, writeAdapter, type Adapter } from './adapters.ts';
import type { Result } from './commands.ts';
import { self } from './detect.ts';

// Adds the command to every agent app found (B29, blueprint/areas/7-getting-started.md). Claude Code and pi get
// AgentPager's plugin and extension, which wake the agent with the answer (B33): their agents use the command line, so
// neither gets the MCP server. Codex gets the MCP server through its own command; Claude Desktop and Cursor through
// their config files. Idempotent. `--print` says what it would change and changes nothing: of the apps' own commands
// it runs only the ones that read.
const has = (bin: string) => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };
// The entry names this binary by its absolute path: GUI apps (Claude Desktop, Cursor) don't get the shell's PATH.
const ENTRY = { command: self(), args: ['mcp'] };
// An app's own command, run with no shell and no input, so every argument reaches it as written. One that hangs is
// stopped, so the apps after it are still set up.
type Ran = { ok: boolean; out: string; err: string };
function exec(bin: string, args: string[]): Ran {
  try { return { ok: true, out: execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 }), err: '' }; }
  catch (e) {
    const text = (v: unknown) => typeof v === 'string' ? v : '';
    return isObject(e) ? { ok: false, out: text(e.stdout), err: text(e.stderr) } : { ok: false, out: '', err: '' };
  }
}
const run = (bin: string, args: string[]) => { const r = exec(bin, args); return r.ok ? r.out : null; };

function isObject(v: unknown): v is { [key: string]: unknown } { return typeof v === 'object' && v !== null && !Array.isArray(v); }
const json = (text: string | null): unknown => { try { return text === null ? null : JSON.parse(text); } catch { return null; } };
const read = (file: string) => { try { return readFileSync(file, 'utf8'); } catch { return null; } };
// A path as the file system names it, so one folder reached two ways (a symlinked home) is one registration.
const real = (p: string) => { try { return realpathSync(p); } catch { return path.resolve(p); } };
const same = (a: string, b: string) => real(a) === real(b);
const code = (e: unknown) => e instanceof Error && 'code' in e ? String(e.code) : 'write failed';
// A path as a person can paste it into a shell.
const quote = (s: string) => /^[A-Za-z0-9_/.:@%+=,-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
// Why an app's command failed, in the app's words, on one line: the message of its JSON reply, else the last line of
// its errors, else the last line it wrote.
function why(r: Ran): string {
  const reply = json(r.out.trim().split('\n').pop() ?? '');
  const last = (text: string) => text.split('\n').filter(l => l.trim()).pop();
  const said = isObject(reply) && typeof reply.message === 'string' ? reply.message : last(r.err) ?? last(r.out) ?? '';
  const line = (said.split('\n')[0] ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();
  return line ? `: ${line.length > 200 ? line.slice(0, 200) + '…' : line}` : '';
}

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
    // These files can hold other servers' keys: the new one keeps the old one's permissions (else owner only).
    const temp = `${file}.agentpager-${process.pid}.tmp`, mode = existsSync(file) ? statSync(file).mode & 0o777 : 0o600;
    try {
      writeFileSync(temp, JSON.stringify({ ...config, mcpServers: { ...servers, agentpager: ENTRY } }, null, 2) + '\n', { mode });
      chmodSync(temp, mode);
      renameSync(temp, file);
    } catch (e) {
      rmSync(temp, { force: true });
      return `${file}: couldn't write it (${code(e)}). Add "agentpager": ${JSON.stringify(ENTRY)} to its mcpServers yourself`;
    }
  }
  return `${file}: ${print ? 'would add' : 'added'} the agentpager MCP server (${ENTRY.command} mcp)`;
}

// An adapter's files, brought to this command's (adapters.ts): the folder, as the file system names it, and whether
// anything changed (with `print`, would change); or the line that says why they couldn't be written.
function adapter(which: Adapter, app: string, what: string, print: boolean): { dir: string; changed: boolean } | string {
  try { const changed = writeAdapter(which, print) === 'written'; return { dir: real(adapterDir(which)), changed }; }
  catch (e) { return `${app}: couldn't write ${what} to ${adapterDir(which)} (${code(e)}), so it wasn't installed. Once that folder can be written, run agentpager setup again`; }
}

// Whether Claude Code has AgentPager's plugin installed and enabled for the user, and its marketplace at this folder;
// null when Claude Code's own lists can't be read.
function claudeState(dir: string): { plugin: boolean; market: boolean } | null {
  const plugins = json(run('claude', ['plugin', 'list', '--json'])), markets = json(run('claude', ['plugin', 'marketplace', 'list', '--json']));
  if (!Array.isArray(plugins) || !Array.isArray(markets)) return null;
  return {
    plugin: plugins.some(p => isObject(p) && p.id === PLUGIN && p.scope === 'user' && p.enabled === true),
    market: markets.some(m => isObject(m) && m.name === MARKETPLACE && typeof m.path === 'string' && same(m.path, dir)),
  };
}
// Whether what `claude mcp get agentpager` printed is exactly the entry setup used to add for Claude Code: in the
// user's config, a stdio server, this command with `mcp`, and no environment. Anything else under that name, or a
// reply in a shape this doesn't know, is someone's own.
function ownEntry(text: string): boolean {
  const lines = text.split('\n');
  const only = (start: string) => { const hits = lines.filter(l => l.startsWith(start)); return hits.length === 1 ? hits[0] : null; };
  const environment = lines.indexOf('  Environment:');
  return lines[0] === 'agentpager:' && only('  Scope: ')?.startsWith('  Scope: User config') === true && only('  Type: ') === '  Type: stdio'
    && only('  Command: ') === `  Command: ${ENTRY.command}` && only('  Args: ') === '  Args: mcp'
    && environment !== -1 && !(lines[environment + 1] ?? '').startsWith('    ');
}
// Claude Code: the plugin, through Claude Code's own plugin commands, from a marketplace that is the folder setup
// wrote. Claude Code 2.1.322 loads such a plugin from that folder itself, so the files setup replaces are the ones the
// next session runs. Then the MCP entry setup added before there was a plugin goes, only once the plugin is in and
// the command can be run by name, so Claude Code is never left with neither.
function claudeCode(print: boolean, named: boolean): string[] {
  const lines: string[] = [];
  let installed = false;
  const files = adapter('claude-code', 'Claude Code', "AgentPager's plugin", print);
  if (typeof files === 'string') lines.push(files);
  else {
    const { dir, changed } = files, byHand = `claude plugin marketplace add ${quote(dir)} && claude plugin install ${PLUGIN}`;
    const before = claudeState(dir);
    if (before === null) lines.push(`Claude Code: couldn't read its plugins (claude plugin list --json), so AgentPager's plugin wasn't installed. By hand: ${byHand}`);
    else if (before.plugin && before.market) {
      installed = true;
      lines.push(!changed ? 'Claude Code: already set up' : print ? `Claude Code: would bring AgentPager's plugin in ${dir} up to date` : "Claude Code: brought AgentPager's plugin up to date (restart Claude Code)");
    } else if (print) {
      installed = true;
      lines.push(`Claude Code: would install AgentPager's plugin: write it to ${dir} and run ${byHand}`);
    } else {
      const add = exec('claude', ['plugin', 'marketplace', 'add', dir, '--json']);
      const install = add.ok ? exec('claude', ['plugin', 'install', PLUGIN, '--json']) : add;
      const after = install.ok ? claudeState(dir) : null;
      installed = after !== null && after.plugin && after.market;
      lines.push(installed ? "Claude Code: installed AgentPager's plugin (restart Claude Code)"
        : `Claude Code: couldn't install AgentPager's plugin${install.ok ? ": Claude Code doesn't list it as installed and enabled" : why(install)}. By hand: ${byHand}`);
    }
  }
  const entry = run('claude', ['mcp', 'get', 'agentpager']);
  if (entry === null) return lines;
  const remove = 'claude mcp remove agentpager -s user';
  if (!ownEntry(entry)) lines.push(`Claude Code: left its agentpager MCP server alone, since it isn't the one setup adds (${ENTRY.command} mcp, in the user's config). With the plugin, agents use the agentpager command, not the MCP server`);
  else if (!installed) lines.push("Claude Code: kept its agentpager MCP server, since AgentPager's plugin isn't installed");
  else if (!named) lines.push("Claude Code: kept its agentpager MCP server, since the plugin can't run agentpager by name yet");
  else if (print) lines.push(`Claude Code: would remove its agentpager MCP server, which setup added: with the plugin, agents use the agentpager command (${remove})`);
  else lines.push(run('claude', ['mcp', 'remove', 'agentpager', '-s', 'user']) === null ? `Claude Code: couldn't remove its agentpager MCP server, which setup added. By hand: ${remove}`
    : 'Claude Code: removed its agentpager MCP server, which setup added: with the plugin, agents use the agentpager command');
  return lines;
}

// pi: the extension, as a pi package in the folder setup wrote, through pi's own install, which records the folder
// in pi's settings and loads the package from it without copying (pi 1.4.0). pi counts a folder reached by another
// path as another package, so the folder is always given as the file system names it. pi's install says it installed
// even where it couldn't read its settings and wrote nothing, so its list is read again afterwards.
function pi(print: boolean): string[] {
  const files = adapter('pi', 'pi', "AgentPager's extension", print);
  if (typeof files === 'string') return [files];
  const { dir, changed } = files, byHand = `pi install ${quote(dir)}`;
  // pi's list gives each package's folder on a line of its own; project packages are left out of it.
  const packages = () => run('pi', ['list', '--no-approve'])?.split('\n').map(l => l.trim()).filter(l => path.isAbsolute(l)) ?? null;
  const before = packages();
  if (before === null) return [`pi: couldn't read its packages (pi list), so AgentPager's extension wasn't installed. By hand: ${byHand}`];
  const lines: string[] = [];
  if (before.some(p => same(p, dir))) lines.push(!changed ? 'pi: already set up' : print ? `pi: would bring AgentPager's extension in ${dir} up to date` : "pi: brought AgentPager's extension up to date (restart pi)");
  else if (print) lines.push(`pi: would install AgentPager's extension: write it to ${dir} and run ${byHand}`);
  else {
    const install = exec('pi', ['install', dir, '--no-approve']);
    const listed = install.ok && (packages()?.some(p => same(p, dir)) ?? false);
    lines.push(listed ? "pi: installed AgentPager's extension (restart pi)"
      : `pi: couldn't install AgentPager's extension${install.ok ? ": pi doesn't list it, as when it can't read its settings.json" : why(install)}. By hand: ${byHand}`);
  }
  // The same extension from another folder (another AGENTPAGER_HOME, or the repository's own) is someone's own
  // registration, so it stays; but each of the two would hand an answer over.
  const isExtension = (dir: string) => { const pkg = json(read(path.join(dir, 'package.json'))); return isObject(pkg) && pkg.name === '@agentpager/pi'; };
  for (const other of before.filter(p => !same(p, dir) && isExtension(p))) lines.push(`pi: it also loads AgentPager's extension from ${other}, and each of the two would hand an answer to the agent. Keep one: pi remove ${quote(other)}`);
  return lines;
}

export function setup(print: boolean): Result {
  const home = homedir(), lines: string[] = [];
  // The plugin and the extension run the command as `agentpager`, by name, as their agents do.
  const onPath = (() => { try { return realpathSync(execFileSync('which', ['agentpager'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { return null; } })();
  const named = onPath !== null && onPath === real(ENTRY.command);
  const claude = has('claude'), hasPi = has('pi');
  if (claude) lines.push(...claudeCode(print, named));
  if (hasPi) lines.push(...pi(print));
  if (has('codex')) {
    if (run('codex', ['mcp', 'get', 'agentpager'])) lines.push('Codex: already set up');
    else if (print) lines.push(`Codex: would run codex mcp add agentpager -- ${ENTRY.command} mcp`);
    else lines.push(run('codex', ['mcp', 'add', 'agentpager', '--', ENTRY.command, 'mcp']) === null ? 'Codex: codex mcp add failed; run it by hand' : 'Codex: added the agentpager MCP server');
  }
  const desktop = jsonConfig(path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'), print);
  if (desktop) lines.push('Claude Desktop: ' + desktop + (print ? '' : ' (restart Claude Desktop)'));
  const cursor = jsonConfig(path.join(home, '.cursor', 'mcp.json'), print);
  if (cursor) lines.push('Cursor: ' + cursor);
  if ((claude || hasPi) && !named) {
    lines.push(`${onPath === null ? "agentpager isn't on your PATH" : `The agentpager on your PATH (${onPath}) isn't this command (${ENTRY.command})`}. AgentPager's plugin and extension run it by that name, as their agents do`
      + (path.isAbsolute(ENTRY.command) ? `: put this one there, such as with ln -sf ${quote(ENTRY.command)} ~/.local/bin/agentpager, then run agentpager setup again` : ''));
  }
  return { code: 0, text: lines.length ? lines.join('\n') : 'No harness found: Claude Code, pi, Codex, Claude Desktop or Cursor. Agents can still run the agentpager command.' };
}
