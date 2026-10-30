// Plays the agent for the decision-brief dogfood: connects to the owner's pager with its number, asks the
// canvas's four example briefs (D1–D4), then waits for each answer and acknowledges it.
// Usage: node --experimental-strip-types scripts/briefs.ts <server> <pager number> [D1 D2 …] [--no-wait]
import { briefNames, loadBrief } from '../fixtures/briefs/load.ts';

const args = process.argv.slice(2), wait = !args.includes('--no-wait');
const [server, number, ...only] = args.filter(a => a !== '--no-wait');
if (!server || !number) { console.error('usage: briefs.ts <server> <pager number> [D1 D2 …] [--no-wait]'); process.exit(2); }
const names = briefNames().filter(name => !only.length || only.some(prefix => name.startsWith(prefix)));

// Over the HTTP API, as the agentpager command does (the hosted MCP server is retired).
let key = '';
async function call(method: string, route: string, data?: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(server + route, { method, headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  const value = await r.json();
  if (!r.ok) throw new Error(`${route} refused: ${JSON.stringify(value)}`);
  return value;
}
const field = (value: unknown, key: string): unknown => typeof value === 'object' && value !== null && key in value ? Object.entries(value).find(([k]) => k === key)?.[1] : undefined;

const connected = await call('POST', '/api/agents', { number, app: 'Claude Code', project: 'shop' });
const agent = String(field(field(connected, 'agent'), 'agentId'));
key = String(field(connected, 'agentKey'));
const asked: { name: string; decisionId: string }[] = [];
for (const name of names) {
  const reply = await call('POST', `/api/agents/${agent}/cards`, loadBrief(name));
  asked.push({ name, decisionId: String(field(reply, 'decisionId')) });
  console.log(`asked ${name}: ${field(reply, 'decisionId')}`);
}
if (!wait) process.exit(0);
await Promise.all(asked.map(async ({ name, decisionId }) => {
  for (;;) {
    const reply = await call('GET', `/api/agents/${agent}/cards/${decisionId}/answer?wait=50`);
    if (field(reply, 'status') !== 'answered') continue;
    const answer = field(reply, 'answer'), choice = field(answer, 'choice');
    const said = field(choice, 'kind') === 'option' ? `option ${String.fromCharCode(64 + Number(field(choice, 'number')))}` : `feedback “${field(choice, 'text')}”`;
    console.log(`answered ${name}: ${said}`);
    await call('POST', `/api/agents/${agent}/cards/${decisionId}/acknowledge`, { answerId: String(field(answer, 'answerId')), nextSteps: `Got ${said}. Carrying on with it now.` });
    console.log(`acknowledged ${name}`);
    return;
  }
}));
