import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMAND, LINE, Mod, SETTLE_MS, TICK_MS, decodeRecord, homeOf, isCommand, outcomeOf, pickupAgainIn, turnText, wakesHere } from '../hooks/wake.ts';
import { record, reply, standIn, type StandIn } from './stand-in.ts';

// The Claude Code plugin's mod (B33.2, blueprint/areas/2-agents.md) with a stand-in for Claude Code (stand-in.ts),
// which handles a plugin's prompt as Claude Code 2.1.321 did in the real run: whether the mod names the session, which
// decisions it holds the command's wait for, and when and how often it hands an answer over as a turn. e2e.test.ts
// runs it against the real command and service.

const HOME = '/home/sam/.agentpager', A = 'ap-7f3k', B = 'ap-9k2m';
const waiting = (agent: string) => `${HOME}/waiting/${agent}.json`;
const claim = (agent: string, d: string) => `${HOME}/claude-code/${agent}.${d}`;
const mine = (session = 'session-1') => ({ app: 'claude-code' as const, session });
const waitFor = (agent: string, d: string) => [COMMAND, 'wait', '--agent', agent, d, '--no-pickup', '--json'];
const pickupOf = (agent: string, d: string) => [COMMAND, 'pickup', '--agent', agent, d, '--json'];
const ANSWER = 'Answered at 11:15 AM: option B "Green".\nDo it, then confirm: agentpager ack --agent ap-7f3k d_2x8w "<what happens next>"';

// Claude Code starts, with the mod: it hears each turn of the stand-in start and end.
async function started(h: StandIn) {
  const mod = new Mod(h, HOME);
  h.mod = mod;
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

test('B33.2 The session is named to the command in AGENTPAGER_WAKE, and named again before the first turn after a /clear; the id of a session that has ended isn\'t taken for the next one\'s while Claude Code still gives it', async () => {
  const h = standIn('session-1');
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine('session-1') }]));
  const mod = await started(h);
  assert.deepEqual(h.wake, ['claude-code:session-1']);
  assert.deepEqual(h.running().map(c => c.argv), [waitFor(A, 'd_2x8w')]);
  // A /clear: the session ends, and Claude Code goes on giving its id while its own session-start hooks run (2 to
  // 2.6 s in the real run). The mod holds nothing under it meanwhile.
  const held = h.children.length, cleared = h.leave('clear', 'session-2');
  assert.deepEqual(h.running(), [], 'the old session\'s waits stop');
  await h.advance(TICK_MS * 3);
  assert.equal(h.children.length, held, 'and aren\'t held again while Claude Code still gives the old id');
  assert.equal(mod.named, null);
  // The conversation goes on under another session, and its first turn names it before any command runs.
  await cleared.arrive();
  await h.type();
  assert.deepEqual(h.wake, ['claude-code:session-1', 'claude-code:session-2']);
  await h.finish();
  await h.advance(TICK_MS * 3);
  assert.deepEqual(h.running(), [], 'the old session\'s decisions wait for it to be resumed');
  // A /resume back: named at the next look once Claude Code gives the id, and its decision is held again.
  const back = h.leave('resume', 'session-1');
  await h.advance(TICK_MS * 2);
  assert.equal(h.children.length, held);
  await back.arrive();
  await h.advance(TICK_MS);
  assert.deepEqual([h.wake.at(-1), h.running().map(c => c.argv)], ['claude-code:session-1', [waitFor(A, 'd_2x8w')]]);
  // A /resume into the session it is already in: the id never changes, so the session is named when its next turn starts.
  const same = h.leave('resume', 'session-1');
  await same.arrive();
  await h.advance(TICK_MS * 3);
  assert.equal(mod.named, null);
  await h.type();
  assert.equal(mod.named, 'session-1');
  await h.finish();
  await h.advance(TICK_MS);
  assert.deepEqual(h.running().map(c => c.argv), [waitFor(A, 'd_2x8w')]);
  // The session ends while Claude Code is still setting the variable for it: it isn't named after all.
  let set: () => void = () => undefined;
  const late = standIn('session-1');
  late.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine('session-2') }]));
  const there = await started(late);
  await late.leave('clear', 'session-2').arrive();
  late.slowWake = new Promise<void>(r => { set = () => r(); });
  await late.advance(TICK_MS);
  assert.deepEqual([late.wake.at(-1), there.named], ['claude-code:session-2', null], 'the look is naming session-2');
  const gone = late.leave('resume', 'session-3');
  late.slowWake = null; set();
  await late.advance(TICK_MS * 2);
  assert.deepEqual([there.named, late.running()], [null, []], 'session-2 ended meanwhile: not named, and its decision not held');
  await gone.arrive();
  await late.advance(TICK_MS);
  assert.equal(there.named, 'session-3');
  late.quit();
  // A session id the command wouldn't take unsets the variable, and nothing is held.
  h.session = 'not a session';
  await h.advance(TICK_MS);
  assert.deepEqual(h.wake.at(-1), undefined);
  assert.equal(mod.named, null);
  assert.deepEqual(h.running(), []);
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
  assert.deepEqual(child?.argv, waitFor(A, 'd_2x8w'), 'the command\'s own wait, held without picking the answer up (B32.12)');
  await h.advance(30_000);
  assert.deepEqual(h.turns, [], 'nothing before the owner answers');
  const at = h.t;
  child?.exit(reply.answered(ANSWER));
  await h.advance(0);
  assert.equal(h.t, at, 'no time passes on the mod\'s side');
  assert.deepEqual(h.turns, [turnText(A, 'd_2x8w', { answered: true, text: ANSWER })]);
  assert.equal(h.turns[0], `AgentPager: your owner answered decision d_2x8w (agent ${A}). The agentpager command's reply:\n\n${ANSWER}`);
  assert.ok(h.dirs.has(claim(A, 'd_2x8w')), 'recorded as handed over');
  assert.deepEqual(h.pickups, [{ argv: pickupOf(A, 'd_2x8w'), turns: 1 }], 'picked up once its turn had started');
  assert.ok(!h.logs.some(l => l.includes('Green')), 'the answer is in no log line');
  assert.deepEqual(mod.held, []);
  await h.finish();
  await h.advance(TICK_MS * 5);
  assert.deepEqual([h.turns.length, h.submitted.length], [1, 1], 'once');
  assert.deepEqual(h.running(), [], 'and no wait is held for it again');
});

