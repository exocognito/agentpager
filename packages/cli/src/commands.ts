import { readFileSync } from 'node:fs';
import { call, get, type Reply } from './client.ts';
import { compile, type Source } from './card.ts';
import { detectApp, detectProject } from './detect.ts';
import { REVIEW, SHORT, EXAMPLE, rulesText } from './rules.ts';
import { agentIds, appendHistory, home, loadAgent, pagerOf, readHistory, saveAgent, server, shortId, updateAgent, writable, type AgentFile } from './store.ts';

// The operations, shared by the CLI and the MCP server, with their replies word for word
// (docs/v2/03-binary-surface.md §4), so a model reads the same words whichever way it arrived.
// Exit codes: 0 done, 2 refused, 4 pager off, 5 can't reach the server, 6 unknown agent id.
export type Result = { code: 0 | 2 | 4 | 5 | 6; text: string; json?: unknown };
const done = (text: string, json?: unknown): Result => ({ code: 0, text, json });
const refused = (text: string): Result => ({ code: 2, text });

// The contract is reprinted inside an `ask` reply on the binary's own clock, not the model's memory.
export const REMINDER_MS = 2 * 3_600_000, REMINDER_CARDS = 5;
const WAIT_SECONDS = 50;

const unknownAgent = (id: string): Result => ({ code: 6, text: `No agent ${id} on this machine. Run \`agentpager agents\` to list them, or connect again.` });
const host = (base: string) => { try { return new URL(base).host || base; } catch { return base; } };
const unreachable = (base: string, why: string): Result => ({ code: 5, text: `Can't reach ${base} (${why}). Nothing was sent.\nIf this machine blocks outbound requests, add ${host(base)} to its allow list and try again.` });
const unwritable = (why: string): Result => refused(`Can't write ${home()} (${why}). Nothing was sent. Set AGENTPAGER_HOME to a folder this agent can write, and try again.`);
const offNotSent = 'Not sent. This pager is turned off and your message was not delivered. Nothing is queued:\nask again once your owner turns it on, or ask them for another pager number.';
// A refusal from the server, in the words of the command that met it.
function refusal(r: Exclude<Reply, { ok: true }>, base: string, off = offNotSent): Result {
  if (r.status === 0) return unreachable(base, r.message);
  if (r.error === 'PagerOff') return { code: 4, text: off };
  if (r.error === 'TooManyOpenDecisions') return refused('Your owner already has 10 unanswered decisions from you. Wait for answers before asking more.');
  if (r.error === 'InvalidInput') return refused(`Refused: ${r.reason ?? r.message}`);
  return refused(r.message);
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
// Shortened at a word, for a reply that quotes the agent's own words back.
const quote = (s: string, max = 60) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1), space = cut.lastIndexOf(' ');
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '') + '…';
};
// A decision by its short id (d_2x8w) or the server's, even one this machine failed to record.
function decisionOf(a: AgentFile, ref: string) {
  const short = a.decisions[ref] ? ref : Object.keys(a.decisions).find(k => a.decisions[k].id === ref);
  if (short) return { short, ...a.decisions[short] };
  return /^[A-Za-z0-9_-]{32}$/.test(ref) ? { short: ref, id: ref, title: 'this decision', options: [] } : null;
}

export async function connect(input: { number?: string; app?: string; project?: string; mcpClient?: string }): Promise<Result> {
  const number = input.number || process.env.AGENTPAGER_PAGER;
  if (!number) return refused('No pager number. Pass the one your owner gave you, or set AGENTPAGER_PAGER.');
  const pager = pagerOf(number), base = server();
  const app = input.app || detectApp(input.mcpClient), project = input.project || detectProject();
  if (!pager) return refused('Not connected. This pager number is not in use. Ask your owner for their current one.');
  const cannot = writable();
  if (cannot) return unwritable(cannot);
  const r = await call(base, 'POST', '/api/agents', { data: { number, app, project } });
  if (!r.ok) {
    if (r.error === 'NumberInvalid') return refused('Not connected. This pager number is not in use. Ask your owner for their current one.');
    return refusal(r, base, 'Not connected. This pager is turned off and your message was not delivered.\nAsk your owner to turn it on, or for another pager number.');
  }
  const agentId = String(get(r.value, 'agent', 'agentId')), agentKey = String(get(r.value, 'agentKey'));
  const id = shortId('ap-', taken => loadAgent(taken) !== null);
  const now = new Date().toISOString();
  try { saveAgent({ id, server: base, pager, agentId, agentKey, app, project, createdAt: now, rulesShownAt: now, cardsSinceRules: 0, decisions: {} }); }
  catch (e) { return refused(`Connected, but this machine couldn't save the agent (${e instanceof Error && 'code' in e ? String(e.code) : 'write failed'}). Your owner's phone shows an agent you can't use; set AGENTPAGER_HOME to a folder you can write, and connect again.`); }
  return done([
    `Connected as agent ${id} on your owner's pager (project ${project}, as ${app}).`,
    `Your owner's phone shows you as a new agent. Use --agent ${id} for every question in`,
    'this piece of work; running connect again adds another agent.',
    'Before your first card: agentpager rules',
  ].join('\n'), { agent: id, app, project });
}

