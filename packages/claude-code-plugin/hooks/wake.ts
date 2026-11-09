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
//   for each, `agentpager wait --agent <agent> <decision> --json --hold`, one 50 s hold after another. The command opens
//   the answer; a held wait doesn't say it has it, so an answer the mod holds while Claude is busy, or loses when Claude
//   Code quits, still brings the owner's warning that no agent picked it up (B32.12). The mod reads only the reply's
//   code and status, and carries its text.
// - Once the turn carrying the answer has started, it tells the service the agent has it, with
//   `agentpager pickup --agent <agent> <decision> --json`, and tries again 10 s apart while the decision is listed as
//   not picked up, across a restart too.
// - It hands the reply over as a new turn ($.prompt.submit) once Claude is idle: at once when it is, else after the
//   running turn and a moment more, so a prompt the person queued, or a /clear, goes first. Never in a running turn.
// - Each answer is handed over once: once its turn has started, a folder under AgentPager's home says so, which a
//   restart of Claude Code, or a later one on the same session, finds. It goes when its decision leaves the record
//   (acknowledged or closed unanswered). A turn Claude Code didn't take is offered again after the person's next turn,
//   or a minute later. Two Claude Codes running one session at the same moment would each hand it over to their own
//   conversation (not tested).
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
const AGAIN_MS = 1_000, UNREACHABLE_MS = 10_000, OFF_MS = 60_000, GONE_MS = 60_000, NOT_TAKEN_MS = 60_000, PICKUP_AGAIN_MS = 10_000;

// What register.ts gives the mod of Claude Code.
export type Entry = { name: string; kind: string; size: number; mtimeMs: number };
export type Spawned = { done: Promise<{ code: number | null; stdout: string }>; stop(): void };
export type Timer = { cancel(): void };
export interface Host {
  now(): Promise<number>;
  after(ms: number, fn: () => void): Timer;
  every(ms: number, fn: () => void): Timer;
  // `$.session.id()`: the transcript's name, which a /clear or a /resume changes.
  sessionId(): Promise<string>;
  // Sets or unsets AGENTPAGER_WAKE for every process the session starts from then on; false when Claude Code refused.
  setWake(value: string | undefined): Promise<boolean>;
  // A folder's entries, or null when it can't be listed (it isn't there, or a failure).
  list(dir: string): Promise<Entry[] | null>;
  read(file: string): Promise<string>;
  exists(file: string): Promise<boolean>;
  run(argv: string[]): Promise<{ exitCode: number; stdout: string }>;
  // A child for as long as it runs: its exit code (null when a signal ended it) and all it wrote to stdout.
  spawn(argv: string[]): Spawned;
  // A turn of its own once Claude is idle, resolved as that turn starts; not entered when Claude Code holds a plugin's
  // prompts (after the person stopped the session, until they type) or refused it.
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
// Whether `agentpager pickup --json` settled it: picked up now or already, or never to be (acknowledged, closed, no
// such agent). A pager that's off, a service out of reach, or no reply at all is tried again.
export function pickupDone(stdout: string): boolean {
  let raw: unknown;
  try { raw = JSON.parse(stdout.trim().split('\n').pop() ?? ''); } catch { return false; }
  const r = object(raw);
  return typeof r?.code === 'number' && r.code !== 4 && r.code !== 5;
}
export const turnText = (agent: string, decision: string, o: { answered: boolean; text: string }) => o.answered
  ? `AgentPager: your owner answered decision ${decision} (agent ${agent}). The agentpager command's reply:\n\n${o.text}`
  : `AgentPager: about decision ${decision} (agent ${agent}), the agentpager command replied:\n\n${o.text}`;

type Hold = {
  key: string; agent: string; decision: string; session: string;
  // holding: its wait runs; ready: the reply waits for Claude to be idle; handing: its turn is being submitted.
  state: 'holding' | 'ready' | 'handing'; turn?: string;
  stopped: boolean; child?: Spawned; wake?: () => void;
};

export class Mod {
  private session: string | null = null;
  private readonly holds = new Map<string, Hold>();
  // A decision whose wait found no such agent here isn't held again before this.
  private readonly resting = new Map<string, number>();
  // Handed over by this process, so never held again here, even where no claim could be made.
  private readonly handed = new Set<string>();
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
  // The main loop's turns: a turn started keeps every handed-over turn waiting, and names the session again first, so
  // the first command after a /clear names the new one.
  async turnStarted() { this.busy = true; await this.name(); }
  async turnEnded() {
    this.busy = false; this.heldUntil = 0; this.endedAt = await this.host.now();
    this.host.after(SETTLE_MS, () => void this.hand());
  }
  // The session ended. Its waits stop. After a /clear or a /resume Claude Code goes on under another session, which
  // the next look names; any other end is the process's.
  sessionEnded(reason: string) {
    for (const key of [...this.holds.keys()]) this.drop(key);
    if (reason === 'clear' || reason === 'resume') return;
    this.ended = true;
    this.ticker?.cancel();
  }
  // For the tests: what the mod holds now, and the session it names.
  get held() { return [...this.holds.values()].map(h => ({ agent: h.agent, decision: h.decision, state: h.state })); }
  get named() { return this.session; }