test('B33.2 When Claude is busy the answer waits for the running turn to end, and a prompt the person queued goes first; never into a running turn', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await started(h);
  await h.type();
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(40_000);
  assert.deepEqual(h.submitted, [], 'not while the turn runs');
  await h.finish();
  await h.advance(SETTLE_MS - 1);
  assert.deepEqual(h.submitted, [], 'a moment for a prompt the person queued');
  // The person's queued prompt starts the next turn: the answer waits for that one too.
  await h.type();
  await h.advance(10_000);
  assert.deepEqual(h.submitted, []);
  await h.finish();
  const ended = h.t;
  await h.advance(SETTLE_MS);
  assert.equal(h.turns.length, 1, 'the next turn');
  assert.equal(h.t - ended, SETTLE_MS);
  // A turn that starts while the mod makes its last checks keeps the answer waiting too.
  const k = standIn();
  k.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await started(k);
  const exists = k.exists;
  let typed = false;
  k.exists = async file => { if (!typed && file === claim(A, 'd_2x8w')) { typed = true; await k.type(); } return exists(file); };
  k.running()[0]?.exit(reply.answered(ANSWER));
  await k.advance(TICK_MS * 3);
  assert.deepEqual([typed, k.submitted], [true, []], 'not submitted behind a turn that started meanwhile');
  await k.finish();
  await k.advance(SETTLE_MS);
  assert.equal(k.turns.length, 1);
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
  assert.deepEqual(decodeRecord(A, record(A, [{ decision: 'd_aaaa', state: 'answered', wake: mine('s') }, { decision: 'd_bbbb' }])), { agent: A, decisions: [{ decision: 'd_aaaa', session: 's', pickedUp: true }, { decision: 'd_bbbb', session: null, pickedUp: false }] });
  for (const bad of [{ decision: '../x', state: 'waiting' }, { decision: 'd_aaaa', state: 'done' }, 'd_aaaa']) assert.equal(decodeRecord(A, JSON.stringify({ version: 1, agent: A, decisions: [bad] })), null);
});

