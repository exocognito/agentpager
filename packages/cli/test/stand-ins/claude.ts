import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// A stand-in for the `claude` command under setup: the plugin and MCP subcommands setup runs, replying in the shapes
// Claude Code 2.1.322 gave in the real run of 9 Nov 2026 (the pull request has it). It keeps what it was told in
// $STAND_IN/claude.json, as Claude Code keeps its settings, and every call it got in $STAND_IN/claude.calls. A test
// makes a subcommand fail by naming it in $STAND_IN/claude.fail, one per line, with the message to fail with after a
// tab. Like Claude Code, it reads the marketplace's and the plugin's manifests in the folder it is given, so a folder
// setup registered before writing it is refused; and its install enables a plugin that was disabled.
type Entry = { scope: 'user' | 'local'; type: string; command: string; args: string[]; env: { [k: string]: string } };
type State = { marketplaces: { [name: string]: string }; plugins: { [id: string]: { enabled: boolean } }; mcp: { [name: string]: Entry } };
const dir = process.env.STAND_IN ?? '', file = path.join(dir, 'claude.json'), argv = process.argv.slice(2), said = argv.join(' ');
const state: State = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { marketplaces: {}, plugins: {}, mcp: {} };
const save = () => writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
const out = (text: string) => process.stdout.write(text + '\n');
const end = (code: number): never => process.exit(code);
appendFileSync(path.join(dir, 'claude.calls'), JSON.stringify(argv) + '\n');
// What it was handed in its environment that names a pager, if anything: setup hands an app none.
if (process.env.AGENTPAGER_PAGER !== undefined) appendFileSync(path.join(dir, 'claude.environment'), `AGENTPAGER_PAGER=${process.env.AGENTPAGER_PAGER}\n`);

const failing = existsSync(path.join(dir, 'claude.fail')) ? readFileSync(path.join(dir, 'claude.fail'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t')) : [];
const fail = failing.find(([prefix]) => said.startsWith(prefix));
if (fail) {
  const message = fail[1] ?? 'It failed.';
  if (argv.includes('--json')) out(JSON.stringify({ command: argv[1], outcome: 'failed', message }));
  process.stderr.write(`✘ ${message}\n`);
  end(1);
}
const manifest = (folder: string, name: string): unknown => { try { return JSON.parse(readFileSync(path.join(folder, '.claude-plugin', name), 'utf8')); } catch { return null; } };
const isObject = (v: unknown): v is { [key: string]: unknown } => typeof v === 'object' && v !== null && !Array.isArray(v);
const refuse = (command: string, message: string): never => { out(JSON.stringify({ command, outcome: 'failed', message })); process.stderr.write(`✘ ${message}\n`); return end(1); };

if (said === 'plugin list --json') {
  out(JSON.stringify(Object.entries(state.plugins).map(([id, p]) => {
    const [name, market] = id.split('@');
    return { id, version: '0.1.0', scope: 'user', enabled: p.enabled, installPath: path.join(dir, 'cache', market, name, '0.1.0'), readFromFolder: path.join(state.marketplaces[market] ?? '', name), folderVersion: '0.1.0' };
  }), null, 2));
} else if (said === 'plugin marketplace list --json') {
  out(JSON.stringify(Object.entries(state.marketplaces).map(([name, folder]) => ({ name, source: 'directory', path: folder, installLocation: folder })), null, 2));
} else if (argv.length === 5 && said.startsWith('plugin marketplace add ') && argv[4] === '--json') {
  const folder = argv[3], listed = manifest(folder, 'marketplace.json');
  if (!existsSync(folder)) refuse('marketplace-add', `Path does not exist: ${folder}`);
  if (!isObject(listed) || typeof listed.name !== 'string') refuse('marketplace-add', `No marketplace manifest in ${folder}`);
  else { state.marketplaces[listed.name] = folder; save(); out(JSON.stringify({ command: 'marketplace-add', outcome: 'ok', marketplace: listed.name, message: `Successfully added marketplace: ${listed.name} (declared in user settings)` })); }
} else if (argv.length === 4 && said.startsWith('plugin install ') && argv[3] === '--json') {
  const id = argv[2], [name, market] = id.split('@'), folder = state.marketplaces[market], listed = folder === undefined ? null : manifest(folder, 'marketplace.json');
  const entry = isObject(listed) && Array.isArray(listed.plugins) ? listed.plugins.find(p => isObject(p) && p.name === name) : undefined;
  const plugin = isObject(entry) && typeof entry.source === 'string' ? manifest(path.join(folder, entry.source), 'plugin.json') : null;
  // The plugin's hooks module, as its hooks.json names it, must be there to load.
  const hooks = isObject(entry) && typeof entry.source === 'string' ? path.join(folder, entry.source, 'hooks') : '';
  const modules: unknown = (() => { try { return JSON.parse(readFileSync(path.join(hooks, 'hooks.json'), 'utf8')).modules; } catch { return null; } })();
  if (!isObject(plugin) || plugin.name !== name) refuse('install', `Plugin "${name}" not found in marketplace "${market}"`);
  else if (!Array.isArray(modules) || !modules.every(m => typeof m === 'string' && existsSync(path.join(hooks, m)))) refuse('install', `Plugin "${name}" names a hooks module that isn't there`);
  else { state.plugins[id] = { enabled: true }; save(); out(JSON.stringify({ command: 'install', outcome: 'ok', plugin: id, pluginId: id, scope: 'user', message: `Successfully installed plugin: ${id} (scope: user)` })); }
} else if (said === 'mcp get agentpager') {
  const e = state.mcp.agentpager;
  if (!e) { out('No MCP server named "agentpager". Run `claude mcp add` to add one.'); end(1); }
  out(['agentpager:', `  Scope: ${e.scope === 'user' ? 'User config (available in all your projects)' : 'Local config (private to you in this project)'}`, '  Status: ✔ Connected', `  Type: ${e.type}`,
    `  Command: ${e.command}`, `  Args: ${e.args.join(' ')}`, '  Environment:', ...Object.entries(e.env).map(([k, v]) => `    ${k}=${v}`), '', `To remove this server, run: claude mcp remove agentpager -s ${e.scope}`].join('\n'));
} else if (said === 'mcp remove agentpager -s user') {
  if (state.mcp.agentpager?.scope !== 'user') { out('No MCP server named "agentpager" in user scope'); end(1); }
  delete state.mcp.agentpager; save(); out('Removed MCP server agentpager from user config');
} else if (said.startsWith('mcp add --scope user agentpager -- ')) {
  state.mcp.agentpager = { scope: 'user', type: 'stdio', command: argv[6], args: argv.slice(7), env: {} }; save();
  out(`Added stdio MCP server agentpager with command: ${argv.slice(6).join(' ')} to user config`);
} else { process.stderr.write(`error: unknown command '${said}'\n`); end(1); }
