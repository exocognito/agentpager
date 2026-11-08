import { readFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Option, Schema } from 'effect';
import { Acknowledgement, AgentStatus, AnswerStatus, Asked, CLOSED_AGENT_FINISHED, Connected, DecisionClosedRefusal, Finished, PagerKey, Received, acceptsChoice, decisionIdOf, type Closed, type ClosedDecision } from '../../contract/exchange.ts';
import { call, type Failure } from './client.ts';
import { compile, type Source } from './card.ts';
import { HARNESS_APP, detectApp, detectMachine, detectProject, identify, self, type Caller } from './detect.ts';
import { QUEUE_TIMEOUT_MS, codexCli, note, ring } from './codex.ts';
import { REVIEW, SHORT, EXAMPLE, rulesText } from './rules.ts';
import { UnreadableAgent, agentIds, appendHistory, fingerprintOf, home, loadAgent, pagerOf, readHistory, saveAgent, server, shortId, updateAgent, writable, type AgentFile, type DecisionWake, type HistoryEvent, type RingOutcome } from './store.ts';
import { Unsendable, askDigest, fingerprint, newKeys, openAnswer, sealAcknowledgement, sealAsk, sealIdentity } from './seal.ts';

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
// Saying an answer was received: each try's time limit, and how many tries, a moment apart. A few seconds at most, since
// the agent gets its answer only after.
const RECEIVED_TIMEOUT_MS = 3_000, RECEIVED_TRIES = 3, RECEIVED_AGAIN_MS = 500;
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
// How to wait, in the words of the app that is waiting (B33; docs/research/2026-10-30-agent-wake-lab.md and
// 2026-11-08-clients-wake-lab.md), chosen by How (howFor, below). Claude Code wakes when a background command ends. A
// Claude Desktop chat is reached only while its turn lasts, through a link to this computer that drops and comes back
// by itself. An agent whose AgentPager adapter wakes it (AGENTPAGER_WAKE) gets the answer as a new turn, and a Codex
// thread gets a note that its answer is in, so neither waits: waiting as well would wake it twice. Every other agent
// gets the words in 'Keep waiting'.
// Via: what an MCP call says of its caller, the client's name and the call's `_meta`; a command from a shell has none.
export type Via = { client?: string; meta?: unknown };
type How = 'claude-code' | 'claude-desktop' | 'adapter' | { codex: 'mcp' | 'shell' } | null;
const background = (id: string, short: string) => `run \`${self()} wait --agent ${id} ${short} --forever\` as a background command, then carry on or end your turn. It ends when your owner answers, and you get the answer then.`;
const relink = 'If a wait call fails or the wait tool disappears, the link to this computer dropped; it comes back by itself within seconds: run sleep 10 in your shell, then call wait again, up to 10 times.';
const adapter = 'Don\'t wait for it: when your owner answers, the answer comes to you as a new message. Carry on or end your turn.';
const codexRead = (via: 'mcp' | 'shell', id: string, short: string) => via === 'mcp' ? `call the agentpager wait tool (agent ${id}, decision ${short})` : `run agentpager wait --agent ${id} ${short}`;
const codexWords = (via: 'mcp' | 'shell', id: string, short: string) => `Don't wait for it: when your owner answers, a note that the answer is in comes to this thread. Carry on or end your turn, and when the note comes, ${codexRead(via, id, short)} to read it.`;
const waitHow = (h: How, id: string, short: string) => h === null ? `Wait for the answer with: agentpager wait --agent ${id} ${short}`
  : h === 'adapter' ? adapter : typeof h === 'object' ? codexWords(h.codex, id, short)
  : h === 'claude-code' ? `Wait for the answer in the background: ${background(id, short)}` : [
    'Don\'t end your turn until it\'s answered: the answer reaches you only while you\'re working.',
    `Other work that doesn't need it? Do it, and call the agentpager wait tool (agent ${id}, decision ${short}) with seconds 1 between steps.`,
    'Nothing else to do? Call wait without seconds (it holds 50 s), again and again, until it returns the answer.',
    relink,
  ].join('\n');
