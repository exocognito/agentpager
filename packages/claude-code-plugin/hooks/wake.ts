// AgentPager's Claude Code plugin, its mod's logic (B33.2, blueprint/areas/2-agents.md;
// docs/research/2026-11-08-clients-wake-lab.md). register.ts hands it Claude Code through Host and nothing else, so the
// tests drive it with a stand-in; it has no Node and no DOM, as a hooks module has none.
//
// What it does, in a session where it can start a turn (wakesHere):
// - It names the session to the agentpager command: AGENTPAGER_WAKE=claude-code:<session id> in the environment every
//   Bash command of the session starts with (packages/cli/src/detect.ts). The command then records each decision the
//   agent asks under that session, in the record of what's waiting (packages/cli/src/store.ts › waitingOf), and tells
//   the agent not to wait. After a /clear or a /resume the session id is another, and so is the variable.
// - It reads that record, never the command's words, for this session's decisions, and holds the command's own wait
//   for each, `agentpager wait --agent <agent> <decision> --no-pickup --json`, one 50 s hold after another, as the
//   adapters' contract beside waitingOf says. The command opens the answer but picks nothing up, so an answer the mod
//   holds while Claude is busy, or loses when Claude Code quits, still brings the owner's warning that no agent picked
//   it up (B32.12). The mod reads only the reply's code and status, and carries its text.
// - Once the turn carrying the answer has started, it tells the service the agent has it, with
//   `agentpager pickup --agent <agent> <decision> --json`, and tries again later, while the decision is listed as not
//   picked up, across a restart too, when the pager is off or the service had no usable reply.
// - It hands the reply over as a new turn ($.prompt.submit) once Claude is idle: at once when it is, else after the
//   running turn and a moment more, so a prompt the person queued, or a /clear, goes first. Never in a running turn.
//   Claude Code holds a plugin's prompt itself while something the mod isn't told of runs (a /compact, its own start),
//   and the call stays unresolved until that prompt's turn starts (Host › submit).
// - An answer counts as handed over only once its turn has started in the session that asked: Claude Code said the
//   prompt entered and then a turn of the main loop started there, or one started carrying the reply. Only then is it
//   recorded and picked up. A prompt Claude Code removed before it ran (the person pressed Esc), or didn't take (it
//   holds a plugin's prompts after the person stopped the session, until they type), is offered again after the
//   person's next turn, or a minute later. One still waiting when the person's /clear takes effect starts in the new
//   conversation (Claude Code 2.1.321 keeps it across the /clear): it isn't recorded or picked up, and the session
//   that asked gets it when it is resumed.
// - Each answer is handed over once: once its turn has started, a folder under AgentPager's home says so, which a
//   restart of Claude Code, or a later one on the same session, finds. It goes when its decision leaves the record
//   (acknowledged or closed unanswered). Two Claude Codes running one session at the same moment each hand it over to
//   their own conversation (seen with Claude Code 2.1.321, 9 Nov). A refusal in place of an answer (an answer that
//   can't be read, say) is handed over once while Claude Code runs, and is neither recorded as handed over nor picked
//   up.
// - The turn carries the answer, as anything the agent reads does: Claude Code keeps it in the session's transcript,
//   and, run with --debug, logs a plugin prompt's first words in its debug log. The mod's own debug lines hold ids and
//   states only.
// - It stops every wait it holds when the session ends, and a held wait ends by itself within 50 s if Claude Code is
//   killed, so nothing is left running.

// The command, by name on Claude Code's PATH.
export const COMMAND = 'agentpager';
// One line in every system prompt of a session where the command runs, the same every time, so the prompt cache holds.
// It names no pager number and no key.
export const LINE = 'AgentPager is available on this computer: when a decision only your owner can make comes up, ask them with the agentpager command (run agentpager help to start).';
export const LINE_ID = 'agentpager:available';

