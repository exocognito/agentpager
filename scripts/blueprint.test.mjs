// The id check's parser, citations and freshness (scripts/blueprint.mjs). Run by `pnpm test`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { check, citations, main, milestonesOf, parse, untested } from './blueprint.mjs';

const README = `| | Milestone | What it delivers |
| --- | --- | --- |
| ✅ | [M1 · APP](milestones/M1-app.md) | AgentPager on my iPhone |
| 🔨 | [M2 · PAGERS](milestones/M2-pagers.md) | Pagers on my phone |
| ⏳ | [ENCRYPT](milestones/next/ENCRYPT.md) | Decisions the service can't read |
`;

const AREA = `# 9 Sample

> **Code:** \`sample.ts\`

## Behaviors

### B5 · @M1 · Read a decision

1. The first clause.
2. @M2: A clause M2 added.

- A note, not a clause.
3. The third clause, after the note.

## Limits

### L9 · @M2 · A limit

- What people meet: only notes.
`;

const collect = () => {
  const warnings = [];
  return { warnings, warn: text => warnings.push(text) };
};

test('parse: entries, their clauses and the milestone each clause came with; bullets are notes', () => {
  const { warnings, warn } = collect();
  const file = parse('blueprint/areas/9-sample.md', AREA, warn);
  assert.equal(file.area, '9 Sample');
  assert.deepEqual(file.entries.map(e => [e.id, e.milestone, e.title]), [['B5', 1, 'Read a decision'], ['L9', 2, 'A limit']]);
  assert.deepEqual(file.entries[0].clauses.map(c => [c.id, c.milestone, c.added, c.text]), [
    ['B5.1', 1, false, 'The first clause.'],
    ['B5.2', 2, true, 'A clause M2 added.'],
    ['B5.3', 1, false, 'The third clause, after the note.'],
  ]);
  assert.deepEqual(file.entries[1].clauses, []);
  check([file], milestonesOf(README), warn);
  assert.deepEqual(warnings, []);
});

test('milestonesOf: the numbered milestones in README\'s table, not the queued ones', () => {
  assert.deepEqual([...milestonesOf(README)], [[1, { word: 'APP', link: 'milestones/M1-app.md' }], [2, { word: 'PAGERS', link: 'milestones/M2-pagers.md' }]]);
});

test('warnings: duplicate ids, headings off the grammar, an unknown @M and a D id', () => {
  const { warnings, warn } = collect();
  const other = parse('blueprint/JOURNEYS.md', `# Journeys

### B5 · @M1 · The same entry id again
### C7 · @M1 · An old id
### B8 · M1 · No at sign
### J9 · @M7 · A milestone not in the table

1. Walks D2.
1. Numbered twice.
2. @M5: Added by a milestone not in the table.
`, warn);
  check([parse('blueprint/areas/9-sample.md', AREA, warn), other], milestonesOf(README), warn);
  assert.deepEqual(warnings, [
    'blueprint/JOURNEYS.md:4: heading off the grammar `### <B|I|J|K|L><n> · @M<n> · <promise>`: ### C7 · @M1 · An old id',
    'blueprint/JOURNEYS.md:5: heading off the grammar `### <B|I|J|K|L><n> · @M<n> · <promise>`: ### B8 · M1 · No at sign',
    'blueprint/JOURNEYS.md:8: a D id; the Blueprint has none (METHOD.md › Ids)',
    'blueprint/JOURNEYS.md:3: B5 is already used at blueprint/areas/9-sample.md:7',
    'blueprint/JOURNEYS.md:6: J9\'s @M7 names no milestone in README\'s table',
    'blueprint/JOURNEYS.md:9: J9.1 is already used at blueprint/JOURNEYS.md:8',
    'blueprint/JOURNEYS.md:10: J9.2\'s @M5 names no milestone in README\'s table',
  ]);
});

