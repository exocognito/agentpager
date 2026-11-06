// The vectors under Bun, as the agentpager command is built (packages/cli/scripts/build.sh): envelope.test.ts compiles
// this with `bun build --compile` and runs it on vectors/envelope.json. It prints the report as JSON and exits 1 on
// any failure.
import { readFileSync } from "node:fs";
import { verify } from "./verify.ts";

const path = process.argv[2];
if (!path) { console.error("usage: check <envelope.json>"); process.exit(2); }
const report = verify(JSON.parse(readFileSync(path, "utf8")));
console.log(JSON.stringify({ runtime: process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.version}`, ...report }));
process.exit(report.failures.length ? 1 : 0);
