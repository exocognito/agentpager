import { after, before, test } from 'node:test';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, assert, until } from '../../app/test/support.ts';
import { agentpagerWake, LINE, TYPE, type Context, type Events, type Options } from '../src/index.ts';

// AgentPager's pi extension (B33.5, blueprint/areas/2-agents.md) against a stand-in for pi and the real command, run from
// its source, on the suites' local server. The stand-in does what pi 1.4.0 does with the calls the extension makes: a
// follow-up sent while idle starts a run with its message, one sent from inside agent_settled waits until that has
// been emitted, each message, and each entry the extension appends, is kept in the session's entries, and pi isn't
// idle while it compacts or moves within its tree (the event of a move comes before it is idle again, and nothing says
// when it is). Whether pi itself starts the turn is shown by the
// real run recorded in the pull request; this shows what the extension does with each event, and when the command picks
// the answer up (B32.12): only once the turn carrying it has started. The service's not-picked-up clock is 3 s here.

const main = fileURLToPath(new URL('../../cli/src/main.ts', import.meta.url));
const command = [process.execPath, '--experimental-strip-types', main];
const work = mkdtempSync(path.join(tmpdir(), 'agentpager-pi-')), home = path.join(work, 'home'), bin = path.join(work, 'bin');
mkdirSync(bin);
for (const v of ['CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_HOME', 'CODEX_THREAD_ID', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT', 'PI_SESSION_ID', 'AGENTPAGER_WAKE', 'AGENTPAGER_PAGER']) delete process.env[v];
process.env.AGENTPAGER_HOME = home;
writeFileSync(path.join(work, 'card.yaml'), 'title: Which colour?\ndetail: A pi wake test.\ncontext:\n  summary: Ready.\noptions:\n  - {label: Blue, title: Blue, prioritizes: calm}\n  - {label: Red, title: Red, prioritizes: speed}\nrecommendation: {option: A, why: Calm.}\n');
const fast: Options = { command, retryMs: 300, offRetryMs: 300, confirmMs: 2_000, idleMs: 200 };
const PICKUP_MS = 3_000;

// pi as the extension sees it: its events, its calls, the session's entries, the branch it is on (a session resumes at
// its last entry, or on the branch given), and whether it is working.
function standIn(mode: Context['mode'], sessionId: string, entries: unknown[] = [], at?: unknown[]) {
  const handlers: { [E in keyof Events]: ((event: Events[E], ctx: Context) => void)[] } = { session_start: [], session_shutdown: [], session_tree: [], before_agent_start: [], message_start: [], agent_start: [], agent_settled: [], tool_result: [] };
  const branch = [...(at ?? entries)];
  const sent: { content: string; details: unknown; options: unknown; whileWorking: boolean }[] = [], notes: string[] = [];
  let working = false, queued = false, settling = false, compacting = false;
  const later: (() => void)[] = [];
  const ctx: Context = {
    mode, hasUI: mode === 'tui' || mode === 'rpc',
    isIdle: () => !working && !compacting, hasPendingMessages: () => queued,
    sessionManager: { getSessionId: () => sessionId, getEntries: () => entries, getBranch: () => branch },
    ui: { notify: m => { notes.push(m); } },
  };
  const emit = <E extends keyof Events>(event: E, payload: Events[E]) => { for (const h of handlers[event]) h(payload, ctx); };
  const run = (message?: { role: string; customType: string; content: string; details: unknown }) => {
    working = true;
    const sections: { [name: string]: string } = {}, options = { sections };
    emit('before_agent_start', { systemPromptOptions: options });
    emit('agent_start', {});
    if (message) emit('message_start', { message });
    return options;
  };
  const pi = {
    on<E extends keyof Events>(event: E, handler: (event: Events[E], ctx: Context) => void) { handlers[event].push(handler); },
    sendMessage(message: { customType: string; content: string; display: boolean; details?: unknown }, options?: { triggerTurn?: boolean; deliverAs?: string }) {
      sent.push({ content: message.content, details: message.details, options, whileWorking: working });
      const go = () => { const entry = { type: 'custom_message', ...message }; entries.push(entry); branch.push(entry); run({ role: 'custom', ...message, details: message.details }); };
      if (settling) later.push(go); else if (!working && options?.triggerTurn) go();
    },
    appendEntry(customType: string, data?: unknown) { const entry = { type: 'custom', customType, data }; entries.push(entry); branch.push(entry); },
  };
  return {
    pi, ctx, sent, notes, entries, emit,
    start: (options: Options = fast) => { agentpagerWake(pi, options); emit('session_start', { reason: 'startup' }); },
    // The owner's own prompt, and the end of whatever run is going.
    prompt: () => run(),
    settle: () => { working = false; settling = true; emit('agent_settled', { aborted: false }); settling = false; for (const go of later.splice(0)) go(); },
    queue: (on: boolean) => { queued = on; },
    bash: () => emit('tool_result', { toolName: 'bash' }),
    shutdown: () => emit('session_shutdown', { reason: 'quit' }),
    // pi compacts, or summarizes the branch a move leaves: it isn't idle meanwhile, and no event says when it ends.
    compacting: (on: boolean) => { compacting = on; },
    // The owner moves to an earlier point of the session's tree, keeping its first entries, or back to a branch left
    // earlier. pi isn't idle until after the event.
    navigate: (keep: number) => { const was = compacting; compacting = true; branch.splice(keep); emit('session_tree', {}); compacting = was; },
    branch: () => [...branch],
    back: (to: unknown[]) => { const was = compacting; compacting = true; branch.splice(0, branch.length, ...to); emit('session_tree', {}); compacting = was; },
  };
}

// A command the agent runs from pi's shell: pi's environment, with the markers pi sets for the session.
function shell(session: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<{ code: number; text: string; result: unknown }> {
  return new Promise((resolve, reject) => execFile(command[0], [...command.slice(1), ...args, '--json'], { cwd: work, env: { ...process.env, PI_CODING_AGENT: 'true', PI_SESSION_ID: session, ...env } }, (e, stdout) => {
    try { const r = JSON.parse(stdout); resolve({ code: r.code, text: r.text, result: r.result }); } catch { reject(e ?? new Error(stdout)); }
  }));
}
const field = (r: { result: unknown }, key: string) => String(typeof r.result === 'object' && r.result !== null ? Reflect.get(r.result, key) : undefined);
// The waits a process's extensions hold now (this test process's, unless named), as the process list shows them.
const waits = (parent = process.pid) => execFileSync('ps', ['-A', '-o', 'pid=,ppid=,command='], { encoding: 'utf8' }).split('\n').map(l => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l)).filter(m => m !== null && Number(m[2]) === parent && / wait --agent ap-[a-z0-9]{4} d_[a-z0-9]{4} --no-pickup --json$/.test(m[3])).map(m => ({ pid: Number(m?.[1]), command: m?.[3] ?? '' }));
const holds = (agent: string, d: string) => waits().some(w => w.command.endsWith(` wait --agent ${agent} ${d} --no-pickup --json`));
const pickups = () => execFileSync('ps', ['-A', '-o', 'ppid=,command='], { encoding: 'utf8' }).split('\n').map(l => /^\s*(\d+)\s+(.*)$/.exec(l)).filter(m => m !== null && Number(m[1]) === process.pid && / pickup --agent /.test(m[2])).map(m => m?.[2] ?? '');
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const record = (agent: string): unknown => JSON.parse(readFileSync(path.join(home, 'waiting', `${agent}.json`), 'utf8'));
const decisionsOf = (details: unknown) => { const d = typeof details === 'object' && details !== null ? Reflect.get(details, 'decisions') : undefined; return Array.isArray(d) ? d : []; };

let f: Awaited<ReturnType<typeof fixture>>, p: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['makePager']>>;
before(async () => { f = await fixture('pi-wake', { autoOffMs: 0, idleMs: 0, pickupMs: PICKUP_MS }); process.env.AGENTPAGER_SERVER = f.origin; p = await f.makePager(); });
after(async () => { for (const w of waits()) process.kill(w.pid, 'SIGKILL'); await f?.stop(); });

// The owner answers the decision of that title on the phone, with option A unless told otherwise.
async function answer(title: string, choice: { kind: 'option'; number: number } | { kind: 'feedback'; text: string } = { kind: 'option', number: 1 }) {
  for (const a of (await f.pager(p.pagerId, p.phone)).agents) {
    const d = a.open.find(x => x.title === title);
    if (d) return f.answer(a.agent.agentId, p.phone, d.decisionId, choice);
  }
  throw new Error(`no open decision "${title}"`);
}
async function seen(title: string) {
  for (const a of (await f.pager(p.pagerId, p.phone)).agents) { const d = [...a.open, ...a.answered].find(x => x.title === title); if (d) return d; }
  return undefined;
}
// An agent of this session connects and asks, from pi's shell; the card's title makes it the test's own.
async function asks(session: string, title: string, env: NodeJS.ProcessEnv = {}) {
  const c = await shell(session, ['connect', p.number, '--app', 'pi', '--project', 'pi-wake'], env);
  assert.equal(c.code, 0, c.text);
  const agent = field(c, 'agent');
  writeFileSync(path.join(work, `${agent}.yaml`), readFileSync(path.join(work, 'card.yaml'), 'utf8').replace('Which colour?', title));
  const a = await shell(session, ['ask', '--agent', agent, `${agent}.yaml`], env);
  assert.equal(a.code, 0, a.text);
  return { agent, d: field(a, 'decision'), connected: c.text, asked: a.text };
}

test('B33.5 In print or JSON mode the extension does nothing, and an AGENTPAGER_WAKE inherited from a session around it is cleared, so the command keeps today\'s words: a pi started inside another without the extension isn\'t woken either', { timeout: 60_000 }, async () => {
  for (const mode of ['print', 'json'] as const) {
    process.env.AGENTPAGER_WAKE = 'pi:outer-session';
    const pi = standIn(mode, `${mode}-session`);
    pi.start();
    assert.equal(process.env.AGENTPAGER_WAKE, undefined, `${mode}: no variable, and the outer session's is gone`);
    const { agent, d, connected, asked } = await asks(`${mode}-session`, `In ${mode} mode?`);
    assert.match(connected, /they may have to nudge you to read it/, 'pi without a wake is told it may need a nudge (B33.1)');
    assert.ok(asked.endsWith(`\nDecision ${d}. Wait for the answer with: agentpager wait --agent ${agent} ${d}`), asked);
    assert.deepEqual(Reflect.get(Object(record(agent)), 'decisions')[0].wake, undefined, 'nothing recorded to wake it');
    pi.bash();
    assert.equal(pi.prompt().sections.agentpager, undefined, 'no line');
    assert.equal(holds(agent, d), false, 'no wait held');
    pi.settle(); pi.shutdown();
    assert.equal(pi.sent.length, 0);
  }
  // A pi started inside another without the extension inherits the outer session's wake, but pi names its own session
  // in PI_SESSION_ID: the command doesn't take the wake for it.
  const inner = await asks('inner-session', 'Inside another pi?', { AGENTPAGER_WAKE: 'pi:outer-session' });
  assert.ok(inner.asked.endsWith(`\nDecision ${inner.d}. Wait for the answer with: agentpager wait --agent ${inner.agent} ${inner.d}`), inner.asked);
  assert.deepEqual(Reflect.get(Object(record(inner.agent)), 'decisions')[0].wake, undefined);
});

test('B33.5 B32.12 An answer to a decision this session asked comes in once, as one follow-up turn once pi settles, carrying the command\'s reply, and is picked up once that turn has started; the session start line names no number, key or id', { timeout: 60_000 }, async () => {
  const pi = standIn('tui', 's-idle');
  pi.start();
  assert.equal(process.env.AGENTPAGER_WAKE, 'pi:s-idle', 'set for the commands the agent runs');
  const sections = pi.prompt().sections;
  assert.equal(sections.agentpager, LINE, 'one fixed line in the session\'s prompt');
  assert.doesNotMatch(LINE, /ap1_|ap-[a-z0-9]{4}|d_[a-z0-9]{4}|[A-Za-z0-9_-]{43}/);
  const { agent, d, connected, asked } = await asks('s-idle', 'Idle, blue or red?');
  assert.doesNotMatch(connected, /nudge/, 'pi with the extension is named (B33.1)');
  assert.ok(asked.endsWith(`\nDecision ${d}. Don't wait for it: when your owner answers, the answer comes to you as a new message. Carry on or end your turn.`), asked);
  pi.bash();
  assert.ok(holds(agent, d), 'the command\'s own wait, held as soon as the ask returned');
  pi.settle();
  assert.equal(pi.sent.length, 0, 'nothing before the answer');
  await answer('Idle, blue or red?');
  await until(async () => pi.sent.length, n => n > 0);
  const [turn] = pi.sent;
  assert.equal(turn.whileWorking, false, 'sent while pi was idle');
  assert.deepEqual(turn.options, { triggerTurn: true, deliverAs: 'followUp' }, 'a follow-up that starts a turn, never a steer into a run');
  assert.match(turn.content, new RegExp(`^AgentPager: your owner answered decision ${d} \\(agent ${agent}\\)\\. The agentpager command's reply:\\n\\nAnswered at .+: option A "Blue"\\.\\nDo it, then confirm: agentpager ack --agent ${agent} ${d} "<what happens next>"$`));
  assert.deepEqual(decisionsOf(turn.details), [{ agent, decision: d, answered: true }]);
  const picked = await until(() => seen('Idle, blue or red?'), x => x?.collectedAt !== undefined);
  assert.equal(picked?.warnedAt, undefined, 'picked up once the turn started, so never warned');
  assert.equal(Reflect.get(Object(record(agent)), 'decisions')[0].state, 'answered', 'and recorded here as answered');
  assert.equal(holds(agent, d), false, 'the wait has ended');
  // It isn't handed over again, however often pi looks.
  pi.settle(); pi.bash(); pi.settle();
  assert.equal(pi.sent.length, 1);
  assert.equal((await shell('s-idle', ['ack', '--agent', agent, d, 'Going blue.'])).code, 0);
  pi.bash();
  assert.equal(pi.sent.length, 1);
  pi.shutdown();
  assert.equal(process.env.AGENTPAGER_WAKE, undefined, 'cleared when the session ends');
});

test('B33.5 After a move to another point of the session\'s tree, a decision still waiting on the agent whose reply only the branch left behind holds is handed over again on this one, and never twice on a branch; once acknowledged, nothing is', { timeout: 90_000 }, async () => {
  const pi = standIn('tui', 's-tree');
  // This pi can be told not to start the next follow-up it is sent (its run failed to begin).
  const realSend = pi.pi.sendMessage.bind(pi.pi);
  let drop = false;
  pi.pi.sendMessage = (message, options) => { if (drop) { drop = false; pi.sent.push({ content: message.content, details: message.details, options, whileWorking: false }); return; } realSend(message, options); };
  pi.start({ ...fast, confirmMs: 300 });
  const { agent, d } = await asks('s-tree', 'Tree, blue or red?');
  pi.bash();
  await answer('Tree, blue or red?');
  await until(async () => pi.sent.length, n => n === 1);
  await until(() => seen('Tree, blue or red?'), x => x?.collectedAt !== undefined);
  pi.settle();
  // The owner goes back to before the reply, and returns to the branch that holds it before the wait held for the other
  // has ended: that wait's reply isn't handed over, since this branch has it.
  const withReply = pi.branch();
  pi.navigate(0);
  assert.ok(holds(agent, d), 'held again for the branch without the reply');
  pi.back(withReply);
  await until(async () => holds(agent, d), held => !held);
  await new Promise(res => setTimeout(res, 500));
  pi.settle();
  assert.equal(pi.sent.length, 1, 'not again on the branch that holds it');
  assert.equal(holds(agent, d), false);
  // The same with the follow-up sent and not started by pi when the owner returns: it isn't sent again there.
  drop = true;
  pi.navigate(0);
  await until(async () => pi.sent.length, n => n === 2);
  pi.back(withReply);
  await new Promise(res => setTimeout(res, 1_500));
  pi.settle();
  assert.equal(pi.sent.length, 2, 'a follow-up pi never started isn\'t sent again on the branch that holds the reply');
  // The owner goes back and prompts at once, and the agent there reads the answer with a wait of its own before pi
  // settles: the record counts that read, so the reply held for this branch isn't handed over as well.
  assert.equal(Reflect.get(Object(record(agent)), 'decisions')[0].reads, undefined, 'the extension\'s own steps aren\'t the agent\'s reads');
  pi.navigate(0);
  pi.prompt();
  assert.match((await shell('s-tree', ['wait', '--agent', agent, d])).text, /^Answered at .+: option A "Blue"/);
  assert.equal(Reflect.get(Object(record(agent)), 'decisions')[0].reads, 1);
  await until(async () => holds(agent, d), held => !held);
  await new Promise(res => setTimeout(res, 500));
  pi.settle();
  assert.equal(pi.sent.length, 2, 'the agent on this branch has read it by itself');
  assert.equal(holds(agent, d), false);
  // The read is noted in the session, on this branch, so the reply isn't handed over there later either: not when the
  // owner leaves and returns, and not when pi starts again on it.
  const readThere = pi.branch();
  assert.deepEqual(readThere.at(-1), { type: 'custom', customType: TYPE, data: { read: [{ agent, decision: d }] } });
  pi.back(withReply); pi.settle();
  pi.back(readThere);
  assert.equal(holds(agent, d), false, 'no wait held on the return');
  pi.settle();
  const resumed = standIn('tui', 's-tree', pi.entries, readThere);
  resumed.start();
  assert.equal(holds(agent, d), false, 'nor at the next start on that branch');
  resumed.settle(); resumed.shutdown();
  assert.equal(pi.sent.length + resumed.sent.length, 2);
  // Before the agent acknowledges it, the owner goes back to before the reply again: the agent there hasn't had it,
  // whatever was read on a branch left behind.
  pi.navigate(0);
  await until(async () => pi.sent.length, n => n === 3);
  assert.equal(pi.sent[2].content, pi.sent[0].content, 'the same reply, on this branch');
  assert.deepEqual(decisionsOf(pi.sent[2].details), [{ agent, decision: d, answered: true }]);
  pi.settle();
  // Moving within the branch that holds it hands nothing over.
  pi.navigate(1); pi.settle();
  assert.equal(pi.sent.length, 3);
  assert.equal((await shell('s-tree', ['ack', '--agent', agent, d, 'Blue, then.'])).code, 0);
  pi.navigate(0); pi.settle();
  assert.equal(holds(agent, d), false);
  assert.equal(pi.sent.length, 3, 'acknowledged: nothing more');
  pi.shutdown();

  // A pickup that hasn't landed and is to run again later (here it never lands) doesn't keep the wait from being held
  // on a branch without the reply.
  const unpicked = path.join(bin, 'tree-no-pickup-lands');
  writeFileSync(unpicked, `#!/bin/sh\nif [ "$1" = pickup ]; then echo 'not JSON'; exit 5; fi\nexec ${command.map(c => `'${c}'`).join(' ')} "$@"\n`);
  chmodSync(unpicked, 0o755);
  const owed = standIn('tui', 's-tree-owed');
  owed.start({ ...fast, command: [unpicked], retryMs: 60_000 });
  const o = await asks('s-tree-owed', 'Tree, owed a pickup?');
  owed.bash();
  await answer('Tree, owed a pickup?');
  await until(async () => owed.sent.length, n => n === 1);
  await until(async () => pickups().length, n => n === 0);
  await new Promise(res => setTimeout(res, 500));
  owed.settle();
  owed.navigate(0);
  await until(async () => owed.sent.length, n => n === 2, 10_000);
  assert.deepEqual(decisionsOf(owed.sent[1].details), [{ agent: o.agent, decision: o.d, answered: true }]);
  owed.settle(); owed.shutdown();
});

test('B33.5 B32.12 While pi works the answer waits, never going into the run and not yet picked up: it goes in once pi has settled with nothing queued; one the agent read by itself meanwhile, acknowledged or not, isn\'t handed over', { timeout: 60_000 }, async () => {
  const pi = standIn('tui', 's-busy');
  pi.start();
  const first = await asks('s-busy', 'Busy, blue or red?'), second = await asks('s-busy', 'Busy, read by itself?'), third = await asks('s-busy', 'Busy, read and not acknowledged?');
  pi.bash();
  pi.prompt();
  await answer('Busy, blue or red?', { kind: 'feedback', text: 'Red, and keep it quiet' });
  await answer('Busy, read by itself?');
  await answer('Busy, read and not acknowledged?', { kind: 'option', number: 2 });
  // Each wait has its reply and has ended, while pi works; none is picked up.
  await until(async () => holds(first.agent, first.d) || holds(second.agent, second.d) || holds(third.agent, third.d), held => !held);
  assert.equal(pi.sent.length, 0, 'nothing goes into a run');
  assert.equal((await seen('Busy, blue or red?'))?.collectedAt, undefined, 'not picked up while it waits for pi');
  // The agent reads the second itself, and acknowledges it.
  assert.match((await shell('s-busy', ['wait', '--agent', second.agent, second.d])).text, /^Answered at/);
  assert.equal((await shell('s-busy', ['ack', '--agent', second.agent, second.d, 'Blue it is.'])).code, 0);
  // And reads the third with a wait of its own, without acknowledging it yet: it has that answer too.
  assert.equal((await seen('Busy, read and not acknowledged?'))?.collectedAt, undefined);
  assert.match((await shell('s-busy', ['wait', '--agent', third.agent, third.d])).text, /^Answered at .+: option B "Red"/);
  assert.equal(Reflect.get(Object(record(third.agent)), 'decisions')[0].state, 'answered');
  pi.queue(true);
  pi.settle();
  assert.equal(pi.sent.length, 0, 'a message the owner queued goes first');
  pi.queue(false);
  pi.prompt(); pi.settle();
  assert.equal(pi.sent.length, 1);
  const [turn] = pi.sent;
  assert.equal(turn.whileWorking, false);
  assert.deepEqual(decisionsOf(turn.details), [{ agent: first.agent, decision: first.d, answered: true }], 'only the one the agent hasn\'t read');
  assert.match(turn.content, /Your owner wrote instead of choosing, at .+:\n {2}"Red, and keep it quiet"/);
  await until(() => seen('Busy, blue or red?'), x => x?.collectedAt !== undefined);
  pi.settle();
  assert.equal(pi.sent.length, 1);
  pi.shutdown();
});

test('B33.5 B32.12 An answer that comes while pi is busy with no run going, compacting or moving within its tree, is handed over once pi is idle again, though no event says so, and once only', { timeout: 60_000 }, async () => {
  const pi = standIn('tui', 's-compacting');
  pi.start();
  const first = await asks('s-compacting', 'Compacting, blue or red?');
  pi.bash();
  // The owner compacts the session, and answers while pi is at it.
  pi.compacting(true);
  await answer('Compacting, blue or red?');
  await until(async () => holds(first.agent, first.d), held => !held);
  await new Promise(res => setTimeout(res, 700));
  assert.equal(pi.sent.length, 0, 'nothing while pi compacts');
  assert.equal((await seen('Compacting, blue or red?'))?.collectedAt, undefined, 'and not picked up');
  // The compaction ends. pi says nothing to the extension, which finds pi idle when it next looks.
  pi.compacting(false);
  await until(async () => pi.sent.length, n => n === 1, 5_000);
  assert.equal(pi.sent[0].whileWorking, false);
  assert.deepEqual(pi.sent[0].options, { triggerTurn: true, deliverAs: 'followUp' });
  assert.deepEqual(decisionsOf(pi.sent[0].details), [{ agent: first.agent, decision: first.d, answered: true }]);
  await until(() => seen('Compacting, blue or red?'), x => x?.collectedAt !== undefined);
  pi.settle();
  // The same during a move within the tree: the answer comes while pi summarizes the branch it leaves, and the move's
  // event comes before pi is idle again.
  const second = await asks('s-compacting', 'Moving, blue or red?');
  pi.bash();
  pi.compacting(true);
  await answer('Moving, blue or red?', { kind: 'option', number: 2 });
  await until(async () => holds(second.agent, second.d), held => !held);
  pi.navigate(pi.branch().length);
  await new Promise(res => setTimeout(res, 700));
  assert.equal(pi.sent.length, 1, 'nothing while pi isn\'t idle');
  pi.compacting(false);
  await until(async () => pi.sent.length, n => n === 2, 5_000);
  assert.deepEqual(decisionsOf(pi.sent[1].details), [{ agent: second.agent, decision: second.d, answered: true }]);
  assert.match(pi.sent[1].content, /option B "Red"/);
  await until(() => seen('Moving, blue or red?'), x => x?.collectedAt !== undefined);
  await new Promise(res => setTimeout(res, 700));
  pi.settle(); pi.bash(); pi.settle();
  assert.equal(pi.sent.length, 2, 'each once');
  pi.shutdown();
});

test('B33.5 B32.12 Each answer goes in once across restarts of the same session: one handed over isn\'t again, and its pickup, if it hadn\'t landed, runs at the next start; one pi stopped before handing over is picked up by nothing and comes at the next start; another session\'s or app\'s decisions are never held', { timeout: 120_000 }, async () => {
  // Handed over, then pi restarts on the same session: nothing again.
  const entries: unknown[] = [];
  const one = standIn('tui', 's-again', entries);
  one.start();
  const a = await asks('s-again', 'Again, blue or red?');
  one.bash();
  await answer('Again, blue or red?');
  await until(async () => one.sent.length, n => n === 1);
  await until(() => seen('Again, blue or red?'), x => x?.collectedAt !== undefined);
  one.settle(); one.shutdown();
  const two = standIn('tui', 's-again', entries);
  two.start();
  assert.equal(holds(a.agent, a.d), false, 'answered and in the session already');
  two.settle();
  assert.equal(two.sent.length, 0);
  two.shutdown();

  // Handed over, but its pickup can't land (the service is away for it) before pi stops: the next start picks it up,
  // and hands nothing over again.
  const unpicked = path.join(bin, 'no-pickup-lands');
  writeFileSync(unpicked, `#!/bin/sh\nif [ "$1" = pickup ]; then echo 'not JSON'; exit 5; fi\nexec ${command.map(c => `'${c}'`).join(' ')} "$@"\n`);
  chmodSync(unpicked, 0o755);
  const owedEntries: unknown[] = [];
  const handed = standIn('tui', 's-owed', owedEntries);
  handed.start({ ...fast, command: [unpicked] });
  const o = await asks('s-owed', 'Owed a pickup?');
  handed.bash();
  await answer('Owed a pickup?');
  await until(async () => handed.sent.length, n => n === 1);
  handed.settle(); handed.shutdown();
  assert.equal((await seen('Owed a pickup?'))?.collectedAt, undefined, 'its pickup never landed');
  const owing = standIn('tui', 's-owed', owedEntries);
  owing.start();
  await until(() => seen('Owed a pickup?'), x => x?.collectedAt !== undefined);
  assert.equal(holds(o.agent, o.d), false);
  owing.settle();
  assert.equal(owing.sent.length, 0, 'not handed over again');
  owing.shutdown();

  // Collected while pi worked, and pi stopped before it settled: nothing picked it up, so the owner is warned, and the
  // next start of the session holds its wait again and hands it over.
  const kept: unknown[] = [];
  const busy = standIn('tui', 's-stopped', kept);
  busy.start();
  const b = await asks('s-stopped', 'Stopped, blue or red?');
  busy.bash(); busy.prompt();
  const sent = await answer('Stopped, blue or red?', { kind: 'option', number: 2 });
  await until(async () => holds(b.agent, b.d), held => !held);
  busy.shutdown();
  assert.equal(busy.sent.length, 0);
  const warned = await until(() => seen('Stopped, blue or red?'), x => x?.warnedAt !== undefined, 20_000);
  assert.equal(warned?.collectedAt, undefined, 'never picked up');
  assert.ok(warned?.warnedAt && Date.parse(warned.warnedAt) - Date.parse(sent.sentAt) >= PICKUP_MS);
  const back = standIn('tui', 's-stopped', kept);
  back.start();
  await until(async () => back.sent.length, n => n === 1);
  assert.match(back.sent[0].content, /option B "Red"/);
  assert.deepEqual(decisionsOf(back.sent[0].details), [{ agent: b.agent, decision: b.d, answered: true }]);
  await until(() => seen('Stopped, blue or red?'), x => x?.collectedAt !== undefined);
  back.settle(); back.shutdown();
  const third = standIn('tui', 's-stopped', kept);
  third.start(); third.settle();
  assert.equal(third.sent.length, 0, 'once, even then');
  third.shutdown();

  // A wait refused for good (here a stand-in says so, as for an answer that doesn't open): the refusal is handed over,
  // and nothing is ever picked up for it, then or at the next start, though the owner has answered meanwhile.
  const refusing = path.join(bin, 'refuses-once'), refusedFlag = path.join(work, 'refuses-once.done');
  writeFileSync(refusing, `#!/bin/sh\nif [ "$1" = wait ] && [ ! -e ${refusedFlag} ]; then : > ${refusedFlag}; echo '{"code":2,"text":"Refused: not this time."}'; exit 2; fi\nexec ${command.map(c => `'${c}'`).join(' ')} "$@"\n`);
  chmodSync(refusing, 0o755);
  const refusedEntries: unknown[] = [];
  const told = standIn('tui', 's-refused', refusedEntries);
  told.start({ ...fast, command: [refusing] });
  const r = await asks('s-refused', 'Refused, then answered?');
  told.bash();
  await until(async () => told.sent.length, n => n === 1);
  assert.match(told.sent[0].content, new RegExp(`^AgentPager: the wait for decision ${r.d} \\(agent ${r.agent}\\) ended without an answer it could give you\\. The agentpager command's reply:\\n\\nRefused: not this time\\.$`));
  assert.deepEqual(decisionsOf(told.sent[0].details), [{ agent: r.agent, decision: r.d, answered: false }]);
  told.settle(); told.shutdown();
  await answer('Refused, then answered?');
  const after = standIn('tui', 's-refused', refusedEntries);
  after.start();
  assert.equal(holds(r.agent, r.d), false);
  assert.equal(waits().filter(w => w.command.includes(` ${r.d} `)).length + pickups().filter(x => x.endsWith(` pickup --agent ${r.agent} ${r.d} --json`)).length, 0, 'neither held nor picked up');
  after.settle(); after.shutdown();

  // Another pi session's decision, and a Claude Code session's, are never held here.
  const mine = standIn('tui', 's-mine');
  mine.start();
  const other = await asks('s-other', 'Another session\'s?', { AGENTPAGER_WAKE: 'pi:s-other' });
  const claude = await asks('s-mine', 'Claude Code\'s?', { AGENTPAGER_WAKE: 'claude-code:s-mine', CLAUDECODE: '1', PI_CODING_AGENT: '', PI_SESSION_ID: '' });
  assert.equal(Reflect.get(Object(record(other.agent)), 'decisions')[0].wake.session, 's-other');
  mine.bash();
  assert.equal(holds(other.agent, other.d), false);
  assert.equal(holds(claude.agent, claude.d), false);
  const own = await asks('s-mine', 'Mine, blue or red?');
  mine.bash();
  assert.ok(holds(own.agent, own.d));
  await answer('Another session\'s?'); await answer('Claude Code\'s?'); await answer('Mine, blue or red?');
  await until(async () => mine.sent.length, n => n === 1);
  assert.deepEqual(decisionsOf(mine.sent[0].details), [{ agent: own.agent, decision: own.d, answered: true }]);
  await until(() => seen('Mine, blue or red?'), x => x?.collectedAt !== undefined);
  assert.equal((await seen('Another session\'s?'))?.collectedAt, undefined, 'another session\'s answer was never picked up here');
  mine.settle(); mine.shutdown();
});

test('B33.5 B32.12 A wait or a pickup that ends without landing, with the pager off, the service away or the command not found at first, is run again later, and a follow-up pi didn\'t start is sent again before anything is picked up, without an answer the agent has read by itself since', { timeout: 60_000 }, async () => {
  // The first wait is told the pager is off, and the first pickup gets no usable reply; the next of each is the
  // command's own.
  const flaky = path.join(bin, 'flaky'), offFlag = path.join(work, 'flaky-off.done'), awayFlag = path.join(work, 'flaky-away.done');
  writeFileSync(flaky, `#!/bin/sh\nif [ "$1" = wait ] && [ ! -e ${offFlag} ]; then : > ${offFlag}; echo '{"code":4,"text":"Your owner\\u0027s pager is off."}'; exit 4; fi\nif [ "$1" = pickup ] && [ ! -e ${awayFlag} ]; then : > ${awayFlag}; echo '{"code":5,"text":"No reply.","result":{"status":"try-again"}}'; exit 5; fi\nexec ${command.map(c => `'${c}'`).join(' ')} "$@"\n`);
  chmodSync(flaky, 0o755);
  const off = standIn('tui', 's-off');
  off.start({ ...fast, command: [flaky] });
  const a = await asks('s-off', 'Off, then on?');
  off.bash();
  await until(async () => holds(a.agent, a.d), held => held, 10_000);
  await answer('Off, then on?');
  await until(async () => off.sent.length, n => n === 1);
  await until(() => seen('Off, then on?'), x => x?.collectedAt !== undefined);
  assert.ok(readFileSync(awayFlag, 'utf8') === '', 'its first pickup failed, and the next landed');
  off.settle(); off.shutdown();

  // The command isn't there when the session starts: the owner sees one line, and the wait is held once it is.
  const later = path.join(bin, 'agentpager-later');
  const missing = standIn('tui', 's-missing');
  missing.start({ ...fast, command: [later] });
  const b = await asks('s-missing', 'Missing, then found?');
  missing.bash();
  await until(async () => missing.notes.length, n => n === 1);
  assert.equal(missing.notes[0], 'AgentPager couldn\'t run the agentpager command to wait for your owner\'s answer (ENOENT). It keeps trying.');
  writeFileSync(later, `#!/bin/sh\nexec ${command.map(c => `'${c}'`).join(' ')} "$@"\n`);
  chmodSync(later, 0o755);
  await until(async () => holds(b.agent, b.d), held => held, 10_000);
  await answer('Missing, then found?');
  await until(async () => missing.sent.length, n => n === 1);
  assert.equal(missing.notes.length, 1);
  missing.settle(); missing.shutdown();

  // pi takes the follow-up but doesn't start it, three times (its run failed to begin): nothing is picked up until it
  // is sent again, each time a while longer after, and starts.
  const dropping = standIn('tui', 's-dropped');
  const realSend = dropping.pi.sendMessage.bind(dropping.pi);
  let drops = 3;
  dropping.pi.sendMessage = (message, options) => { if (drops > 0) { drops--; dropping.sent.push({ content: message.content, details: message.details, options, whileWorking: false }); return; } realSend(message, options); };
  dropping.start({ ...fast, confirmMs: 300 });
  const c = await asks('s-dropped', 'Dropped, then sent?');
  dropping.bash();
  await answer('Dropped, then sent?');
  await until(async () => dropping.sent.length, n => n === 1);
  assert.equal((await seen('Dropped, then sent?'))?.collectedAt, undefined, 'not picked up: the turn never started');
  await until(async () => dropping.sent.length, n => n === 4);
  assert.equal(dropping.sent[0].content, dropping.sent[3].content);
  assert.deepEqual(decisionsOf(dropping.sent[3].details), [{ agent: c.agent, decision: c.d, answered: true }]);
  await until(() => seen('Dropped, then sent?'), x => x?.collectedAt !== undefined);
  dropping.settle(); dropping.shutdown();

  // pi doesn't start the follow-up, the owner starts a turn of their own, and in it the agent reads one answer with a
  // wait of its own and reads and acknowledges another: when pi settles, neither is sent again, only the one it hasn't read.
  const unread = standIn('tui', 's-dropped-read');
  const send = unread.pi.sendMessage.bind(unread.pi);
  let dropped = 1;
  unread.pi.sendMessage = (message, options) => { if (dropped > 0) { dropped--; unread.sent.push({ content: message.content, details: message.details, options, whileWorking: false }); return; } send(message, options); };
  unread.start({ ...fast, confirmMs: 60_000 });
  const x = await asks('s-dropped-read', 'Dropped, then read?'), y = await asks('s-dropped-read', 'Dropped, then acknowledged?'), z = await asks('s-dropped-read', 'Dropped, and not read?');
  unread.bash(); unread.prompt();
  await answer('Dropped, then read?'); await answer('Dropped, then acknowledged?'); await answer('Dropped, and not read?');
  await until(async () => holds(x.agent, x.d) || holds(y.agent, y.d) || holds(z.agent, z.d), held => !held);
  unread.settle();
  assert.equal(unread.sent.length, 1, 'all three in one follow-up, which pi doesn\'t start');
  assert.equal(decisionsOf(unread.sent[0].details).length, 3);
  unread.prompt();
  assert.match((await shell('s-dropped-read', ['wait', '--agent', x.agent, x.d])).text, /^Answered at/);
  assert.match((await shell('s-dropped-read', ['wait', '--agent', y.agent, y.d])).text, /^Answered at/);
  assert.equal((await shell('s-dropped-read', ['ack', '--agent', y.agent, y.d, 'Done.'])).code, 0);
  unread.settle();
  assert.equal(unread.sent.length, 2);
  assert.deepEqual(decisionsOf(unread.sent[1].details), [{ agent: z.agent, decision: z.d, answered: true }], 'only the one the agent hasn\'t read');
  await until(() => seen('Dropped, and not read?'), q => q?.collectedAt !== undefined);
  unread.settle(); unread.shutdown();
});

test('B33.5 B32.12 Every wait it holds stops when the session shuts down, and when pi exits without saying so; one left behind when pi is killed picks nothing up, so the owner is warned', { timeout: 90_000 }, async () => {
  const pi = standIn('tui', 's-down');
  pi.start();
  const a = await asks('s-down', 'Shut down, blue?'), b = await asks('s-down', 'Shut down, red?');
  pi.bash();
  const held = waits().filter(w => w.command.includes(` ${a.d} `) || w.command.includes(` ${b.d} `));
  assert.equal(held.length, 2);
  pi.shutdown();
  for (const w of held) await until(async () => alive(w.pid), up => !up, 5_000);
  pi.bash();
  assert.deepEqual(waits().filter(w => w.command.includes(` ${a.d} `) || w.command.includes(` ${b.d} `)), [], 'none held after');
  // A pi that exits without its shutdown event, as when its terminal is gone; and one killed outright.
  const script = (session: string, exits: boolean) => {
    const file = path.join(work, `${session}.ts`);
    writeFileSync(file, `import { agentpagerWake } from ${JSON.stringify(fileURLToPath(new URL('../src/index.ts', import.meta.url)))};
const handlers = {};
const ctx = { mode: 'tui', hasUI: false, isIdle: () => true, hasPendingMessages: () => false, sessionManager: { getSessionId: () => ${JSON.stringify(session)}, getEntries: () => [] }, ui: { notify() {} } };
agentpagerWake({ on: (e, h) => { handlers[e] = h; }, sendMessage() {}, appendEntry() {} }, { command: ${JSON.stringify(command)} });
handlers.session_start({}, ctx);
handlers.tool_result({ toolName: 'bash' }, ctx);
${exits ? 'setTimeout(() => process.exit(0), 500);' : 'setInterval(() => {}, 1000);'}
`);
    return file;
  };
  const theirs = async (parent: number | undefined, agent: string, d: string) => Number((await until(async () => waits(parent).find(w => w.command.endsWith(` wait --agent ${agent} ${d} --no-pickup --json`)), w => w !== undefined, 10_000))?.pid);
  const c = await asks('s-exits', 'Exits, blue?', { AGENTPAGER_WAKE: 'pi:s-exits' });
  const exiting = spawn(process.execPath, ['--experimental-strip-types', script('s-exits', true)], { stdio: 'ignore', env: process.env });
  const pid = await theirs(exiting.pid, c.agent, c.d);
  await new Promise(res => exiting.on('exit', res));
  await until(async () => alive(pid), up => !up, 5_000);

  // Killed outright, the extension can't stop its wait: the wait has the answer, but picks nothing up.
  const k = await asks('s-killed', 'Killed, blue?', { AGENTPAGER_WAKE: 'pi:s-killed' });
  const killed = spawn(process.execPath, ['--experimental-strip-types', script('s-killed', false)], { stdio: 'ignore', env: process.env, detached: true });
  const orphan = await theirs(killed.pid, k.agent, k.d);
  killed.kill('SIGKILL');
  await new Promise(res => killed.on('exit', res));
  assert.ok(alive(orphan), 'its wait is left running');
  const sent = await answer('Killed, blue?');
  await until(async () => alive(orphan), up => !up, 10_000);
  const warned = await until(() => seen('Killed, blue?'), x => x?.warnedAt !== undefined, 20_000);
  assert.equal(warned?.collectedAt, undefined, 'it had the answer and picked nothing up');
  assert.ok(warned?.warnedAt && Date.parse(warned.warnedAt) - Date.parse(sent.sentAt) >= PICKUP_MS, 'so the owner is warned');
});
