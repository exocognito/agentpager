// The id check (METHOD.md › Tests): reads the Blueprint's promises and the test names, and writes
// blueprint/generated/by-milestone.md and blueprint/generated/untested.md. It reports and never blocks.
//   node scripts/blueprint.mjs          (pnpm blueprint) rewrites both files and prints the warnings
//   node scripts/blueprint.mjs --check  (in pnpm check) fails only when either file is stale; warnings never fail it
// Known limits, in forms no test here uses (checked on 5 Nov 2026, PR #46's last review):
// - Swift: a raw string holding an escaped delimiter (`#"… \#"# …"#`) or a regex literal (`/func test_…/`) can hide a
//   fake `func test_B26_4_…` that counts.
// - TypeScript: an id written with `_` in a test's name (`test('B26_4 …')`) counts as B26.4; only Swift needs `_`.
// - untested.md's intro names `*.test.ts`, but `.test.js`, `.mjs`, `.cjs`, `.jsx` and `.tsx` files are read too.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repo = fileURLToPath(new URL('..', import.meta.url));
const OUT = 'blueprint/generated';

// An entry's heading, `### B25 · @M3 · Connect with a pager number`; a clause a later milestone added, `2. @M4: …`.
const HEADING = /^### ([BIJKL])(\d+) · @M(\d+) · (\S.*)$/;
const CLAUSE = /^(\d+)\. (.*)$/;
const ADDED = /^@M(\d+):\s*/;
const D_ID = /(?<![\w-])D\d+(?![\w-])/;
// A test counts when its name carries the id (METHOD.md › Tests). A TypeScript or JavaScript test's name is the first
// argument of a call to `test`, `it` or `describe`, or to a property of one, such as `.skip` or `test.each(table)(…)`,
// read with the TypeScript parser, so comments, regex literals and other strings can't count. Swift has no dot in a
// name, so an iPhone test is `func test`, then the id with `_` for its dot: `func test_B25_2_connectsFromMCP()`.
// The letters of retired ids (C, D) are read too, so a test naming one is reported.
const SWIFT_STRING = /(#*)("(?:"")?)/y, SWIFT_TEST = /\bfunc\s+test(\w*)/y;
const CITED = /(?<![A-Za-z0-9])([BCDIJKL])(\d+)[._](\d+)(?!\d)/g;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$|Tests\.swift$/;

// The numbered milestones in README's table, such as `| ✅ | [M1 · APP](milestones/M1-app.md) | … |`.
export function milestonesOf(readme) {
  return new Map([...readme.matchAll(/^\|[^|\n]*\| \[M(\d+) · ([^\]]+)\]\(([^)]+)\)/gm)].map(m => [Number(m[1]), { word: m[2], link: m[3] }]));
}

// One Blueprint file's entries. Numbered lines under an entry's heading are its clauses; bullets are notes.
export function parse(file, text, warn) {
  const lines = text.split('\n');
  const area = lines[0].replace(/^#\s*/, '');
  const entries = [];
  let entry;
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (D_ID.test(line)) warn(`${at}: a D id; the Blueprint has none (METHOD.md › Ids)`);
    if (line.startsWith('#')) entry = undefined;
    const heading = line.match(HEADING), clause = line.match(CLAUSE);
    if (heading) {
      entry = { id: heading[1] + heading[2], milestone: Number(heading[3]), title: heading[4], file, area, at, clauses: [] };
      entries.push(entry);
    } else if (line.startsWith('### ')) {
      warn(`${at}: heading off the grammar \`### <B|I|J|K|L><n> · @M<n> · <promise>\`: ${line}`);
    } else if (entry && clause) {
      const added = clause[2].match(ADDED);
      entry.clauses.push({ id: `${entry.id}.${clause[1]}`, at, added: Boolean(added), milestone: added ? Number(added[1]) : entry.milestone, text: clause[2].replace(ADDED, '') });
    }
  });
  return { file, area, entries };
}

// Duplicate ids, and an @M that names no milestone in README's table.
export function check(files, milestones, warn) {
  const seen = new Map();
  const once = (id, at) => seen.has(id) ? warn(`${at}: ${id} is already used at ${seen.get(id)}`) : seen.set(id, at);
  const known = (number, at, id) => milestones.has(number) || warn(`${at}: ${id}'s @M${number} names no milestone in README's table`);
  for (const entry of files.flatMap(f => f.entries)) {
    once(entry.id, entry.at);
    known(entry.milestone, entry.at, entry.id);
    for (const clause of entry.clauses) {
      once(clause.id, clause.at);
      if (clause.added) known(clause.milestone, clause.at, clause.id);
    }
  }
}