// How often the record is looked at; how long after a turn ends a handed-over turn waits, so the person's own prompt
// goes first; and how long a wait that can't reach the service or the pager pauses before the next.
export const TICK_MS = 1_000, SETTLE_MS = 500;
const AGAIN_MS = 1_000, UNREACHABLE_MS = 10_000, OFF_MS = 60_000, GONE_MS = 60_000, NOT_TAKEN_MS = 60_000;

// What register.ts gives the mod of Claude Code.
export type Entry = { name: string; kind: string; size: number; mtimeMs: number };
export type Spawned = { done: Promise<{ code: number | null; stdout: string }>; stop(): void };
export type Timer = { cancel(): void };
export interface Host {
  now(): Promise<number>;
  after(ms: number, fn: () => void): Timer;
  every(ms: number, fn: () => void): Timer;
  // `$.session.id()`: the transcript's name, which a /clear or a /resume changes, some time after the session it
  // left has ended: Claude Code 2.1.321 goes on giving the old one until its own session-start hooks are done.
  sessionId(): Promise<string>;
  // Sets or unsets AGENTPAGER_WAKE for every process the session starts from then on; false when Claude Code refused.
  setWake(value: string | undefined): Promise<boolean>;
  // A folder's entries, or null when it isn't there. Any other failure rejects, and the look it was for is made again
  // a second later: a folder of hand-overs that didn't list must never read as one with none.
  list(dir: string): Promise<Entry[] | null>;
  read(file: string): Promise<string>;
  exists(file: string): Promise<boolean>;
  run(argv: string[]): Promise<{ exitCode: number; stdout: string }>;
  // A child for as long as it runs: its exit code (null when a signal ended it) and all it wrote to stdout.
  spawn(argv: string[]): Spawned;
  // `$.prompt.submit`: a turn of its own once Claude Code is idle. Claude Code keeps the prompt waiting behind a running
  // turn, a compaction or its own start, and the call stays unresolved meanwhile. With Claude Code 2.1.321 it resolves
  // entered as that turn starts, a moment before the mod hears the turn start; Claude Code's declarations also let it
  // resolve once the prompt is queued behind a running turn, so entered alone never counts as started. Not entered:
  // Claude Code removed the prompt before it ran (the person pressed Esc), holds a plugin's prompts (after the person
  // stopped the session, until they type), or refused it.
  submit(text: string): Promise<{ entered: true } | { entered: false; why: string }>;
  // A line in Claude Code's debug log: ids and states only, never an answer.
  debug(line: string): void;
}

// Where the mod can hand an answer over as a turn, and so names the session to the command: a session someone is at
// (not `claude -p`, nor an SDK run such as the desktop app's Code tab), with /bin/sh (not Windows), the command on PATH
// and a home for it. Anywhere else it unsets AGENTPAGER_WAKE, which a session started inside another inherits, and the
// command gives today's background-wait words (B33.2).
export function wakesHere(at: { isInteractive: boolean; hasShell: boolean; command: boolean; home: string | null }): boolean {
  return at.isInteractive && at.hasShell && at.command && at.home !== null;
}
// AgentPager's home, as the command finds it (store.ts › home): AGENTPAGER_HOME, else ~/.agentpager.
export function homeOf(agentpagerHome: string | undefined, home: string | undefined): string | null {
  if (agentpagerHome) return agentpagerHome.replace(/\/+$/, '');
  return home ? `${home.replace(/\/+$/, '')}/.agentpager` : null;
}
// Whether `agentpager version` answered as the command does.
export const isCommand = (r: { exitCode: number; stdout: string }) => r.exitCode === 0 && r.stdout.startsWith('agentpager ');

// A session id the command takes in AGENTPAGER_WAKE (detect.ts › wakeOf); Claude Code's are UUIDs.
const SESSION = /^[A-Za-z0-9._-]{1,128}$/;
const AGENT = /^ap-[a-z0-9]{4}$/, DECISION = /^d_[a-z0-9]{4}$/;
const RECORD_FILE = /^(ap-[a-z0-9]{4})\.json$/, CLAIM = /^(ap-[a-z0-9]{4})\.(d_[a-z0-9]{4})$/;

