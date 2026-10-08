// Builds the "Routes · replies by session state" canvas data from the design code: every route (effects/routes.ts),
// its MCP tool, and each session store call's success and errors (effects/session.ts), with the HTTP status of each
// error. The before-pairing and live cells, and what the phone shows, come from the promises named in RULES.
// Fails if a route has no row, an MCP tool maps to no route, or a call can return an error its row never names.
//   node --experimental-strip-types records/workshop/v1/routes-table.mjs [<generator.js> <out.js>]
// With a generator and an out path it writes the generator with `const TABLE = ...` prepended, ready for the tldraw
// exec API; without them it only checks.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const design = new URL('../../../design/', import.meta.url);
const { ROUTES } = await import(new URL('effects/routes.ts', design));
const { HTTP_STATUS } = await import(new URL('effects/session.ts', design));
const { MCP_TOOLS, PHONE_POLL_MS } = await import(new URL('schemas/exchange.ts', design));

// Each session store call's success types and error tags, read from the SessionStoreService interface.
function storeCalls() {
  const source = readFileSync(new URL('effects/session.ts', design), 'utf8');
  const body = source.slice(source.indexOf('export interface SessionStoreService {'));
  const calls = {};
  for (const [, name, rest] of body.matchAll(/^ {2}readonly (\w+): ([\s\S]*?)(?=^ {2}(?:readonly |\/\/)|^\})/gm)) {
    const success = new Set(), errors = new Set();
    for (const m of rest.matchAll(/Effect\.Effect</g)) {
      let depth = 1, i = m.index + m[0].length, comma = -1;
      for (; depth; i++) {
        const c = rest[i];
        if (c === '<' || c === '{' || c === '(') depth++;
        else if (c === '>' || c === '}' || c === ')') depth--;
        else if (c === ',' && depth === 1 && comma < 0) comma = i;
      }
      success.add(rest.slice(m.index + m[0].length, comma).trim().replace(/\s+/g, ' '));
      for (const tag of rest.slice(comma + 1, i - 1).split('|')) errors.add(tag.trim());
    }
    calls[name] = { success: [...success], errors: [...errors] };
  }
  return calls;
}

const s = n => `${HTTP_STATUS[n]} ${n}`;
const poll = `${PHONE_POLL_MS / 1000} s`;
// before: the session exists but the agent has not acknowledged the pairing card. live: pairing acknowledged.
// always: refusals in any state. phone: what the owner's phone shows. Ended, expired and the remaining refusals are
// filled from the call's errors. A cell that names an error tag counts for the coverage check.
const RULES = {
  // The owner's browser and public pages.
  frontPage: { group: 'Pages', always: '200 HTML, the front page', phone: 'the front page (C6)' },
  homeApp: { group: 'Pages', always: '200 HTML, the home screen', phone: 'this browser\'s sessions, or an empty list with + (C12)' },
  phoneApp: { group: 'Pages', before: 'the pairing card, already open (C1)', live: 'the queue and any open card', ended: '"Session ended"; who ended it (C7)', expired: '"Session expired" (I6)', phone: 'the session screen' },
  claimPage: { group: 'Pages', before: 'first claim: opens the pairing card; a used or replaced link: "This link no longer works" (I3)', live: '"This link no longer works" (I3)', ended: '"This session is over"', expired: '"This session is over"', phone: 'the claim screen' },
  pairingQr: { group: 'Pages', always: '200 SVG of the pairing link', phone: '—' },
  start: { group: 'Pages', always: '200 markdown, the start document; joins nothing', phone: '—' },
  connectPage: { group: 'Pages', always: '200 markdown, the start document with the connect id; joins nothing', phone: '—' },
  mcp: { group: 'Pages', always: '200 JSON-RPC over streamable HTTP; a tool error carries the same tag as its HTTPS route; a notification gets 202', phone: '—' },
  // Agent calls.
  createSession: { group: 'Agent', mcp: 'start_session', before: '200 SessionCreated: a new session, its pairing link and target', phone: 'nothing until a phone claims the link' },
  joinPhone: { group: 'Agent', mcp: 'join_session', before: '200 PhoneJoined: the first join makes the session the phone holds (C13)', always: `${s('ConnectLinkInvalid')}: a used, expired or unknown id`, phone: 'with the Connect sheet open, the session opens on its pairing card; else an unpaired row (C13)' },
  agentStatus: { group: 'Agent', before: '200 AgentStatus with the current pairing link, replaced when older than its lifetime (I3)', live: '200 AgentStatus, pairing null', phone: '—' },
  askCard: { group: 'Agent', mcp: 'ask_card', before: `${s('InvalidInput')}: every ask is refused until the agent acknowledges the pairing card (I9)`, live: '200 Decision', phone: `live: the card is in the queue within ${poll}; ended: nothing, the phone shows "Session ended"` },
  readCardAnswer: { group: 'Agent', mcp: 'wait_for_card_answer', before: '200 AnswerStatus for the pairing card, held until Send; the MCP wait also returns the current link while it is unclaimed', live: '200 AnswerStatus, held up to the answer wait', phone: '—' },
  acknowledgeCard: { group: 'Agent', mcp: 'acknowledge_card', before: '200 Acknowledgement of the pairing answer: the session is live (C1)', live: `200 Acknowledgement; ${s('NotAnswered')}, ${s('AlreadyAcknowledged')} or ${s('AnswerMismatch')}`, phone: '"Your agent confirmed" and the next steps on that card' },
  endSession: { group: 'Agent and phone', mcp: 'end_session', before: '200 endedAt: either side may end it (I3, C7)', live: '200 endedAt', phone: 'agent end: "Your agent ended this session"; owner end: "You ended this session"' },
  // Phone calls.
  openConnect: { group: 'Phone', before: '200 ConnectOpened: the id is registered (C13)', always: `${s('InvalidInput')}: the id is already registered`, phone: 'the connect link on the sheet' },
  readConnect: { group: 'Phone', before: '200 ConnectStatus: the session an agent made, or null (C13)', always: `${s('ConnectLinkInvalid')}: expired unused or unknown`, phone: 'the session appears on Home' },
  claimPairing: { group: 'Phone', before: `200 session id and phone key: the first claim reserves the session; a second claim ${s('PairingLinkInvalid')} or ${s('AlreadyPaired')} (I3)`, live: `${s('AlreadyPaired')} (I3)`, phone: 'lands on the pairing card' },
  readCards: { group: 'Phone', before: '200 Inbox: the pairing card only', live: '200 Inbox: open cards and history', phone: 'the queue' },
  answerCard: { group: 'Phone', before: `200 Receipt for the agent's emoji; another option ${s('InvalidInput')} (C1)`, live: `200 Receipt; a second answer ${s('AlreadyAnswered')} with the stored receipt (I12)`, phone: 'Undo, then Sending, then the answer' },
};

