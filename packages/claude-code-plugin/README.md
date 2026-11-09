# AgentPager for Claude Code (the plugin)

A Claude Code plugin whose mod hands the owner's answer to the agent as a new turn (B33.2, [2 Agents](../../blueprint/areas/2-agents.md)). The agentpager command still does everything else: it keeps the keys, asks, waits, opens the answer and acknowledges. The mod names the Claude Code session to the command in `AGENTPAGER_WAKE`, reads the command's record of what's waiting (`~/.agentpager/waiting/`, [store.ts](../cli/src/store.ts)), holds the command's own wait for each of the session's decisions (`--no-pickup`), which picks nothing up, submits the command's reply as a turn once Claude is idle, and tells the service the agent has the answer (`agentpager pickup`) once that turn has started. It does nothing in `claude -p`, an SDK run or on Windows, where the command gives today's background-wait words.

- `hooks/wake.ts`: the logic, with Claude Code behind one interface, `Host`.
- `hooks/register.ts`: Claude Code's side, every call on `$`.
- `test/`: `mod.test.ts` with a stand-in for Claude Code, `e2e.test.ts` against the real command and the local service.

## Run it

```sh
claude --plugin-dir packages/claude-code-plugin    # loads it for that session; needs agentpager on PATH
pnpm test:plugin                                     # the tests
claude plugin validate packages/claude-code-plugin   # what the mod hooks and calls, as Claude Code reads it
```

Claude Code writes its own type declarations into `.claude-plugin/types/` when it loads the plugin from this folder; after that, `npx tsc -p packages/claude-code-plugin` type-checks the hooks module. The repository's `pnpm check` type-checks `wake.ts` and the tests, not `register.ts`.

Publishing it through a plugin marketplace is INSTALL's.