  // AGENTPAGER_WAKE follows the session's id. A new id ends the waits for the old one's decisions; they are held again
  // when that session is resumed.
  private async name() {
    const id = await this.host.sessionId();
    if (id === this.session) return;
    const set = SESSION.test(id) && await this.host.setWake(`claude-code:${id}`);
    if (!set) await this.host.setWake(undefined);
    this.session = set ? id : null;
    for (const h of [...this.holds.values()]) if (h.session !== this.session && h.state !== 'handing') this.drop(h.key);
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
    if (records && this.session) for (const [agent, r] of records) for (const d of r?.decisions ?? []) if (d.session === this.session) mine.set(`${agent} ${d.decision}`, { agent, decision: d.decision, pickedUp: d.pickedUp });
    // A decision no longer this session's, or one a wait of the agent's own has picked up (it followed today's
    // background-wait words, say), is the agent's already: its hold stops, ready or not.
    for (const h of [...this.holds.values()]) if (h.state !== 'handing' && (!mine.has(h.key) || mine.get(h.key)?.pickedUp)) this.drop(h.key);
    if (records) for (const key of [...this.handed, ...this.picked, ...this.pickupAt.keys()]) if (!mine.has(key)) { this.handed.delete(key); this.picked.delete(key); this.pickupAt.delete(key); }
    const taken = new Set(claimed);
    for (const [key, m] of mine) {
      const handed = this.handed.has(key) || taken.has(`${m.agent}.${m.decision}`);
      if (!handed && !m.pickedUp && !this.holds.has(key) && (this.resting.get(key) ?? 0) <= now) this.hold(key, m.agent, m.decision);
      // Handed over, and the record still says no agent picked it up: the pickup that didn't land, here or before a restart.
      if (handed && !m.pickedUp && !this.picked.has(key) && (this.pickupAt.get(key) ?? 0) <= now) void this.pickup(key, m.agent, m.decision);
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
  // Every agent's record, by agent: its decoded record, or null for one that didn't read. Null when the folder can't
  // be listed. A file is read again only when its size or time changed.
  private async records(): Promise<Map<string, Record | null> | null> {
    const entries = await this.host.list(this.waiting);
    if (!entries) return null;
    const out = new Map<string, Record | null>();
    for (const e of entries) {
      const agent = RECORD_FILE.exec(e.name)?.[1];
      if (!agent || e.kind !== 'file') continue;
      const known = this.cache.get(agent);
      if (known && known.mtimeMs === e.mtimeMs && known.size === e.size) { out.set(agent, known.record); continue; }
      const record = await this.host.read(`${this.waiting}/${e.name}`).then(t => decodeRecord(agent, t), () => null);
      this.cache.set(agent, { mtimeMs: e.mtimeMs, size: e.size, record });
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
      h.child = this.host.spawn([COMMAND, 'wait', '--agent', h.agent, h.decision, '--json', '--hold']);
      const { stdout } = await h.child.done;
      h.child = undefined;
      if (h.stopped) return;
      const o = outcomeOf(stdout);
      this.host.debug(`wait for ${h.agent} ${h.decision}: ${o.kind}`);
      if (o.kind === 'deliver') { h.state = 'ready'; h.turn = turnText(h.agent, h.decision, o); void this.hand(); return; }
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

  // Hands the first ready reply over, once Claude is idle and has been for SETTLE_MS; the next waits for that turn's end.
  // A decision another Claude Code on the session has handed over is left to it.
  private async hand() {
    if (this.handing || this.ended) return;
    this.handing = true;
    try {
      for (;;) {
        const h = [...this.holds.values()].find(x => x.state === 'ready');
        if (!h || this.busy) return;
        const now = await this.host.now();
        if (now < this.heldUntil) return;
        if (now - this.endedAt < SETTLE_MS) { this.host.after(SETTLE_MS - (now - this.endedAt), () => void this.hand()); return; }
        if (!(await this.stillMine(h)) || await this.host.exists(this.claimOf(h.agent, h.decision)).catch(() => false)) { this.drop(h.key); continue; }
        h.state = 'handing';
        const r = await this.host.submit(h.turn ?? '').catch((e: unknown) => ({ entered: false as const, why: String(e) }));
        if (r.entered) {
          this.holds.delete(h.key); this.handed.add(h.key);
          await this.claim(h.agent, h.decision);
          this.host.debug(`handed ${h.agent} ${h.decision} over`);
          void this.pickup(h.key, h.agent, h.decision);
          return;
        }
        // Not taken: the turn waits for the person's next turn, or a minute.
        this.host.debug(`turn for ${h.agent} ${h.decision} not taken: ${r.why}`);
        h.state = 'ready'; this.heldUntil = (await this.host.now()) + NOT_TAKEN_MS;
        this.host.after(NOT_TAKEN_MS, () => void this.hand());
        return;
      }
    } finally { this.handing = false; }
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
  // again by a later look, PICKUP_AGAIN_MS on, while the record lists the decision as not picked up.
  private async pickup(key: string, agent: string, decision: string) {
    if (this.picking.has(key)) return;
    this.picking.add(key);
    try {
      const r = await this.host.run([COMMAND, 'pickup', '--agent', agent, decision, '--json']).catch(() => ({ exitCode: 1, stdout: '' }));
      const done = pickupDone(r.stdout);
      this.host.debug(`pickup of ${agent} ${decision}: ${done ? 'done' : 'not yet'}`);
      if (done) this.picked.add(key); else this.pickupAt.set(key, (await this.host.now()) + PICKUP_AGAIN_MS);
    } finally { this.picking.delete(key); }
  }
}
