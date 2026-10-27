// Dogfood server: production lifetimes (15 min window, 24h/7d/30d, 7-day tombstones), listening on every
// interface so a phone on the same Wi-Fi can reach it, with data kept across restarts in ~/.agentpager-dogfood.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
const port = process.env.PORT || '8787';
const persist = process.env.AGENTPAGER_PERSIST || path.join(homedir(), '.agentpager-dogfood');
mkdirSync(persist, { recursive: true });
let lan = '';
try { lan = execFileSync('ipconfig', ['getifaddr', 'en0'], { encoding: 'utf8' }).trim(); } catch { /* not on Wi-Fi en0 */ }
const env = { ...process.env, PORT: port, AGENTPAGER_IP: '0.0.0.0', AGENTPAGER_PERSIST: persist, AGENTPAGER_UNPAIRED_MS: '0', AGENTPAGER_SESSION_MS: '0', AGENTPAGER_RETAIN_MS: '0' };
console.log(`AgentPager dogfood server: http://${lan || '<this Mac\'s LAN IP>'}:${port}  (data in ${persist})`);
console.log(`Agents: read http://${lan || 'localhost'}:${port}/start   MCP: http://${lan || 'localhost'}:${port}/mcp`);
const child = spawn(process.execPath, ['scripts/start.mjs'], { cwd: path.dirname(path.dirname(new URL(import.meta.url).pathname)), env, stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
