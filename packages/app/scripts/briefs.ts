// Plays the agent for the decision-brief dogfood: connects to the owner's pager with its number, asks the
// canvas's four example briefs (D1–D4), then waits for each answer and acknowledges it. It seals and opens every part as
// the agentpager command does (packages/cli/src/seal.ts), after checking the pager's key against the number.
// Usage: node --experimental-strip-types scripts/briefs.ts <server> <pager number> [D1 D2 …] [--no-wait]
import { randomBytes } from 'node:crypto';
import { briefNames, loadBrief } from '../fixtures/briefs/load.ts';
import { CLIENT_HEADER, clientVersion, decisionIdOf } from '../../contract/exchange.ts';
import { askDigest, fingerprint, newKeys, openAnswer, sealAcknowledgement, sealAsk, sealIdentity, type Question } from '../../cli/src/seal.ts';

const args = process.argv.slice(2), wait = !args.includes('--no-wait');
const [server, number, ...only] = args.filter(a => a !== '--no-wait');
if (!server || !number) { console.error('usage: briefs.ts <server> <pager number> [D1 D2 …] [--no-wait]'); process.exit(2); }
const names = briefNames().filter(name => !only.length || only.some(prefix => name.startsWith(prefix)));

// Over the HTTP API, as the agentpager command does (the hosted MCP server is retired).
let key = '';
async function call(method: string, route: string, data?: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(server + route, { method, headers: { 'content-type': 'application/json', [CLIENT_HEADER]: clientVersion('briefs', 'designs'), ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  const value = await r.json();
  if (!r.ok) throw new Error(`${route} refused: ${JSON.stringify(value)}`);
  return value;
}
const field = (value: unknown, key: string): unknown => typeof value === 'object' && value !== null && key in value ? Object.entries(value).find(([k]) => k === key)?.[1] : undefined;

const bytes = Buffer.from(number.slice(4), 'base64url'), pager = bytes.subarray(0, 16).toString('hex');
const pagerKey = String(field(await call('GET', `/api/pagers/${pager}/key`), 'publicKey'));
if (fingerprint(pagerKey) !== bytes.subarray(16, 24).toString('hex')) { console.error('The pager\'s key doesn\'t match its number.'); process.exit(1); }
const keys = { pager, pagerKey, privateKey: newKeys().privateKey }, identity = { app: 'Claude Code', project: 'shop' };
const connected = await call('POST', '/api/agents', { number, identity: sealIdentity(keys, identity) });
const agent = String(field(field(connected, 'agent'), 'agentId'));
key = String(field(connected, 'agentKey'));
const asked: { name: string; decisionId: string; title: string }[] = [];
for (const name of names) {
  const brief = loadBrief(name) as Question, requestId = randomBytes(24).toString('base64url'), decisionId = await decisionIdOf(agent, requestId);
  const reply = await call('POST', `/api/agents/${agent}/cards`, { requestId, digest: askDigest(keys, brief), ...sealAsk(keys, identity, brief, decisionId) });
  asked.push({ name, decisionId: String(field(reply, 'decisionId')), title: brief.title });
  console.log(`asked ${name}: ${field(reply, 'decisionId')}`);
}
if (!wait) process.exit(0);
await Promise.all(asked.map(async ({ name, decisionId, title }) => {
  for (;;) {
    const reply = await call('GET', `/api/agents/${agent}/cards/${decisionId}/answer?wait=50`);
    if (field(reply, 'status') !== 'answered') continue;
    const answer = field(reply, 'answer'), choice = openAnswer(keys, decisionId, String(field(answer, 'answer')));
    if (!choice) throw new Error(`${name}: an answer that doesn't open`);
    const said = choice.kind === 'option' ? `option ${String.fromCharCode(64 + choice.number)}` : `feedback “${choice.text}”`;
    console.log(`answered ${name}: ${said}`);
    await call('POST', `/api/agents/${agent}/cards/${decisionId}/acknowledge`, { answerId: String(field(answer, 'answerId')), ...sealAcknowledgement(keys, identity, decisionId, `Got ${said}. Carrying on with it now.`, title) });
    console.log(`acknowledged ${name}`);
    return;
  }
}));
