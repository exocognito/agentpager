import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMAND, LINE, Mod, SETTLE_MS, TICK_MS, decodeRecord, homeOf, isCommand, outcomeOf, turnText, wakesHere } from '../hooks/wake.ts';
import { record, reply, standIn, type StandIn } from './stand-in.ts';

// The Claude Code plugin's mod (B33.2, blueprint/areas/2-agents.md) with a stand-in for Claude Code (stand-in.ts):
// whether it names the session, which decisions it holds the command's wait for, and when and how often it hands an
// answer over as a turn. e2e.test.ts runs it against the real command and service.

const HOME = '/home/sam/.agentpager', A = 'ap-7f3k', B = 'ap-9k2m';
const waiting = (agent: string) => `${HOME}/waiting/${agent}.json`;
const claim = (agent: string, d: string) => `${HOME}/claude-code/${agent}.${d}`;
const mine = (session = 'session-1') => ({ app: 'claude-code' as const, session });
const waitFor = (agent: string, d: string) => [COMMAND, 'wait', '--agent', agent, d, '--json'];
const ANSWER = 'Answered at 11:15 AM: option B "Green".\nDo it, then confirm: agentpager ack --agent ap-7f3k d_2x8w "<what happens next>"';

async function started(h: StandIn) {
  const mod = new Mod(h, HOME);
  // A turn the mod submits starts as Claude Code starts one: the main loop is busy until the test ends it.
  h.started = async () => { await mod.turnStarted(); };
  await mod.start();
  return mod;
}

test('B33.2 The plugin names the session to the command only where it can start a turn: never in claude -p, an SDK run such as the Code tab, on Windows, or without the command', () => {
  const at = { isInteractive: true, hasShell: true, command: true, home: HOME };
  assert.equal(wakesHere(at), true);
  assert.equal(wakesHere({ ...at, isInteractive: false }), false, 'claude -p, or the SDK');
  assert.equal(wakesHere({ ...at, hasShell: false }), false, 'Windows');
  assert.equal(wakesHere({ ...at, command: false }), false, 'no agentpager command on PATH');
  assert.equal(wakesHere({ ...at, home: null }), false);
  assert.equal(homeOf('/tmp/ap/', '/home/sam'), '/tmp/ap');
  assert.equal(homeOf(undefined, '/home/sam'), HOME);
  assert.equal(homeOf('', undefined), null);
  assert.equal(isCommand({ exitCode: 0, stdout: 'agentpager 9849671\n' }), true);
  assert.equal(isCommand({ exitCode: 0, stdout: 'something else\n' }), false);
  assert.equal(isCommand({ exitCode: 127, stdout: '' }), false);
});

test('B33.2 The session is named to the command in AGENTPAGER_WAKE, and named again before the first turn after a /clear', async () => {
  const h = standIn('session-1');
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine('session-1') }]));
  const mod = await started(h);
  assert.deepEqual(h.wake, ['claude-code:session-1']);
  assert.deepEqual(h.running().map(c => c.argv), [waitFor(A, 'd_2x8w')]);
  // A /clear: the conversation goes on under another session, and its first turn names it before any command runs.
  mod.sessionEnded('clear');
  assert.deepEqual(h.running(), [], 'the old session\'s waits stop');
  h.session = 'session-2';
  await mod.turnStarted();
  assert.deepEqual(h.wake, ['claude-code:session-1', 'claude-code:session-2']);
  await h.advance(TICK_MS * 3);
  assert.deepEqual(h.running(), [], 'the old session\'s decisions wait for it to be resumed');
  // A session id the command wouldn't take unsets the variable, and nothing is held.
  h.session = 'not a session';
  await h.advance(TICK_MS);
  assert.deepEqual(h.wake.at(-1), undefined);
  assert.equal(mod.named, null);
  // Where Claude Code refuses the variable (an organization's settings), the mod holds nothing, and the command, not
  // seeing it, words the background wait.
  const refused = standIn('session-1');
  refused.setWake = async value => { refused.wake.push(value); return value === undefined; };
  refused.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine('session-1') }]));
  const off = await started(refused);
  assert.equal(off.named, null);
  assert.deepEqual(refused.running(), []);
});

