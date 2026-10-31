---
id: D8::bun
statement: The agentpager command is built with Bun into one file that runs on the kind of machine that built it.
providedBy: owner
provided: Bun on the machine that builds the command, installed by the owner. `pnpm --filter @agentpager/cli build` runs `bun build --compile` on the command's source and writes `packages/cli/dist/agentpager`. No Bun version is pinned.
caveats:
  - "The build makes a binary for the building machine's own system only. *Not built yet: comes with the release builds.* Binaries for other machines, and the one-line install (C29::install-the-command-with-one-line)."
  - Run from source, as its tests run it, the command runs on Node instead.
---

Must supply: a compiler that bundles the command's TypeScript, its dependencies and a runtime into one executable, with Node's built-in modules, fetch, and standard input and output for the MCP server.

Must never do: need Bun, Node or the repository where the built command runs.

Proof runs on: the compiled binary on the machine that built it. The binary's test connects with it, reads its status, serves MCP and runs setup with no Bun or Node on the PATH; it is skipped until the binary is built, and `pnpm test:cli` builds it first.