// The record of what's waiting for one agent, as the command writes it (store.ts › Waiting), decoded: each decision it
// lists, with the Claude Code session that asked it when one did. Null for a file that isn't a version 1 record of
// that agent. Fields it doesn't know are ignored.
export type Listed = { decision: string; session: string | null; pickedUp: boolean };
export type Record = { agent: string; decisions: Listed[] };
const object = (v: unknown): { [k: string]: unknown } | null => typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
export function decodeRecord(agent: string, text: string): Record | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const r = object(raw);
  if (!r || r.version !== 1 || r.agent !== agent || !AGENT.test(agent) || !Array.isArray(r.decisions)) return null;
  const decisions: Listed[] = [];
  for (const item of r.decisions) {
    const d = object(item), w = object(d?.wake);
    if (!d || typeof d.decision !== 'string' || !DECISION.test(d.decision) || (d.state !== 'waiting' && d.state !== 'answered')) return null;
    decisions.push({ decision: d.decision, session: w && w.app === 'claude-code' && typeof w.session === 'string' && SESSION.test(w.session) ? w.session : null, pickedUp: d.state === 'answered' });
  }
  return { agent, decisions };
}

// What one held wait came to, from its `--json` reply alone (packages/cli/src/main.ts; exit codes as commands.ts has
// them): the answer, or a refusal while the decision is still listed (such as an answer that can't be read), to hand
// over; still pending, to hold again; the pager off or no usable reply from the service, to try again later; and no
// such agent here, to stop.
export type Outcome = { kind: 'deliver'; answered: boolean; text: string } | { kind: 'again' } | { kind: 'later'; ms: number } | { kind: 'stop' };
export function outcomeOf(stdout: string): Outcome {
  let raw: unknown;
  try { raw = JSON.parse(stdout.trim().split('\n').pop() ?? ''); } catch { return { kind: 'later', ms: UNREACHABLE_MS }; }
  const r = object(raw), result = object(r?.result);
  if (!r || typeof r.code !== 'number' || typeof r.text !== 'string') return { kind: 'later', ms: UNREACHABLE_MS };
  if (r.code === 0 && result?.status === 'answered') return { kind: 'deliver', answered: true, text: r.text };
  if (r.code === 0 && result?.status === 'pending') return { kind: 'again' };
  if (r.code === 2) return { kind: 'deliver', answered: false, text: r.text };
  if (r.code === 4) return { kind: 'later', ms: OFF_MS };
  if (r.code === 6) return { kind: 'stop' };
  return { kind: 'later', ms: UNREACHABLE_MS };
}
// The turn: which decision, and the command's reply as it gave it.
// What `agentpager pickup --json` came to (the contract beside waitingOf): settled, picked up now or before, or never
// to be (acknowledged, closed, pending, unreadable, refused, no such agent); or to be tried again, a minute on when the
// pager is off, 10 s on when the service had no usable reply or the command gave no reply at all.
export function pickupAgainIn(stdout: string): number | null {
  let raw: unknown;
  try { raw = JSON.parse(stdout.trim().split('\n').pop() ?? ''); } catch { return UNREACHABLE_MS; }
  const r = object(raw);
  if (typeof r?.code !== 'number') return UNREACHABLE_MS;
  return r.code === 4 ? OFF_MS : r.code === 5 ? UNREACHABLE_MS : r.code === 0 || r.code === 2 || r.code === 6 ? null : UNREACHABLE_MS;
}
// Its first line names the decision and the agent, and is what a turn carrying it is known by when it starts.
export const turnOpening = (agent: string, decision: string, answered: boolean) => answered
  ? `AgentPager: your owner answered decision ${decision} (agent ${agent}). The agentpager command's reply:`
  : `AgentPager: about decision ${decision} (agent ${agent}), the agentpager command replied:`;