test('B33.2 Each answer is handed over once, across restarts of Claude Code, and the record of it goes once the decision leaves the record', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }, { decision: 'd_9k2m', wake: mine() }]));
  const one = await started(h);
  assert.equal(h.running().length, 2);
  h.running().find(c => c.argv[4] === 'd_2x8w')?.exit(reply.answered(ANSWER));
  await h.advance(0);
  assert.deepEqual(h.turns, [turnText(A, 'd_2x8w', { answered: true, text: ANSWER })]);
  // Claude Code quits before the owner answers the other, and comes back: the first isn't handed over again, and the
  // other is held again.
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', state: 'answered', wake: mine() }, { decision: 'd_9k2m', wake: mine() }]));
  assert.deepEqual(one.held, [{ agent: A, decision: 'd_9k2m', state: 'holding' }]);
  h.quit();
  assert.deepEqual(h.running(), [], 'quitting stops every wait');
  await started(h);
  assert.deepEqual(h.running().map(c => c.argv), [waitFor(A, 'd_9k2m')]);
  // Answered while Claude Code was closed: the wait comes back with it at once, and it goes as the first turn.
  h.running()[0]?.exit(reply.answered('Answered at 11:20 AM: option A "Blue".'));
  await h.advance(0);
  assert.equal(h.turns.length, 2);
  assert.match(h.turns[1] ?? '', /decision d_9k2m .*\n\nAnswered at 11:20 AM: option A "Blue"\./s);
  await h.finish();
  // And once more: a third start holds neither.
  h.quit();
  await started(h);
  await h.advance(TICK_MS * 3);
  assert.deepEqual(h.running(), []);
  assert.equal(h.turns.length, 2);
  // The agent acknowledges both: they leave the record, and so does the record of handing them over.
  h.write(waiting(A), record(A, []));
  await h.advance(TICK_MS);
  assert.ok(!h.dirs.has(claim(A, 'd_2x8w')) && !h.dirs.has(claim(A, 'd_9k2m')));
  await h.advance(TICK_MS * 5);
  assert.deepEqual([h.turns.length, h.submitted.length], [2, 2]);
  h.quit();
});

test('B33.2 B32.12 The answer counts as picked up only once the turn carrying it has started: not while Claude is busy, not when Claude Code quits first, and a pickup that didn\'t land is tried again, across a restart too', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await started(h);
  await h.type();
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(30_000);
  assert.equal(h.pickups.length, 0, 'held while Claude is busy, and not picked up');
  // Claude Code quits before the turn: nothing was picked up, so the owner is still warned, and nothing was handed over.
  h.quit();
  assert.equal(h.pickups.length, 0);
  assert.ok(!h.dirs.has(claim(A, 'd_2x8w')));
  // It comes back: the answer goes as the first turn, and only then is it picked up. The service is out of reach.
  h.picking = JSON.stringify({ code: 5, text: 'No reply from the server.', result: { status: 'try-again' } }) + '\n';
  await started(h);
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(0);
  assert.deepEqual([h.turns.length, h.pickups.map(p => p.turns)], [1, [1]]);
  await h.advance(9_000);
  assert.equal(h.pickups.length, 1, 'tried again 10 s on, not on every look');
  await h.advance(1_000);
  assert.equal(h.pickups.length, 2);
  // Claude Code quits again before it lands, and comes back while the folder of hand-overs can't be listed: that is
  // never read as none, so the answer isn't held, or handed over, again.
  h.quit();
  h.picking = JSON.stringify({ code: 0, text: 'Picked up.', result: { status: 'picked-up' } }) + '\n';
  h.failing.add(`${HOME}/claude-code`);
  await started(h);
  await h.advance(TICK_MS * 3);
  assert.deepEqual([h.running(), h.turns.length, h.pickups.length], [[], 1, 2]);
  // Once it lists, the next look tries the pickup again, and stops once it is done.
  h.failing.clear();
  await h.advance(TICK_MS);
  assert.equal(h.pickups.length, 3);
  await h.advance(60_000);
  assert.equal(h.pickups.length, 3, 'done');
  assert.equal(h.turns.length, 1, 'and the turn went once');
  // A record that says it's picked up needs no pickup.
  h.quit();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', state: 'answered', wake: mine() }]));
  await started(h);
  await h.advance(TICK_MS * 30);
  assert.equal(h.pickups.length, 3);
  h.quit();
});

