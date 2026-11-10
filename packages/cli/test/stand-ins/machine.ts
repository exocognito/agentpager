import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A throwaway machine for setup's tests: its own home, PATH and AgentPager home, with stand-ins for Claude Code and pi
// on that PATH (claude.ts and pi.ts here), which keep what they were told and every call they got.
const main = fileURLToPath(new URL('../../src/main.ts', import.meta.url)), standIns = fileURLToPath(new URL('.', import.meta.url));
const node = (script: string) => `#!/bin/sh\nexec '${process.execPath}' --experimental-strip-types --no-warnings '${script}' "$@"\n`;
export type Machine = ReturnType<typeof machine>;
// A machine with the apps named on its PATH, and the agentpager command there by name unless `named` is false. Its
// AgentPager home has a space in its name. `command` runs a built command in place of the source.
export function machine(apps: ('claude' | 'pi')[], options: { named?: boolean; command?: string } = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'agentpager-setup-')));
  const home = path.join(root, 'home'), bin = path.join(root, 'bin'), standIn = path.join(root, 'stand-in'), agentpager = path.join(root, 'agentpager home');
  for (const dir of [home, bin, standIn]) mkdirSync(dir);
  for (const app of apps) writeFileSync(path.join(bin, app), node(path.join(standIns, `${app}.ts`)), { mode: 0o755 });
  if (options.command) execFileSync('cp', [options.command, path.join(bin, 'agentpager')]);
  else if (options.named !== false) writeFileSync(path.join(bin, 'agentpager'), node(main), { mode: 0o755 });
  const env = (more: { [k: string]: string } = {}) => ({ HOME: home, PATH: `${bin}:/usr/bin:/bin`, AGENTPAGER_HOME: agentpager, STAND_IN: standIn, ...more });
  const command = options.command ? [path.join(bin, 'agentpager')] : [process.execPath, '--experimental-strip-types', main];
  const read = (name: string) => existsSync(path.join(standIn, name)) ? readFileSync(path.join(standIn, name), 'utf8') : '';
  return {
    root, home, bin, standIn, agentpager,
    // This command, as setup names it in an MCP entry.
    self: options.named === false ? 'agentpager' : path.join(bin, 'agentpager'),
    plugin: path.join(agentpager, 'adapters', 'claude-code'), extension: path.join(agentpager, 'adapters', 'pi'),
    setup: (args: string[] = [], more: { [k: string]: string } = {}) => execFileSync(command[0], [...command.slice(1), 'setup', ...args], { env: env(more), cwd: root, encoding: 'utf8' }),
    calls: (app: 'claude' | 'pi') => read(`${app}.calls`).split('\n').filter(Boolean).map(l => { const argv: string[] = JSON.parse(l); return argv.join(' '); }),
    forget: () => { for (const app of ['claude', 'pi']) writeFileSync(path.join(standIn, `${app}.calls`), ''); },
    claude: (): { marketplaces: { [name: string]: string }; plugins: { [id: string]: { enabled: boolean } }; mcp: { [name: string]: unknown } } => JSON.parse(read('claude.json') || '{"marketplaces":{},"plugins":{},"mcp":{}}'),
    pi: (): string[] => JSON.parse(read('pi.json') || '[]'),
    write: (name: string, text: string) => writeFileSync(path.join(standIn, name), text),
    // Everything the stand-ins were told and kept.
    told: () => readdirSync(standIn).sort().map(name => readFileSync(path.join(standIn, name), 'utf8')).join('\n'),
  };
}
// Every file under a folder, with its text.
export function filesUnder(dir: string): { [file: string]: string } {
  const all: { [file: string]: string } = {};
  const walk = (at: string) => { for (const e of readdirSync(at, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(at, e.name)); else all[path.relative(dir, path.join(at, e.name))] = readFileSync(path.join(at, e.name), 'utf8'); } };
  if (existsSync(dir)) walk(dir);
  return all;
}
export const ADAPTER_FILES = ['claude-code/agentpager/.claude-plugin/plugin.json', 'claude-code/agentpager/hooks/hooks.json', 'claude-code/agentpager/hooks/register.ts', 'claude-code/agentpager/hooks/wake.ts', 'pi/package.json', 'pi/src/index.ts'];