// The names of the tests in a TypeScript or JavaScript file.
export function tsNames(file, text) {
  const names = [];
  const runner = node => ts.isIdentifier(node) ? ['test', 'it', 'describe'].includes(node.text)
    : (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) ? runner(node.expression)
    : ts.isTaggedTemplateExpression(node) && runner(node.tag); // it.each`table`(name, …)
  const visit = node => {
    const name = ts.isCallExpression(node) && runner(node.expression) ? node.arguments[0] : undefined;
    if (name && (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))) names.push(name.text);
    if (name && ts.isTemplateExpression(name)) names.push(name.head.text);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest));
  return names;
}

// The names of the `func test…` functions in a Swift file, outside comments (`//`, `///`, nested `/* */`) and strings
// (`"…"`, `"""…"""` and raw `#"…"#`).
export function swiftNames(text) {
  const names = [];
  for (let i = 0; i < text.length;) {
    const at = re => { re.lastIndex = i; return re.exec(text); };
    let m;
    if (text.startsWith('//', i)) i = text.indexOf('\n', i) < 0 ? text.length : text.indexOf('\n', i);
    else if (text.startsWith('/*', i)) for (let depth = 0; i < text.length;) {
      if (text.startsWith('/*', i)) { depth++; i += 2; } else if (text.startsWith('*/', i)) { i += 2; if (--depth === 0) break; } else i++;
    }
    else if ((m = at(SWIFT_STRING))) {
      const [open, hashes, quotes] = m, close = quotes + hashes;
      for (i += open.length; i < text.length && !text.startsWith(close, i);) i += !hashes && text[i] === '\\' ? 2 : 1;
      i += close.length;
    }
    else if ((m = at(SWIFT_TEST))) { names.push(m[1]); i += m[0].length; }
    else i++;
  }
  return names;
}

// The clause ids that tests' names carry, each with the files whose tests carry it.
export function citations(tests) {
  const cited = new Map();
  const names = (file, text) => file.endsWith('.swift') ? swiftNames(text) : tsNames(file, text);
  for (const { file, text } of tests) for (const m of names(file, text).flatMap(name => [...name.matchAll(CITED)])) {
    const id = `${m[1]}${m[2]}.${m[3]}`;
    cited.set(id, [...new Set([...(cited.get(id) ?? []), file])]);
  }
  return cited;
}

// GitHub's anchor for a heading, so a link lands on the entry.
const anchor = entry => `${entry.id} · @M${entry.milestone} · ${entry.title}`.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const link = entry => `[${entry.id} · ${entry.title}](../${path.relative('blueprint', entry.file)}#${anchor(entry)})`;
const ids = clauses => clauses.map(c => c.id).join(', ');
const n = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const HEADER = "Generated by `pnpm blueprint` from the area files, JOURNEYS.md, README's milestone table and the test files; don't edit it by hand.";

export function byMilestone(files, milestones) {
  const entries = files.flatMap(f => f.entries);
  const clauses = entries.flatMap(e => e.clauses);
  const count = letter => entries.filter(e => e.id.startsWith(letter)).length;
  const out = ['# What each milestone added', '', HEADER, '',
    `**${entries.length} entries** (${count('B')} behaviors, ${count('I')} invariants, ${count('J')} journeys, ${count('K')} metrics, ${count('L')} limits) **and ${clauses.length} clauses.** Each entry is under the milestone it was born in, \`@M<n>\` on its heading, with the clauses it was born with. A clause a later milestone added, \`@M<n>:\`, is under that milestone. A limit has notes only.`, ''];
  for (const [number, m] of [...milestones].sort(([a], [b]) => a - b)) {
    const born = entries.filter(e => e.milestone === number);
    const later = entries.flatMap(e => e.clauses.filter(c => c.added && c.milestone === number).map(c => ({ ...c, entry: e })));
    const bornClauses = born.flatMap(e => e.clauses.filter(c => !c.added)).length;
    out.push(`## [M${number} · ${m.word}](../${m.link})`, '');
    out.push(`${n(born.length, 'entry', 'entries')} with ${n(bornClauses, 'clause')}, and ${n(later.length, 'clause')} added to earlier entries.`, '');
    for (const e of born) out.push(`- ${link(e)} · ${e.area}${e.clauses.some(c => !c.added) ? `: ${ids(e.clauses.filter(c => !c.added))}` : ''}`);
    if (born.length) out.push('');
    if (later.length) out.push('Added to earlier entries:', '', ...later.map(c => `- **${c.id}**, in ${link(c.entry)}: ${c.text}`), '');
  }
  return out.join('\n');
}

