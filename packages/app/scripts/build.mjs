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
await build({ entryPoints: [path.join(root, 'src/worker.ts')], outfile: path.join(out, 'worker.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', loader: { '.css': 'empty' }, define: { __BUILD_SHA__: JSON.stringify(sha), __LOCAL_UNPAIRED_MS__: local ? process.env.AGENTPAGER_UNPAIRED_MS || '60000' : '0', __LOCAL_SESSION_MS__: local ? process.env.AGENTPAGER_SESSION_MS || '180000' : '0', __LOCAL_RETAIN_MS__: local ? process.env.AGENTPAGER_RETAIN_MS || '180000' : '0', 'process.env.NODE_ENV': '"production"' } });
const config = {
  name: 'ownerpager', main: './worker.js', compatibility_date: '2026-09-24',
  assets: { directory: './public', binding: 'ASSETS', run_worker_first: true },
  durable_objects: { bindings: [{ name: 'SESSION', class_name: 'Session' }, { name: 'REGISTRY', class_name: 'Registry' }] },
  migrations: [{ tag: 'v1', new_sqlite_classes: ['Session'] }, { tag: 'v2', new_sqlite_classes: ['Registry'] }],
  // Local builds keep the caller's origin (a LAN dogfood server hands out LAN links); only deploy binds the domain.
  ...(local ? {} : { routes: [{ pattern: 'agentpager.me', custom_domain: true }] }),
  workers_dev: false,
};
await writeFile(path.join(out, 'wrangler.json'), JSON.stringify(config, null, 2));
console.log(`Built ${sha} (${local && process.env.AGENTPAGER_UNPAIRED_MS !== '0' ? 'local lifetimes' : 'production lifetimes'}) at ${out}`);
