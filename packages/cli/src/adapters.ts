import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { home } from './store.ts';

// AgentPager's adapters, as setup installs them (B29.1, blueprint/areas/7-getting-started.md): the Claude Code plugin
// (packages/claude-code-plugin) and the pi extension (packages/pi). An adapter and the command share a contract, the
// record of what's waiting (store.ts › Waiting), so the adapter an app runs must be the one this command was built
// with. The built command therefore carries the adapters' files inside itself (scripts/build.sh), needing no
// repository where it runs (B29.8); run from source, it reads them from the repository. Setup writes them under the
// command's own home, never inside another app's folders, and registers that folder with the app (setup.ts):
//   adapters/claude-code/                               a Claude Code marketplace of one plugin, in a folder
//     .claude-plugin/marketplace.json
//     agentpager/.claude-plugin/plugin.json             the plugin: what Claude Code needs on disk, and no tests
//     agentpager/hooks/{hooks.json,register.ts,wake.ts}
//   adapters/pi/{package.json,src/index.ts}             the pi package
// None of it holds a key, an agent id or a pager number (B29.6): they are the repository's files, byte for byte.
export const MARKETPLACE = 'agentpager-local', PLUGIN = `agentpager@${MARKETPLACE}`;
// Each file as it lands under adapters/, and where the repository keeps it, under packages/.
const SOURCES: [to: string, from: string][] = [
  ['claude-code/agentpager/.claude-plugin/plugin.json', 'claude-code-plugin/.claude-plugin/plugin.json'],
  ['claude-code/agentpager/hooks/hooks.json', 'claude-code-plugin/hooks/hooks.json'],
  ['claude-code/agentpager/hooks/register.ts', 'claude-code-plugin/hooks/register.ts'],
  ['claude-code/agentpager/hooks/wake.ts', 'claude-code-plugin/hooks/wake.ts'],
  ['pi/package.json', 'pi/package.json'],
  ['pi/src/index.ts', 'pi/src/index.ts'],
];
// The marketplace is setup's own: it only names the plugin beside it.
const MARKETPLACE_JSON = JSON.stringify({ name: MARKETPLACE, description: 'AgentPager for Claude Code, as the agentpager command on this computer installed it.', owner: { name: 'AgentPager' }, plugins: [{ name: 'agentpager', source: './agentpager' }] }, null, 2) + '\n';

export type Files = { [file: string]: string };
// Set at build time to fromSource()'s files (scripts/build.sh); not set when run from source.
declare const __AGENTPAGER_ADAPTERS__: Files | undefined;
export const fromSource = (): Files => Object.fromEntries(SOURCES.map(([to, from]) => [to, readFileSync(new URL(`../../${from}`, import.meta.url), 'utf8')]));
const files = (): Files => ({ 'claude-code/.claude-plugin/marketplace.json': MARKETPLACE_JSON, ...(typeof __AGENTPAGER_ADAPTERS__ === 'object' ? __AGENTPAGER_ADAPTERS__ : fromSource()) });

export type Adapter = 'claude-code' | 'pi';
// The folder an app is given: the marketplace for Claude Code, the package for pi.
export const adapterDir = (adapter: Adapter) => path.resolve(home(), 'adapters', adapter);

// Brings one adapter's files on disk to this command's: each file that differs is written beside itself and renamed
// over itself, so an app starting meanwhile never reads half of one. It writes nothing else and removes nothing: both
// apps load only the modules the manifests name, so a file a later command no longer carries is never loaded.
// `print` only says whether anything would change. Throws what the file system throws.
export function writeAdapter(adapter: Adapter, print: boolean): 'written' | 'current' {
  const root = path.resolve(home(), 'adapters');
  let changed = false;
  for (const [file, text] of Object.entries(files())) {
    if (!file.startsWith(`${adapter}/`)) continue;
    const to = path.join(root, file);
    let now: string | null;
    try { now = readFileSync(to, 'utf8'); } catch { now = null; }
    if (now === text) continue;
    changed = true;
    if (print) continue;
    mkdirSync(path.dirname(to), { recursive: true, mode: 0o700 });
    const temp = `${to}.${process.pid}.tmp`;
    try { writeFileSync(temp, text, { mode: 0o600 }); chmodSync(temp, 0o600); renameSync(temp, to); }
    catch (e) { rmSync(temp, { force: true }); throw e; }
  }
  return changed ? 'written' : 'current';
}