export function rules(agent?: string): Result {
  const a = agent ? loadAgent(agent) : null;
  if (agent && !a) return unknownAgent(agent);
  // Reading the contract needs no write: the reminder clock is reset when it can be.
  if (a) try { updateAgent(a.id, x => { x.rulesShownAt = new Date().toISOString(); x.cardsSinceRules = 0; }); } catch { /* clock not reset */ }
  return done(rulesText());
}

export const example = (): Result => done(EXAMPLE);

// The card with what good looks like, for a subagent to grade. The binary judges nothing.
export function review(card: Source): Result {
  let text: string;
  if ('file' in card) { try { text = readFileSync(card.file, 'utf8'); } catch { return refused(`There is no card at ${card.file}.`); } }
  // An MCP card's attachment bytes are named, not printed: the reviewer grades the card, and the bytes would fill
  // its context.
  else text = 'yaml' in card ? card.yaml : JSON.stringify(card.object, (key, value) => (key === 'base64' || key === 'text') && typeof value === 'string' && value.length > 200 ? `(${value.length.toLocaleString('en-US')} characters, not shown)` : value, 2);
  return done(`${REVIEW}\n\n--- card.yaml ---\n${text.trimEnd()}\n`);
}

export async function ask(agent: string, card: Source): Promise<Result> {
  const a = loadAgent(agent);
  if (!a) return unknownAgent(agent);
  const compiled = compile(card);
  if (!compiled.ok) return refused(compiled.problems.join('\n'));
  const brief = compiled.brief;
  const cannot = writable();
  if (cannot) return unwritable(cannot);
  const r = await call(a.server, 'POST', `/api/agents/${a.agentId}/cards`, { key: a.agentKey, data: brief });
  if (!r.ok) return refusal(r, a.server);
  const id = String(get(r.value, 'decisionId'));
  const now = new Date();
  let short = id, reminder: string | null = null;
  try {
    updateAgent(a.id, x => {
      short = shortId('d_', taken => taken in x.decisions);
      x.decisions[short] = { id, title: brief.title, options: brief.card.options.map(o => o.label) };
      const cards = x.cardsSinceRules + 1, since = x.rulesShownAt ? now.getTime() - Date.parse(x.rulesShownAt) : Infinity;
      if (since > REMINDER_MS || cards >= REMINDER_CARDS) {
        reminder = since > REMINDER_MS ? `It's been ${Number.isFinite(since) ? Math.floor(since / 3_600_000) + ' hours' : 'a while'} since you last read the card contract.` : `That's ${cards} cards since you last read the card contract.`;
        x.rulesShownAt = now.toISOString(); x.cardsSinceRules = 0;
      } else x.cardsSinceRules = cards;
    });
    appendHistory(a.pager, { at: now.toISOString(), event: 'asked', agent: a.id, app: a.app, project: a.project, decision: short, title: brief.title, detail: brief.detail, options: brief.card.options.map(o => o.label), recommended: brief.card.recommended });
  } catch { /* Sent, but not recorded here: the reply gives the server's id, which wait and ack also take. */ }
  const lines = ['Sent. Your owner sees it as:', `  ${brief.title}`, `  ${brief.detail}`, `Decision ${short}. Wait for the answer with: agentpager wait --agent ${a.id} ${short}`];
  if (reminder) lines.push('', `${reminder} The short version:`, `  ${SHORT}`);
  return done(lines.join('\n'), { decision: short });
}