export const turnText = (agent: string, decision: string, o: { answered: boolean; text: string }) => `${turnOpening(agent, decision, o.answered)}\n\n${o.text}`;

type Hold = {
  key: string; agent: string; decision: string; session: string;
  // holding: its wait runs; ready: the reply waits for Claude to be idle; handing: Claude Code has been asked for its
  // turn, which hasn't started yet as far as the mod has heard (entered: Claude Code said the prompt entered).
  state: 'holding' | 'ready' | 'handing'; turn?: string; answered?: boolean; entered?: boolean;
  stopped: boolean; child?: Spawned; wake?: () => void;
};

export class Mod {
  private session: string | null = null;
  // The session a /clear or a /resume ended, while Claude Code still gives its id as the session's.
  private left: string | null = null;
  private readonly holds = new Map<string, Hold>();
  // A decision whose wait found no such agent here isn't held again before this.
  private readonly resting = new Map<string, number>();
  // Handed over by this process, so never held again here, even where no claim could be made; and of those, the
  // answers, which are picked up.
  private readonly handed = new Set<string>(); private readonly answers = new Set<string>();
  // Pickups: being tried now, done, and when the next try may be made.
  private readonly picking = new Set<string>(); private readonly picked = new Set<string>();
  private readonly pickupAt = new Map<string, number>();
  private readonly cache = new Map<string, { mtimeMs: number; size: number; record: Record | null }>();
  private busy = false; private endedAt = 0; private heldUntil = 0;
  private looking: Promise<void> | null = null; private again = false; private handing = false; private ended = false;
  private claimsReady = false; private ticker: Timer | null = null;
  private readonly host: Host; private readonly home: string;
  constructor(host: Host, home: string) { this.host = host; this.home = home; }
  private get waiting() { return `${this.home}/waiting`; }
  private get claims() { return `${this.home}/claude-code`; }

  // Names the session and looks at the record, now and every second after, so a look that fails is tried again.
  // Never hands a turn over inside the caller's hook.
  async start() {
    this.ticker = this.host.every(TICK_MS, () => void this.look().catch(e => this.host.debug(`look failed: ${String(e)}`)));
    await this.look().catch(e => this.host.debug(`look failed: ${String(e)}`));
  }
  // The main loop's turns: a turn started keeps every hand-over waiting, and names the session again first, so the
  // first command after a /clear names the new one. It is also where an answer is known to be handed over: a turn
  // has started, in the session that asked, after Claude Code said the answer's prompt entered, or carrying its reply.
  async turnStarted(text = '') {
    this.busy = true;
    await this.name(true).catch(e => this.host.debug(`naming failed: ${String(e)}`));
    for (const h of [...this.holds.values()]) {
      if (h.state === 'handing' && h.session === this.session && (h.entered || text.includes(turnOpening(h.agent, h.decision, h.answered === true)))) this.handedOver(h);
    }
  }
  async turnEnded() {
    this.busy = false; this.heldUntil = 0; this.endedAt = await this.host.now();
    this.host.after(SETTLE_MS, () => void this.hand());
  }
  // The session ended. Its waits stop. After a /clear or a /resume Claude Code goes on under another session, which
  // a later look names once Claude Code gives its id, or the next turn's start; any other end is the process's.
  sessionEnded(reason: string, id?: string) {
    for (const key of [...this.holds.keys()]) this.drop(key);
    if (reason === 'clear' || reason === 'resume') { this.left = id ?? this.session; this.session = null; return; }
    this.ended = true;
    this.ticker?.cancel();
  }
  // For the tests: what the mod holds now, and the session it names.
  get held() { return [...this.holds.values()].map(h => ({ agent: h.agent, decision: h.decision, state: h.state })); }
  get named() { return this.session; }