test('B33.2 B32.12 A prompt Claude Code keeps waiting isn\'t handed over yet: during a /compact, which is no turn to the mod, the answer is recorded and picked up only once its turn has started, and if Claude Code quits first it comes at the next start', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  const mod = await started(h);
  h.compact();
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(8_000);
  assert.deepEqual([h.submitted.length, h.turns.length, h.pickups.length, h.dirs.has(claim(A, 'd_2x8w'))], [1, 0, 0, false], 'Claude Code holds the prompt, and nothing is recorded or picked up');
  assert.deepEqual(mod.held, [{ agent: A, decision: 'd_2x8w', state: 'handing' }]);
  // Claude Code quits during the compaction: the prompt is gone with it, and the answer comes at the next start.
  h.quit();
  await started(h);
  h.compact();
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(8_000);
  assert.deepEqual([h.submitted.length, h.turns.length, h.pickups.length], [2, 0, 0]);
  // The compaction ends: the turn starts, and only then is the answer recorded and picked up.
  await h.idle();
  assert.deepEqual([h.turns.length, h.pickups.map(p => p.turns), h.dirs.has(claim(A, 'd_2x8w'))], [1, [1], true]);
  await h.finish();
  await h.advance(TICK_MS * 5);
  assert.deepEqual([h.turns.length, h.submitted.length], [1, 2], 'once');
  h.quit();
});

test('B33.2 B32.12 Claude Code saying a prompt entered isn\'t its turn starting: one queued behind a running turn is recorded and picked up only when the mod hears a turn start after it, whichever of the two the mod hears first', async () => {
  // The mod is loaded while a turn runs (a reload), so it knows of no turn; Claude Code queues the prompt behind it
  // and, as its declarations allow, says at once that it entered.
  const h = standIn();
  h.entersWhenQueued = true;
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  h.doing = 'turn';
  const mod = await started(h);
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(20_000);
  assert.deepEqual([h.submitted.length, h.turns.length, h.pickups.length, h.dirs.has(claim(A, 'd_2x8w'))], [1, 0, 0, false], 'entered, and its turn hasn\'t started');
  assert.deepEqual(mod.held, [{ agent: A, decision: 'd_2x8w', state: 'handing' }]);
  assert.equal(h.submitted.length, 1, 'and it isn\'t submitted again meanwhile');
  await h.finish();
  assert.deepEqual([h.turns.length, h.pickups.map(p => p.turns), h.dirs.has(claim(A, 'd_2x8w'))], [1, [1], true]);
  h.quit();
  // Several prompts waiting start as one turn, whose start names only the last: the mod's own, not being it, still
  // counts, since Claude Code said it entered before the turn started.
  const merged = standIn();
  merged.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await started(merged);
  merged.compact();
  merged.running()[0]?.exit(reply.answered(ANSWER));
  await merged.advance(2_000);
  merged.other('Another plugin\'s prompt.');
  await merged.idle();
  assert.deepEqual([merged.turns.length, merged.pickups.map(p => p.turns), merged.dirs.has(claim(A, 'd_2x8w'))], [2, [2], true]);
  merged.quit();
  // The other order: the mod hears the turn start, carrying its reply, before the call resolves.
  const early = standIn();
  early.startsBeforeEntered = true;
  early.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await started(early);
  early.running()[0]?.exit(reply.answered(ANSWER));
  await early.advance(0);
  assert.deepEqual([early.turns.length, early.pickups.map(p => p.turns), early.dirs.has(claim(A, 'd_2x8w'))], [1, [1], true]);
  await early.finish();
  await early.advance(TICK_MS * 5);
  assert.deepEqual([early.turns.length, early.submitted.length, early.pickups.length], [1, 1, 1], 'once');
  early.quit();
});

test('B33.2 B32.12 A prompt still waiting when a /clear takes effect starts in the new conversation, as Claude Code 2.1.321 has it: it is neither recorded nor picked up there, and the session that asked gets its answer when it is resumed', async () => {
  const h = standIn('session-1');
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine('session-1') }]));
  await started(h);
  h.compact();
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(2_000);
  assert.equal(h.submitted.length, 1);
  // The compaction ends and the /clear the person queued during it takes effect, before the prompt runs.
  const cleared = h.leave('clear', 'session-2');
  await cleared.arrive();
  assert.deepEqual([h.turns.length, h.turnsIn], [1, ['session-2']], 'Claude Code started it in the new conversation');
  assert.deepEqual([h.pickups.length, h.dirs.has(claim(A, 'd_2x8w'))], [0, false], 'which isn\'t the one that asked');
  await h.finish();
  await h.advance(TICK_MS * 5);
  assert.deepEqual([h.submitted.length, h.running()], [1, []], 'and nothing more is offered there');
  // Back in the session that asked: held again, and handed over there.
  const back = h.leave('resume', 'session-1');
  await back.arrive();
  await h.advance(TICK_MS);
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(SETTLE_MS);
  assert.deepEqual([h.turnsIn, h.pickups.map(p => p.turns), h.dirs.has(claim(A, 'd_2x8w'))], [['session-2', 'session-1'], [2], true]);
  h.quit();
});

