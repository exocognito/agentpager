// The design catalogue, blueprint/generated/screens: the real app's screens and journeys as checked-in images and
// text, so an agent can see the design without a Simulator.
//   node scripts/designs.mjs          (pnpm designs) regenerates it, on a Mac with Xcode and the iPhone 17e Simulator
//   node scripts/designs.mjs --check  (in pnpm check) fails when its sources changed since; needs only git and Node
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('..', import.meta.url));
const repo = path.resolve(app, '../..');
const out = path.join(repo, 'blueprint/generated/screens');
const ios = path.join(repo, 'packages/ios');
const DEVICE = 'iPhone 17e';

// What the catalogue is drawn from: a change to any of these can change an image, so it makes the catalogue stale.
// The rest of the server (routing, storage, alerts) is left out: it changes often and draws nothing itself. The wire
// contract it serves, every shape the phone draws from, is in.
const SOURCES = [
  'packages/ios/AgentPager', // the app
  'packages/ios/AgentPagerUITests', // the screens and journeys, and what their agents ask
  'packages/app/fixtures/briefs', // the briefs journey's four briefs
  'packages/app/scripts/briefs.ts', // its agent, and the words it acknowledges with
  'packages/cli/src/seal.ts', // how that agent seals what it asks and opens what it is answered
  'packages/contract', // the wire contract, and the brief's wire format
  'packages/app/src/contract.ts', // the server's side of it: its clocks and refusals
  'packages/app/src/browser.tsx', // the front page
  'packages/app/scripts/build.mjs', // its HTML shell and bundle
  'packages/app/src/site', // the front page's parts
  'packages/app/scripts/designs.mjs', // this script, which writes the index
];

// The journeys: UI tests against the local server, each playing the agent over the HTTP API.
const JOURNEYS = [
  { name: 'pager', test: 'FlowTests/testPagerJourney', about: 'Make a pager; two agents connect with its number and ask; answer one through the Undo window; the agent confirms; the closed record.' },
  { name: 'briefs', test: 'BriefTests/testBriefs', about: 'The four example briefs (D1–D4) from a real agent: the Options sheet, images, background pages, picking and sending, asking for changes, and an answered brief.' },
  { name: 'undo-and-changes', test: 'FlowTests/testUndoChangesAndNotConfirmed', about: 'An answer whose sends all fail (Answer Not Confirmed, Retry), Undo inside the window, leaving the app during Undo, and Ask for changes.' },
  { name: 'off-and-on', test: 'FlowTests/testOffAndOn', about: 'Switch a pager off: its agents are refused and its decision shows Turn on; turn it back on and answer.' },
  { name: 'delete', test: 'FlowTests/testDeletePager', about: 'Delete a pager from its detail screen: confirm, and it is gone from the phone.' },
];

// Tracked files as they are on disk, and new files not yet added if their extension is in SOURCE_FILE. TypeScript
// unit tests (*.test.ts) and ignored files don't count; the iPhone UI tests do, since they draw the journeys.
const SOURCE_FILE = /\.(swift|ts|tsx|css|mjs|md|json|plist|png|jpe?g)$/;
function fingerprint() {
  const list = (...args) => execFileSync('git', ['ls-files', '-z', ...args, '--', ...SOURCES], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean);
  const files = [...new Set([...list('--cached'), ...list('--others', '--exclude-standard').filter(file => SOURCE_FILE.test(file))])]
    .filter(file => !file.endsWith('.test.ts') && existsSync(path.join(repo, file))).sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(`${file}\0${createHash('sha256').update(readFileSync(path.join(repo, file))).digest('hex')}\n`);
  return { hash: hash.digest('hex').slice(0, 16), files: files.length };
}