  // AGENTPAGER_WAKE follows the session's id. A new id ends the waits for the old one's decisions; they are held again
  // when that session is resumed. The id of a session that has just ended isn't taken for the session's until a turn
  // starts under it: Claude Code goes on giving it for a while (Host › sessionId), and an answer handed over then
  // would start its turn in the conversation that comes next.
  private async name(atTurn = false) {
    const id = await this.host.sessionId();
    if (id === this.left && !atTurn) return;
    this.left = null;
    if (id === this.session) return;
    const set = SESSION.test(id) && await this.host.setWake(`claude-code:${id}`);
    if (!set) await this.host.setWake(undefined);
    this.session = set ? id : null;
    for (const h of [...this.holds.values()]) if (h.session !== this.session) this.drop(h.key);
    this.host.debug(`names session ${this.session ?? 'none'}`);
  }

  private async look() {
    if (this.ended) return;
    if (this.looking) { this.again = true; return this.looking; }
    this.looking = (async () => {
      do { this.again = false; await this.lookOnce(); } while (this.again && !this.ended);
    })().finally(() => { this.looking = null; });
    return this.looking;
  }
  private async lookOnce() {
    await this.name();
    // The claims are listed before the records are read: a claim is made only for a listed decision, and a decision
    // never comes back once it leaves, so a claim whose decision these records don't list is done with.
    const claimed = (await this.host.list(this.claims))?.filter(e => CLAIM.test(e.name)).map(e => e.name) ?? [];
    const records = await this.records();
    const now = await this.host.now(), mine = new Map<string, { agent: string; decision: string; pickedUp: boolean }>();
    // Every decision the records list, whoever wakes its agent, and the agents whose record didn't read this time:
    // nothing is concluded about a decision from a record that didn't read.
    const listed = new Set<string>(), unread = new Set<string>();
    for (const [agent, r] of records ?? []) {
      if (r === null) { unread.add(agent); continue; }
      for (const d of r.decisions) {
        listed.add(`${agent} ${d.decision}`);
        if (this.session && d.session === this.session) mine.set(`${agent} ${d.decision}`, { agent, decision: d.decision, pickedUp: d.pickedUp });
      }
    }
    // A decision no longer this session's, or one a wait of the agent's own has picked up (it followed today's
    // background-wait words, say), is the agent's already: its hold stops, ready or not.
    for (const h of [...this.holds.values()]) if (h.state !== 'handing' && !unread.has(h.agent) && (!mine.has(h.key) || mine.get(h.key)?.pickedUp)) this.drop(h.key);
    // What this process remembers of a decision goes when the decision leaves the record, not when the session changes:
    // back in a session after a /resume, what was handed over there isn't handed over again.
    for (const key of [...this.handed, ...this.picked, ...this.pickupAt.keys(), ...this.resting.keys()]) {
      if (listed.has(key) || unread.has(key.slice(0, key.indexOf(' ')))) continue;
      this.handed.delete(key); this.answers.delete(key); this.picked.delete(key); this.pickupAt.delete(key); this.resting.delete(key);
    }
    const taken = new Set(claimed);
    for (const [key, m] of mine) {
      const answer = this.answers.has(key) || taken.has(`${m.agent}.${m.decision}`), handed = answer || this.handed.has(key);
      if (!handed && !m.pickedUp && !this.holds.has(key) && (this.resting.get(key) ?? 0) <= now) this.hold(key, m.agent, m.decision);
      // An answer handed over that the record still says no agent picked up: the pickup that didn't land, here or
      // before a restart.
      if (answer && !m.pickedUp && !this.picked.has(key) && (this.pickupAt.get(key) ?? 0) <= now) void this.pickup(key, m.agent, m.decision);
    }
    if (records) for (const name of claimed) {
      const [, agent = '', decision = ''] = CLAIM.exec(name) ?? [];
      const r = records.get(agent);
      // A record that didn't read leaves its claims alone; a listed decision keeps its claim.
      if (r === null || r?.decisions.some(d => d.decision === decision)) continue;
      await this.host.run(['/bin/rmdir', `${this.claims}/${name}`]).catch(() => undefined);
    }
    void this.hand();
  }
  // Every agent's record, by agent: its decoded record, or null for one that didn't read. Null when there is no folder
  // of records yet. A file is read again only when its size or time changed.
  private async records(): Promise<Map<string, Record | null> | null> {
    const entries = await this.host.list(this.waiting);
    if (!entries) return null;
    const out = new Map<string, Record | null>();
    for (const e of entries) {
      const agent = RECORD_FILE.exec(e.name)?.[1];
      if (!agent || e.kind !== 'file') continue;
      const known = this.cache.get(agent);
      if (known && known.mtimeMs === e.mtimeMs && known.size === e.size) { out.set(agent, known.record); continue; }
      // A file that didn't read is read again at the next look; one that read is decoded once for what it holds.
      const text = await this.host.read(`${this.waiting}/${e.name}`).catch(() => null);
      const record = text === null ? null : decodeRecord(agent, text);
      if (text !== null) this.cache.set(agent, { mtimeMs: e.mtimeMs, size: e.size, record });
      out.set(agent, record);
    }
    return out;
  }
  // Whether a decision is still this session's, and no wait has picked it up, read fresh from its record.
  private async stillMine(h: Hold) {
    if (h.session !== this.session) return false;
    const r = await this.host.read(`${this.waiting}/${h.agent}.json`).then(t => decodeRecord(h.agent, t), () => null);
    return Boolean(r?.decisions.some(d => d.decision === h.decision && d.session === h.session && !d.pickedUp));
  }