test('B33.2 An answer the agent already has, from a wait of its own (today\'s background-wait words followed all the same), isn\'t handed over as well', async () => {
  for (const after of ['picked up', 'acknowledged'] as const) {
    const h = standIn();
    h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
    const mod = await started(h);
    // The agent's own background wait woke it first; the mod's wait came back with the answer too.
    await h.type();
    h.running()[0]?.exit(reply.answered(ANSWER));
    await h.advance(0);
    h.write(waiting(A), record(A, after === 'picked up' ? [{ decision: 'd_2x8w', state: 'answered', reads: 1, wake: mine() }] : []));
    await h.finish();
    await h.advance(SETTLE_MS + TICK_MS);
    assert.deepEqual(h.submitted, [], after);
    assert.deepEqual(mod.held, []);
    // Nor held again at a restart.
    h.quit();
    await started(h);
    await h.advance(TICK_MS * 3);
    assert.deepEqual([h.running(), h.submitted, h.pickups.length], [[], [], 0]);
    h.quit();
  }
});

test('B33.2 A turn Claude Code didn\'t take, or removed before it ran, is offered again after the person\'s next turn, or a minute later, so it is never lost', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await started(h);
  // The person stopped the session with Esc: Claude Code refuses a plugin's prompts until they type.
  await h.type(); await h.esc();
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(SETTLE_MS);
  assert.deepEqual([h.submitted.length, h.turns.length], [1, 0]);
  assert.ok(!h.dirs.has(claim(A, 'd_2x8w')), 'not recorded as handed over');
  assert.equal(h.pickups.length, 0, 'nor picked up');
  await h.advance(TICK_MS * 10);
  assert.equal(h.submitted.length, 1, 'not offered again on every look');
  await h.type(); await h.finish();
  await h.advance(SETTLE_MS);
  assert.deepEqual([h.submitted.length, h.turns.length], [2, 1]);
  assert.ok(h.dirs.has(claim(A, 'd_2x8w')));
  assert.deepEqual(h.pickups.map(p => p.turns), [1]);
  h.quit();
  // Nor is one lost when no one types: it is offered again a minute later.
  const k = standIn();
  k.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await started(k);
  k.stopped = true;
  k.running()[0]?.exit(reply.answered(ANSWER));
  await k.advance(0);
  assert.deepEqual([k.submitted.length, k.turns.length], [1, 0]);
  k.stopped = false;
  await k.advance(60_000);
  assert.deepEqual([k.submitted.length, k.turns.length, k.pickups.length], [2, 1, 1]);
  k.quit();
  // A prompt waiting behind a turn the person then stops with Esc is removed by Claude Code, which says so: it is
  // neither recorded nor picked up, and is offered again after the person's next turn. (The mod was loaded while
  // that turn ran, so it knew of no turn.)
  const r = standIn();
  r.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  r.doing = 'turn';
  await started(r);
  r.running()[0]?.exit(reply.answered(ANSWER));
  await r.advance(5_000);
  assert.deepEqual([r.submitted.length, r.turns.length], [1, 0]);
  await r.esc();
  await r.advance(TICK_MS * 5);
  assert.deepEqual([r.submitted.length, r.turns.length, r.pickups.length, r.dirs.has(claim(A, 'd_2x8w'))], [2, 0, 0, false], 'removed, and refused while the session stays stopped');
  assert.ok(r.logs.some(l => l.includes('removed from the queue')), r.logs.join('\n'));
  await r.type(); await r.finish();
  await r.advance(SETTLE_MS);
  assert.deepEqual([r.submitted.length, r.turns.length, r.pickups.map(p => p.turns), r.dirs.has(claim(A, 'd_2x8w'))], [3, 1, [1], true]);
  r.quit();
});

