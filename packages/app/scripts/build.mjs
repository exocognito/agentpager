import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = process.env.AGENTPAGER_BUILD_DIR || path.join(root, 'dist');
const local = process.argv.includes('--local');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await mkdir(path.join(out, 'public/assets'), { recursive: true });
await build({ entryPoints: [path.join(root, 'src/browser.tsx')], outfile: path.join(out, 'public/assets/app.js'), bundle: true, format: 'esm', platform: 'browser', minify: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
await writeFile(path.join(out, 'public/index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>AgentPager</title><link rel="stylesheet" href="/assets/app.css"><style>html,body{margin:0;padding:0}</style><div id="root"></div><script type="module" src="/assets/app.js"></script></html>');
await build({ entryPoints: [path.join(root, 'src/worker.ts')], outfile: path.join(out, 'worker.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', loader: { '.css': 'empty' }, define: { __BUILD_SHA__: JSON.stringify(sha), __LOCAL_AUTO_OFF_MS__: local ? process.env.AGENTPAGER_AUTO_OFF_MS || '0' : '0', __LOCAL_IDLE_MS__: local ? process.env.AGENTPAGER_IDLE_MS || '0' : '0', 'process.env.NODE_ENV': '"production"' } });
const config = {
  name: 'ownerpager', main: './worker.js', compatibility_date: '2026-09-24',
  assets: { directory: './public', binding: 'ASSETS', run_worker_first: true },
  durable_objects: { bindings: [{ name: 'AGENT', class_name: 'Agent' }, { name: 'REGISTRY', class_name: 'Registry' }] },
  // v3: v2's agents are v1's sessions renamed. Their old rows are not read; each forgets itself at its next alarm.
  migrations: [{ tag: 'v1', new_sqlite_classes: ['Session'] }, { tag: 'v2', new_sqlite_classes: ['Registry'] }, { tag: 'v3', renamed_classes: [{ from: 'Session', to: 'Agent' }] }],
  // Local builds keep the caller's origin (a LAN dogfood server hands out LAN links); only deploy binds the domain.
  ...(local ? {} : { routes: [{ pattern: 'agentpager.me', custom_domain: true }] }),
  // Workers Logs keep each failure's message, which the platform's analytics do not.
  ...(local ? {} : { observability: { enabled: true } }),
  // Alerts (push.ts). The key itself is the Worker secret APNS_KEY_P8, never in a build. A local build takes these
  // from the environment, so tests can point it at a stand-in for Apple.
  vars: local
    ? Object.fromEntries(['APNS_KEY_P8', 'APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_TOPIC', 'APNS_ORIGIN'].filter(k => process.env[k]).map(k => [k, process.env[k]]))
    : { APNS_KEY_ID: 'LP76VF4XQ5', APNS_TEAM_ID: 'X3M532E87A', APNS_TOPIC: 'me.agentpager.app.dev' },
  workers_dev: false,
};
await writeFile(path.join(out, 'wrangler.json'), JSON.stringify(config, null, 2));
console.log(`Built ${sha} (${local && (process.env.AGENTPAGER_AUTO_OFF_MS || process.env.AGENTPAGER_IDLE_MS) ? 'local clocks' : 'production clocks'}) at ${out}`);
