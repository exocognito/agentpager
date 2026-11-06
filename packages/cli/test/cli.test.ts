import { test } from 'node:test';
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fixture, assert, token, until } from '../../app/test/support.ts';
import { EXAMPLE } from '../src/rules.ts';
import type { Result } from '../src/commands.ts';
import { decisionIdOf } from '../../contract/exchange.ts';

// A field of a command's --json result, read without a cast.
const field = (r: { json?: unknown }, key: string) => String(typeof r.json === 'object' && r.json !== null ? Reflect.get(r.json, key) : undefined);

const cli = fileURLToPath(new URL('..', import.meta.url));
const png = path.join(cli, '..', 'app', 'fixtures', 'briefs', 'D1-pricing', 'a-cards.png');

test('the binary: connect, refusals, ask, wait, ack, status, history, off, finish, and the same over MCP', { timeout: 240_000 }, async () => {
  const f = await fixture('cli');
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-cli-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-card-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = f.origin; delete process.env.AGENTPAGER_PAGER;
  // An agent the binary can't name gets the words every agent gets (wait.test.ts has Claude's).
  delete process.env.CLAUDECODE;
  const op = await import('../src/commands.ts');
  const client = new Client({ name: 'codex-mcp-client', version: '1' });
  try {
    const p = await f.makePager();

    // connect: a new agent each time, its key only in its own file.
    assert.equal((await op.connect({})).code, 2, 'no number');
    const bad = await op.connect({ number: 'ap1_' + 'A'.repeat(32), app: 'Codex', project: 'cli' });
    assert.deepEqual([bad.code, bad.text], [2, 'Not connected. This pager number is not in use. Ask your owner for their current one.']);
    const c = await op.connect({ number: p.number, app: 'Codex', project: 'atomic-pages' });
    assert.equal(c.code, 0, c.text);
    const id = field(c, 'agent');
    assert.match(id, /^ap-[a-z0-9]{4}$/);
    assert.equal(c.text, `Connected as agent ${id} on your owner's pager (project atomic-pages, as Codex).\nYour owner's phone shows you as a new agent. Use --agent ${id} for every question in\nthis piece of work; running connect again adds another agent.\nBefore your first card: agentpager rules`);
    const file = path.join(home, 'agents', `${id}.json`);
    assert.equal(statSync(file).mode & 0o777, 0o600, 'the agent file is private');
    assert.ok(!c.text.includes(JSON.parse(readFileSync(file, 'utf8')).agentKey), 'the key is never printed');
    process.env.AGENTPAGER_PAGER = p.number;
    const second = await op.connect({ app: 'Codex', project: 'atomic-pages' });
    assert.notEqual(field(second, 'agent'), id, 'connecting again adds another agent');
    delete process.env.AGENTPAGER_PAGER;
    assert.equal((await op.ask('ap-zzzz', { yaml: EXAMPLE, dir: work })).code, 6);

    // ask refuses only mechanical problems, one line each: here the example's two images aren't next to it.
    const missing = await op.ask(id, { yaml: EXAMPLE, dir: work });
    assert.deepEqual([missing.code, missing.text], [2, 'Attachment warning.png is listed but there is no such file next to card.yaml.\nAttachment flow.png is listed but there is no such file next to card.yaml.']);
    const broken = EXAMPLE.replace('option: A', 'option: C').replace('title: Which M11 guarantee should we build?', `title: ${'Which M11 guarantee should we build? '.repeat(4)}`).replace('    B: "green: Recover original job or stored acceptance automatically"\n', '');
    const refused = await op.ask(id, { yaml: broken, dir: work });
    assert.equal(refused.code, 2);
    assert.deepEqual(refused.text.split('\n').filter(l => !l.startsWith('Attachment ')), ['title is 147 characters; the limit is 100.', 'tradeoffs[0] has no cell for B.', 'recommendation.option is C but there are two options.']);
    assert.equal((await op.ask(id, { yaml: 'title: [unclosed', dir: work })).text.startsWith("card.yaml doesn't parse:"), true);
    const one = await op.ask(id, { yaml: 'title: Ship it?\ndetail: The release.\ncontext:\n  summary: Ready.\noptions:\n  - {label: Ship, title: Ship, prioritizes: speed}\nrecommendation: {option: A, why: Ready.}\n', dir: work });
    assert.equal(one.text, 'A decision needs at least two options.');

    // With its images next to it, the example asks; the phone sees the brief, the background page and the images.
    copyFileSync(png, path.join(work, 'warning.png')); copyFileSync(png, path.join(work, 'flow.png'));
    writeFileSync(path.join(work, 'card.yaml'), EXAMPLE);
    const asked = await op.ask(id, { file: path.join(work, 'card.yaml') });
    assert.equal(asked.code, 0, asked.text);
    const d = field(asked, 'decision');
    assert.equal(asked.text, `Sent. Your owner sees it as:\n  Which M11 guarantee should we build?\n  Two real alternatives: a smaller fix with occasional manual recovery, or precise automatic recovery.\nDecision ${d}. Wait for the answer with: agentpager wait --agent ${id} ${d}`);
    const asker = (await f.pager(p.pagerId, p.phone)).agents.find(a => a.open.length), seen = asker?.open[0];
    assert.equal(asker?.agent.machine, hostname().split('.')[0], 'the phone sees which computer asked');
    assert.ok(seen && seen.card.type === 'brief');
    const brief = seen.card;
    assert.deepEqual(seen.attachments?.map(a => a.name).sort(), ['background.md', 'flow.png', 'warning.png']);
    assert.deepEqual(brief.options.map(o => 'label' in o ? o.label : ''), ['Small + manual', 'Precise + automatic']);
    assert.equal(brief.recommended, 1);
    for (const needle of ['## Context: a lost reply', '[How the mix-up happens](background.md)', ':::option A\n![Small + manual](warning.png)\n### What A changes', '| Lost connection | :yellow[May need inspection, Cancel or Run again] |', '## Recommendation: A\n**Why:** Fix the misleading timeout', '**Assumes:** If stuck jobs turn out to be frequent, pick B.', '## Next steps: build only the chosen one\n**After A:** Ship the warning and Cancel this week.', '**If no decision:** Nothing changes; stuck jobs stay invisible.']) {
      assert.ok(brief.markdown.includes(needle), needle);
    }
    assert.ok(brief.markdown.includes('The service hands the agent job A, but the reply is lost on the way. When the agent asks again'), 'hard-wrapped prose is joined');

    // wait: pending, then the option; ack once; a note reads back as the owner wrote it.
    const pending = await op.wait(id, d, { seconds: 1 });
    assert.equal(pending.text, `Pending. Your owner hasn't answered "Which M11 guarantee should we build?" yet.\nKeep waiting: agentpager wait --agent ${id} ${d}`);
    const agentId = (await f.pager(p.pagerId, p.phone)).agents.find(a => a.open.length)?.agent.agentId ?? '';
    await f.answer(agentId, p.phone, seen.decisionId, { kind: 'option', number: 1 });
    const answered = await op.wait(id, d);
    assert.match(answered.text, new RegExp(`^Answered at \\d{1,2}:\\d{2} [AP]M: option A "Small \\+ manual"\\.\\nDo it, then confirm: agentpager ack --agent ${id} ${d} "<what happens next>"$`));
    const acked = await op.ack(id, d, 'Build the smaller fix, the exact wording and the uncertainty warning.');
    assert.equal(acked.text, 'Acknowledged. Your owner sees "Build the smaller fix, the exact wording and the…" with a green tick on that decision.');
    assert.equal((await op.ack(id, d, 'Again.')).code, 2, 'only the first acknowledgement counts');
    const small = 'title: Dinner on Friday?\ndetail: Where to eat.\ncontext:\n  summary: Friday is booked.\noptions:\n  - {label: Sushi, title: Sushi, prioritizes: fish}\n  - {label: Pasta, title: Pasta, prioritizes: carbs}\nrecommendation: {option: B, why: Closer.}\n';
    const dinner = field(await op.ask(id, { yaml: small, dir: work }), 'decision');
    const dinnerId = (await f.pager(p.pagerId, p.phone)).agents.flatMap(a => a.open).find(x => x.title === 'Dinner on Friday?')?.decisionId ?? '';
    await f.answer(agentId, p.phone, dinnerId, { kind: 'feedback', text: 'Somewhere vegetarian, please.' });
    assert.match((await op.wait(id, dinner)).text, /^Your owner wrote instead of choosing, at .*:\n  "Somewhere vegetarian, please\."\nFollow the note\. If you still need a decision, ask a new card\. Acknowledge this one with\nwhat you'll do: agentpager ack/);

    // status and history read what happened; history is per pager, newest first.
    const status = await op.status(id);
    assert.match(status.text, new RegExp(`^Agent ${id} · Codex · atomic-pages\\nPager: on\\nOpen decisions: 0\\nAnswered, not yet acknowledged: ${dinner}$`));
    const history = await op.history(id);
    assert.match(history.text, /Dinner on Friday\?\n  Options: Sushi \/ Pasta → note "Somewhere vegetarian, please\."[\s\S]*Which M11 guarantee should we build\?\n  Options: Small \+ manual \/ Precise \+ automatic → option A "Small \+ manual"\n  Next: Build the smaller fix/);

    // The contract comes back on the binary's clock: by the fifth card since it was last shown.
    for (let n = 0; n < 2; n++) assert.ok(!(await op.ask(id, { yaml: small.replace('Dinner on Friday?', `Lunch ${n}?`), dir: work })).text.includes('short version'));
    const fifth = await op.ask(id, { yaml: small.replace('Dinner on Friday?', 'Lunch 3?'), dir: work });
    assert.match(fifth.text, /That's 5 cards since you last read the card contract\. The short version:\n  1\. One question per card\./);

    // Off: exit 4, nothing queued. Unreachable: exit 5.
    await f.settings(p.pagerId, p.phone, { on: false });
    const off = await op.ask(id, { yaml: small.replace('Dinner on Friday?', 'While off?'), dir: work });
    assert.deepEqual([off.code, off.text], [4, 'Not sent. This pager is turned off and your message was not delivered. Nothing is queued:\nask again once your owner turns it on, or ask them for another pager number.']);
    assert.equal((await op.connect({ number: p.number })).text, 'Not connected. This pager is turned off and your message was not delivered.\nAsk your owner to turn it on, or for another pager number.');
    assert.match((await op.status(id)).text, /Pager: off/);
    await f.settings(p.pagerId, p.phone, { on: true });
    process.env.AGENTPAGER_SERVER = 'http://127.0.0.1:9';
    const away = await op.connect({ number: p.number, app: 'Codex', project: 'cli' });
    assert.equal(away.code, 5); assert.match(away.text, /^Can't reach http:\/\/127\.0\.0\.1:9 \(.+\)\. Nothing was sent\.\nIf this machine blocks outbound requests, add 127\.0\.0\.1:9 to its allow list and try again\.$/);
    process.env.AGENTPAGER_SERVER = f.origin;

    // The same over MCP: nine tools, the contract on ask, the same replies; the client's name says who asked.
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['--experimental-strip-types', path.join(cli, 'src', 'main.ts'), 'mcp'], env: { ...process.env, AGENTPAGER_HOME: home, AGENTPAGER_SERVER: f.origin, PATH: process.env.PATH ?? '' }, stderr: 'ignore' }));
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map(t => t.name), ['connect', 'rules', 'review', 'ask', 'wait', 'ack', 'status', 'history', 'finish']);
    assert.match(tools.find(t => t.name === 'ask')?.description ?? '', /12\. Before you send, get it reviewed once\./);
    const say = async (name: string, args: Record<string, unknown>) => {
      const r = await client.callTool({ name, arguments: args });
      const content = Array.isArray(r.content) ? r.content : [];
      return { error: r.isError === true, text: typeof content[0]?.text === 'string' ? content[0].text : '' };
    };
    const viaMcp = await say('connect', { number: p.number, project: 'over MCP' });
    assert.match(viaMcp.text, /\(project over MCP, as Codex\)/, 'the MCP client named itself Codex');
    const mcpId = viaMcp.text.match(/agent (ap-[a-z0-9]{4})/)?.[1] ?? '';
    const reviewed = await say('review', { card: { title: 'Ok?' } });
    assert.match(reviewed.text, /^Review this decision card[\s\S]*--- card\.yaml ---\n\{\n {2}"title": "Ok\?"\n\}\n$/);
    const card = { title: 'Ship tonight?', detail: 'The release.', context: { summary: 'Ready.' }, options: [{ label: 'Ship', title: 'Ship tonight', prioritizes: 'speed' }, { label: 'Wait', title: 'Ship Monday', prioritizes: 'sleep' }], recommendation: { option: 'B', why: 'Rested.' }, attachments: [{ name: 'shot.png', type: 'image/png', base64: readFileSync(png).toString('base64') }], next_steps: { A: 'Ship.', B: 'Ship Monday.', if_no_answer: 'Monday.' } };
    const sent = await say('ask', { agent: mcpId, card });
    assert.equal(sent.error, false, sent.text);
    assert.match(sent.text, /^Sent\. Your owner sees it as:\n  Ship tonight\?\n  The release\.\nDecision d_[a-z0-9]{4}\./);
    const unknownKey = await say('ask', { agent: mcpId, card: { ...card, mood: 'great' } });
    assert.deepEqual([unknownKey.error, unknownKey.text], [true, 'mood is not a card key.']);
    assert.equal((await say('status', { agent: 'ap-zzzz' })).text, 'No agent ap-zzzz on this machine. Run `agentpager agents` to list them, or connect again.');
    assert.equal((await say('finish', { agent: mcpId })).error, false);
    assert.match((await op.agents()).text, new RegExp(`${id}  pager ${p.pagerId.slice(0, 8)}  atomic-pages · Codex`));
    void token;
  } finally { await client.close(); await f.stop(); }
});

