// The waits held in one pager's store (pager.ts), each for one of its agents' decisions. A wait sleeps until what it
// waits for changes, and the store wakes it then: the answer stored, the pager turning off or going, the agent
// forgotten. Whatever ends what a wait waits for calls `wake` once its write is done; there is no other path. A woken
// wait looks again, in a transaction of its own, and a wait that finds nothing new sleeps again. Each wait also looks at
// its own deadline, and at the time its look names, such as its pager's auto-off, so a lost wake costs at most that.
//
// A wait is held only in memory, while its request is open: when the store restarts, its requests fail, and the
// Worker and the command ask again (shared.ts › read, packages/cli/src/commands.ts › wait). Nothing here is stored.
// Each held wait has one timer and one entry here, both gone when it wakes or ends, so what is held is never more than
// the waits whose requests are open.

// Time, as something a test can move: `after` runs `run` once, `ms` from now, unless the function it returns cancels it.
export type Clock = { now(): number; after(ms: number, run: () => void): () => void };
export const systemClock: Clock = {
  now: () => Date.now(),
  after: (ms, run) => { const timer = setTimeout(run, ms); return () => clearTimeout(timer); },
};

// Which waits a wake reaches: those on one decision, every wait of one agent, or every wait in the store.
export type Reach = { agentId: string; decisionId?: string } | 'all';
// What a look finds: what the wait waited for, or not yet, with the time by which it must look again, if any.
export type Look<A> = { found: A } | { lookBy: number | null };
type Held = { agentId: string; decisionId: string; wake: () => void };

export class Waits {
  private held = new Set<Held>();
  private clock: Clock;
  constructor(clock: Clock = systemClock) { this.clock = clock; }
  // How many waits are asleep now.
  get size() { return this.held.size; }

  wake(reach: Reach) {
    for (const w of [...this.held]) {
      if (reach === 'all' || (w.agentId === reach.agentId && (reach.decisionId === undefined || w.decisionId === reach.decisionId))) w.wake();
    }
  }

  // Looks now, then again at each wake and by the time each look names, until a look finds something or `until`
  // passes, when it gives null. A look that throws ends the wait with what it threw. Each look and the sleep after it
  // start in the same turn, so nothing written between them can go unseen. A time already passed is no time to look
  // again: the look just made saw what it brought.
  async hold<A>(on: { agentId: string; decisionId: string }, until: number, look: () => Look<A>): Promise<A | null> {
    for (;;) {
      const seen = look();
      if ('found' in seen) return seen.found;
      const now = this.clock.now();
      if (now >= until) return null;
      await this.sleep(on, (seen.lookBy !== null && seen.lookBy > now && seen.lookBy < until ? seen.lookBy : until) - now);
    }
  }

  // Until it is woken or `ms` passes, whichever is first; then its timer and its entry are gone.
  private sleep(on: { agentId: string; decisionId: string }, ms: number): Promise<void> {
    return new Promise(resolve => {
      let cancel = () => {};
      const w: Held = { ...on, wake: () => { if (!this.held.delete(w)) return; cancel(); resolve(); } };
      this.held.add(w);
      cancel = this.clock.after(ms, w.wake);
    });
  }
}
