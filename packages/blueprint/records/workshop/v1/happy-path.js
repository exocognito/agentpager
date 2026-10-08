// Generator for the "Happy path" page, from design/v1 on main. Run through the tldraw desktop exec API with SHOTS prepended:
// const SHOTS = { '<storybook id>': 'data:image/jpeg;base64,...' } — 390 px Storybook captures at 2x.
const { createShapeId, toRichText, AssetRecordType } = await import('tldraw');
const GEN = 'mcards-v1-happy', PAGE = 'Happy path';
const prior = editor.getCurrentPageId();
let page = editor.getPages().find(p => p.name === PAGE);
if (!page) { editor.createPage({ id: 'page:mcards-v1-happy', name: PAGE }); page = editor.getPages().find(p => p.name === PAGE); }
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

// One entry per step of the happy path (E32::sessions#happy), in order. `shot` is the nearest Storybook story;
// fixtures can differ from the tracer's data.
const STEPS = [
  { shot: 'v1-marketing--preview', title: 'Front page', where: '/', state: 'web page (no machine)', does: 'Under Tell your agent, the owner taps Copy and pastes the line to the agent. Copy selects the line, then tries the clipboard; if that is refused, nothing is shown. Download opens the web app at /app.', next: 'owner pastes\nthe line' },
  { shot: 'v1-start--start', title: '/start', where: '/start', state: 'agent reads markdown', does: 'Agent reads /start ("AgentPager for agents"), creates a session with its name (createSession or start_session), and shows the QR (terminal text, or the image where its client shows images) with the full pairing link as text right below it, and the target emoji.', next: 'owner opens link\nor scans QR\n→ /p/:token' },
  { shot: 'v1-claim--claiming', title: 'Claiming', where: '/p/:token', state: 'claim page (no machine)', does: 'Claims the link and stores the phone key, then goes straight to /s/:id; normally only "Opening your session…" shows. A refused, over or unreachable link gets its own screen (Session screen statechart).', next: 'claimed\n→ /s/:id' },
  { shot: 'v1-screens--loading', title: 'Loading', where: '/s/:id', state: 'loading', does: 'Phone reads its cards (invokes load). The header pill reads Connecting.', next: 'done, unpaired\n/ openPairing' },
  { shot: 'v1-screens--pairing', title: 'Pairing card', where: '/s/:id', state: 'live.screen.view\nlive.clock.unpaired', does: 'The pairing card opens over the queue: five emoji options, no Ask for changes, Send off until one is chosen. No status pill until the phone is paired. Owner chooses the emoji the agent named (SELECT).', next: 'SEND [valid]' },
  { shot: 'v1-screens--pairing-undoing', title: 'Undo window', where: '/s/:id', state: 'live.screen.undoing', does: 'Send shows the chosen emoji under a green check with Undo and a 5-second count. Nothing has gone yet. Undo returns to the choices with the same choice; X cancels the answer and closes.', next: 'after 5 s' },
  { shot: 'v1-screens--pairing-sending', title: 'Sending', where: '/s/:id', state: 'live.screen.sending', does: 'Invokes answer. The card shows only the answer and "Sending…".', next: 'done' },
  { shot: 'v1-screens--pairing-confirmed', title: 'Agent confirmed', where: '/s/:id', state: 'live.screen.sent\nclock → counting on\nSYNC [paired]', does: 'The card stays on its answer, "Waiting for your agent", until the agent acknowledges; then "Your agent confirmed" with its next steps and a Close button. The 24 hours start at pairing.', next: 'Close\n(BACK)' },
  { shot: 'v1-happy-path--queue', title: 'Queue, paired', where: '/s/:id', state: 'live.screen.queue\nlive.clock.counting', does: 'Back on the queue. The agent asked two cards; each row shows its title and detail. Nothing opens on its own: the owner taps the next card.', next: 'OPEN the\nsecond card' },
  { shot: 'v1-happy-path--second-card', title: 'Second card', where: '/s/:id', state: 'live.screen.view', does: 'The card opens as a sheet over the queue: the title with its detail under it, close at the top right, the numbered options as one list, Send and Ask for changes. Owner answers this card first and chooses option 2; choosing sends nothing.', next: 'SEND, then\nUndo and Sending\nas steps 6–7' },
  { shot: 'v1-happy-path--second-confirmed', title: 'Agent confirmed', where: '/s/:id', state: 'live.screen.sent', does: 'The agent acknowledges. One grey box says "Your agent confirmed", when, and its next steps; Close sits below it.', next: 'Close, then\nOPEN the\nfirst card' },
  { shot: 'v1-happy-path--first-card', title: 'First card', where: '/s/:id', state: 'live.screen.view', does: 'Back on the queue, the owner taps the first card. Option 1 chosen, so Send is on.', next: 'SEND, steps\n6–8, then OPEN\nan answered card' },
  { shot: 'v1-happy-path--history', title: 'History', where: '/s/:id', state: 'live.screen.view (read-only)', does: 'With both cards answered, the owner opens the second card from History: the whole card with nothing to choose, the answer and the agent\'s reply.', next: 'BACK, then\nback arrow\n(All sessions)\n→ /app' },
  { shot: 'v1-home--all-answered', title: 'Home', where: '/app', state: 'home.list.browse', does: 'This browser\'s sessions, by the name the agent sent. Both cards are answered, so none is open. The happy tracer ends here.', next: 'row → /s/:id\nthen END\n(the Active pill)' },
  { shot: 'v1-happy-path--confirm-end', title: 'Confirm end', where: '/s/:id', state: 'live.screen.confirmEnd', does: 'End session (primary) or Keep session (secondary, BACK), both full width. The tracer stops at home; steps 15–18 close the session the owner\'s way.', next: 'CONFIRM_END' },
  { shot: 'v1-happy-path--ending', title: 'Ending', where: '/s/:id', state: 'live.screen.ending', does: 'Invokes end. The confirm sheet stays open: its primary button reads "Ending…" and both buttons are disabled.', next: 'done' },
  { shot: 'v1-happy-path--ended', title: 'Ended', where: '/s/:id', state: 'ended (final)', does: 'Storage cleared. The owner ended it, so the screen reads "You ended this session."', next: 'back arrow\n→ /app' },
  { shot: 'v1-home--after-ending', title: 'Home, after ending', where: '/app', state: 'home.list.browse', does: 'The session keeps only its name and when it ended, under Ended. + stays ready for the next agent.' },
];