  private hold(key: string, agent: string, decision: string) {
    if (!this.session) return;
    const h: Hold = { key, agent, decision, session: this.session, state: 'holding', stopped: false };
    this.holds.set(key, h);
    this.host.debug(`holds ${agent} ${decision}`);
    void this.watch(h).catch(async (e: unknown) => {
      this.host.debug(`wait for ${agent} ${decision} failed: ${String(e)}`);
      this.drop(key); this.resting.set(key, (await this.host.now()) + GONE_MS);
    });
  }
  private async watch(h: Hold) {
    for (;;) {
      if (h.stopped) return;
      const began = await this.host.now();
      h.child = this.host.spawn([COMMAND, 'wait', '--agent', h.agent, h.decision, '--no-pickup', '--json']);
      const { stdout } = await h.child.done;
      h.child = undefined;
      if (h.stopped) return;
      const o = outcomeOf(stdout);
      this.host.debug(`wait for ${h.agent} ${h.decision}: ${o.kind}`);
      if (o.kind === 'deliver') { h.state = 'ready'; h.turn = turnText(h.agent, h.decision, o); h.answered = o.answered; void this.hand(); return; }
      if (o.kind === 'stop') { this.drop(h.key); this.resting.set(h.key, began + GONE_MS); return; }
      const rest = o.kind === 'again' ? AGAIN_MS - ((await this.host.now()) - began) : o.ms;
      if (rest > 0) await new Promise<void>(resolve => { const t = this.host.after(rest, resolve); h.wake = () => { t.cancel(); resolve(); }; });
      h.wake = undefined;
    }
  }
  private drop(key: string) {
    const h = this.holds.get(key);
    if (!h) return;
    h.stopped = true; h.child?.stop(); h.wake?.();
    this.holds.delete(key);
  }