if (process.argv.includes('--check')) {
  const index = path.join(out, 'README.md');
  const stored = existsSync(index) ? readFileSync(index, 'utf8').match(/^Fingerprint: `([0-9a-f]+)`/m)?.[1] : undefined;
  const { hash } = fingerprint();
  if (stored !== hash) {
    console.error('Design screens are stale: what they are drawn from (the iPhone app, its UI tests, the brief fixtures, the wire contract or the front page) changed since. Run `pnpm designs` on a Mac and commit blueprint/generated/screens.');
    process.exit(1);
  }
  console.log(`Design screens are current (fingerprint ${hash}).`);
  process.exit(0);
}

const started = Date.now();
const scratch = mkdtempSync(path.join(tmpdir(), 'agentpager-designs-'));
const derived = path.join(tmpdir(), 'agentpager-designs-build'); // kept between runs, so a rebuild is incremental
const log = path.join(scratch, 'log.txt');
const logStream = createWriteStream(log);
const children = new Set();
let server, wasBooted = true, udid, appearance;

async function freePort() {
  const s = createServer();
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  const { port } = s.address();
  await new Promise(resolve => s.close(resolve));
  return port;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const step = text => console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${text}`);
const simctl = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' });

// Runs a command to the end, its output to the log. Test results go to the console too. Resolves with the output.
function run(command, args, { cwd = ios, env = {}, timeout = 30 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    logStream.write(`\n$ ${command} ${args.join(' ')}\n`);
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    let output = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    const take = chunk => {
      const text = chunk.toString();
      output += text;
      logStream.write(text);
      for (const line of text.split('\n')) if (/^Test Case .*(passed|failed|skipped)/.test(line) || /: error: /.test(line)) console.log(`  ${line.trim()}`);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('exit', code => {
      clearTimeout(timer);
      children.delete(child);
      code === 0 ? resolve(output) : reject(new Error(`${path.basename(command)} ${args[0]} failed (exit ${code}); the log is ${log}`));
    });
  });
}

// The local server, in its own process group so it can be stopped whole: workerd runs under wrangler under pnpm.
async function startServer() {
  const [port, inspector] = [await freePort(), await freePort()];
  const origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['scripts/start.mjs'], {
    cwd: app, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), AGENTPAGER_INSPECTOR_PORT: String(inspector), AGENTPAGER_PERSIST: path.join(scratch, 'persist'), AGENTPAGER_BUILD_DIR: path.join(scratch, 'server') },
  });
  server.stdout.pipe(createWriteStream(path.join(scratch, 'server.log')));
  server.stderr.pipe(createWriteStream(path.join(scratch, 'server.err.log')));
  for (const stop = Date.now() + 120_000; Date.now() < stop; await pause(250)) {
    if (server.exitCode !== null) throw new Error(`the server exited; see ${scratch}/server.err.log`);
    try { if ((await fetch(origin + '/')).ok) return origin; } catch { /* not listening yet */ }
  }
  throw new Error(`the server did not start; see ${scratch}/server.err.log`);
}

async function stopServer() {
  const pid = server?.pid;
  if (!pid) return;
  const gone = () => { try { process.kill(-pid, 0); return false; } catch { return true; } };
  try { process.kill(-pid, 'SIGTERM'); } catch { return; }
  for (let n = 0; n < 50 && !gone(); n++) await pause(100);
  if (!gone()) process.kill(-pid, 'SIGKILL');
  server = undefined;
}

// One way out, however the run ends: stop the tests and the server, and put the Simulator back as it was.
let stopping;
function shutdown() {
  stopping ??= (async () => {
    for (const child of children) child.kill('SIGTERM');
    await stopServer();
    if (!udid) return;
    try { simctl('status_bar', udid, 'clear'); } catch { /* the Simulator may be gone */ }
    if (appearance) try { simctl('ui', udid, 'appearance', appearance); } catch { /* likewise */ }
    if (!wasBooted) try { simctl('shutdown', udid); } catch { /* already shut down */ }
  })();
  return stopping;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  console.error(`pnpm designs: stopped by ${signal}; cleaning up`);
  await shutdown();
  process.exit(130);
});

function simulator() {
  const { devices } = JSON.parse(simctl('list', 'devices', 'available', '-j'));
  const found = Object.entries(devices).filter(([runtime]) => runtime.includes('iOS')).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .flatMap(([runtime, list]) => list.filter(d => d.name === DEVICE).map(d => ({ ...d, runtime: runtime.replace(/.*SimRuntime\.iOS-/, 'iOS ').replace('-', '.') }))).at(-1);
  if (!found) throw new Error(`no ${DEVICE} Simulator: add one in Xcode (Window → Devices and Simulators)`);
  return found;
}

const xcodeTest = (only, env) => run('xcodebuild', ['test-without-building', '-project', 'AgentPager.xcodeproj', '-scheme', 'AgentPager', '-destination', `id=${udid}`, '-derivedDataPath', derived,
  '-resultBundlePath', path.join(scratch, `results-${Date.now()}.xcresult`), ...only.map(t => `-only-testing:AgentPagerUITests/${t}`)], { env });

// The phone's screenshots are 3x; 2x keeps them sharp at a third less weight.
function copyImage(from, to) {
  const height = Number(execFileSync('sips', ['-g', 'pixelHeight', from], { encoding: 'utf8' }).match(/pixelHeight: (\d+)/)[1]);
  execFileSync('sips', ['--resampleHeight', String(Math.round(height * 2 / 3)), from, '--out', to], { stdio: 'ignore' });
}

// The front page one screen at a time, top to bottom: a whole page at 390 px is too tall to read as one image.
// Returns the files made at each width.
async function frontPage(origin, dir) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const made = {};
  try {
    for (const [width, height, scale] of [[390, 844, 2], [1280, 900, 1]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
      await page.goto(origin + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      made[width] = [];
      for (let y = 0; y < total; y += height) {
        const file = `front-page-${width}-${made[width].length + 1}.png`;
        await page.screenshot({ path: path.join(dir, file), fullPage: true, clip: { x: 0, y, width, height: Math.min(height, total - y) }, animations: 'disabled' });
        made[width].push(file);
      }
      await page.close();
    }
  } finally { await browser.close(); }
  return made;
}

const table = rows => rows.map(cells => `| ${cells.join(' | ')} |`).join('\n');

async function main() {
  try { execFileSync('xcrun', ['--find', 'xcodebuild'], { stdio: 'ignore' }); } catch { throw new Error('needs a Mac with Xcode'); }
  const sources = fingerprint(); // what the images are made from, before anything can change
  const sim = simulator();
  udid = sim.udid;
  step(`${DEVICE} (${sim.runtime}); scratch and log in ${scratch}`);
  wasBooted = sim.state === 'Booted';
  simctl('bootstatus', udid, '-b');
  const was = simctl('ui', udid, 'appearance').trim();
  appearance = was === 'light' || was === 'dark' ? was : undefined; // restored when the run ends
  simctl('status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--cellularMode', 'active', '--cellularBars', '4', '--batteryState', 'charged', '--batteryLevel', '100');
  simctl('ui', udid, 'appearance', 'light');

  step('Starting the local server');
  const origin = await startServer();
  step(`Server at ${origin}; building the app and its UI tests`);
  await run('xcodebuild', ['build-for-testing', '-project', 'AgentPager.xcodeproj', '-scheme', 'AgentPager', '-destination', `id=${udid}`, '-derivedDataPath', derived]);

  const phone = path.join(scratch, 'phone'), shots = path.join(scratch, 'shots'), web = path.join(scratch, 'web');
  const env = { TEST_RUNNER_AGENTPAGER_SERVER_URL: origin, TEST_RUNNER_SCREENSHOT_DIR: shots, TEST_RUNNER_DESIGN_DIR: phone };
  step('Phone screens (DesignTests) and the flow journeys');
  await xcodeTest(['DesignTests', ...JOURNEYS.filter(j => j.test.startsWith('FlowTests/')).map(j => j.test)], env);

  // The brief journey needs a real agent between its two tests: the phone makes the pager, the agent asks with its
  // number, then the phone answers (packages/ios/README.md, Decision briefs).
  step('Brief journey: the pager, then the agent, then the owner');
  const number = (await xcodeTest(['BriefTests/testPagerNumber'], { ...env, TEST_RUNNER_AGENTPAGER_BRIEF_RESET: '1' })).match(/AGENTPAGER_NUMBER=(ap1_[A-Za-z0-9_-]+)/)?.[1];
  if (!number) throw new Error(`BriefTests/testPagerNumber printed no pager number; the log is ${log}`);
  const agent = spawn(process.execPath, ['--experimental-strip-types', 'scripts/briefs.ts', origin, number], { cwd: app, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(agent);
  let agentOutput = '';
  agent.stdout.on('data', chunk => { agentOutput += chunk; logStream.write(chunk); });
  agent.stderr.on('data', chunk => logStream.write(chunk));
  const agentDone = new Promise(resolve => agent.on('exit', code => { children.delete(agent); resolve(code); }));
  for (const stop = Date.now() + 60_000; (agentOutput.match(/^asked /gm) ?? []).length < 4; await pause(250)) {
    if (agent.exitCode !== null || Date.now() > stop) throw new Error(`the brief agent did not ask its four briefs; the log is ${log}`);
  }
  await xcodeTest(['BriefTests/testBriefs'], env);
  if (await Promise.race([agentDone, pause(60_000).then(() => 'timeout')]) !== 0) throw new Error(`the brief agent did not acknowledge every answer; the log is ${log}`);

  step('Front page in Chromium');
  mkdirSync(web);
  const front = await frontPage(origin, web);

  step('Writing the catalogue');
  const next = path.join(scratch, 'screens');
  for (const dir of ['phone', 'journeys', 'web']) mkdirSync(path.join(next, dir), { recursive: true });

  // Phone states in DesignTests' order.
  const states = [...readFileSync(path.join(ios, 'AgentPagerUITests/DesignTests.swift'), 'utf8').matchAll(/capture\("(\w+)"/g)].map(m => m[1]);
  const phoneRows = states.map(state => {
    for (const file of [`${state}.png`, `${state}.txt`]) if (!existsSync(path.join(phone, file))) throw new Error(`DesignTests made no ${file}`);
    copyImage(path.join(phone, `${state}.png`), path.join(next, 'phone', `${state}.png`));
    copyFileSync(path.join(phone, `${state}.txt`), path.join(next, 'phone', `${state}.txt`));
    const about = readFileSync(path.join(phone, `${state}.txt`), 'utf8').split('\n')[0].replace(/^-demo \w+: /, '');
    return [`[${state}.png](phone/${state}.png)`, `[${state}.txt](phone/${state}.txt)`, about];
  });

  const journeyRows = JOURNEYS.map(journey => {
    const from = path.join(shots, journey.test.split('/')[1]);
    const frames = readFileSync(path.join(from, 'frames.tsv'), 'utf8').trim().split('\n').map(line => line.split('\t'));
    // Two frames alike mean a step that showed nothing new.
    const seen = new Map();
    for (const [name] of frames) {
      const digest = createHash('sha256').update(readFileSync(path.join(from, `${name}.png`))).digest('hex');
      if (seen.has(digest)) throw new Error(`journey ${journey.name}: frame ${name} is the same image as ${seen.get(digest)}; drop one, or make its step show something new`);
      seen.set(digest, name);
    }
    const dir = path.join(next, 'journeys', journey.name);
    mkdirSync(dir);
    const lines = frames.map(([name, action], i) => {
      const file = `${String(i + 1).padStart(2, '0')}-${name}.png`;
      copyImage(path.join(from, `${name}.png`), path.join(dir, file));
      return `### ${i + 1}. ${name}\n\n${/[.?!"]$/.test(action) ? action : action + '.'}\n\n<img src="${file}" alt="${name}" width="300">\n`;
    });
    writeFileSync(path.join(dir, 'README.md'), `# Journey: ${journey.name}\n\n${journey.about}\n\nFrom \`${journey.test}\` in \`packages/ios/AgentPagerUITests\`, against a local server, the test playing the agent over the HTTP API. Each frame is the screen after the action written above it. Generated by \`pnpm designs\`: don't edit it by hand.\n\n${lines.join('\n')}`);
    return [`[${journey.name}](journeys/${journey.name}/README.md)`, String(frames.length), journey.about];
  });

  for (const file of Object.values(front).flat()) copyFileSync(path.join(web, file), path.join(next, 'web', file));
  const screens = width => front[width].map((file, i) => `[${i + 1}](web/${file})`).join(' ');

  const { hash, files } = sources;
  const minutes = Math.max(1, Math.round((Date.now() - started) / 60_000));
  writeFileSync(path.join(next, 'README.md'), `# Design screens

The real app, drawn from its code: read these to see the design without a Simulator. Generated by \`pnpm designs\`; don't edit anything here by hand.

Fingerprint: \`${hash}\`

The phone is the SwiftUI app (\`packages/ios\`) in the ${DEVICE} Simulator, ${sim.runtime}, saved at 2x. The web is the front page from the local server in headless Chromium.

## Regenerate

On a Mac with Xcode and the ${DEVICE} Simulator, run \`pnpm designs\` (the last run took about ${minutes} min) and commit this folder. It starts a local server on a free port and stops it after, runs the UI tests (\`DesignTests\` and the journeys below), renders the front page, and rewrites this folder only once everything has passed. It prints the scratch folder that holds its full log.

The fingerprint is a hash of the ${files} files it is drawn from: ${SOURCES.map(source => `\`${source}\``).join(', ')}. TypeScript unit tests (\`*.test.ts\`) don't count; the iPhone UI tests do, since they draw the journeys. An untracked file counts only with one of these extensions: .swift, .ts, .tsx, .css, .mjs, .md, .json, .plist, .png, .jpg, .jpeg. The rest of the server (routing, storage, alerts) is left out: it changes often and draws nothing itself, so after a change there that shows on screen, run \`pnpm designs\` by hand. \`pnpm check\` fails when the fingerprint no longer matches.

## Phone: \`phone/\`

One screen per \`-demo\` state: the mocks' sample data (\`packages/ios/AgentPager/Preview/Previews.swift\`), no network, in light appearance. \`<state>.txt\` is the screen's accessibility tree: a line on what it shows, then one element per line, indented by depth, as \`type #identifier "label" value="…" [x,y wxh]\` in points.

${table([['Screen', 'Tree', 'What it shows'], ['---', '---', '---'], ...phoneRows])}

## Journeys: \`journeys/\`

Interactions as storyboards: each journey's README lists its numbered frames, each with the action that led to it.

${table([['Journey', 'Frames', 'What it shows'], ['---', '---', '---'], ...journeyRows])}

## Web: \`web/\`

The front page, \`/\`, one screen at a time from the top: \`front-page-<width>-<n>.png\`.

${table([['Width', 'Screens', 'What it shows'], ['---', '---', '---'], ['390 px', screens(390), 'The front page on a phone, 844 px per screen, at 2x.'], ['1280 px', screens(1280), 'The front page on a laptop, 900 px per screen.']])}
`);

  // The old catalogue moves into the scratch folder rather than being deleted.
  if (existsSync(out)) renameSync(out, path.join(scratch, 'previous-screens'));
  renameSync(next, out);
  const images = readdirSync(out, { recursive: true }).filter(file => String(file).endsWith('.png')).length;
  step(`Done: ${images} images (${states.length} phone states, ${JOURNEYS.length} journeys, ${Object.values(front).flat().length} web) in ${path.relative(repo, out)}`);
}

try {
  await main();
} catch (error) {
  console.error(`pnpm designs failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await shutdown();
}