test('B33.2 B32.12 The mod holds the command\'s own wait and reads only its code and status: pending holds again, the pager off or the service out of reach tries later, no such agent stops, and a refusal is handed over', async () => {
  assert.deepEqual(outcomeOf(reply.answered(ANSWER)), { kind: 'deliver', answered: true, text: ANSWER });
  assert.deepEqual(outcomeOf(reply.pending()), { kind: 'again' });
  assert.deepEqual(outcomeOf(reply.off()), { kind: 'later', ms: 60_000 });
  assert.deepEqual(outcomeOf(reply.unreachable()), { kind: 'later', ms: 10_000 });
  assert.deepEqual(outcomeOf(reply.unknown(A)), { kind: 'stop' });
  assert.deepEqual(outcomeOf('Answered at 11:15 AM: option B "Green".'), { kind: 'later', ms: 10_000 }, 'words alone are never read as an answer');
  assert.deepEqual(outcomeOf(''), { kind: 'later', ms: 10_000 }, 'a wait that died');
  // pickup, as the contract beside waitingOf has it: settled, or tried again later.
  for (const status of ['picked-up', 'acknowledged']) assert.equal(pickupAgainIn(JSON.stringify({ code: 0, text: '', result: { status } })), null, status);
  for (const status of ['pending', 'closed', 'unreadable', 'refused']) assert.equal(pickupAgainIn(JSON.stringify({ code: 2, text: '', result: { status } })), null, status);
  assert.equal(pickupAgainIn(JSON.stringify({ code: 6, text: 'No agent ap-7f3k on this machine.' })), null);
  assert.equal(pickupAgainIn(JSON.stringify({ code: 4, text: '', result: { status: 'pager-off' } })), 60_000);
  assert.equal(pickupAgainIn(JSON.stringify({ code: 5, text: '', result: { status: 'try-again' } })), 10_000);
  assert.equal(pickupAgainIn(''), 10_000, 'no reply at all');

  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  const mod = await started(h);
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
  // A refusal isn't an answer: handed over once while this Claude Code runs, never recorded as handed over or picked
  // up, so an answer that reads later still comes, after a restart, and until then the owner is still warned.
  await h.finish();
  await h.advance(TICK_MS * 5);
  assert.deepEqual([h.turns.length, h.submitted.length, h.running().length, h.pickups.length, h.dirs.has(claim(A, 'd_2x8w'))], [1, 1, 0, 0, false]);
  assert.deepEqual(mod.held, []);
  // Nor is it handed over again while Claude Code runs: not after its record didn't read for a while, and not after
  // a /resume away and back.
  h.failing.add(waiting(A));
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  await h.advance(TICK_MS * 2);
  h.failing.clear();
  await h.advance(TICK_MS * 3);
  assert.deepEqual([h.submitted.length, h.running().length], [1, 0], 'its record didn\'t read for a while');
  await h.leave('resume', 'session-2').arrive();
  await h.advance(TICK_MS * 2);
  await h.leave('resume', 'session-1').arrive();
  await h.advance(TICK_MS * 3);
  assert.deepEqual([mod.named, h.submitted.length, h.running().length], ['session-1', 1, 0], 'a /resume away and back');
  h.quit();
  await started(h);
  h.running()[0]?.exit(reply.answered(ANSWER));
  await h.advance(0);
  assert.deepEqual([h.turns.length, h.pickups.length, h.dirs.has(claim(A, 'd_2x8w'))], [2, 1, true]);
  h.quit();
});

test('B33.2 A record that didn\'t read is read again at the next look, so its decisions are still held', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  h.failing.add(waiting(A));
  await started(h);
  assert.deepEqual(h.running(), []);
  h.failing.clear();
  await h.advance(TICK_MS);
  assert.deepEqual(h.running().map(c => c.argv), [waitFor(A, 'd_2x8w')]);
});

test('B33.2 A hold that stops while the mod is about to start its next wait starts none, so no wait is left that nothing would stop', async () => {
  const h = standIn('session-1');
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine('session-1') }]));
  await started(h);
  h.running()[0]?.exit(reply.pending());
  await h.advance(0);
  // A second after it began, the mod asks the clock before holding again; the /clear lands while it waits for the answer.
  let answer: () => void = () => undefined;
  h.slowClock = new Promise<void>(r => { answer = () => r(); });
  await h.advance(TICK_MS);
  assert.equal(h.children.length, 1);
  const cleared = h.leave('clear', 'session-2');
  h.slowClock = null; answer();
  await h.advance(0);
  assert.deepEqual([h.children.length, h.running()], [1, []], 'no wait started for the session that ended');
  await cleared.arrive();
  await h.advance(TICK_MS * 3);
  assert.deepEqual([h.children.length, h.running()], [1, []]);
  h.quit();
});

test('B33.2 When the session ends, every wait the mod holds stops, and it looks no more', async () => {
  const h = standIn();
  h.write(waiting(A), record(A, [{ decision: 'd_2x8w', wake: mine() }]));
  h.write(waiting(B), record(B, [{ decision: 'd_9k2m', wake: mine() }]));
  await started(h);
  assert.equal(h.running().length, 2);
  h.quit();
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