test('review rounds: concurrent asks, an unwritable home, attachments, unsafe cells, fences, bad input', { timeout: 240_000 }, async () => {
  const f = await fixture('cli-edges');
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-cli-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-card-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = f.origin; delete process.env.AGENTPAGER_PAGER;
  const op = await import('../src/commands.ts');
  const small = (title: string) => `title: ${title}\ndetail: Where to eat.\ncontext:\n  summary: Friday is booked.\noptions:\n  - {label: Sushi, title: Sushi, prioritizes: fish}\n  - {label: Pasta, title: Pasta, prioritizes: carbs}\nrecommendation: {option: B, why: Closer.}\n`;
  try {
    const p = await f.makePager();
    const id = field(await op.connect({ number: p.number, app: 'Codex', project: 'edges' }), 'agent');

    // Two asks at once on one agent (helpers sharing its id): both decisions stay waitable.
    const [one, two] = await Promise.all([op.ask(id, { yaml: small('One?'), dir: work }), op.ask(id, { yaml: small('Two?'), dir: work })]);
    for (const r of [one, two]) assert.equal((await op.wait(id, field(r, 'decision'), { seconds: 1 })).text.startsWith('Pending.'), true);

    // The same from separate processes (helpers sharing the id): every decision is kept.
    for (let n = 0; n < 4; n++) writeFileSync(path.join(work, `p${n}.yaml`), small(`Process ${n}?`));
    const procs = await Promise.all([0, 1, 2, 3].map(n => new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', path.join(cli, 'src', 'main.ts'), 'ask', '--agent', id, path.join(work, `p${n}.yaml`), '--json'], { env: process.env });
      let out = ''; child.stdout.on('data', d => { out += d; }); child.on('error', reject); child.on('close', () => resolve(out));
    })));
    const kept = JSON.parse(readFileSync(path.join(home, 'agents', `${id}.json`), 'utf8')).decisions;
    for (const out of procs) assert.ok(JSON.parse(out).result.decision in kept, out);

    // A home it can't write: refused before anything is sent, so the phone shows no stray agent.
    const agentsBefore = (await f.pager(p.pagerId, p.phone)).agents.length;
    chmodSync(path.join(home, 'agents'), 0o500);
    const locked = await op.connect({ number: p.number, app: 'Codex', project: 'edges' });
    assert.equal(locked.code, 2); assert.match(locked.text, /^Can't write .* \(EACCES\)\. Nothing was sent\./);
    assert.match((await op.ask(id, { yaml: small('Locked?'), dir: work })).text, /^Can't write .*Nothing was sent\./);
    assert.match(op.rules(id).text, /^A decision card asks your owner one question/, 'the contract still reads');
    chmodSync(path.join(home, 'agents'), 0o700);
    assert.equal((await f.pager(p.pagerId, p.phone)).agents.length, agentsBefore);
    assert.equal((await op.wait(id, 'd_xxxx', { seconds: Number('abc') })).code, 2);
    assert.equal((await op.wait(id, field(one, 'decision'), { seconds: Number('abc') })).text, '--seconds takes a number from 1 to 50.');

    // Cards: an inline attachment with no content, a line break or "|" in a table field, a fenced diff kept whole.
    const empty = await op.ask(id, { object: { title: 'Look?', detail: 'A mock.', context: { summary: '![Mock](a.png)' }, options: [{ label: 'A', title: 'A', prioritizes: 'a' }, { label: 'B', title: 'B', prioritizes: 'b' }], recommendation: { option: 'A', why: 'A.' }, attachments: [{ name: 'a.png', type: 'image/png' }] } });
    assert.equal(empty.text, 'Attachment a.png has no content: give its base64 (or text for a .md page).');
    const page = (a: Record<string, unknown>) => op.ask(id, { object: { title: 'Read?', detail: 'A page.', context: { summary: 'See [notes](notes.md).' }, options: [{ label: 'A', title: 'A', prioritizes: 'a' }, { label: 'B', title: 'B', prioritizes: 'b' }], recommendation: { option: 'A', why: 'A.' }, attachments: [{ name: 'notes.md', ...a }] } });
    assert.equal((await page({ type: 'text/markdown', base64: 'not base64!' })).text, "Attachment notes.md isn't valid base64.");
    assert.equal((await page({ type: 'image/png', base64: 'aGk=' })).text, 'Attachment notes.md is declared image/png but its name says text/markdown.');
    assert.equal((await page({ type: 'text/markdown', base64: Buffer.from([0xff, 0xfe, 0x00]).toString('base64') })).text, "Attachment notes.md isn't UTF-8 text.");
    const reviewed = op.review({ object: { title: 'Look?', attachments: [{ name: 'a.png', type: 'image/png', base64: readFileSync(png).toString('base64') }] } }).text;
    assert.ok(reviewed.includes('"attachments": [\n    {\n      "name": "a.png",\n      "type": "image/png"\n    }\n  ]') && !reviewed.includes('base64'), reviewed);
    assert.equal(op.review({ object: undefined }).text, 'Give the card to review.');
    // Structure can't be injected through a one-line field, and a page on disk must be UTF-8.
    const injected = small('Headings?').replace('label: Sushi,', 'label: "Sushi ]",').replace('  summary: Friday is booked.', '  summary: Friday is booked.\n  more: {title: "How ] it works", body: Why.}') + 'next_steps:\n  heading: "after\\n## Options"\n  A: Eat.\n';
    assert.deepEqual((await op.ask(id, { yaml: injected, dir: work })).text.split('\n'), ['context.more.title has a square bracket; use parentheses.', 'options[0].label has a square bracket; use parentheses.', 'next_steps.heading must be one line.']);
    // A carriage return is a line break too; one-line prose stays one line; a card file must be UTF-8.
    assert.equal((await op.ask(id, { yaml: small('CR?').replace('title: CR?', 'title: "CR?\\r## Options"'), dir: work })).text.split('\n')[0], 'title must be one line.');
    assert.equal((await op.ask(id, { yaml: small('Why?').replace('why: Closer.', 'why: "Closer.\\n\\n```\\ncode\\n```"'), dir: work })).text, 'recommendation.why must be one line.');
    writeFileSync(path.join(work, 'latin1.yaml'), Buffer.concat([Buffer.from(small('Caf')), Buffer.from([0xe9])]));
    assert.match((await op.ask(id, { file: path.join(work, 'latin1.yaml') })).text, /latin1\.yaml isn't UTF-8 text\.$/);
    assert.ok(!op.review({ object: { title: 'T', attachments: [{ type: 'image/png', base64: 'U0VDUkVUQllURVM=' }, 'raw'] } }).text.includes('U0VDUkVU'));
    writeFileSync(path.join(work, 'bad.md'), Buffer.from([0x23, 0x20, 0xff, 0xfe]));
    assert.equal((await op.ask(id, { yaml: small('Bad page?') + 'attachments: [bad.md]\n', dir: work })).text, "Attachment bad.md isn't UTF-8 text.");
    const unsafe = small('Table?').replace('title: Sushi,', 'title: "Sushi\\nbar",') + 'tradeoffs:\n  - {concern: Cost, A: "green: Cheap | quick", B: "red: [dear]"}\n';
    assert.deepEqual((await op.ask(id, { yaml: unsafe, dir: work })).text.split('\n'), ['options[0].title must be one line.', 'tradeoffs[0].A has a "|", which would break the Options table; use "/" or words.', 'tradeoffs[0].B has a square bracket; use parentheses.']);
    const { compile } = await import('../src/card.ts');
    const fenced = compile({ yaml: small('Diff?').replace('  - {label: Sushi, title: Sushi, prioritizes: fish}', '  - label: Sushi\n    title: Sushi\n    prioritizes: fish\n    changes: |\n      - One line.\n\n      ```python\n      # a comment, not a heading\n      def f():\n          return 1\n\n      ```'), dir: work });
    assert.ok(fenced.ok && fenced.brief.card.markdown.includes('### What A changes\n- One line.\n\n```python\n# a comment, not a heading\ndef f():\n    return 1\n\n```'), fenced.ok ? fenced.brief.card.markdown : fenced.problems.join());

    // history with a nonsense limit reads as the default; a server that isn't a URL is refused, not a crash.
    assert.match(op.history(id, Number('abc')).text, /Two\?|One\?/);
    // --server names another server, and the agent keeps it.
    process.env.AGENTPAGER_SERVER = 'http://127.0.0.1:9';
    const elsewhere = await op.connect({ number: p.number, app: 'Codex', project: 'edges', server: f.origin + '/' });
    assert.equal(elsewhere.code, 0, elsewhere.text);
    assert.match((await op.status(field(elsewhere, 'agent'))).text, /Pager: on/);
    assert.equal((await op.connect({ number: p.number, server: 'agentpager.me' })).text, "--server takes the server's address, such as https://agentpager.me.");
    process.env.AGENTPAGER_SERVER = 'not a url';
    const bad = await op.connect({ number: p.number, app: 'Codex', project: 'edges' });
    assert.equal(bad.code, 5); assert.match(bad.text, /^Can't reach not a url \(/);
  } finally { process.env.AGENTPAGER_SERVER = f.origin; await f.stop(); }
});

// A stand-in for a network that loses replies: it passes each call to the server, and for the next `lose` asks keeps
// the server's reply from the command, closing the connection instead.
async function lossy(target: string) {
  let lose = 0, asks = 0, lost = 0, before: (lost: number) => Promise<void> = async () => {};
  let stalled: Promise<void> | null = null;
  const pass = (h: IncomingHttpHeaders) => Object.fromEntries(['content-type', 'authorization', 'x-agentpager-client'].filter(k => h[k]).map(k => [k, String(h[k])]));
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const reply = await fetch(target + req.url, { method: req.method, headers: pass(req.headers), body: chunks.length ? Buffer.concat(chunks) : undefined });
    const body = Buffer.from(await reply.arrayBuffer());
    if (req.method === 'POST' && /\/cards$/.test(req.url ?? '')) {
      asks++;
      if (stalled) { const until = stalled; stalled = null; await until; }
      else if (lose > 0) { lose--; await before(++lost); req.socket.resetAndDestroy(); return; }
    }
    res.writeHead(reply.status, { 'content-type': reply.headers.get('content-type') ?? 'application/json' });
    res.end(body);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`,
    // `then` runs before each lost reply is dropped, with how many have been lost so far.
    lose: (n: number, then: (lost: number) => Promise<void> = async () => {}) => { lose = n; asks = 0; lost = 0; before = then; }, asks: () => asks,
    // The next ask reaches the server, and its reply waits until the returned function is called.
    stall: () => { let go = () => {}; stalled = new Promise<void>(r => { go = r; }); return go; },
    close: () => new Promise(r => { server.closeAllConnections(); server.close(r); }),
  };
}

test('B27.9 B32.10 A lost ask reply is never taken as success, and asking the same card again reaches the owner once', { timeout: 240_000 }, async () => {
  const f = await fixture('cli-lost'), net = await lossy(f.origin);
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-cli-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-card-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = net.origin; delete process.env.AGENTPAGER_PAGER;
  delete process.env.CLAUDECODE;
  const op = await import('../src/commands.ts'), store = await import('../src/store.ts');
  const card = (title: string) => { const file = path.join(work, `${title.replace(/\W/g, '')}.yaml`); writeFileSync(file, `title: ${title}\ndetail: Where to eat.\ncontext:\n  summary: Friday is booked.\noptions:\n  - {label: Sushi, title: Sushi, prioritizes: fish}\n  - {label: Pasta, title: Pasta, prioritizes: carbs}\nrecommendation: {option: B, why: Closer.}\n`); return file; };
  try {
    const p = await f.makePager();
    const id = field(await op.connect({ number: p.number, app: 'Codex', project: 'lost' }), 'agent');
    const onPhone = async () => (await f.pager(p.pagerId, p.phone)).agents.flatMap(a => a.open).map(d => [d.title, d.decisionId]);
    const recorded = (short: string) => store.loadAgent(id)?.decisions[short]?.id;
    // The decision a kept request id names: the service's agent id with it (decisionIdOf).
    const named = async (requestId: string) => decisionIdOf(store.loadAgent(id)?.agentId ?? '', requestId);

    // One reply lost: the command sends the ask once more with the same request id, and the owner has it once.
    net.lose(1);
    const once = await op.ask(id, { file: card('Lost once?') });
    assert.equal(once.code, 0, once.text);
    assert.equal(net.asks(), 2, 'sent twice');
    const [first] = await onPhone();
    assert.deepEqual(first, ['Lost once?', recorded(field(once, 'decision'))]);
    assert.deepEqual(store.loadAgent(id)?.asking, {}, 'settled');

    // Both replies lost: it may have reached the owner, so it isn't success, and the card's request id is kept.
    net.lose(2);
    const lost = await op.ask(id, { file: card('Lost twice?') });
    assert.deepEqual([lost.code, lost.text], [5, `No reply from ${net.origin} (the connection closed).\nThis may or may not have reached your owner. Check with \`agentpager status --agent ${id}\` before trying again.\nAsking again with the same card is safe: your owner gets it once.`]);
    const kept = Object.values(store.loadAgent(id)?.asking ?? {});
    assert.equal(kept.length, 1);
    assert.equal(kept[0].sendingUntil, undefined, 'no run holds it now');
    const decision = await named(kept[0].requestId);
    assert.deepEqual(await onPhone(), [first, ['Lost twice?', decision]], 'it did reach the owner, once');
    assert.equal(Object.keys(store.loadAgent(id)?.decisions ?? {}).length, 1, 'nothing recorded as asked');

    // Asked again by a new run of the command, the same card finds that decision: still one on the phone.
    const again = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', path.join(cli, 'src', 'main.ts'), 'ask', '--agent', id, card('Lost twice?'), '--json'], { env: process.env });
      let out = ''; child.stdout.on('data', d => { out += d; }); child.on('error', reject); child.on('close', () => resolve(out));
    });
    const short = JSON.parse(again).result.decision;
    assert.equal(recorded(short), decision);
    assert.deepEqual(await onPhone(), [first, ['Lost twice?', decision]]);
    assert.deepEqual(store.loadAgent(id)?.asking, {}, 'settled');
    await f.answer((await f.pager(p.pagerId, p.phone)).agents[0].agent.agentId, p.phone, decision);
    assert.match((await op.wait(id, short)).text, /^Answered at .*: option B "Pasta"\./);

    // One run at a time sends a card: another run of the same card while this one is sending is refused with nothing
    // sent, so it can't settle the id this run is about to be unsure of. This run loses both replies and keeps the
    // id, so asking again finds the one decision.
    let meanwhile: Result | undefined, sent = 0;
    net.lose(2, async n => { if (n === 1) { const before = net.asks(); meanwhile = await op.ask(id, { file: card('At once?') }); sent = net.asks() - before; } });
    const racing = await op.ask(id, { file: card('At once?') });
    assert.deepEqual([meanwhile?.code, meanwhile?.text, sent], [2, 'Another run is sending this same card now. Nothing was sent: wait for its reply, then ask again only if it says to.', 0]);
    assert.equal(racing.code, 5, racing.text);
    assert.match(racing.text, /Asking again with the same card is safe/);
    const once2 = await op.ask(id, { file: card('At once?') });
    assert.equal(once2.code, 0, once2.text);
    assert.equal((await onPhone()).filter(([title]) => title === 'At once?').length, 1, 'one decision');

    // A run that outlives its hold (here a hold of 0 ms, as if it paused for minutes) can't drop the request id a later
    // run has since been unsure of: only the run that last took the card may change it.
    const go = net.stall(), asked = net.asks();
    const paused = op.ask(id, { file: card('Outlived?') }, undefined, 0);
    await until(async () => net.asks(), n => n === asked + 1);
    net.lose(2);
    const later2 = await op.ask(id, { file: card('Outlived?') });
    assert.equal(later2.code, 5, later2.text);
    assert.match(later2.text, /Asking again with the same card is safe/);
    go();
    assert.equal((await paused).code, 0, 'the paused run gets its reply');
    const outlived = Object.values(store.loadAgent(id)?.asking ?? {});
    assert.equal(outlived.length, 1, 'the later run\'s request id is still kept');
    assert.equal((await op.ask(id, { file: card('Outlived?') })).code, 0);
    assert.equal((await onPhone()).filter(([title]) => title === 'Outlived?').length, 1, 'one decision');

    // Once settled, the same card asked again is a new decision, as the agent meant it.
    const later = await op.ask(id, { file: card('Lost twice?') });
    assert.equal(later.code, 0, later.text);
    assert.notEqual(recorded(field(later, 'decision')), decision);
    assert.deepEqual((await onPhone()).map(([title]) => title), ['Lost once?', 'At once?', 'Outlived?', 'Lost twice?']);
  } finally { await net.close(); await f.stop(); }
});