const calls = storeCalls();
const problems = [];
for (const key of Object.keys(ROUTES)) if (!RULES[key]) problems.push(`route ${key} has no row`);
for (const key of Object.keys(RULES)) if (!ROUTES[key]) problems.push(`row ${key} names no route`);
const tools = Object.values(RULES).map(r => r.mcp).filter(Boolean);
for (const tool of Object.keys(MCP_TOOLS)) if (!tools.includes(tool)) problems.push(`MCP tool ${tool} maps to no route`);
const STATE_ERRORS = { ended: ['SessionEnded', 'PhoneSessionEnded'], expired: ['SessionExpired'] };
const rows = Object.entries(RULES).map(([key, rule]) => {
  const route = ROUTES[key], call = calls[key];
  const row = { key, group: rule.group, route: `${route.method} ${route.path}`, caller: route.caller, mcp: rule.mcp ?? '', before: rule.before ?? '', live: rule.live ?? '', ended: rule.ended ?? '', expired: rule.expired ?? '', always: rule.always ?? '', phone: rule.phone ?? '' };
  if (!call) return row;
  const named = () => Object.values(row).join(' ');
  if (!row.ended && call.errors.some(e => STATE_ERRORS.ended.includes(e)))
    row.ended = s('SessionEnded') + (call.errors.includes('PhoneSessionEnded') ? '; after an agent end it may carry the agent\'s last acknowledgement (C7)' : '');
  if (!row.expired && call.errors.includes('SessionExpired')) row.expired = s('SessionExpired');
  const rest = call.errors.filter(e => !STATE_ERRORS.ended.includes(e) && !STATE_ERRORS.expired.includes(e) && !named().includes(e));
  row.always = [row.always, ...rest.map(s)].filter(Boolean).join(' · ');
  for (const e of call.errors) if (!named().includes(e === 'PhoneSessionEnded' ? 'SessionEnded' : e)) problems.push(`${key} can return ${e}, which its row never names`);
  // An inline object type reads as its field names: { readonly endedAt: string } → { endedAt }.
  row.returns = call.success.map(t => t.startsWith('{') ? `{ ${[...t.matchAll(/(\w+)\s*:/g)].map(m => m[1]).join(', ')} }` : t).join(' or ');
  return row;
});
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const [generator, out] = process.argv.slice(2);
if (generator && out) {
  writeFileSync(out, `const TABLE = ${JSON.stringify(rows)};\n` + readFileSync(generator, 'utf8'));
  console.log(`${rows.length} rows → ${out}`);
} else console.log(`${rows.length} rows; every route, MCP tool and error is covered`);
if (process.argv[1] === fileURLToPath(import.meta.url) && !generator) process.exit(0);
