import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { Acknowledgement, AgentStatus, AnswerStatus, Asked, Connected, Finished, decisionIdOf } from '../../contract/exchange.ts';
import { call, type Failure } from './client.ts';
import { compile, type Source } from './card.ts';
import { HARNESS_APP, detectApp, detectMachine, detectProject, harness, self, type Harness } from './detect.ts';
import { REVIEW, SHORT, EXAMPLE, rulesText } from './rules.ts';
import { UnreadableAgent, agentIds, appendHistory, home, loadAgent, pagerOf, readHistory, saveAgent, server, shortId, updateAgent, writable, type AgentFile } from './store.ts';

// The operations, shared by the CLI and the MCP server, with their replies word for word
// (B25, B32 and B33, blueprint/areas/2-agents.md), so a model reads the same words whichever way it arrived.
// Exit codes: 0 done, 2 refused, 4 pager off, 5 no usable reply from the server (unreachable, no reply, or a reply not understood), 6 unknown agent id.
export type Result = { code: 0 | 2 | 4 | 5 | 6; text: string; json?: unknown };
const done = (text: string, json?: unknown): Result => ({ code: 0, text, json });
const refused = (text: string): Result => ({ code: 2, text });

// The contract is reprinted inside an `ask` reply on the binary's own clock, not the model's memory.
export const REMINDER_MS = 2 * 3_600_000, REMINDER_CARDS = 5;
const WAIT_SECONDS = 50;
// A Claude Desktop chat stops waiting this long after asking; an answer after that gets the phone's warning instead.
export const DESKTOP_WAIT_MS = 2 * 3_600_000;
// How long `wait --forever` pauses before trying an unreachable server again.
const RETRY_MS = 10_000;
// How long an ask whose reply was lost pauses before it is sent once more, and how long a run holds its card while
// it sends: longer than its two tries can take, so a run that died lets the card go.
const ASK_AGAIN_MS = 1_000, SENDING_MS = 2 * 60_000;