test('B33.2 An answer comes as a new turn as soon as Claude is idle, carrying the command\'s reply, found from the record alone', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  const mod = await started(h);
  const [child] = h.running();
  assert.deepEqual(child?.argv, waitFor(A, 'd_2x8w'), 'the command\'s own wait, which picks the answer up (B32.12)');
  await h.advance(30_000);
  assert.deepEqual(h.turns, [], 'nothing before the owner answers');
  const at = h.t;
  child?.exit(reply.answered(ANSWER));
  await h.advance(0);
  assert.equal(h.t, at, 'no time passes on the mod\'s side');
  assert.deepEqual(h.turns, [turnText(A, 'd_2x8w', { answered: true, text: ANSWER })]);
  assert.equal(h.turns[0], `AgentPager: your owner answered decision d_2x8w (agent ${A}). The agentpager command's reply:\n\n${ANSWER}`);
  assert.ok(h.dirs.has(claim(A, 'd_2x8w')), 'claimed before it went');
  assert.ok(!h.logs.some(l => l.includes('Green')), 'the answer is in no log line');
  await mod.turnEnded();
  await h.advance(TICK_MS * 5);
  assert.equal(h.turns.length, 1, 'once');
  assert.deepEqual(h.running(), [], 'and no wait is held for it again');
});

test('B33.2 When Claude is busy the answer waits for the running turn to end, and a prompt the person queued goes first; never into a running turn', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  const mod = await started(h);
  await mod.turnStarted();
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(40_000);
  assert.deepEqual(h.turns, [], 'not while the turn runs');
  await mod.turnEnded();
  await h.advance(SETTLE_MS - 1);
  assert.deepEqual(h.turns, [], 'a moment for a prompt the person queued');
  // The person's queued prompt starts the next turn: the answer waits for that one too.
  await mod.turnStarted();
  await h.advance(10_000);
  assert.deepEqual(h.turns, []);
  await mod.turnEnded();
  const ended = h.t;
  await h.advance(SETTLE_MS);
  assert.equal(h.turns.length, 1, 'the next turn');
  assert.equal(h.t - ended, SETTLE_MS);
});

test('B33.2 Only this session\'s decisions are held: never another session\'s, another app\'s, one asked without the plugin, or one in a file that isn\'t a record', async () => {
  const h = standIn('session-1');
  h.write(waiting(A), record(A, [
    { decision: 'd_aaaa', wake: mine('session-1') },
    { decision: 'd_bbbb', wake: mine('session-2') },
    { decision: 'd_cccc', wake: { app: 'pi', session: 'session-1' } },
    { decision: 'd_dddd', wake: { app: 'codex', thread: '01a1bcce-75de-7fb0-8877-d5ce6682e9aa' } },
    { decision: 'd_eeee' },
  ]));
  h.write(waiting(B), record(B, [{ decision: 'd_ffff', wake: mine('session-1') }]));
  // A record under another agent's name, one from a newer command, and a half-written one are read as nothing.
  h.write(`${HOME}/waiting/ap-zzzz.json`, record(A, [{ decision: 'd_gggg', wake: mine('session-1') }]));
  h.write(`${HOME}/waiting/ap-yyyy.json`, JSON.stringify({ version: 2, agent: 'ap-yyyy', decisions: [{ decision: 'd_hhhh', state: 'waiting', wake: mine('session-1') }] }));
  h.write(`${HOME}/waiting/ap-xxxx.json`, '{"version": 1, "agent": "ap-xx');
  h.write(`${HOME}/waiting/ap-wwww.json.4242.tmp`, record('ap-wwww', [{ decision: 'd_iiii', wake: mine('session-1') }]));
  await started(h);
  assert.deepEqual(h.running().map(c => c.argv).sort(), [waitFor(A, 'd_aaaa'), waitFor(B, 'd_ffff')].sort());
  assert.equal(decodeRecord('ap-zzzz', record(A, [])), null);
  assert.deepEqual(decodeRecord(A, record(A, [{ decision: 'd_aaaa', state: 'answered', wake: mine('s') }, { decision: 'd_bbbb' }])), { agent: A, decisions: [{ decision: 'd_aaaa', session: 's' }, { decision: 'd_bbbb', session: null }] });
  for (const bad of [{ decision: '../x', state: 'waiting' }, { decision: 'd_aaaa', state: 'done' }, 'd_aaaa']) assert.equal(decodeRecord(A, JSON.stringify({ version: 1, agent: A, decisions: [bad] })), null);
});

