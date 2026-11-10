import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromSource } from '../src/adapters.ts';
import { ADAPTER_FILES, filesUnder, machine, type Machine } from './stand-ins/machine.ts';

// setup writes only into the homes it is given: throwaway ones here (stand-ins/machine.ts). Claude Code and pi are
// stand-ins on PATH, which keep what they were told and every call they got; Claude Desktop's and Cursor's configs are
// real files. Codex isn't on these PATHs.
const main = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const MARKET = { name: 'agentpager-local', plugins: [{ name: 'agentpager', source: './agentpager' }] };
const READS = ['plugin list --json', 'plugin marketplace list --json', 'mcp get agentpager'];
// Claude Code's agentpager MCP entry as setup used to add it, or one a little different.
const entry = (m: Machine, more: object = {}) => m.write('claude.json', JSON.stringify({ marketplaces: {}, plugins: {}, mcp: { agentpager: { scope: 'user', type: 'stdio', command: m.self, args: ['mcp'], env: {}, ...more } } }));

test("B29.1 setup installs AgentPager's plugin in Claude Code and its extension in pi, from the files the command carries, through each app's own install", () => {
  const m = machine(['claude', 'pi']);
  assert.equal(m.setup(), "Claude Code: installed AgentPager's plugin (restart Claude Code)\npi: installed AgentPager's extension (restart pi)\n");
  // The files are the repository's, byte for byte, and nothing else but the marketplace that names the plugin.
  const { 'claude-code/.claude-plugin/marketplace.json': market, ...adapters } = filesUnder(path.join(m.agentpager, 'adapters'));
  assert.deepEqual(adapters, fromSource());
  assert.deepEqual(Object.keys(adapters).sort(), ADAPTER_FILES);
  const { name, plugins } = JSON.parse(market);
  assert.deepEqual({ name, plugins }, MARKET);
  // Claude Code: the marketplace, then the plugin, then both read back; no MCP server is added any more.
  assert.deepEqual(m.calls('claude'), ['plugin list --json', 'plugin marketplace list --json', `plugin marketplace add ${m.plugin} --json`, 'plugin install agentpager@agentpager-local --json', 'plugin list --json', 'plugin marketplace list --json', 'mcp get agentpager']);
  assert.deepEqual(m.claude(), { marketplaces: { 'agentpager-local': m.plugin }, plugins: { 'agentpager@agentpager-local': { enabled: true } }, mcp: {} });
  // pi: the package's folder, then its list read back; no MCP server either.
  assert.deepEqual(m.calls('pi'), ['list --no-approve', `install ${m.extension} --no-approve`, 'list --no-approve']);
  assert.deepEqual(m.pi(), [m.extension]);
});

test('B29.1 a second setup changes nothing: one registration in each app, the files untouched, and only the reading commands run', () => {
  const m = machine(['claude', 'pi']);
  m.setup();
  const state = () => ({ claude: m.claude(), pi: m.pi(), wake: statSync(path.join(m.plugin, 'agentpager/hooks/wake.ts')).ino, index: statSync(path.join(m.extension, 'src/index.ts')).ino });
  const before = state();
  m.forget();
  assert.equal(m.setup(), 'Claude Code: already set up\npi: already set up\n');
  assert.deepEqual(m.calls('claude'), READS);
  assert.deepEqual(m.calls('pi'), ['list --no-approve']);
  assert.deepEqual(state(), before);
});

test("B29.1 setup by a newer command replaces the plugin's and the extension's files, and registers neither again", () => {
  const m = machine(['claude', 'pi']);
  m.setup();
  // What an older command left: other files under the same names, and one this command no longer carries.
  writeFileSync(path.join(m.plugin, 'agentpager/hooks/wake.ts'), "// an older command's mod\n");
  writeFileSync(path.join(m.extension, 'src/index.ts'), "// an older command's extension\n");
  writeFileSync(path.join(m.extension, 'src/gone.ts'), '// a module a later extension dropped\n');
  m.forget();
  assert.equal(m.setup(['--print']), `Claude Code: would bring AgentPager's plugin in ${m.plugin} up to date\npi: would bring AgentPager's extension in ${m.extension} up to date\n`);
  assert.equal(readFileSync(path.join(m.plugin, 'agentpager/hooks/wake.ts'), 'utf8'), "// an older command's mod\n", '--print replaced nothing');
  assert.equal(m.setup(), "Claude Code: brought AgentPager's plugin up to date (restart Claude Code)\npi: brought AgentPager's extension up to date (restart pi)\n");
  const { 'claude-code/.claude-plugin/marketplace.json': market, 'pi/src/gone.ts': gone, ...adapters } = filesUnder(path.join(m.agentpager, 'adapters'));
  assert.deepEqual(adapters, fromSource());
  // Nothing is removed: a file the manifests no longer name is never loaded.
  assert.ok(market && gone);
  assert.deepEqual(m.calls('claude'), [...READS, ...READS]);
  assert.deepEqual(m.calls('pi'), ['list --no-approve', 'list --no-approve']);
  assert.deepEqual([Object.keys(m.claude().marketplaces), Object.keys(m.claude().plugins), m.pi()], [['agentpager-local'], ['agentpager@agentpager-local'], [m.extension]]);
});

