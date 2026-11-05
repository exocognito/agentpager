# agentpager (the binary)

The only thing an agent talks to: a CLI for terminals and scripts, and with `agentpager mcp` a stdio MCP server for
Claude Code, Claude Desktop, Codex and Cursor. Both expose the same operations with the same replies
(`docs/v2/03-binary-surface.md`). The card contract, the review list and the `card.yaml` format live in `src/rules.ts`
and nowhere else (`docs/v2/02-writing-rules.md`).

## Build and install (Stage 2: local only)

```sh
pnpm --filter @agentpager/cli build          # bun build --compile → packages/cli/dist/agentpager
ln -sf "$PWD/packages/cli/dist/agentpager" ~/.local/bin/agentpager
agentpager setup --print                     # what it would add to Claude Code, Codex, Claude Desktop, Cursor
agentpager setup
```

No releases, install script or self-update until MINSTALL.

## Use

```sh
agentpager connect ap1_…                     # or set AGENTPAGER_PAGER; replies with an agent id such as ap-7f3k
agentpager rules --agent ap-7f3k
agentpager example > card.yaml
agentpager review card.yaml                  # give the output to a subagent; fix the must-fixes
agentpager ask --agent ap-7f3k card.yaml     # mechanical refusals only, one line each
agentpager wait --agent ap-7f3k d_2x8w
agentpager ack --agent ap-7f3k d_2x8w "Building the smaller fix today."
```

`status`, `history`, `finish`, `agents`, `share`, `version`. Every command takes `--json`. Exit codes: 0 done,
2 refused, 4 pager off, 5 no usable reply from the server (unreachable, no reply, or a reply not understood),
6 unknown agent id.

Files: `~/.agentpager/agents/<id>.json` (mode 600: the agent's server key and its reminder clock; the agent only ever
passes the id) and `~/.agentpager/history/<pager>.jsonl` (capped at 1,000 lines). `AGENTPAGER_HOME` moves the folder;
`AGENTPAGER_SERVER` or `config.json` `{"server": …}` picks the server (default `https://agentpager.me`).

Not yet (Stage 3): end-to-end encryption. The binary sends cards in the clear over HTTPS, as the hosted MCP did.

## Tests

```sh
pnpm --filter @agentpager/cli test           # against local workerd, through the app's test fixture
```

`cli.test.ts` drives every command and the MCP server over stdio; `binary.test.ts` runs the compiled binary (skipped
until it is built); `setup.test.ts` writes only into a throwaway home.

The review list's regression set is the 10 cards of 28–29 Oct: `scripts/regression-cards.mjs` rebuilds them from
`docs/v2/regression/cards-2026-10-28.txt`, `agentpager review` prints each, and a fresh subagent grades it.