// What an agent's app does with an answer when it arrives: Claude Code and a Claude Desktop chat are told how to wait
// for it, an adapter's session gets it as a new turn, and a Codex thread gets a note when a Codex CLI here can ring it.
// Any other agent may need its owner to nudge it (B33.1).
const wakes = (c: Caller | null) => c !== null && (c.app !== 'codex' || (c.thread !== null && codexCli() !== null));
export const NUDGE = 'AgentPager can\'t wake an agent in this app, so when your owner answers, they may have to nudge you to read it.';
// The words for a decision: its own wake when this call comes from it (the adapter's session, or the Codex thread whose
// watcher is running or starts now), else the caller's app's.
async function howFor(c: Caller | null, a: AgentFile, d: { short: string; wake?: DecisionWake }): Promise<How> {
  const w = d.wake;
  if (w && w.app !== 'codex' && (c?.app === 'claude-code' || c?.app === 'pi') && c.wake?.app === w.app && c.wake.session === w.session) return 'adapter';
  if (w?.app === 'codex' && c?.app === 'codex' && c.thread === w.thread && await watcherFor(a.id, d.short)) return { codex: w.via };
  return c?.app === 'claude-code' || c?.app === 'claude-desktop' ? c.app : null;
}

// A decision by its short id (d_2x8w) or the server's, even one this machine failed to record.
function decisionOf(a: AgentFile, ref: string) {
  const short = a.decisions[ref] ? ref : Object.keys(a.decisions).find(k => a.decisions[k].id === ref);
  if (short) return { short, ...a.decisions[short] };
  return /^[A-Za-z0-9_-]{32}$/.test(ref) ? { short: ref, id: ref, title: 'this decision', options: [] } : null;
}

// What this agent seals with: its pager, the pager's key pinned at connect, and its own private key.
const keysOf = (a: AgentFile) => ({ pager: a.pager, pagerKey: a.pagerKey, privateKey: a.privateKey });
const identityOf = (a: AgentFile) => ({ app: a.app, project: a.project, ...(a.machine ? { machine: a.machine } : {}) });
// A decision that closed unanswered (Closed, packages/contract/exchange.ts): the service refuses a wait for it, a read of
// it and an acknowledgement of it as DecisionClosed, with when and why. Its agent finishing is the only reason it gives
// for now; one this command doesn't know closes the decision all the same, in words that don't say why. A refusal
// whose record doesn't read is left to the service's own words, as any other refusal.
const finishedFirst = (c: Closed) => c.reason === CLOSED_AGENT_FINISHED;
function closedOf(r: Failure): Closed | null {
  if (r.error !== 'DecisionClosed') return null;
  const body = Schema.decodeUnknownOption(DecisionClosedRefusal)(r.body);
  return Option.isSome(body) ? body.value.closed : null;
}
// Marks this agent's decisions the service says closed unanswered, and records each in the history once, by the run
// that marks it. Returns each one's short id, or the server's for one this machine didn't record.
function noteClosed(a: AgentFile, closed: ReadonlyArray<ClosedDecision>): string[] {
  const shortOf = (x: AgentFile, id: string) => Object.keys(x.decisions).find(k => x.decisions[k].id === id);
  const marked: { short: string; c: ClosedDecision }[] = [];
  try {
    updateAgent(a.id, x => {
      for (const c of closed) {
        const short = shortOf(x, c.decisionId);
        if (short && !x.decisions[short].closed) { x.decisions[short].closed = true; marked.push({ short, c }); }
      }
    });
    for (const { short, c } of marked) appendHistory(a.pager, { at: c.at, event: 'closed', agent: a.id, decision: short, reason: c.reason });
  } catch { /* not recorded here; the service still holds it */ }
  return closed.map(c => shortOf(a, c.decisionId) ?? c.decisionId);
}
// What a wait or an acknowledgement meets on a decision that closed unanswered: it ends, saying so.
function closedUnanswered(a: AgentFile, d: { short: string; id: string; title: string }, closed: Closed, then: string): Result {
  noteClosed(a, [{ decisionId: d.id, ...closed }]);
  const when = finishedFirst(closed) ? ` when agent ${a.id} finished` : '';
  const anew = finishedFirst(closed) ? ' To ask about new work, connect again.' : '';
  return { code: 2, text: `Closed unanswered. "${d.title}" (${d.short}) closed${when}, before your owner answered it, so no answer will come.\n${then}${anew}`, json: { status: 'closed', reason: closed.reason, closedAt: closed.at } };
}
const unreadableAnswer = (short: string) => `An answer to ${short} arrived, but it can't be read as your owner's answer to that card, so it may not be theirs. Don't act on it: tell your owner.`;

