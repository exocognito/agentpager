// Rebuilds the 10 cards of 28–29 Oct (test/regression/) from the Codex transcript extract by running each snippet
// with stubbed I/O, for `agentpager review`. Images and pages the transcript doesn't hold are named, not included.
// Usage: node scripts/regression-cards.mjs <test/regression/cards-2026-10-28.txt> <out dir>
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const [src, out] = process.argv.slice(2);
const lines = readFileSync(src, 'utf8').split('\n');
const ok = { ok: true, status: 200, json: () => ({ decisionId: 'd', status: 'pending', answer: { answerId: 'a', choice: { kind: 'option', number: 1 } } }) };
const ctx = vm.createContext({ fetch: () => ok, nodeRepl: { write() {} }, pagerSession: 's', pagerKey: 'k', JSON, structuredClone, console, Buffer,
  ...Object.fromEntries(['m10', 'm11', 'm12', 'm13', 'm11r3', 'm11r4'].map(k => [`${k}Attachments`, []])),
  shotFiles: ['normal.png', 'pre-save.png', 'unavailable.png', 'mcp.png', 'cli.png'].map(name => ({ name, type: 'image/png', base64: '(image omitted)' })) });
for (const line of lines) {
  const m = line.match(/mcp__node_repl__js\(\{code:("(?:[^"\\]|\\.)*")/);
  if (!m) continue;
  const code = JSON.parse(m[1]).replaceAll('await ', '');
  try { vm.runInContext(code, ctx, { timeout: 1000 }); } catch { /* I/O we don't need */ }
}
const order = ['pagerCard', 'm9Card', 'm9VisualCard', 'm9AttachedCard', 'm10Card', 'm11Card', 'm12Card', 'm13Card', 'm11r3Card', 'm11r4Card'];
const names = ['4.31pm-M8', '7.36pm-M9-policies', '8.29pm-M9-mockup', '8.33pm-M9-mockup-attached', '9.17pm-M10', '10.17pm-M11', '10.43pm-M12', '1.06am-M13', '7.30am-M11-rev3', '8.03am-M11-rev4'];
order.forEach((v, i) => {
  const card = ctx[v];
  if (!card) { console.log('missing', v); return; }
  // Attachments the transcript doesn't hold are named by the card's own links, their content left out.
  const named = [...new Set([...String(card.card?.markdown ?? '').matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1]).filter(t => !t.startsWith('http')))];
  const listed = (card.attachments ?? []).map(a => ({ name: a.name, type: a.type, ...(a.text ? { text: a.text.length > 4000 ? a.text.slice(0, 4000) + '\n[… page continues …]' : a.text } : { content: '(image, not shown here)' }) }));
  for (const name of named) if (!listed.some(a => a.name === name)) listed.push({ name, type: name.endsWith('.md') ? 'text/markdown' : 'image/png', content: '(attached; its content is not in this extract)' });
  const slim = { ...card, ...(listed.length ? { attachments: listed } : {}) };
  writeFileSync(`${out}/${String(i + 1).padStart(2, '0')}-${names[i]}.json`, JSON.stringify(slim, null, 2));
  console.log(names[i], card.title);
});