export async function wait(agent: string, ref: string, opts: { seconds?: number; forever?: boolean } = {}): Promise<Result> {
  const a = loadAgent(agent);
  if (!a) return unknownAgent(agent);
  const d = decisionOf(a, ref);
  if (!d) return refused(`Agent ${a.id} has no decision ${ref}. Its decisions: ${Object.keys(a.decisions).join(', ') || 'none yet'}.`);
  if (opts.seconds !== undefined && !(Number.isFinite(opts.seconds) && opts.seconds >= 1)) return refused('--seconds takes a number from 1 to 50.');
  const seconds = Math.min(Math.floor(opts.seconds ?? WAIT_SECONDS), WAIT_SECONDS);
  for (;;) {
    const r = await call(a.server, 'GET', `/api/agents/${a.agentId}/cards/${d.id}/answer?wait=${seconds}`, { key: a.agentKey, timeoutMs: (seconds + 20) * 1000 });
    if (!r.ok) return refusal(r, a.server);
    if (get(r.value, 'status') !== 'answered') {
      if (opts.forever) continue;
      return done(`Pending. Your owner hasn't answered "${d.title}" yet.\nKeep waiting: agentpager wait --agent ${a.id} ${d.short}`, { status: 'pending' });
    }
    const choice = get(r.value, 'answer', 'choice'), sentAt = String(get(r.value, 'answer', 'sentAt'));
    if (!d.answered) {
      try {
        updateAgent(a.id, x => { if (x.decisions[d.short]) x.decisions[d.short].answered = true; });
        appendHistory(a.pager, { at: sentAt, event: 'answered', agent: a.id, decision: d.short, ...(get(choice, 'kind') === 'option' ? { choice: get(choice, 'number') } : { note: get(choice, 'text') }) });
      } catch { /* not recorded here; the answer is still the server's */ }
    }
    if (get(choice, 'kind') === 'option') {
      const n = Number(get(choice, 'number')), letter = String.fromCharCode(64 + n);
      return done(`Answered at ${clock(sentAt)}: option ${letter} "${d.options[n - 1] ?? letter}".\nDo it, then confirm: agentpager ack --agent ${a.id} ${d.short} "<what happens next>"`, { status: 'answered', option: letter });
    }
    const note = String(get(choice, 'text'));
    return done([
      `Your owner wrote instead of choosing, at ${clock(sentAt)}:`,
      ...note.split('\n').map((line, i, all) => `  ${i === 0 ? '"' : ' '}${line}${i === all.length - 1 ? '"' : ''}`),
      'Follow the note. If you still need a decision, ask a new card. Acknowledge this one with',
      `what you'll do: agentpager ack --agent ${a.id} ${d.short} "<next steps>"`,
    ].join('\n'), { status: 'answered', note });
  }
}

export async function ack(agent: string, ref: string, nextSteps: string): Promise<Result> {
  const a = loadAgent(agent);
  if (!a) return unknownAgent(agent);
  const d = decisionOf(a, ref);
  if (!d) return refused(`Agent ${a.id} has no decision ${ref}. Its decisions: ${Object.keys(a.decisions).join(', ') || 'none yet'}.`);
  if (!nextSteps.trim()) return refused('Say what happens next: agentpager ack --agent <id> <decision> "<next steps>"');
  const read = await call(a.server, 'GET', `/api/agents/${a.agentId}/cards/${d.id}/answer`, { key: a.agentKey });
  if (!read.ok) return refusal(read, a.server);
  if (get(read.value, 'status') !== 'answered') return refused(`Your owner hasn't answered "${d.title}" yet. Wait first: agentpager wait --agent ${a.id} ${d.short}`);
  const r = await call(a.server, 'POST', `/api/agents/${a.agentId}/cards/${d.id}/acknowledge`, { key: a.agentKey, data: { answerId: get(read.value, 'answer', 'answerId'), nextSteps } });
  if (!r.ok) return refusal(r, a.server);
  try {
    updateAgent(a.id, x => { if (x.decisions[d.short]) Object.assign(x.decisions[d.short], { answered: true, acknowledged: true }); });
    appendHistory(a.pager, { at: String(get(r.value, 'acknowledgedAt')), event: 'acknowledged', agent: a.id, decision: d.short, nextSteps });
  } catch { /* not recorded here; the acknowledgement is still the server's */ }
  return done(`Acknowledged. Your owner sees "${quote(nextSteps)}" with a green tick on that decision.`);
}