  // Asks Claude Code for the first ready reply's turn, once Claude is idle and has been for SETTLE_MS; the next waits
  // for that turn's end. A decision another Claude Code on the session has handed over is left to it. One call to
  // Claude Code is out at a time, and what comes of it is the turn's start (turnStarted), not the call's reply alone.
  private async hand() {
    if (this.handing) return;
    this.handing = true;
    try {
      for (;;) {
        if (this.ended || this.busy) return;
        const h = [...this.holds.values()].find(x => x.state === 'ready');
        if (!h) return;
        const now = await this.host.now();
        if (now < this.heldUntil) return;
        if (now - this.endedAt < SETTLE_MS) { this.host.after(SETTLE_MS - (now - this.endedAt), () => void this.hand()); return; }
        if (!(await this.stillMine(h)) || await this.host.exists(this.claimOf(h.agent, h.decision)).catch(() => false)) { this.drop(h.key); continue; }
        // Those reads took time: a turn may have started, or the session ended or changed, since.
        if (this.busy || this.ended || this.holds.get(h.key) !== h || h.session !== this.session) continue;
        h.state = 'handing';
        const r = await this.host.submit(h.turn ?? '').catch((e: unknown) => ({ entered: false as const, why: String(e) }));
        // Its turn has started already, or its hold stopped while the call was out (the session ended, say).
        if (this.holds.get(h.key) !== h) return;
        if (r.entered) { h.entered = true; this.host.debug(`turn for ${h.agent} ${h.decision} entered`); return; }
        // Not taken: the turn waits for the person's next turn, or a minute.
        this.host.debug(`turn for ${h.agent} ${h.decision} not taken: ${r.why}`);
        h.state = 'ready'; this.heldUntil = (await this.host.now()) + NOT_TAKEN_MS;
        this.host.after(NOT_TAKEN_MS, () => void this.hand());
        return;
      }
    } finally { this.handing = false; }
  }
  // The turn carrying a reply has started: it is handed over, and its hold is done. Only an answer is recorded as
  // handed over and picked up. A refusal (an answer that can't be read, say) is handed over once while this process
  // runs and leaves the service as it was, so an answer that comes or reads later still reaches the agent after a
  // restart, and until then brings the owner's warning.
  private handedOver(h: Hold) {
    this.holds.delete(h.key); this.handed.add(h.key);
    this.host.debug(`handed ${h.agent} ${h.decision} over`);
    if (!h.answered) return;
    this.answers.add(h.key);
    void this.claim(h.agent, h.decision).then(() => this.pickup(h.key, h.agent, h.decision)).catch(e => this.host.debug(`pickup of ${h.agent} ${h.decision} failed: ${String(e)}`));
  }
  // The record that a decision's answer was handed over, made once its turn has started: so a restart finds it, and
  // the turn is never handed over again. Made after, not before, so a Claude Code that quits while the turn waits to
  // start (behind a slow session-start hook, say) hands it over again when it comes back. A home that can't be
  // written leaves only this process's memory of it.
  private claimOf(agent: string, decision: string) { return `${this.claims}/${agent}.${decision}`; }
  private async claim(agent: string, decision: string) {
    if (!this.claimsReady) this.claimsReady = (await this.host.run(['/bin/mkdir', '-p', '-m', '700', this.claims]).catch(() => ({ exitCode: 1, stdout: '' }))).exitCode === 0;
    await this.host.run(['/bin/mkdir', this.claimOf(agent, decision)]).catch(() => undefined);
  }
  // Tells the service the agent has the answer, once its turn has started (B32.12). A try that doesn't land is made
  // again by a later look, after the time pickupAgainIn gives, while the record lists the decision as not picked up.
  private async pickup(key: string, agent: string, decision: string) {
    if (this.picking.has(key)) return;
    this.picking.add(key);
    try {
      const r = await this.host.run([COMMAND, 'pickup', '--agent', agent, decision, '--json']).catch(() => ({ exitCode: 1, stdout: '' }));
      const again = pickupAgainIn(r.stdout);
      this.host.debug(`pickup of ${agent} ${decision}: ${again === null ? 'done' : 'not yet'}`);
      if (again === null) this.picked.add(key); else this.pickupAt.set(key, (await this.host.now()) + again);
    } finally { this.picking.delete(key); }
  }
}
