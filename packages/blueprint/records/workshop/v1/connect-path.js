// Generator for the "Connect path" page, the owner-first way in (C13::connect-an-agent-from-the-phone), laid out like the Happy path page. Run through the tldraw desktop exec API with SHOTS prepended:
// const SHOTS = { '<storybook id>': 'data:image/jpeg;base64,...' } — 390 px Storybook captures at 2x.
const { createShapeId, toRichText, AssetRecordType, getIndexBetween } = await import('tldraw');
const GEN = 'mcards-v1-connect', PAGE = 'Connect path';
const prior = editor.getCurrentPageId();
let page = editor.getPages().find(p => p.name === PAGE);
if (!page) { editor.createPage({ id: 'page:mcards-v1-connect', name: PAGE });
  // Sit right after the Happy path page.
  const pages = editor.getPages(), happy = pages.find(p => p.name === 'Happy path'), after = pages[pages.indexOf(happy) + 1];
  if (happy) editor.updatePage({ id: 'page:mcards-v1-connect', index: getIndexBetween(happy.index, after?.id === 'page:mcards-v1-connect' ? undefined : after?.index) }); page = editor.getPages().find(p => p.name === PAGE); }
editor.setCurrentPage(page.id);
editor.deleteShapes(editor.getCurrentPageShapes().filter(s => s.meta?.gen === GEN).map(s => s.id));
const id = k => createShapeId(`${page.id.slice(5)}-${k}`);
const base = { opacity: 1, meta: { gen: GEN } };
const text = (k, x, y, w, t, o = {}) => editor.createShape({ ...base, id: id(k), type: 'text', x, y, props: { w, autoSize: false, font: 'sans', size: o.size ?? 's', color: o.color ?? 'black', textAlign: o.align ?? 'start', richText: toRichText(t) } });
const box = (k, x, y, w, h, t, o = {}) => editor.createShape({ ...base, id: id(k), type: 'geo', x, y, props: { geo: o.geo ?? 'rectangle', w, h, color: o.color ?? 'black', fill: o.fill ?? 'none', dash: o.dash ?? 'solid', size: o.size ?? 's', font: 'sans', align: o.align ?? 'start', verticalAlign: o.valign ?? 'start', labelColor: o.labelColor ?? o.color ?? 'black', richText: toRichText(t) } });
const arrow = (k, from, to, label, o = {}) => {
  const a = id(k);
  editor.createShape({ ...base, id: a, type: 'arrow', x: 0, y: 0, props: { color: o.color ?? 'green', size: o.size ?? 'l', dash: o.dash ?? 'solid', font: 'sans', labelColor: o.color ?? 'green', richText: toRichText(label), start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } });
  editor.createBindings([
    { type: 'arrow', fromId: a, toId: from, props: { terminal: 'start', normalizedAnchor: o.fromAnchor ?? { x: 1, y: 0.5 }, isExact: false, isPrecise: true } },
    { type: 'arrow', fromId: a, toId: to, props: { terminal: 'end', normalizedAnchor: o.toAnchor ?? { x: 0, y: 0.5 }, isExact: false, isPrecise: true } },
  ]);
};

// One entry per step of the connect path (E30::connect-an-agent), in order. `shot` is the nearest Storybook story;
// fixtures can differ from the tracer's data.
const STEPS = [
  { shot: 'v1-home--one-session', title: 'Home', where: '/app', state: 'home.list.browse', does: 'The owner wants to bring in another agent and taps +.', next: '+ (CONNECT)' },
  { shot: 'v1-home--connect-making', title: 'Making the link', where: '/app', state: 'home.list.connect.listening', does: 'The phone makes a connect id and registers it (openConnect). No link shows until it is registered: "Making your link…".', next: 'CONNECT_OPENED' },
  { shot: 'v1-home--connect', title: 'Connect an agent', where: '/app', state: 'home.list.connect.listening', does: 'Scan the agent\'s QR code with the phone\'s camera (C1), or give the agent the link /start?connect=:connectId. Copy, in the link row, selects the link, then tries the clipboard; a refusal shows nothing. A new id every CONNECT_ROTATE_MS. The owner copies the link to the agent.', next: 'owner pastes\nthe link;\nagent joins' },
  { shot: 'v1-screens--pairing', title: 'Choose the emoji', where: '/app → /s/:id', state: 'home.list.connect.opening\n→ loading → live.screen.view\nlive.clock.unpaired', does: 'On the phone\'s next read the new unpaired session appears (SYNC) and the phone opens it at once, on its pairing card, as in happy path step 5. No sheet says the agent joined. If the owner had closed the sheet, the session waits as an unpaired row on home. The agent tells the owner the emoji; the owner selects it. Fixture is the blueprint session.', next: 'SELECT\nthen SEND' },
  { shot: 'v1-screens--pairing-undoing', title: 'Undo, then sending', where: '/s/:id', state: 'live.screen.undoing →\nsending → sent', does: 'As happy path steps 6–7: Undo for 5 seconds (X cancels and closes), then sending.', next: 'agent\nconfirms' },
  { shot: 'v1-screens--pairing-confirmed', title: 'Agent confirmed', where: '/s/:id', state: 'live.screen.sent\nclock → counting', does: 'As happy path step 8: "Your agent confirmed" and its next steps, then Close.', next: 'Close (BACK)' },
  { shot: 'v1-happy-path--queue', title: 'Decision list', where: '/s/:id', state: 'live.screen.queue\nlive.clock.counting', does: 'Close lands on this session\'s decisions, the same as after the scanned link. The pairing card sits in History with the emoji chosen. From here the session runs as the happy path. A second join with the same id, or one after CONNECT_LINK_LIFETIME_MS, is refused with ConnectLinkInvalid.' },
];