test('B29.1 a home reached another way, or moved, leaves Claude Code one plugin; pi, which counts folders, is told of the other', () => {
  const m = machine(['claude', 'pi']);
  m.setup();
  // The same home through a symlink: the folder is named as the file system names it, so nothing is registered again.
  const link = path.join(m.root, 'link');
  execFileSync('ln', ['-s', m.agentpager, link]);
  assert.equal(m.setup([], { AGENTPAGER_HOME: link }), 'Claude Code: already set up\npi: already set up\n');
  assert.deepEqual([m.claude().marketplaces, m.pi()], [{ 'agentpager-local': m.plugin }, [m.extension]]);
  // Another home: Claude Code's one marketplace moves to it. pi now has two packages, and setup removes neither.
  const moved = path.join(m.root, 'moved');
  assert.equal(m.setup([], { AGENTPAGER_HOME: moved }), `Claude Code: installed AgentPager's plugin (restart Claude Code)\npi: installed AgentPager's extension (restart pi)\npi: it also loads AgentPager's extension from ${m.extension}, and each of the two would hand an answer to the agent. Keep one: pi remove '${m.extension}'\n`);
  assert.deepEqual(m.claude().marketplaces, { 'agentpager-local': path.join(moved, 'adapters', 'claude-code') });
  assert.deepEqual(m.pi(), [m.extension, path.join(moved, 'adapters', 'pi')]);
});

test('B29.1 --print says what setup would do and changes nothing', () => {
  const m = machine(['claude', 'pi']);
  entry(m);
  const cursor = path.join(m.home, '.cursor', 'mcp.json');
  mkdirSync(path.dirname(cursor)); writeFileSync(cursor, '{"mcpServers":{}}');
  const kept = () => [readFileSync(path.join(m.standIn, 'claude.json'), 'utf8'), existsSync(path.join(m.standIn, 'pi.json'))];
  const before = kept();
  assert.equal(m.setup(['--print']), [
    `Claude Code: would install AgentPager's plugin: write it to ${m.plugin} and run claude plugin marketplace add '${m.plugin}' && claude plugin install agentpager@agentpager-local`,
    'Claude Code: would remove its agentpager MCP server, which setup added: with the plugin, agents use the agentpager command (claude mcp remove agentpager -s user)',
    `pi: would install AgentPager's extension: write it to ${m.extension} and run pi install '${m.extension}'`,
    `Cursor: ${cursor}: would add the agentpager MCP server (${m.self} mcp)`, ''].join('\n'));
  assert.equal(existsSync(m.agentpager), false, 'nothing written under the home');
  assert.equal(readFileSync(cursor, 'utf8'), '{"mcpServers":{}}');
  assert.deepEqual(kept(), before, 'neither app was told anything');
  assert.deepEqual(m.calls('claude'), READS);
  assert.deepEqual(m.calls('pi'), ['list --no-approve']);
});

test("B29.1 an app that isn't on the machine is skipped", () => {
  const onlyPi = machine(['pi']);
  assert.equal(onlyPi.setup(), "pi: installed AgentPager's extension (restart pi)\n");
  assert.deepEqual(Object.keys(filesUnder(path.join(onlyPi.agentpager, 'adapters'))).sort(), ['pi/package.json', 'pi/src/index.ts'], "Claude Code's plugin isn't written");
  const onlyClaude = machine(['claude']);
  assert.equal(onlyClaude.setup(), "Claude Code: installed AgentPager's plugin (restart Claude Code)\n");
  assert.equal(existsSync(onlyClaude.extension), false);
  const none = machine([]);
  assert.equal(none.setup(), 'No harness found: Claude Code, pi, Codex, Claude Desktop or Cursor. Agents can still run the agentpager command.\n');
  assert.equal(existsSync(none.agentpager), false);
});