export async function status(agent: string): Promise<Result> {
  const a = loadAgent(agent);
  if (!a) return unknownAgent(agent);
  const r = await call(a.server, 'GET', `/api/agents/${a.agentId}`, { key: a.agentKey });
  if (!r.ok) return refusal(r, a.server);
  const on = get(r.value, 'pager', 'on') === true, open = Number(get(r.value, 'agent', 'openCount'));
  const unacked = Object.entries(a.decisions).filter(([, d]) => d.answered && !d.acknowledged).map(([k]) => k);
  const waiting = Object.entries(a.decisions).filter(([, d]) => !d.answered).map(([k]) => k);
  return done([
    `Agent ${a.id} · ${a.app} · ${a.project}`,
    `Pager: ${on ? 'on' : 'off: nothing you send is delivered'}`,
    `Open decisions: ${open}${waiting.length ? ` (${waiting.join(', ')})` : ''}`,
    `Answered, not yet acknowledged: ${unacked.length ? unacked.join(', ') : 'none'}`,
  ].join('\n'), { agent: a.id, pagerOn: on, open, waiting, unacknowledged: unacked });
}

// This machine's decisions on the agent's pager, newest first. Never printed unasked.
export function history(agent: string, limit?: number): Result {
  const a = loadAgent(agent);
  if (!a) return unknownAgent(agent);
  const events = readHistory(a.pager), n = limit !== undefined && Number.isFinite(limit) && limit >= 1 ? Math.min(Math.floor(limit), 1000) : 20;
  const asked = events.filter(e => e.event === 'asked').reverse().slice(0, n);
  const byDecision = (event: string, d: string) => events.find(e => e.event === event && e.decision === d && e.agent === events.find(x => x.event === 'asked' && x.decision === d)?.agent);
  const lines = asked.map(e => {
    const answer = byDecision('answered', e.decision), ackd = byDecision('acknowledged', e.decision);
    const options = Array.isArray(e.options) ? e.options.map(String) : [];
    const chose = answer ? ('choice' in answer ? `option ${String.fromCharCode(64 + Number(answer.choice))} "${options[Number(answer.choice) - 1] ?? ''}"` : `note "${quote(String(answer.note))}"`) : 'not answered';
    return `${new Date(e.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${e.app} · ${e.project} · ${e.decision} (${e.agent})\n  ${e.title}\n  Options: ${options.join(' / ')} → ${chose}${ackd ? `\n  Next: ${quote(String(ackd.nextSteps), 120)}` : ''}`;
  });
  return done(lines.length ? lines.join('\n') : 'No decisions on this pager from this machine yet.', events);
}

export async function finish(agent: string): Promise<Result> {
  const a = loadAgent(agent);
  if (!a) return unknownAgent(agent);
  const r = await call(a.server, 'POST', `/api/agents/${a.agentId}/finish`, { key: a.agentKey });
  if (!r.ok) return refusal(r, a.server);
  return done(`Finished. Your owner's phone shows ${a.id} as finished; it asks nothing more. Its decisions stay on the phone.`);
}

export function agents(): Result {
  const all = agentIds().map(loadAgent).filter((a): a is AgentFile => !!a);
  if (!all.length) return done('No agents on this machine. Connect with: agentpager connect <number>', []);
  const rows = all.map(a => `${a.id}  pager ${a.pager.slice(0, 8)}  ${a.project} · ${a.app}  ${a.createdAt.slice(0, 16).replace('T', ' ')}  ${Object.values(a.decisions).filter(d => !d.answered).length} open`);
  return done(rows.join('\n'), all.map(({ agentKey, ...rest }) => { void agentKey; return rest; }));
}

export function share(agent: string): Result {
  const a = loadAgent(agent);
  if (!a) return unknownAgent(agent);
  return done(`${a.id}: helpers on this machine pass --agent ${a.id}; their questions show on your owner's phone as this agent's. It's just the id: the key stays in this machine's agent file.`);
}
