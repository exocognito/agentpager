// Plays the agent for the decision-brief dogfood: connects to the owner's pager with its number over MCP, asks the
// canvas's four example briefs (D1–D4), then waits for each answer and acknowledges it.
// Usage: node --experimental-strip-types scripts/briefs.ts <server> <pager number> [D1 D2 …] [--no-wait]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { briefNames, loadBrief } from '../fixtures/briefs/load.ts';

const args = process.argv.slice(2), wait = !args.includes('--no-wait');
const [server, number, ...only] = args.filter(a => a !== '--no-wait');
if (!server || !number) { console.error('usage: briefs.ts <server> <pager number> [D1 D2 …] [--no-wait]'); process.exit(2); }
const names = briefNames().filter(name => !only.length || only.some(prefix => name.startsWith(prefix)));

const client = new Client({ name: 'AgentPager briefs dogfood', version: '1' });
await client.connect(new StreamableHTTPClientTransport(new URL(server + '/mcp')));
async function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const reply = await client.callTool({ name, arguments: args });
  const content = Array.isArray(reply.content) ? reply.content : [];
  const text = typeof content[0]?.text === 'string' ? content[0].text : '';
  if (reply.isError) throw new Error(`${name} refused: ${text}`);
  return JSON.parse(text);
}
const field = (value: unknown, key: string): unknown => typeof value === 'object' && value !== null && key in value ? Object.entries(value).find(([k]) => k === key)?.[1] : undefined;

const connected = await call('connect', { number, app: 'Claude Code', project: 'shop' });
const agent = { agentId: String(field(field(connected, 'agent'), 'agentId')), agentKey: String(field(connected, 'agentKey')) };
const asked: { name: string; decisionId: string }[] = [];
for (const name of names) {
  const reply = await call('ask', { ...agent, question: loadBrief(name) });
  asked.push({ name, decisionId: String(field(reply, 'decisionId')) });
  console.log(`asked ${name}: ${field(reply, 'decisionId')}`);
}
if (!wait) { await client.close(); process.exit(0); }
await Promise.all(asked.map(async ({ name, decisionId }) => {
  for (;;) {
    const reply = await call('wait', { ...agent, decisionId, waitSeconds: 50 });
    if (field(reply, 'status') !== 'answered') continue;
    const answer = field(reply, 'answer'), choice = field(answer, 'choice');
    const said = field(choice, 'kind') === 'option' ? `option ${String.fromCharCode(64 + Number(field(choice, 'number')))}` : `feedback “${field(choice, 'text')}”`;
    console.log(`answered ${name}: ${said}`);
    await call('ack', { ...agent, decisionId, acknowledgement: { answerId: String(field(answer, 'answerId')), nextSteps: `Got ${said}. Carrying on with it now.` } });
    console.log(`acknowledged ${name}`);
    return;
  }
}));
await client.close();
