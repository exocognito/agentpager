# agentpager (the binary)

The only thing an agent talks to: a CLI for terminals and scripts, and with `agentpager mcp` a stdio MCP server for
Claude Code, Claude Desktop, Codex and Cursor. Both expose the same operations with the same replies
([2 Agents](../../blueprint/areas/2-agents.md)). The card contract, the review list and the `card.yaml` format live in `src/rules.ts`
and nowhere else ([3 Cards](../../blueprint/areas/3-cards.md), B27).

## Build and install (Stage 2: local only)

```sh
pnpm --filter @agentpager/cli build          # bun build --compile → packages/cli/dist/agentpager
ln -sf "$PWD/packages/cli/dist/agentpager" ~/.local/bin/agentpager
agentpager setup --print                     # what it would add to Claude Code, pi, Codex, Claude Desktop, Cursor
agentpager setup
```

`setup` gives Claude Code AgentPager's plugin and pi its extension, which wake the agent with the answer
([packages/claude-code-plugin](../claude-code-plugin/README.md), [packages/pi](../pi/src/index.ts)); their agents use the
command line, so neither gets the MCP server, and the entry an earlier setup added to Claude Code is removed. The
binary carries both adapters' files (`src/adapters.ts`): setup writes them to `~/.agentpager/adapters/` and registers
that folder through each app's own install (`claude plugin marketplace add` and `claude plugin install`; `pi install`).
Run it again after each new build, so the adapters match the command. Codex, Claude Desktop and Cursor get the MCP
server.

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

Files: `~/.agentpager/agents/<id>.json` (mode 600: the agent's server key, its own private key, made at connect, the
pager's public key as checked against the number at connect, its reminder clock, and the request id of each ask no
reply has settled yet, so asking the same card again after a lost reply reaches the owner once; the agent only ever
passes the id, and neither key is printed) and `~/.agentpager/history/<pager>.jsonl` (capped at 1,000 lines). `AGENTPAGER_HOME` moves the folder;
`AGENTPAGER_SERVER` or `config.json` `{"server": …}` picks the server (default `https://agentpager.me`).

End to end (B30, I19.6): connect reads the pager's public key, checks it against the number's fingerprint and pins it,
or sends nothing. Who asked, every card and attachment, and every acknowledgement are sealed to that key
(`src/seal.ts`, the format in `packages/contract/envelope.ts`); the card carries this agent's own public key, the only
key the phone seals its answer to, and wait opens each answer and checks it fits the card asked. An agent file from
before the encryption switch has no keys: that agent is told to connect again.

## Tests

```sh
pnpm --filter @agentpager/cli test           # against local workerd, through the app's test fixture
```

`cli.test.ts` drives every command and the MCP server over stdio; `binary.test.ts` runs the compiled binary (skipped
until it is built); `setup.test.ts` writes only into a throwaway home, with stand-ins for `claude` and `pi` on its PATH (`test/stand-ins/`).

The review list's regression set is the 10 cards of 28–29 Oct: `scripts/regression-cards.mjs` rebuilds them from
`test/regression/cards-2026-10-28.txt`, `agentpager review` prints each, and a fresh subagent grades it.