// --server names a server other than agentpager.me; the agent file keeps it for every later call, CLI or MCP.
// Before anything of the agent's is sent, the pager's public key is read from the server and checked against the
// fingerprint in the number (I19.6, blueprint/areas/6-privacy.md); it is pinned in the agent file, and every part this
// agent sends is sealed to it. Who asked, the project and the computer travel sealed to it too.
export const keyMismatch = (base: string) => `Not connected, and nothing was sent: the key this pager number names doesn't match the key ${host(base)} gave for it. Check the number with the one your owner gave you. If it is right, stop and tell your owner.`;
export async function connect(input: { number?: string; app?: string; project?: string; server?: string; mcpClient?: string; meta?: unknown }): Promise<Result> {
  const number = input.number || process.env.AGENTPAGER_PAGER;
  if (!number) return refused('No pager number. Pass the one your owner gave you, or set AGENTPAGER_PAGER.');
  if (input.server !== undefined && !/^https?:\/\/[^\s/]+/.test(input.server)) return refused('--server takes the server\'s address, such as https://agentpager.me.');
  const pager = pagerOf(number), named = fingerprintOf(number), base = input.server ? input.server.replace(/\/+$/, '') : server();
  // A harness the binary identifies names itself: a Claude Desktop chat passes app "Claude" (lab, 30 Oct 2026), and the
  // phone has to say where the agent is.
  const caller = identify(input.mcpClient === undefined ? undefined : { client: input.mcpClient, meta: input.meta });
  const known = caller?.app === 'claude-code' || caller?.app === 'claude-desktop' ? caller.app : null;
  const app = known ? HARNESS_APP[known] : input.app || detectApp(input.mcpClient), project = input.project || detectProject();
  const notInUse = refused('Not connected. This pager number is not in use. Ask your owner for their current one.');
  if (!pager || !named) return notInUse;
  const cannot = writable();
  if (cannot) return unwritable(cannot);
  const machine = detectMachine();
  const offWords = 'Not connected. This pager is turned off and your message was not delivered.\nAsk your owner to turn it on, or for another pager number.';
  const key = await call(PagerKey, base, 'GET', `/api/pagers/${pager}/key`);
  // Only the pager's id went out, so whatever went wrong reached no one.
  if (!key.ok && (key.error === 'NoReply' || key.error === 'NotUnderstood')) return { code: 5, text: [
    key.error === 'NoReply' ? `No reply from ${base} (${key.message}).` : `The reply from ${base} wasn't understood (${key.message}). A proxy or Wi-Fi sign-in page may have answered for it.`,
    'Not connected, and nothing reached your owner: try again.',
  ].join('\n') };
  if (!key.ok) return key.error === 'NumberInvalid' ? notInUse : refusal(key, { server: base }, offWords);
  if (key.value.pagerId !== pager || fingerprint(key.value.publicKey) !== named) return refused(keyMismatch(base));
  const keys = newKeys(), sealing = { pager, pagerKey: key.value.publicKey, privateKey: keys.privateKey };
  let identity: string;
  try { identity = sealIdentity(sealing, { app, project, ...(machine ? { machine } : {}) }); }
  catch (e) { if (e instanceof Unsendable) return refused(`Refused: ${e.message}`); throw e; }
  const r = await call(Connected, base, 'POST', '/api/agents', { data: { number, identity } });
  if (!r.ok) {
    if (r.error === 'NumberInvalid') return notInUse;
    return refusal(r, { server: base }, offWords);
  }
  const agentId = r.value.agent.agentId, agentKey = r.value.agentKey;
  const id = shortId('ap-', taken => agentIds().includes(taken));
  const now = new Date().toISOString();
  try { saveAgent({ id, server: base, pager, agentId, agentKey, privateKey: keys.privateKey, pagerKey: key.value.publicKey, app, project, ...(machine ? { machine } : {}), createdAt: now, rulesShownAt: now, cardsSinceRules: 0, decisions: {} }); }
  catch (e) { return refused(`Connected, but this machine couldn't save the agent (${e instanceof Error && 'code' in e ? String(e.code) : 'write failed'}). Your owner's phone shows an agent you can't use; set AGENTPAGER_HOME to a folder you can write, and connect again.`); }
  return done([
    `Connected as agent ${id} on your owner's pager (project ${project}, as ${app}).`,
    `Your owner's phone shows you as a new agent. Use --agent ${id} for every question in`,
    'this piece of work; running connect again adds another agent.',
    ...(wakes(caller) ? [] : [NUDGE]),
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

// holdMs: how long this run holds the card while it sends (SENDING_MS); a test shortens it.
export async function ask(agent: string, card: Source, via?: Via, holdMs = SENDING_MS): Promise<Result> {
  const a = agentOf(agent);
  if ('code' in a) return a;
  const compiled = compile(card);
  if (!compiled.ok) return refused(compiled.problems.join('\n'));
  const brief = compiled.brief;
  const cannot = writable();
  if (cannot) return unwritable(cannot);
  // The ask's request id is chosen here and kept in the agent's file, under the card's content, until a reply settles
  // it: the same card asked again after a lost reply, in this run or a later one, names the same decision. One run
  // at a time sends a card, and only the run that last took it may change it, so a run that settles it can't drop
  // the id another run has since been unsure of, even one that outlived its hold.
  const cardKey = createHash('sha256').update(JSON.stringify(brief)).digest('base64url'), run = randomBytes(24).toString('base64url');
  let requestId = '', busy = false;
  try {
    const now = Date.now();
    if (!updateAgent(a.id, x => {
      x.asking ??= {};
      const kept = x.asking[cardKey];
      if (kept?.sendingUntil && Date.parse(kept.sendingUntil) > now) { busy = true; return; }
      requestId = kept?.requestId ?? randomBytes(24).toString('base64url');
      x.asking[cardKey] = { requestId, run, sendingUntil: new Date(now + holdMs).toISOString() };
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
        if (now && now.run !== run) return;
        if (settled) delete x.asking[cardKey]; else { x.asking[cardKey] = { requestId, run }; kept = true; }
      });
    } catch { /* left as it was: its hold runs out */ }
    return kept;
  };
  // Sealed once for this run, so a resend is the same request; a later run seals again, under the same request id and
  // digest, and finds the same decision.
  const decisionId = await decisionIdOf(a.agentId, requestId);
  let sealed: ReturnType<typeof sealAsk>;
  try { sealed = sealAsk(keysOf(a), identityOf(a), brief, decisionId); }
  catch (e) { leave(false); if (e instanceof Unsendable) return refused(`${e.message}.`); throw e; }
  const data = { requestId, digest: askDigest(keysOf(a), brief), ...sealed };
  const send = () => call(Asked, a.server, 'POST', `/api/agents/${a.agentId}/cards`, { key: a.agentKey, data });
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
  if (r.value.decisionId !== decisionId) return unsure({ ok: false, status: 200, error: 'NotUnderstood', message: 'it named another decision' });
  leave(true);
  const id = r.value.decisionId;
  const now = new Date();
  // Who wakes the agent for it, recorded with it (store.ts › Wake): the caller's adapter, or the Codex thread that
  // asked, when a Codex CLI here can ring it.
  const caller = identify(via);
  const wake: DecisionWake | undefined = caller?.app === 'pi' ? caller.wake : caller?.app === 'claude-code' ? caller.wake ?? undefined
    : caller?.app === 'codex' && caller.thread !== null && codexCli() !== null ? { app: 'codex', thread: caller.thread, via: caller.via } : undefined;
  // The short id is given out only once it is recorded; otherwise the reply names the server's id. A decision this
  // machine already recorded (an earlier run of the same ask got its reply first) keeps its short id and its wake, so it
  // has one watcher and is rung once, and isn't counted or added to the history again.
  let short = id, reminder: string | null = null, recorded: DecisionWake | undefined | null = null, again = false;
  try {
    let chosen = '';
    updateAgent(a.id, x => {
      const known = Object.keys(x.decisions).find(k => x.decisions[k].id === id);
      if (known) { chosen = known; recorded = x.decisions[known].wake; again = true; return; }
      chosen = shortId('d_', taken => taken in x.decisions);
      x.decisions[chosen] = { id, title: brief.title, options: brief.card.options.map(o => o.label), askedAt: now.toISOString(), ...(wake ? { wake } : {}) };
      recorded = wake;
      const cards = x.cardsSinceRules + 1, since = x.rulesShownAt ? now.getTime() - Date.parse(x.rulesShownAt) : Infinity;
      if (since > REMINDER_MS || cards >= REMINDER_CARDS) {
        reminder = since > REMINDER_MS ? `It's been ${Number.isFinite(since) ? Math.floor(since / 3_600_000) + ' hours' : 'a while'} since you last read the card contract.` : `That's ${cards} cards since you last read the card contract.`;
        x.rulesShownAt = now.toISOString(); x.cardsSinceRules = 0;
      } else x.cardsSinceRules = cards;
    });
    if (chosen) short = chosen;
    if (!again) appendHistory(a.pager, { at: now.toISOString(), event: 'asked', agent: a.id, app: a.app, project: a.project, decision: short, title: brief.title, detail: brief.detail, options: brief.card.options.map(o => o.label), recommended: brief.card.recommended });
  } catch { /* Sent, but not recorded here: the reply gives the server's id, which wait and ack also take. */ }
  const how = await howFor(caller, a, recorded ? { short, wake: recorded } : { short });
  const lines = ['Sent. Your owner sees it as:', `  ${brief.title}`, `  ${brief.detail}`, `Decision ${short}. ${waitHow(how, a.id, short)}`];
  if (reminder) lines.push('', `${reminder} The short version:`, `  ${SHORT}`);
  return done(lines.join('\n'), { decision: short });
}

export async function wait(agent: string, ref: string, opts: { seconds?: number; forever?: boolean; via?: Via } = {}): Promise<Result> {
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
    if (!r.ok) {
      const closed = closedOf(r);
      return closed ? closedUnanswered(a, d, closed, 'Don\'t wait for it again.') : refusal(r, a);
    }
    if (r.value.status !== 'answered') {
      if (opts.forever) continue;
      return pending(a, d, opts.seconds !== undefined && seconds < WAIT_SECONDS, await howFor(identify(opts.via), a, d));
    }
    const { sentAt } = r.value.answer, choice = openAnswer(keysOf(a), d.id, r.value.answer.answer);
    // Only the phone, which read the card, holds the key the answer is sealed to; an answer that doesn't open, or names
    // an option the card didn't offer, isn't the owner's answer to this card.
    if (!choice || (d.options.length > 0 && !acceptsChoice({ options: d.options.map((_, i) => ({ number: i + 1 })) }, choice))) return refused(unreadableAnswer(d.short));
    await received(a, d.id, r.value.answer.answerId);
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

// This command has the answer, opened: it tells the service so, a step of its own after the read, and only now does the
// answer count as picked up (B32.12, blueprint/areas/2-agents.md). A wait whose command went away before this never
// gets here, so the owner is still told no agent picked the answer up (B5.13). Sent before the answer is handed to the
// agent, while this run is sure to be alive. A try with no reply, or a server that failed, is tried again; a refusal
// isn't, since another try gets the same. Nothing here keeps the answer from the agent: one that never lands leaves
// the owner the warning, until the agent's acknowledgement picks the answer up instead. A service from before this
// (m6.1) refuses the route as NotFound, having picked the answer up when it was read.
async function received(a: AgentFile, decisionId: string, answerId: string) {
  for (let tries = 1; tries <= RECEIVED_TRIES; tries++) {
    const r = await call(Received, a.server, 'POST', `/api/agents/${a.agentId}/cards/${decisionId}/received`, { key: a.agentKey, data: { answerId }, timeoutMs: RECEIVED_TIMEOUT_MS });
    if (r.ok || (r.status > 0 && r.status < 500)) return;
    if (tries < RECEIVED_TRIES) await new Promise(res => setTimeout(res, RECEIVED_AGAIN_MS));
  }
}

export function pending(a: AgentFile, d: { short: string; title: string; askedAt?: string }, quick: boolean, h: How): Result {
  const head = `Pending. Your owner hasn't answered "${d.title}" yet.`;
  if (h === 'adapter') return done(`${head}\nDon't wait for it: the answer comes to you as a new message when your owner answers. Carry on or end your turn.`, { status: 'pending' });
  if (typeof h === 'object' && h !== null) return done(`${head}\nDon't wait for it: a note that the answer is in comes to this thread when your owner answers. Carry on or end your turn, and when the note comes, ${codexRead(h.codex, a.id, d.short)} to read it.`, { status: 'pending' });
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
  if (!read.ok) {
    const closed = closedOf(read);
    return closed ? closedUnanswered(a, d, closed, 'There is no answer to acknowledge.') : refusal(read, a);
  }
  if (read.value.status !== 'answered') return refused(`Your owner hasn't answered "${d.title}" yet. Wait first: agentpager wait --agent ${a.id} ${d.short}`);
  let sealed: ReturnType<typeof sealAcknowledgement>;
  try { sealed = sealAcknowledgement(keysOf(a), identityOf(a), d.id, nextSteps, d.title); }
  catch (e) { if (e instanceof Unsendable) return refused(`Refused: ${e.message}`); throw e; }
  const r = await call(Acknowledgement, a.server, 'POST', `/api/agents/${a.agentId}/cards/${d.id}/acknowledge`, { key: a.agentKey, data: { answerId: read.value.answer.answerId, ...sealed } });
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
  // What closed unanswered, from a service that lists it. Neither it nor one a wait here met counts as waiting.
  const shut = r.value.closed ?? [], closed = noteClosed(a, shut), ids = new Set(shut.map(c => c.decisionId));
  const unacked = Object.entries(a.decisions).filter(([, d]) => d.answered && !d.acknowledged).map(([k]) => k);
  const waiting = Object.entries(a.decisions).filter(([, d]) => !d.answered && !d.closed && !ids.has(d.id)).map(([k]) => k);
  return done([
    `Agent ${a.id} · ${a.app} · ${a.project}`,
    `Pager: ${on ? 'on' : 'off: nothing you send is delivered'}`,
    `Open decisions: ${open}${waiting.length ? ` (${waiting.join(', ')})` : ''}`,
    `Answered, not yet acknowledged: ${unacked.length ? unacked.join(', ') : 'none'}`,
    ...(closed.length ? [`Closed unanswered${shut.every(finishedFirst) ? ' when this agent finished' : ''}: ${closed.join(', ')}`] : []),
  ].join('\n'), { agent: a.id, pagerOn: on, open, waiting, unacknowledged: unacked, closed });
}

// This machine's decisions on the agent's pager, newest first. Never printed unasked.
export function history(agent: string, limit?: number): Result {
  const a = agentOf(agent);
  if ('code' in a) return a;
  const events = readHistory(a.pager), n = limit !== undefined && Number.isFinite(limit) && limit >= 1 ? Math.min(Math.floor(limit), 1000) : 20;
  const asked = events.filter(e => e.event === 'asked').reverse().slice(0, n);
  // A short id is unique within its agent only, so each event is the asking agent's own.
  const byDecision = (event: string, asked: HistoryEvent) => events.find(e => e.event === event && e.decision === asked.decision && e.agent === asked.agent);
  const lines = asked.map(e => {
    const answer = byDecision('answered', e), ackd = byDecision('acknowledged', e), closed = byDecision('closed', e);
    const options = Array.isArray(e.options) ? e.options.map(String) : [];
    const chose = answer ? ('choice' in answer ? `option ${String.fromCharCode(64 + Number(answer.choice))} "${options[Number(answer.choice) - 1] ?? ''}"` : `note "${quote(String(answer.note))}"`)
      : closed ? `closed unanswered${closed.reason === CLOSED_AGENT_FINISHED ? ' when its agent finished' : ''}` : 'not answered';
    return `${new Date(e.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${e.app} · ${e.project} · ${e.decision} (${e.agent})\n  ${e.title}\n  Options: ${options.join(' / ')} → ${chose}${ackd ? `\n  Next: ${quote(String(ackd.nextSteps), 120)}` : ''}`;
  });
  return done(lines.length ? lines.join('\n') : 'No decisions on this pager from this machine yet.', events);
}

export async function finish(agent: string): Promise<Result> {
  const a = agentOf(agent);
  if ('code' in a) return a;
  const r = await call(Finished, a.server, 'POST', `/api/agents/${a.agentId}/finish`, { key: a.agentKey });
  if (!r.ok) return refusal(r, a);
  const head = `Finished. Your owner's phone shows ${a.id} as finished; it asks nothing more. Its decisions stay on the phone.`;
  // What finishing closed, from a service that says.
  const shut = r.value.closed;
  if (!shut) return done(head);
  if (!shut.length) return done(`${head}\nIt had no open decisions to close.`, { closed: [] });
  const closed = noteClosed(a, shut), one = closed.length === 1;
  return done(`${head}\nFinishing closed ${one ? 'its open decision' : `its ${closed.length} open decisions`} unanswered: ${closed.join(', ')}. Your owner can't answer ${one ? 'it' : 'them'} now, and a wait for ${one ? 'it' : 'them'} ends.`, { closed });
}

// Codex's doorbell (B33.4, blueprint/areas/2-agents.md; codex.ts): the watcher that waits for one decision's answer and
// rings the Codex thread that asked it, once. It runs as a process of its own, `agentpager watch --agent <id>
// <decision>`, started detached by the call that asked, or by a later wait from that thread when none runs, so it
// outlives that call and Codex itself, which stops its MCP servers when it quits. It waits as a wait does, but never
// receives the answer: it doesn't open it, and never tells the service it has it, so an answer only it saw still
// brings the owner's warning that no agent picked it up (B32.12). The ring is recorded in the agent's file before
// `codex queue` runs, so the thread is never rung twice, whatever happens to the call or this process. It stops on the
// answer, rung or not; when this machine already has the answer; when the decision closes, the pager is turned off or
// deleted, or the agent is gone; when the server has been unreachable for a day; 30 days after it started; and at once
// when another watcher runs for the decision. It prints nothing anyone reads.
const UNREACHABLE_MS = 24 * 3_600_000, WATCH_MS = 30 * 24 * 3_600_000;
// This program, run again as the watcher: the compiled binary itself (Bun's, whose sources are under /$bunfs/), or Node
// with this source.
const program = import.meta.url.startsWith('file:///$bunfs/') ? [process.execPath] : [process.execPath, '--experimental-strip-types', fileURLToPath(new URL('./main.ts', import.meta.url))];
// Whether that process is this decision's watcher: alive, and running it, so a process id reused after a restart
// doesn't count.
function watching(pid: number, id: string, short: string): boolean {
  try { process.kill(pid, 0); } catch (e) { if (!(e instanceof Error && 'code' in e && e.code === 'EPERM')) return false; }
  try { return new RegExp(`(^|\\s)watch --agent ${id} ${short}$`).test(execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); }
  catch { return false; }
}
// Starts the watcher for a decision a Codex thread asked, when it hasn't rung, nothing here has the answer yet and no
// watcher runs. True when one runs: the one already there, or the new one once it has put itself in the agent's file,
// within STARTS_MS, or has rung already; so the agent is told a note will come only when something will ring it. A new
// one that hasn't by then is stopped, so it can't ring an agent told to wait for itself, unless it has begun to ring.
// Its environment and working folder are this process's, without the pager's number.
const STARTS_MS = 3_000;
async function watcherFor(id: string, short: string): Promise<boolean> {
  const now = () => { try { return loadAgent(id)?.decisions[short] ?? null; } catch { return null; } };
  const d = now(), w = d?.wake;
  if (!d || w?.app !== 'codex' || w.ring || d.answered || d.acknowledged || d.closed) return false;
  if (w.watcher !== undefined && watching(w.watcher, id, short)) return true;
  const env = { ...process.env };
  delete env.AGENTPAGER_PAGER;
  let child: ReturnType<typeof spawn>, ended = false;
  try { child = spawn(program[0], [...program.slice(1), 'watch', '--agent', id, short], { detached: true, stdio: 'ignore', env }); } catch { return false; }
  child.on('error', () => { ended = true; });
  child.on('exit', () => { ended = true; });
  child.unref();
  if (child.pid === undefined) return false;
  for (const until = Date.now() + STARTS_MS; Date.now() < until;) {
    const x = now()?.wake;
    if (x?.app === 'codex' && (x.ring || x.watcher === child.pid)) return true;
    // It ended without watching, as when another watcher started first: that one counts.
    if (ended) return x?.app === 'codex' && x.watcher !== undefined && watching(x.watcher, id, short);
    await new Promise(res => setTimeout(res, 25));
  }
  try { process.kill(child.pid, 'SIGKILL'); } catch { /* it ended */ }
  const x = now()?.wake;
  return x?.app === 'codex' && x.ring !== undefined;
}
// queueTimeoutMs, retryMs and forMs: a test shortens them.
export async function watch(agent: string, ref: string, opts: { queueTimeoutMs?: number; retryMs?: number; forMs?: number } = {}): Promise<Result> {
  const a = agentOf(agent);
  if ('code' in a) return a;
  const d = a.decisions[ref] ? { short: ref, ...a.decisions[ref] } : null;
  if (!d) return refused(`Agent ${a.id} has no decision ${ref}.`);
  const short = d.short, theirs = (x: AgentFile) => {
    const e = x.decisions[short], w = e?.wake;
    return e && w?.app === 'codex' && !w.ring && !e.answered && !e.acknowledged && !e.closed ? w : null;
  };
  let mine = false;
  try {
    updateAgent(a.id, x => {
      const w = theirs(x);
      if (!w || (w.watcher !== undefined && w.watcher !== process.pid && watching(w.watcher, a.id, short))) return;
      w.watcher = process.pid; mine = true;
    });
  } catch { /* busy: not registered */ }
  if (!mine) return done('Nothing to watch: it has rung, this machine has the answer, or another watcher runs.');
  try {
    const started = Date.now();
    let failing: number | null = null;
    for (;;) {
      if (Date.now() - started > (opts.forMs ?? WATCH_MS)) return done('Stopped: watched for as long as a watcher may.');
      const look = Date.now();
      const r = await call(AnswerStatus, a.server, 'GET', `/api/agents/${a.agentId}/cards/${d.id}/answer?wait=${WAIT_SECONDS}`, { key: a.agentKey, timeoutMs: (WAIT_SECONDS + 20) * 1000 });
      // The service holds each look up to 50 s; one that comes back pending sooner (a proxy that doesn't hold) waits out
      // a second, so a watcher never spins.
      if (r.ok && r.value.status === 'pending') { failing = null; if (Date.now() - look < 1000) await new Promise(res => setTimeout(res, 1000)); continue; }
      if (r.ok) break;
      // An unreachable or restarting server, or a page that isn't its reply (a Wi-Fi sign-in), is tried again.
      if (r.status === 0 || r.status >= 500 || r.error === 'NotUnderstood') {
        failing ??= Date.now();
        if (Date.now() - failing > UNREACHABLE_MS) return done('Stopped: the server has been unreachable for a day.');
        await new Promise(res => setTimeout(res, opts.retryMs ?? RETRY_MS));
        continue;
      }
      const closed = closedOf(r);
      if (closed) noteClosed(a, [{ decisionId: d.id, ...closed }]);
      return done(`Stopped: ${closed ? 'the decision closed unanswered' : r.error}.`);
    }
    // Answered: recorded as rung before the call, so no watcher rings it again.
    const cli = codexCli();
    let thread = '', via: 'mcp' | 'shell' = 'mcp', claimed = false;
    try {
      updateAgent(a.id, x => {
        const w = theirs(x);
        if (!w || w.watcher !== process.pid) return;
        w.ring = { at: new Date().toISOString(), outcome: cli ? 'ringing' : 'no-cli' };
        ({ thread, via } = w); claimed = cli !== null;
      });
    } catch { /* not recorded, so not rung */ }
    if (!cli || !claimed) return done(cli ? 'Not rung: this machine has the answer, or it rang already.' : 'Not rung: no Codex CLI here can ring it.');
    const outcome: RingOutcome = await ring(cli, thread, note(a.id, short, via), opts.queueTimeoutMs ?? QUEUE_TIMEOUT_MS);
    try { updateAgent(a.id, x => { const w = x.decisions[short]?.wake; if (w?.app === 'codex' && w.ring) w.ring = { at: w.ring.at, outcome }; }); } catch { /* left as ringing: never rung again */ }
    return done(`Rang thread ${thread}: ${outcome}.`);
  } finally {
    try { updateAgent(a.id, x => { const w = x.decisions[short]?.wake; if (w?.app === 'codex' && w.watcher === process.pid) delete w.watcher; }); } catch { /* left: the next start finds no process */ }
  }
}

export function agents(): Result {
  const all = agentIds().map(agentOf).filter((a): a is AgentFile => !('code' in a));
  if (!all.length) return done('No agents on this machine. Connect with: agentpager connect <number>', []);
  const rows = all.map(a => `${a.id}  pager ${a.pager.slice(0, 8)}  ${a.project} · ${a.app}  ${a.createdAt.slice(0, 16).replace('T', ' ')}  ${Object.values(a.decisions).filter(d => !d.answered && !d.closed).length} open`);
  // Neither key is ever printed.
  return done(rows.join('\n'), all.map(({ agentKey, privateKey, ...rest }) => { void agentKey; void privateKey; return rest; }));
}

export function share(agent: string): Result {
  const a = agentOf(agent);
  if ('code' in a) return a;
  return done(`${a.id}: helpers on this machine pass --agent ${a.id}; their questions show on your owner's phone as this agent's. It's just the id: the key stays in this machine's agent file.`);
}
