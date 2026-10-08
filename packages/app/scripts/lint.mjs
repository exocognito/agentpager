import ts from 'typescript';
import { globSync, readFileSync } from 'node:fs';
let failures = 0;
for (const path of globSync(['src/**/*.ts', 'src/**/*.tsx', 'test/**/*.ts'])) {
  const text = readFileSync(path, 'utf8');
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  // No derived file currently needs a negative compiler directive. Reject these
  // spellings anywhere (even quoted), including trailing/file-only comments. The
  // negative harness constructs its directive only in a temporary scratch source.
  for (const match of text.matchAll(/@ts-(ignore|nocheck|expect-error)\b/g)) {
    console.error(`${path}:${file.getLineAndCharacterOfPosition(match.index).line + 1}: no suppressions in derived code`); failures++;
  }
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword || ts.isTypeAssertionExpression(node) || (ts.isAsExpression(node) && node.type.getText(file) !== 'const')) {
      console.error(`${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}: no any, casts or suppressions in derived code`); failures++;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}
if (failures) process.exit(1);
console.log('Derived source: no any, casts or suppressions. Pinned design remains typechecked.');