test('B33.2 Each answer is handed over once, across a restart of Claude Code and by a second Claude Code on the session, and its claim goes once the decision leaves the record', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }, { decision: 'd_9k2m', wake: mine() }]));
  // Two processes on one session (claude --continue while the first still runs).
  const one = await started(h), two = await started(h);
  assert.equal(h.running().length, 4);
  for (const c of h.running().filter(c => c.argv[4] === 'd_2x8w')) c.exit(reply.answered(ANSWER));
  await h.advance(0);
  assert.deepEqual(h.turns, [turnText(A, 'd_2x8w', { answered: true, text: ANSWER })], 'one turn between them');
  // Claude Code quits before the owner answers the other, and comes back: the claim stands, so the first isn't
  // handed over again, and the other is held again.
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', state: 'answered', wake: mine() }, { decision: 'd_9k2m', wake: mine() }]));
  one.sessionEnded('prompt_input_exit'); two.sessionEnded('prompt_input_exit');
  assert.deepEqual(h.running(), [], 'quitting stops every wait');
  const again = await started(h);
  assert.deepEqual(h.running().map(c => c.argv), [waitFor(A, 'd_9k2m')]);
  // Answered while Claude Code was closed: the wait comes back with it at once, and it goes as the first turn.
  h.running()[0]?.exit(reply.answered('Answered at 11:20 AM: option A "Blue".'));
  await h.advance(0);
  assert.equal(h.turns.length, 2);
  assert.match(h.turns[1] ?? '', /decision d_9k2m .*\n\nAnswered at 11:20 AM: option A "Blue"\./s);
  await again.turnEnded();
  // The agent acknowledges both: they leave the record, and so do their claims.
  h.write(waiting(A), record(A, []));
  await h.advance(TICK_MS);
  assert.ok(!h.dirs.has(claim(A, 'd_2x8w')) && !h.dirs.has(claim(A, 'd_9k2m')));
  await h.advance(TICK_MS * 5);
  assert.equal(h.turns.length, 2);
});

test('B33.2 An answer the agent has already acknowledged, having waited for it itself, isn\'t handed over as well', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  const mod = await started(h);
  // The agent ran today's background wait anyway: it woke the agent first, and the mod's wait got the answer too.
  await mod.turnStarted();
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(0);
  h.write(waiting(A), record(A, []));
  await mod.turnEnded();
  await h.advance(SETTLE_MS + TICK_MS);
  assert.deepEqual(h.turns, []);
  assert.deepEqual(mod.held, []);
});

test('B33.2 A turn Claude Code didn\'t take gives its claim back and is offered again after the person\'s next turn, so it is never lost', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  const mod = await started(h);
  // The person stopped the session with Esc: Claude Code holds a plugin's prompts until they type.
  h.taking = { entered: false, why: 'the session was stopped and nobody has sent input since' };
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(0);
  assert.equal(h.turns.length, 1);
  assert.ok(!h.dirs.has(claim(A, 'd_2x8w')), 'the claim is given back');
  await h.advance(TICK_MS * 10);
  assert.equal(h.turns.length, 1, 'not offered again on every look');
  h.taking = { entered: true };
  await mod.turnStarted(); await mod.turnEnded();
  await h.advance(SETTLE_MS);
  assert.equal(h.turns.length, 2);
  assert.ok(h.dirs.has(claim(A, 'd_2x8w')));
  // Nor is one lost when no one types: it is offered again a minute later.
  const k = standIn();
  k.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await started(k);
  k.taking = { entered: false, why: 'held' };
  k.running()[0]?.exit(reply.answered(ANSWER));
  await k.advance(0);
  k.taking = { entered: true };
  await k.advance(60_000);
  assert.equal(k.turns.length, 2);
});