const W = 300, H = 649, GAP = 220, X0 = 0, Y = 560;
const SUB = 'MCARDS design v1 as this PR proposes it: one decision at a time, each card from Send to Close. Each state is drawn as its Storybook mockup at 390 px. The connect path and the session and home statecharts are on the next pages. Generated by records/workshop/v1/happy-path.js: draw your notes on a copy of this page.';
text('title', 0, -40, 2600, 'OwnerPager · MCARDS v1 · Happy path', { size: 'xl' });
text('sub', 0, 40, 2600, SUB, { size: 's' });
box('legend', 2700, -40, 1100, 230, 'Legend\n• Green arrows: the happy path, in order. Labels are the machine events.\n• Circled number: the step, the same as the chip above.\n• Text under a screen is the margin: route, machine state, what happens. Nothing in the margin is UI.\n• Orange Q: an open question for you. Blue box: what this PR changes.\n• Bands at the bottom: the route and the machine regions each step sits in.', { color: 'black' });
box('questions', 4900, -40, 1150, 170, 'Questions for you\nNone open. Your answers are in the blue box.', { color: 'orange' });
box('changed', 6150, -40, 1350, 330, 'Changed in this PR\n• One decision at a time: a card stays on screen from Send to Close, and nothing opens the next card on its own (steps 5–9).\n• X in the Undo window cancels the answer and closes (your answer 1c); it used to send at once.\n• After Send the card shows only the answer and its status; the options come back only when you reopen it from History.\n• Once the agent confirms, a Close button sits at the bottom of the card (steps 8 and 11).\n• Steps 6–8 show the pairing card itself, not a later card.\n• /start: the agent shows the full pairing link as text right below the QR (step 2).\n• A card shows its detail under the title; there is no ⓘ button.\n• "Your agent confirmed" and its time sit in the agent\'s reply box; no separate Sent time, and no line above the button.\n• Steps 9–17 follow the same two decisions from asking to ending.\n• Each decision row has a round mark: empty while open; the emoji you chose once answered; a speech bubble if you asked for changes. Home\'s agent rows keep their coloured dots.', { color: 'blue' });

