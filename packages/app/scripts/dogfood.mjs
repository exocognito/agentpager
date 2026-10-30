// Dogfood server: production clocks (auto-off after 24h/7d/30d, agents forgotten after 30 idle days), listening on every
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
const env = { ...process.env, PORT: port, AGENTPAGER_IP: '0.0.0.0', AGENTPAGER_PERSIST: persist, AGENTPAGER_AUTO_OFF_MS: '0', AGENTPAGER_IDLE_MS: '0', AGENTPAGER_PICKUP_MS: '0' };
console.log(`AgentPager dogfood server: http://${lan || '<this Mac\'s LAN IP>'}:${port}  (data in ${persist})`);
console.log(`Agents: AGENTPAGER_SERVER=http://${lan || 'localhost'}:${port} agentpager connect <number>`);
const child = spawn(process.execPath, ['scripts/start.mjs'], { cwd: path.dirname(path.dirname(new URL(import.meta.url).pathname)), env, stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