export function untested(files, cited) {
  const clauses = files.flatMap(f => f.entries.flatMap(e => e.clauses));
  const known = new Set(clauses.map(c => c.id));
  const open = clauses.filter(c => !cited.has(c.id));
  const key = id => id.replace(/\d+/g, d => d.padStart(6, '0')); // B5.2 before B25.1, the same on every machine
  const unknown = [...cited].filter(([id]) => !known.has(id)).sort(([a], [b]) => key(a) < key(b) ? -1 : 1);
  const out = ['# Untested clauses', '', HEADER, '',
    'A clause is tested when a test\'s name in `packages/` carries its id (METHOD.md › Tests): the string given to `test(`, `it(` or `describe(` in a `*.test.ts` file, such as `\'B25.2 Connect from MCP\'`, or an iPhone `*Tests.swift` function named `test`, then the id with `_` for its dot, such as `test_B25_2_connectsFromMCP`. Comments and other strings don\'t count. The name is all this reads: it doesn\'t run the test. A retired id, such as an old `C` id, counts as unknown.', '',
    `**${open.length} of ${clauses.length} clauses untested**, ${clauses.length - open.length} tested. Tests name ${n(unknown.length, 'unknown id')}.`, ''];
  for (const file of files) {
    const rows = file.entries.map(e => [e, e.clauses.filter(c => !cited.has(c.id))]).filter(([, cs]) => cs.length);
    if (rows.length) out.push(`## ${file.area}`, '', ...rows.map(([e, cs]) => `- ${link(e)}: ${ids(cs)}`), '');
  }
  out.push('## Tests naming an unknown id', '', ...(unknown.length ? unknown.map(([id, tests]) => `- \`${id}\` in ${tests.map(t => `\`${t}\``).join(', ')}`) : ['None.']), '');
  return out.join('\n');
}

// A file's text with LF line ends, so a checkout with CRLF ones reads the same.
const text = (root, file) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

// Everything the check reads, from the repository as it is on disk.
export function build(root = repo) {
  const warnings = [];
  const warn = text => warnings.push(text);
  const read = file => text(root, file);
  const sources = [...readdirSync(path.join(root, 'blueprint/areas')).filter(f => f.endsWith('.md')).sort().map(f => `blueprint/areas/${f}`), 'blueprint/JOURNEYS.md'];
  const files = sources.map(file => parse(file, read(file), warn));
  const milestones = milestonesOf(read('blueprint/README.md'));
  check(files, milestones, warn);
  const tests = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'packages'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(file => TEST_FILE.test(file) && existsSync(path.join(root, file))).sort().map(file => ({ file, text: read(file) }));
  const cited = citations(tests);
  const known = new Set(files.flatMap(f => f.entries.flatMap(e => e.clauses.map(c => c.id))));
  for (const [id, by] of cited) if (!known.has(id)) warn(`${by.join(', ')}: names ${id}, which is no clause in the Blueprint`);
  const clauses = [...known];
  const counts = { entries: files.flatMap(f => f.entries).length, clauses: clauses.length, tested: clauses.filter(id => cited.has(id)).length, tests: tests.length };
  return { warnings, counts, made: { [`${OUT}/by-milestone.md`]: byMilestone(files, milestones), [`${OUT}/untested.md`]: untested(files, cited) } };
}

// `pnpm blueprint`, or with --check the freshness check in `pnpm check`: it fails only when a generated file is missing
// or differs from what the Blueprint and the tests make now. Returns the exit code.
export function main(argv, root = repo, log = console) {
  const { warnings, counts, made } = build(root);
  for (const warning of warnings) log.warn(`warning: ${warning}`);
  const summary = `${counts.entries} entries, ${counts.clauses} clauses (${counts.tested} tested, ${counts.clauses - counts.tested} untested) from ${n(counts.tests, 'test file')}, ${n(warnings.length, 'warning')}`;
  if (argv.includes('--check')) {
    const old = Object.keys(made).filter(file => !existsSync(path.join(root, file)) || text(root, file) !== made[file]);
    if (old.length) {
      log.error(`${old.join(' and ')} ${old.length > 1 ? 'are' : 'is'} stale: the Blueprint or the tests changed since. Run \`pnpm blueprint\` and commit ${OUT}.`);
      return 1;
    }
    log.log(`Blueprint reports are current: ${summary}.`);
    return 0;
  }
  mkdirSync(path.join(root, OUT), { recursive: true });
  for (const [file, text] of Object.entries(made)) writeFileSync(path.join(root, file), text);
  log.log(`Wrote ${Object.keys(made).join(' and ')}: ${summary}.`);
  return 0;
}

// Run as a script, by any path to it: relative, or through a symlink.
const isMain = () => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (isMain()) process.exitCode = main(process.argv.slice(2));