let bottom = 0;
STEPS.forEach((s, i) => {
  const x = X0 + i * (W + GAP);
  box(`chip${i}`, i * 300, 260, 280, 60, `${i + 1} · ${s.title}`, { color: 'green', fill: 'semi', align: 'middle', valign: 'middle' });
  box(`num${i}`, x, Y - 110, 70, 70, String(i + 1), { geo: 'ellipse', color: 'green', fill: 'semi', align: 'middle', valign: 'middle', size: 'm' });
  text(`head${i}`, x + 85, Y - 95, W - 85, s.title, { size: 'm' });
  const assetId = AssetRecordType.createId(`${GEN}-${i}`);
  // Replace the image on every run so a step that changed its story never shows the old capture.
  if (editor.getAsset(assetId)) editor.deleteAssets([assetId]);
  editor.createAssets([{ id: assetId, type: 'image', typeName: 'asset', props: { name: `${s.shot}.jpg`, src: SHOTS[s.shot], w: 780, h: 1688, mimeType: 'image/jpeg', isAnimated: false }, meta: {} }]);
  editor.createShape({ ...base, id: id(`img${i}`), type: 'image', x, y: Y, props: { assetId, w: W, h: H } });
  box(`frame${i}`, x - 4, Y - 4, W + 8, H + 8, '', { color: 'green', size: 'm' });
  text(`margin${i}`, x, Y + H + 30, W, `${s.where}\n${s.state}\n\n${s.does}\n\nstory: ${s.shot.replace('v1-', '')}`, { size: 's' });
  // Questions and bands sit below the tallest margin, so a long margin never runs into them.
  if (s.q) text(`q${i}`, x, editor.getShapePageBounds(id(`margin${i}`)).maxY + 30, W, s.q, { color: 'orange', size: 's' });
  bottom = Math.max(bottom, editor.getShapePageBounds(id(s.q ? `q${i}` : `margin${i}`)).maxY);
  if (i > 0) arrow(`arrow${i}`, id(`frame${i - 1}`), id(`frame${i}`), STEPS[i - 1].next);
});

const span = (a, b) => [X0 + a * (W + GAP) - 20, (b - a) * (W + GAP) + W + 40];
const BAND = bottom + 60;
[['b-front', 0, 0, 0, '/  front page'], ['b-start', 1, 1, 0, '/start  (agent)'], ['b-claim', 2, 2, 0, '/p/:token  claim page'], ['b-machine', 3, 12, 0, '/s/:sessionId · cards machine (createCardMachine)'],
 ['b-home', 13, 13, 0, '/app  home machine'], ['b-machine2', 14, 16, 0, '/s/:sessionId · cards machine'], ['b-home2', 17, 17, 0, '/app  home machine'],
 ['b-screen', 4, 12, 1, 'live (parallel) · screen region: view → undoing → sending → sent → queue → view → …'], ['b-screen2', 14, 15, 1, 'screen: confirmEnd → ending'],
 ['b-unpaired', 4, 6, 2, 'clock: unpaired'], ['b-counting', 7, 12, 2, 'clock: counting (24 h from pairing)'], ['b-counting2', 14, 15, 2, 'clock: counting']]
  .forEach(([k, a, b, row, t]) => { const [x, w] = span(a, b); box(k, x, BAND + row * 90, w, 70, t, { color: 'black', dash: 'dashed', valign: 'middle' }); });

editor.setCurrentPage(prior);
await helpers.saveDoc();
return { page: page.id, steps: STEPS.length };