const unknownAgent = (id: string): Result => ({ code: 6, text: `No agent ${id} on this machine. Run \`agentpager agents\` to list them, or connect again.` });
// The agent's file, or the reply when there is none or it can't be read.
function agentOf(id: string): AgentFile | Result {
  try { return loadAgent(id) ?? unknownAgent(id); }
  catch (e) { if (e instanceof UnreadableAgent) return refused(e.message); throw e; }
}
const host = (base: string) => { try { return new URL(base).host || base; } catch { return base; } };
const unreachable = (base: string, why: string): Result => ({ code: 5, text: `Can't reach ${base} (${why}). Nothing was sent.\nIf this machine blocks outbound requests, add ${host(base)} to its allow list and try again.` });
// The request may have gone out: never "Nothing was sent", and look before trying again.
const uncertain = (r: Failure, a: { server: string; id?: string }, ...more: string[]): Result => ({ code: 5, text: [
  r.error === 'NoReply' ? `No reply from ${a.server} (${r.message}).` : `The reply from ${a.server} wasn't understood (${r.message}). A proxy or Wi-Fi sign-in page may have answered for it.`,
  `This may or may not have reached your owner. ${a.id ? `Check with \`agentpager status --agent ${a.id}\` before trying again.` : 'Connect again; their phone may show an extra agent from this try.'}`,
  ...more,
].join('\n') });
// An ask goes under the id kept for its card, so asking it again can't reach the owner twice.
const askAgain = 'Asking again with the same card is safe: your owner gets it once.';
const unwritable = (why: string): Result => refused(`Can't write ${home()} (${why}). Nothing was sent. Set AGENTPAGER_HOME to a folder this agent can write, and try again.`);
const offNotSent = 'Not sent. This pager is turned off and your message was not delivered. Nothing is queued:\nask again once your owner turns it on, or ask them for another pager number.';
// A refusal from the server, in the words of the command that met it.
function refusal(r: Failure, a: { server: string; id?: string }, off = offNotSent): Result {
  if (r.error === 'NoReply' || r.error === 'NotUnderstood') return uncertain(r, a);
  if (r.status === 0) return unreachable(a.server, r.message);
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
// How to wait, in the words of the harness that is waiting (B33; docs/research/2026-10-30-agent-wake-lab.md). Claude Code wakes when
// a background command ends. A Claude Desktop chat is reached only while its turn lasts, through a link to this
// computer that drops and comes back by itself. Every other agent gets the words in 'Keep waiting'.
const background = (id: string, short: string) => `run \`${self()} wait --agent ${id} ${short} --forever\` as a background command, then carry on or end your turn. It ends when your owner answers, and you get the answer then.`;
const relink = 'If a wait call fails or the wait tool disappears, the link to this computer dropped; it comes back by itself within seconds: run sleep 10 in your shell, then call wait again, up to 10 times.';
const waitHow = (h: Harness, id: string, short: string) => h === 'claude-code' ? `Wait for the answer in the background: ${background(id, short)}` : [
  'Don\'t end your turn until it\'s answered: the answer reaches you only while you\'re working.',
  `Other work that doesn't need it? Do it, and call the agentpager wait tool (agent ${id}, decision ${short}) with seconds 1 between steps.`,
  'Nothing else to do? Call wait without seconds (it holds 50 s), again and again, until it returns the answer.',
  relink,
].join('\n');

// A decision by its short id (d_2x8w) or the server's, even one this machine failed to record.
function decisionOf(a: AgentFile, ref: string) {
  const short = a.decisions[ref] ? ref : Object.keys(a.decisions).find(k => a.decisions[k].id === ref);
  if (short) return { short, ...a.decisions[short] };
  return /^[A-Za-z0-9_-]{32}$/.test(ref) ? { short: ref, id: ref, title: 'this decision', options: [] } : null;
}

// --server names a server other than agentpager.me; the agent file keeps it for every later call, CLI or MCP.
export async function connect(input: { number?: string; app?: string; project?: string; server?: string; mcpClient?: string }): Promise<Result> {
  const number = input.number || process.env.AGENTPAGER_PAGER;
  if (!number) return refused('No pager number. Pass the one your owner gave you, or set AGENTPAGER_PAGER.');
  if (input.server !== undefined && !/^https?:\/\/[^\s/]+/.test(input.server)) return refused('--server takes the server\'s address, such as https://agentpager.me.');
  const pager = pagerOf(number), base = input.server ? input.server.replace(/\/+$/, '') : server();
  // A harness the binary identifies names itself: a Claude Desktop chat passes app "Claude" (lab, 30 Oct 2026), and the
  // phone has to say where the agent is.
  const known = harness(input.mcpClient);
  const app = known ? HARNESS_APP[known] : input.app || detectApp(input.mcpClient), project = input.project || detectProject();
  if (!pager) return refused('Not connected. This pager number is not in use. Ask your owner for their current one.');
  const cannot = writable();
  if (cannot) return unwritable(cannot);
  const machine = detectMachine();
  const r = await call(Connected, base, 'POST', '/api/agents', { data: { number, app, project, ...(machine ? { machine } : {}) } });
  if (!r.ok) {
    if (r.error === 'NumberInvalid') return refused('Not connected. This pager number is not in use. Ask your owner for their current one.');
    return refusal(r, { server: base }, 'Not connected. This pager is turned off and your message was not delivered.\nAsk your owner to turn it on, or for another pager number.');
  }
  const agentId = r.value.agent.agentId, agentKey = r.value.agentKey;
  const id = shortId('ap-', taken => agentIds().includes(taken));
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
  const a = agent ? agentOf(agent) : null;
  if (a && 'code' in a) return a;
  // Reading the contract needs no write: the reminder clock is reset when it can be.
  if (a) try { updateAgent(a.id, x => { x.rulesShownAt = new Date().toISOString(); x.cardsSinceRules = 0; }); } catch { /* clock not reset */ }
  return done(rulesText());
}

export const example = (): Result => done(EXAMPLE);

// The card with what good looks like, for a subagent to grade. The binary judges nothing.
export function review(card: Source): Result {
  let text: string;
  if ('file' in card) { try { text = readFileSync(card.file, 'utf8'); } catch { return refused(`There is no card at ${card.file}.`); } }
  // An MCP card's attachments are named, never printed, as card.yaml names its files: the reviewer grades the card.
  else if ('object' in card && card.object === undefined) return refused('Give the card to review.');
  else text = 'yaml' in card ? card.yaml : JSON.stringify(card.object, (key, value) => key === 'attachments' && Array.isArray(value)
    ? value.map(a => typeof a === 'object' && a !== null ? { name: 'name' in a ? a.name : '(unnamed)', ...('type' in a ? { type: a.type } : {}) } : '(an attachment that is not an object)') : value, 2);
  return done(`${REVIEW}\n\n--- card.yaml ---\n${text.trimEnd()}\n`);
}

export async function ask(agent: string, card: Source, client?: string): Promise<Result> {
  const a = agentOf(agent);
  if ('code' in a) return a;
  const compiled = compile(card);
  if (!compiled.ok) return refused(compiled.problems.join('\n'));
  const brief = compiled.brief;
  const cannot = writable();
  if (cannot) return unwritable(cannot);
  // The ask's request id is chosen here and kept in the agent's file, under the card's content, until a reply settles
  // it: the same card asked again after a lost reply, in this run or a later one, names the same decision. One run
  // at a time sends a card, so a run that settles it can't drop the id another run has just been unsure of.
  const cardKey = createHash('sha256').update(JSON.stringify(brief)).digest('base64url');
  let requestId = '', busy = false;
  try {
    const now = Date.now();
    if (!updateAgent(a.id, x => {
      x.asking ??= {};
      const kept = x.asking[cardKey];
      if (kept?.sendingUntil && Date.parse(kept.sendingUntil) > now) { busy = true; return; }
      requestId = kept?.requestId ?? randomBytes(24).toString('base64url');
      x.asking[cardKey] = { requestId, sendingUntil: new Date(now + SENDING_MS).toISOString() };
    })) return unknownAgent(a.id);
  } catch (e) {
    const code = e instanceof Error && 'code' in e ? String(e.code) : 'write failed';
    return code === 'EBUSY' ? refused(`Agent ${a.id} is busy with another call on this machine. Nothing was sent; try again.`) : unwritable(code);
  }
  if (busy) return refused('Another run is sending this same card now. Nothing was sent: wait for its reply, then ask again only if it says to.');
  // How this run leaves the card's id: gone once settled, otherwise kept for the next run, without this run's hold.
  const leave = (settled: boolean) => {
    let kept = false;
    try {
      updateAgent(a.id, x => {
        x.asking ??= {};
        const now = x.asking[cardKey];
        if (now && now.requestId !== requestId) return;
        if (settled) delete x.asking[cardKey]; else { x.asking[cardKey] = { requestId }; kept = true; }
      });
    } catch { /* left as it was: its hold runs out */ }
    return kept;
  };
  const send = () => call(Asked, a.server, 'POST', `/api/agents/${a.agentId}/cards`, { key: a.agentKey, data: { requestId, ...brief } });
  // It may have reached the owner (B32.10): the id is kept, and the agent is told asking again is safe when it is.
  const unsure = (f: Failure) => leave(false) ? uncertain(f, a, askAgain) : uncertain(f, a);
  let r = await send();
  // A lost reply is sent once more: with the same request id the owner gets one decision either way.
  if (!r.ok && r.error === 'NoReply') {
    const lost = r;
    await new Promise(res => setTimeout(res, ASK_AGAIN_MS));
    r = await send();
    if (!r.ok) return unsure(lost);
  }
  if (!r.ok) {
    if (r.error === 'NoReply' || r.error === 'NotUnderstood') return unsure(r);
    // Another card already has this request id on the server: the next try takes a new one.
    if (r.error === 'RequestIdTaken') {
      leave(true);
      return refused('Not sent: the request id kept for this card is already taken on the server. Ask again to send it under a new one.');
    }
    leave(false);
    return refusal(r, a);
  }
  // The service names the decision by this agent and the request id; any other name isn't its reply.
  if (r.value.decisionId !== await decisionIdOf(a.agentId, requestId)) return unsure({ ok: false, status: 200, error: 'NotUnderstood', message: 'it named another decision' });
  leave(true);
  const id = r.value.decisionId;
  const now = new Date();
  // The short id is given out only once it is recorded; otherwise the reply names the server's id.
  let short = id, reminder: string | null = null;
  try {
    let chosen = '';
    updateAgent(a.id, x => {
      chosen = shortId('d_', taken => taken in x.decisions);
      x.decisions[chosen] = { id, title: brief.title, options: brief.card.options.map(o => o.label), askedAt: now.toISOString() };
      const cards = x.cardsSinceRules + 1, since = x.rulesShownAt ? now.getTime() - Date.parse(x.rulesShownAt) : Infinity;
      if (since > REMINDER_MS || cards >= REMINDER_CARDS) {
        reminder = since > REMINDER_MS ? `It's been ${Number.isFinite(since) ? Math.floor(since / 3_600_000) + ' hours' : 'a while'} since you last read the card contract.` : `That's ${cards} cards since you last read the card contract.`;
        x.rulesShownAt = now.toISOString(); x.cardsSinceRules = 0;
      } else x.cardsSinceRules = cards;
    });
    if (chosen) short = chosen;
    appendHistory(a.pager, { at: now.toISOString(), event: 'asked', agent: a.id, app: a.app, project: a.project, decision: short, title: brief.title, detail: brief.detail, options: brief.card.options.map(o => o.label), recommended: brief.card.recommended });
  } catch { /* Sent, but not recorded here: the reply gives the server's id, which wait and ack also take. */ }
  const h = harness(client);
  const lines = ['Sent. Your owner sees it as:', `  ${brief.title}`, `  ${brief.detail}`, h ? `Decision ${short}. ${waitHow(h, a.id, short)}` : `Decision ${short}. Wait for the answer with: agentpager wait --agent ${a.id} ${short}`];
  if (reminder) lines.push('', `${reminder} The short version:`, `  ${SHORT}`);
  return done(lines.join('\n'), { decision: short });
}

export async function wait(agent: string, ref: string, opts: { seconds?: number; forever?: boolean; client?: string } = {}): Promise<Result> {
  const a = agentOf(agent);
  if ('code' in a) return a;
  const d = decisionOf(a, ref);
  if (!d) return refused(`Agent ${a.id} has no decision ${ref}. Its decisions: ${Object.keys(a.decisions).join(', ') || 'none yet'}.`);
  if (opts.seconds !== undefined && !(Number.isFinite(opts.seconds) && opts.seconds >= 1)) return refused('--seconds takes a number from 1 to 50.');
  const seconds = Math.min(Math.floor(opts.seconds ?? WAIT_SECONDS), WAIT_SECONDS);
  for (;;) {
    const r = await call(AnswerStatus, a.server, 'GET', `/api/agents/${a.agentId}/cards/${d.id}/answer?wait=${seconds}`, { key: a.agentKey, timeoutMs: (seconds + 20) * 1000 });
    // Waiting forever outlasts a dropped network or a server restart; a refusal, or a reply that isn't AgentPager's,
    // still ends it.
    if (!r.ok && opts.forever && (r.status === 0 || r.status >= 500)) { await new Promise(res => setTimeout(res, RETRY_MS)); continue; }
    if (!r.ok) return refusal(r, a);
    if (r.value.status !== 'answered') {
      if (opts.forever) continue;
      return pending(a, d, opts.seconds !== undefined && seconds < WAIT_SECONDS, harness(opts.client));
    }
    const { choice, sentAt } = r.value.answer;
    if (!d.answered) {
      try {
        updateAgent(a.id, x => { if (x.decisions[d.short]) x.decisions[d.short].answered = true; });
        appendHistory(a.pager, { at: sentAt, event: 'answered', agent: a.id, decision: d.short, ...(choice.kind === 'option' ? { choice: choice.number } : { note: choice.text }) });
      } catch { /* not recorded here; the answer is still the server's */ }
    }
    if (choice.kind === 'option') {
      const n = choice.number, letter = String.fromCharCode(64 + n);
      return done(`Answered at ${clock(sentAt)}: option ${letter} "${d.options[n - 1] ?? letter}".\nDo it, then confirm: agentpager ack --agent ${a.id} ${d.short} "<what happens next>"`, { status: 'answered', option: letter });
    }
    const note = choice.text;
    return done([
      `Your owner wrote instead of choosing, at ${clock(sentAt)}:`,
      ...note.split('\n').map((line, i, all) => `  ${i === 0 ? '"' : ' '}${line}${i === all.length - 1 ? '"' : ''}`),
      'Follow the note. If you still need a decision, ask a new card. Acknowledge this one with',
      `what you'll do: agentpager ack --agent ${a.id} ${d.short} "<next steps>"`,
    ].join('\n'), { status: 'answered', note });
  }
}

export function pending(a: AgentFile, d: { short: string; title: string; askedAt?: string }, quick: boolean, h: Harness | null): Result {
  const head = `Pending. Your owner hasn't answered "${d.title}" yet.`;
  if (h === 'claude-code') return done(`${head}\nKeep waiting in the background: ${background(a.id, d.short)}`, { status: 'pending' });
  if (h !== 'claude-desktop') return done(`${head}\nKeep waiting: agentpager wait --agent ${a.id} ${d.short}`, { status: 'pending' });
  if (d.askedAt && Date.now() - Date.parse(d.askedAt) >= DESKTOP_WAIT_MS) return done([
    `Pending. Your owner hasn't answered "${d.title}" in ${DESKTOP_WAIT_MS / 3_600_000} hours.`,
    'Stop waiting: end your turn and tell your owner you stopped waiting for this decision. Their answer stays on the',
    `server; call wait (agent ${a.id}, decision ${d.short}) for it when you're next working.`,
  ].join('\n'), { status: 'pending', stop: true });
  return done([
    head,
    quick ? 'Carry on with your other work and check again after your next step. When you run out of work, call wait without seconds and keep calling it. Don\'t end your turn.'
      : 'Call wait again now, and keep calling it until it returns the answer. Don\'t end your turn.',
    relink,
  ].join('\n'), { status: 'pending' });
}

export async function ack(agent: string, ref: string, nextSteps: string): Promise<Result> {
  const a = agentOf(agent);
  if ('code' in a) return a;
  const d = decisionOf(a, ref);
  if (!d) return refused(`Agent ${a.id} has no decision ${ref}. Its decisions: ${Object.keys(a.decisions).join(', ') || 'none yet'}.`);
  if (!nextSteps.trim()) return refused('Say what happens next: agentpager ack --agent <id> <decision> "<next steps>"');
  const read = await call(AnswerStatus, a.server, 'GET', `/api/agents/${a.agentId}/cards/${d.id}/answer`, { key: a.agentKey });
  if (!read.ok) return refusal(read, a);
  if (read.value.status !== 'answered') return refused(`Your owner hasn't answered "${d.title}" yet. Wait first: agentpager wait --agent ${a.id} ${d.short}`);
  const r = await call(Acknowledgement, a.server, 'POST', `/api/agents/${a.agentId}/cards/${d.id}/acknowledge`, { key: a.agentKey, data: { answerId: read.value.answer.answerId, nextSteps } });
  if (!r.ok) return refusal(r, a);
  try {
    updateAgent(a.id, x => { if (x.decisions[d.short]) Object.assign(x.decisions[d.short], { answered: true, acknowledged: true }); });
    appendHistory(a.pager, { at: r.value.acknowledgedAt, event: 'acknowledged', agent: a.id, decision: d.short, nextSteps });
  } catch { /* not recorded here; the acknowledgement is still the server's */ }
  return done(`Acknowledged. Your owner sees "${quote(nextSteps)}" with a green tick on that decision.`);
}

export async function status(agent: string): Promise<Result> {
  const a = agentOf(agent);
  if ('code' in a) return a;
  const r = await call(AgentStatus, a.server, 'GET', `/api/agents/${a.agentId}`, { key: a.agentKey });
  if (!r.ok) return refusal(r, a);
  const on = r.value.pager.on, open = r.value.agent.openCount;
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
  const a = agentOf(agent);
  if ('code' in a) return a;
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
  const a = agentOf(agent);
  if ('code' in a) return a;
  const r = await call(Finished, a.server, 'POST', `/api/agents/${a.agentId}/finish`, { key: a.agentKey });
  if (!r.ok) return refusal(r, a);
  return done(`Finished. Your owner's phone shows ${a.id} as finished; it asks nothing more. Its decisions stay on the phone.`);
}

export function agents(): Result {
  const all = agentIds().map(agentOf).filter((a): a is AgentFile => !('code' in a));
  if (!all.length) return done('No agents on this machine. Connect with: agentpager connect <number>', []);
  const rows = all.map(a => `${a.id}  pager ${a.pager.slice(0, 8)}  ${a.project} · ${a.app}  ${a.createdAt.slice(0, 16).replace('T', ' ')}  ${Object.values(a.decisions).filter(d => !d.answered).length} open`);
  return done(rows.join('\n'), all.map(({ agentKey, ...rest }) => { void agentKey; return rest; }));
}

export function share(agent: string): Result {
  const a = agentOf(agent);
  if ('code' in a) return a;
  return done(`${a.id}: helpers on this machine pass --agent ${a.id}; their questions show on your owner's phone as this agent's. It's just the id: the key stays in this machine's agent file.`);
}
