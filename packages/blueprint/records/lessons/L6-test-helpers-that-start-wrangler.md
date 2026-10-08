---
id: L6::test-helpers-that-start-wrangler
learnedIn: MSTART, simple-loop run 02 turn 1 (2026-09-26) and VM run 01 turns 3 and 4 (2026-09-29); PRs #38, #40, #74
---

What happened: in run 02 every test helper started wrangler on the same inspector port, so the files passed one at a time and collided together. The same builder reported that the quoted test glob found no files; that did not reproduce on Node 24 or 26, but it showed that a run reporting zero tests looks green. On the VM, run 01's helper leaked wrangler children: the turn 4 rerun hung on a port an earlier test still held, and six wrangler trees were alive afterwards.

What a role does now: a helper that starts a local instance waits, bounded, until the port answers, and on exit stops the process group it started, on failure too. One wrangler per test file, each on its own port, inspector port and persistence directory, so files run in parallel from `toy-examples/ownerpager`: `node --test --experimental-strip-types --test-concurrency=4 'packages/app/test/**/*.test.ts'`, quoted so Node expands the glob. Read the test count; if it is zero, name the files explicitly and say so. Never use port 4317; a service on the owner's Mac holds it. Guidance, never a requirement: if this turns out to be a requirement it is promoted to design and this file points at it.

Now held by: the [recipe](../../../../recipe.json) test command runs four files at a time and its environment gives each instance its own port, inspector port and storage, and the [simple-builder](https://github.com/exocognito/blueprint/blob/main/src/skills/simple-builder/SKILL.md) skill owns bounded server start and process-group stop; this file is history.