test("B29.1 setup removes Claude Code's agentpager MCP entry only when it is the one setup added, once the plugin is installed", () => {
  // Its own: this command with `mcp`, in the user's config, no environment. Removed after the plugin is in.
  const own = machine(['claude']);
  entry(own);
  assert.equal(own.setup(), "Claude Code: installed AgentPager's plugin (restart Claude Code)\nClaude Code: removed its agentpager MCP server, which setup added: with the plugin, agents use the agentpager command\n");
  assert.deepEqual(own.calls('claude').slice(-3), ['plugin marketplace list --json', 'mcp get agentpager', 'mcp remove agentpager -s user']);
  assert.deepEqual(own.claude().mcp, {});
  // Someone's own, each a little different: kept, never removed, and setup says so.
  for (const [what, more] of [['another command', { command: '/opt/other/agentpager' }], ['another argument', { args: ['mcp', '--verbose'] }], ['no argument', { args: [] }], ['an environment', { env: { AGENTPAGER_HOME: '/elsewhere' } }], ['the project, not the user', { scope: 'local' }], ['not a stdio server', { type: 'http' }]] as const) {
    const m = machine(['claude']);
    entry(m, more);
    const kept = m.claude().mcp;
    assert.equal(m.setup(), `Claude Code: installed AgentPager's plugin (restart Claude Code)\nClaude Code: left its agentpager MCP server alone, since it isn't the one setup adds (${m.self} mcp, in the user's config). With the plugin, agents use the agentpager command, not the MCP server\n`, what);
    assert.match(m.setup(['--print']), /^Claude Code: already set up\nClaude Code: left its agentpager MCP server alone/, what);
    assert.deepEqual(m.claude().mcp, kept, what);
    assert.ok(!m.calls('claude').some(c => c.startsWith('mcp remove')), what);
  }
  // The plugin didn't go in: its own entry stays, so Claude Code isn't left with neither.
  const failed = machine(['claude']);
  entry(failed);
  failed.write('claude.fail', 'plugin install\tFailed to update settings\n');
  assert.equal(failed.setup(), `Claude Code: couldn't install AgentPager's plugin: Failed to update settings. By hand: claude plugin marketplace add '${failed.plugin}' && claude plugin install agentpager@agentpager-local\nClaude Code: kept its agentpager MCP server, since AgentPager's plugin isn't installed and enabled\n`);
  assert.ok(failed.claude().mcp.agentpager);
  // The person disabled the plugin in Claude Code: setup doesn't enable it, as Claude Code's install would, and the entry stays.
  const disabled = machine(['claude']);
  disabled.setup();
  const off = { ...disabled.claude(), plugins: { 'agentpager@agentpager-local': { enabled: false } }, mcp: { agentpager: { scope: 'user', type: 'stdio', command: disabled.self, args: ['mcp'], env: {} } } };
  disabled.write('claude.json', JSON.stringify(off));
  disabled.forget();
  for (const args of [['--print'], []]) assert.equal(disabled.setup(args), "Claude Code: AgentPager's plugin is installed and disabled, so setup left it so. To enable it: claude plugin enable agentpager@agentpager-local\nClaude Code: kept its agentpager MCP server, since AgentPager's plugin isn't installed and enabled\n");
  assert.deepEqual(disabled.claude(), off);
  assert.deepEqual(disabled.calls('claude'), [...READS, ...READS]);
  // The removal itself fails: said, with the command.
  const stuck = machine(['claude']);
  entry(stuck);
  stuck.write('claude.fail', 'mcp remove\n');
  assert.match(stuck.setup(), /\nClaude Code: couldn't remove its agentpager MCP server, which setup added\. By hand: claude mcp remove agentpager -s user\n$/);
  // The command isn't on PATH by name, as the plugin runs it: the entry stays until it is, and setup says so.
  const unnamed = machine(['claude'], { named: false });
  entry(unnamed);
  assert.equal(unnamed.setup(), "Claude Code: installed AgentPager's plugin (restart Claude Code)\nClaude Code: kept its agentpager MCP server, since the plugin can't run agentpager by name yet\nagentpager isn't on your PATH. AgentPager's plugin and extension run it by that name, as their agents do\n");
  assert.ok(unnamed.claude().mcp.agentpager);
});

test("B29.4 a claude or pi command that fails gives one line with what to do by hand, and doesn't stop the other apps", () => {
  const cursorOf = (m: Machine) => { const file = path.join(m.home, '.cursor', 'mcp.json'); mkdirSync(path.dirname(file)); return file; };
  const byHand = (m: Machine) => `By hand: claude plugin marketplace add '${m.plugin}' && claude plugin install agentpager@agentpager-local`;
  // Claude Code can't read its own settings (as Claude Code 2.1.322 said it): it changed nothing, and neither did setup.
  const a = machine(['claude', 'pi']), cursor = cursorOf(a);
  a.write('claude.fail', 'plugin marketplace add\tInvalid JSON syntax in settings file at /home/.claude/settings.json\n');
  assert.equal(a.setup(), `Claude Code: couldn't install AgentPager's plugin: Invalid JSON syntax in settings file at /home/.claude/settings.json. ${byHand(a)}\npi: installed AgentPager's extension (restart pi)\nCursor: ${cursor}: added the agentpager MCP server (${a.self} mcp)\n`);
  assert.deepEqual([a.claude().marketplaces, a.claude().plugins, a.pi()], [{}, {}, [a.extension]]);
  assert.ok(!a.calls('claude').some(c => c.startsWith('plugin install')), 'the plugin is not installed from a marketplace that was not added');
  // Its lists can't be read at all, as from a Claude Code with no plugin commands.
  const b = machine(['claude', 'pi']);
  b.write('claude.fail', 'plugin list\n');
  assert.equal(b.setup(), `Claude Code: couldn't read its plugins (claude plugin list --json), so AgentPager's plugin wasn't installed. ${byHand(b)}\npi: installed AgentPager's extension (restart pi)\n`);
  // pi 1.4.0 with a settings.json it can't read: it says Installed, exits 0 and writes nothing. Setup reads its list again.
  const d = machine(['claude', 'pi']);
  d.write('pi.mode', 'unreadable-settings');
  assert.equal(d.setup(), `Claude Code: installed AgentPager's plugin (restart Claude Code)\npi: couldn't install AgentPager's extension: pi doesn't list it, as when it can't read its settings.json. By hand: pi install '${d.extension}'\n`);
  assert.deepEqual(d.pi(), []);
  for (const [mode, line] of [['install-fails', "pi: couldn't install AgentPager's extension: Error: it failed. By hand: pi install "], ['list-fails', "pi: couldn't read its packages (pi list), so AgentPager's extension wasn't installed. By hand: pi install "]]) {
    const m = machine(['claude', 'pi']);
    m.write('pi.mode', mode);
    assert.equal(m.setup(), `Claude Code: installed AgentPager's plugin (restart Claude Code)\n${line}'${m.extension}'\n`);
  }
  // The home can't be written: neither adapter is installed, each says so once, and Cursor is still set up.
  const e = machine(['claude', 'pi']), cursorE = cursorOf(e);
  mkdirSync(e.agentpager); chmodSync(e.agentpager, 0o500);
  assert.equal(e.setup(), [`Claude Code: couldn't write AgentPager's plugin to ${e.plugin} (EACCES), so it wasn't installed. Once that folder can be written, run agentpager setup again`,
    `pi: couldn't write AgentPager's extension to ${e.extension} (EACCES), so it wasn't installed. Once that folder can be written, run agentpager setup again`, `Cursor: ${cursorE}: added the agentpager MCP server (${e.self} mcp)`, ''].join('\n'));
  assert.deepEqual([e.calls('claude'), e.calls('pi')], [['mcp get agentpager'], []], 'neither app is told of a folder that was not written');
  chmodSync(e.agentpager, 0o700);
});

test('B29.6 nothing setup writes, or passes to an app, holds a key, an agent id or a pager number', () => {
  const m = machine(['claude', 'pi']);
  // An agent connected on this machine, and a number in the environment, as an agent's shell may have.
  const secrets = { agentKey: 'k'.repeat(43), privateKey: 'p'.repeat(43), pagerKey: 'q'.repeat(43), number: 'ap1_' + 'n'.repeat(32), id: 'ap-k3y5' };
  mkdirSync(path.join(m.agentpager, 'agents'), { recursive: true });
  writeFileSync(path.join(m.agentpager, 'agents', `${secrets.id}.json`), JSON.stringify({ server: 'http://127.0.0.1:9', pager: 'pg_x', agentId: 'a'.repeat(22), ...secrets }));
  entry(m);
  const desktop = path.join(m.home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'), cursor = path.join(m.home, '.cursor', 'mcp.json');
  mkdirSync(path.dirname(desktop), { recursive: true }); mkdirSync(path.dirname(cursor));
  const said = m.setup(['--print'], { AGENTPAGER_PAGER: secrets.number }) + m.setup([], { AGENTPAGER_PAGER: secrets.number });
  assert.match(said, /Claude Code: installed[\s\S]*Claude Code: removed[\s\S]*pi: installed[\s\S]*Claude Desktop: .* added[\s\S]*Cursor: .* added/);
  // All it wrote: the adapters and the two configs. All it passed: the stand-ins' calls, what they kept, and the number
  // in their environment, which each stand-in notes if it is handed one. And its replies.
  const everything = [said, ...Object.values(filesUnder(path.join(m.agentpager, 'adapters'))), readFileSync(desktop, 'utf8'), readFileSync(cursor, 'utf8'), m.told()].join('\n');
  assert.deepEqual([existsSync(path.join(m.standIn, 'claude.environment')), existsSync(path.join(m.standIn, 'pi.environment'))], [false, false], 'neither app was handed the number in its environment');
  assert.ok(m.calls('claude').length >= 10 && m.calls('pi').length >= 4, 'both apps were run, with --print and without');
  for (const [what, secret] of Object.entries(secrets)) assert.ok(!everything.includes(secret), what);
  assert.ok(!/ap1_|\bap-[a-z0-9]{4}\b/.test(everything), 'no pager number and no agent id of any kind');
  assert.deepEqual(JSON.parse(readFileSync(cursor, 'utf8')), { mcpServers: { agentpager: { command: m.self, args: ['mcp'] } } }, 'only where the command is');
});

test("B29.1 setup adds the MCP server to Claude Desktop's and Cursor's configs, once; B29.4 a config that isn't plain JSON is left alone, with what to add by hand", () => {
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-setup-'));
  const desktop = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  mkdirSync(path.dirname(desktop), { recursive: true }); mkdirSync(path.join(home, '.cursor'));
  writeFileSync(desktop, JSON.stringify({ mcpServers: { other: { command: 'other' } }, theme: 'dark' }));
  chmodSync(desktop, 0o600);
  const run = (...args: string[]) => execFileSync(process.execPath, ['--experimental-strip-types', main, 'setup', ...args], { env: { HOME: home, PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
  assert.match(run('--print'), /Claude Desktop: .* would add[\s\S]*Cursor: .* would add/);
  assert.equal(JSON.parse(readFileSync(desktop, 'utf8')).mcpServers.agentpager, undefined, '--print changed nothing');
  assert.match(run(), /Claude Desktop: .* added the agentpager MCP server \(agentpager mcp\) \(restart Claude Desktop\)/);
  const config = JSON.parse(readFileSync(desktop, 'utf8'));
  assert.deepEqual(config, { mcpServers: { other: { command: 'other' }, agentpager: { command: 'agentpager', args: ['mcp'] } }, theme: 'dark' }, 'other settings kept');
  assert.equal(statSync(desktop).mode & 0o777, 0o600, 'its permissions kept');
  assert.deepEqual(JSON.parse(readFileSync(path.join(home, '.cursor', 'mcp.json'), 'utf8')).mcpServers.agentpager, { command: 'agentpager', args: ['mcp'] });
  assert.match(run(), /Claude Desktop: .* already set up[\s\S]*Cursor: .* already set up/);
  assert.equal(existsSync(path.join(home, '.agentpager')), false, 'with neither Claude Code nor pi, no adapter is written');
  // A folder it can't write: said so, nothing thrown.
  const cursor = path.join(home, '.cursor', 'mcp.json');
  writeFileSync(cursor, '{}'); chmodSync(path.join(home, '.cursor'), 0o500);
  assert.match(run(), /Cursor: .* couldn't write it \(EACCES\)\. Add "agentpager"/);
  chmodSync(path.join(home, '.cursor'), 0o700);
  // A config that isn't plain JSON is left alone, byte for byte.
  const commented = '// mine\n{ "mcpServers": { "other": { "command": "other" } }, }\n';
  writeFileSync(desktop, commented);
  assert.match(run(), /Claude Desktop: .* it isn't plain JSON, so it was left alone\. Add "agentpager": \{"command":"agentpager","args":\["mcp"\]\} to its mcpServers yourself/);
  assert.equal(readFileSync(desktop, 'utf8'), commented);
});