test('citations: only a test\'s name counts, never a test inside a comment or a string; untested lists the rest and unknown ids', () => {
  const cited = citations([
    { file: 'packages/a.test.ts', text: [
      "test('B5.1 Read the first clause', () => {",
      "  // B5.2 in a comment, and in a string: 'B5.2 is only a fixture', 'https://fixtures.invalid/B5.2'",
      "  expect(/B5\\.2/.test('B5.2 is a method call, not a test')).toBe(true);",
      '});',
      'describe("I4.2 and C25.3, an old id", () => {});',
      "test.each([[1, f(2)]])('I4.3 a table, %s', () => {});",
      "it.skip(`I4.4 skipped`, () => {});",
      "// test('B5.2 a commented-out test', () => {});",
      "/* it('B5.2 a block-commented test', () => {});",
      "   test('B5.2 still in the block', () => {}); */",
      "const fixture = \"test('B5.2 a test inside a string')\", url = 'https://fixtures.invalid/'; test('I4.5 after a // in a string', f);",
      "test('I4.6 a name with // in it', () => {});",
    ].join('\n') },
    { file: 'packages/ios/FlowTests.swift', text: [
      'func test_B5_3_theThird() {',
      '    // B5_2 in a comment',
      '    XCTAssertEqual(row.label, "B5_2 is only a label")',
      '}',
      'func testB5_1Again() {}',
      '// func test_B5_2_commentedOut() {}',
      '/// func test_B5_2_inADocComment() {}',
      'let page = """',
      '    func test_B5_2_inAMultiLineString() {} // and "quoted"',
      '    """',
      'let line = "func test_B5_2_inAString() {}"',
    ].join('\n') },
  ]);
  assert.deepEqual([...cited], [
    ['B5.1', ['packages/a.test.ts', 'packages/ios/FlowTests.swift']],
    ['I4.2', ['packages/a.test.ts']],
    ['C25.3', ['packages/a.test.ts']],
    ['I4.3', ['packages/a.test.ts']],
    ['I4.4', ['packages/a.test.ts']],
    ['I4.5', ['packages/a.test.ts']],
    ['I4.6', ['packages/a.test.ts']],
    ['B5.3', ['packages/ios/FlowTests.swift']],
  ]);
  const report = untested([parse('blueprint/areas/9-sample.md', AREA, () => {})], cited);
  assert.match(report, /\*\*1 of 3 clauses untested\*\*, 2 tested\. Tests name 6 unknown ids\./);
  assert.match(report, /## 9 Sample\n\n- \[B5 · Read a decision\]\(\.\.\/areas\/9-sample\.md#b5--m1--read-a-decision\): B5\.2\n/);
  assert.match(report, /- `C25\.3` in `packages\/a\.test\.ts`\n- `I4\.2` in `packages\/a\.test\.ts`\n- `I4\.3` in/);
});

test('main: --check fails only when a generated file is stale, never for a warning or an untested clause', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'agentpager-blueprint-'));
  const write = (file, text) => { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), text); };
  write('blueprint/README.md', README);
  write('blueprint/areas/9-sample.md', `${AREA}\n### Off the grammar\n`.replace(/\n/g, '\r\n')); // a CRLF checkout reads the same
  write('blueprint/JOURNEYS.md', '# Journeys\n');
  write('packages/x/a.test.ts', "test('B5.1 Read the first clause', () => {});\n");
  execFileSync('git', ['init', '-q'], { cwd: root });
  const lines = [];
  const log = { log: text => lines.push(text), warn: text => lines.push(text), error: text => lines.push(text) };
  assert.equal(main(['--check'], root, log), 1, 'nothing generated yet');
  assert.equal(main([], root, log), 0);
  assert.equal(main(['--check'], root, log), 0, 'fresh, with a warning and two untested clauses');
  assert.match(lines.at(-1), /current: 2 entries, 3 clauses \(1 tested, 2 untested\) from 1 test file, 1 warning\./);
  const report = path.join(root, 'blueprint/generated/untested.md');
  writeFileSync(report, readFileSync(report, 'utf8').replace(/\n/g, '\r\n'));
  assert.equal(main(['--check'], root, log), 0, 'a generated file checked out with CRLF line ends is still fresh');
  write('packages/x/a.test.ts', "test('B5.2 Read the second clause', () => {});\n");
  assert.equal(main(['--check'], root, log), 1, 'a test now names another clause');
  assert.equal(lines.at(-1), 'blueprint/generated/untested.md is stale: the Blueprint or the tests changed since. Run `pnpm blueprint` and commit blueprint/generated.');
});

test('run as a script through a symlink or a relative path, --check still compares', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agentpager-blueprint-link-')); // on macOS, tmpdir is itself behind a symlink
  symlinkSync(path.dirname(new URL(import.meta.url).pathname), path.join(dir, 'scripts'));
  for (const script of [path.join(dir, 'scripts/blueprint.mjs'), 'scripts/blueprint.mjs']) {
    let output;
    try { output = execFileSync(process.execPath, [script, '--check'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }); } catch (error) { output = `${error.stdout}${error.stderr}`; }
    assert.match(output, /Blueprint reports are current|is stale|are stale/, `${script} ran the check`);
  }
});