test('B33.2 B32.12 The mod holds the command\'s own wait and reads only its code and status: pending holds again, the pager off or the service out of reach tries later, no such agent stops, and a refusal is handed over', async () => {
  assert.deepEqual(outcomeOf(reply.answered(ANSWER)), { kind: 'deliver', answered: true, text: ANSWER });
  assert.deepEqual(outcomeOf(reply.pending()), { kind: 'again' });
  assert.deepEqual(outcomeOf(reply.off()), { kind: 'later', ms: 60_000 });
  assert.deepEqual(outcomeOf(reply.unreachable()), { kind: 'later', ms: 10_000 });
  assert.deepEqual(outcomeOf(reply.unknown(A)), { kind: 'stop' });
  assert.deepEqual(outcomeOf('Answered at 11:15 AM: option B "Green".'), { kind: 'later', ms: 10_000 }, 'words alone are never read as an answer');
  assert.deepEqual(outcomeOf(''), { kind: 'later', ms: 10_000 }, 'a wait that died');

  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await started(h);
  const waits = () => h.children.filter(c => c.argv[4] === 'd_2x8w').length;
  h.running()[0]?.exit(reply.pending());
  await h.advance(0);
  assert.equal(waits(), 1, 'a wait that came back at once is held again a second after it began');
  await h.advance(1_000);
  assert.equal(waits(), 2);
  await h.advance(50_000);
  h.running()[0]?.exit(reply.pending());
  await h.advance(0);
  assert.equal(waits(), 3, 'after a full hold, at once');
  h.running()[0]?.exit(reply.off());
  await h.advance(59_000);
  assert.equal(waits(), 3);
  await h.advance(1_000);
  assert.equal(waits(), 4, 'the pager off: a minute later');
  h.running()[0]?.exit(reply.unreachable());
  await h.advance(10_000);
  assert.equal(waits(), 5, 'no usable reply: 10 s later');
  h.running()[0]?.exit(reply.unknown(A));
  await h.advance(59_000);
  assert.equal(waits(), 5, 'no such agent here: not held again for a minute');
  assert.deepEqual(h.turns, []);
  await h.advance(1_000);
  const text = 'An answer to d_2x8w arrived, but it can\'t be read as your owner\'s answer to that card, so it may not be theirs. Don\'t act on it: tell your owner.';
  h.running()[0]?.exit(reply.refused(text), 2);
  await h.advance(0);
  assert.deepEqual(h.turns, [`AgentPager: about decision d_2x8w (agent ${A}), the agentpager command replied:\n\n${text}`]);
});

test('B33.2 When the session ends, every wait the mod holds stops, and it looks no more', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  h.write(waiting(B), record(B, [{ decision: 'd_9k2m', wake: mine() }]));
  const mod = await started(h);
  assert.equal(h.running().length, 2);
  mod.sessionEnded('prompt_input_exit');
  assert.deepEqual(h.running(), []);
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }, { decision: 'd_4hq7', wake: mine() }]));
  const before = h.children.length;
  await h.advance(TICK_MS * 5);
  assert.equal(h.children.length, before, 'nothing started after');
});

test('B33.2 The session-start line says AgentPager is there and to ask with the command, the same every time, with no number or key', () => {
  assert.equal(LINE, 'AgentPager is available on this computer: when a decision only your owner can make comes up, ask them with the agentpager command (run agentpager help to start).');
  assert.doesNotMatch(LINE, /ap1_|[A-Za-z0-9_-]{20,}|\d/);
});