const W = 300, H = 649, GAP = 220, X0 = 0, Y = 560;
const SUB = 'MCARDS design v1 as this PR proposes it. From the home screen\'s + the phone gives one agent a connect link; the agent joins the phone directly and the emoji handshake still confirms it (C13). Generated by records/workshop/v1/connect-path.js.';
text('title', 0, -40, 2600, 'OwnerPager · MCARDS v1 · Connect path', { size: 'xl' });
text('sub', 0, 40, 2600, SUB, { size: 's' });
box('legend', 2700, -40, 1100, 230, 'Legend\n• Blue arrows: the connect path, in order. Labels are the machine events.\n• Circled number: the step, the same as the chip above.\n• Text under a screen is the margin: route, machine state, what happens. Nothing in the margin is UI.\n• Orange Q: an open question for you. All of them are listed on the Happy path page.\n• Bands at the bottom: the route, the machine regions and what the agent does.', { color: 'black' });

let bottom = 0;
STEPS.forEach((s, i) => {
  const x = X0 + i * (W + GAP);
  box(`chip${i}`, i * 300, 260, 280, 60, `${i + 1} · ${s.title}`, { color: 'blue', fill: 'semi', align: 'middle', valign: 'middle' });
  box(`num${i}`, x, Y - 110, 70, 70, String(i + 1), { geo: 'ellipse', color: 'blue', fill: 'semi', align: 'middle', valign: 'middle', size: 'm' });
  text(`head${i}`, x + 85, Y - 95, W - 85, s.title, { size: 'm' });
  const assetId = AssetRecordType.createId(`${GEN}-${i}`);
  // Replace the image on every run so a step that changed its story never shows the old capture.
  if (editor.getAsset(assetId)) editor.deleteAssets([assetId]);
  editor.createAssets([{ id: assetId, type: 'image', typeName: 'asset', props: { name: `${s.shot}.jpg`, src: SHOTS[s.shot], w: 780, h: 1688, mimeType: 'image/jpeg', isAnimated: false }, meta: {} }]);
  editor.createShape({ ...base, id: id(`img${i}`), type: 'image', x, y: Y, props: { assetId, w: W, h: H } });
  box(`frame${i}`, x - 4, Y - 4, W + 8, H + 8, '', { color: 'blue', size: 'm' });
  text(`margin${i}`, x, Y + H + 30, W, `${s.where}\n${s.state}\n\n${s.does}\n\nstory: ${s.shot.replace('v1-', '')}`, { size: 's' });
  if (s.q) text(`q${i}`, x, editor.getShapePageBounds(id(`margin${i}`)).maxY + 30, W, s.q, { color: 'orange', size: 's' });
  bottom = Math.max(bottom, editor.getShapePageBounds(id(s.q ? `q${i}` : `margin${i}`)).maxY);
  if (i > 0) arrow(`arrow${i}`, id(`frame${i - 1}`), id(`frame${i}`), STEPS[i - 1].next, { color: 'blue' });
});

const span = (a, b) => [X0 + a * (W + GAP) - 20, (b - a) * (W + GAP) + W + 40];
const BAND = bottom + 60;
[['b-home', 0, 2, 0, '/app · home machine'], ['b-machine', 3, 6, 0, '/s/:sessionId · cards machine'],
 ['b-connect', 1, 2, 1, 'list.connect: listening → opening, which opens /s/:id'], ['b-screen', 3, 6, 1, 'screen: view → undoing → sending → sent → queue'],
 ['b-agent', 2, 4, 2, 'agent: reads /start?connect=:connectId (joins nothing) → joinPhone or join_session with its name → tells the owner the emoji → acknowledges'],
 ['b-unpaired', 3, 4, 3, 'clock: unpaired'], ['b-counting', 5, 6, 3, 'clock: counting (24 h from pairing)']]
  .forEach(([k, a, b, row, t]) => { const [x, w] = span(a, b); box(k, x, BAND + row * 90, w, 70, t, { color: 'black', dash: 'dashed', valign: 'middle' }); });

editor.setCurrentPage(prior);
await helpers.saveDoc();
return { page: page.id, steps: STEPS.length };
