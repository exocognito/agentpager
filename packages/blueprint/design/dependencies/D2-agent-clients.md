---
id: D2::agent-clients
statement: The agentpager command runs inside the agent apps owners already use, which the product did not build, as a command line from their shell or as a local MCP server they start.
providedBy: owner
provided: the agent apps on the owner's machines, which the owner installs and signs in to. `agentpager setup` adds the command's MCP server to the ones it finds (C29::install-the-command-with-one-line), and the owner restarts Claude Desktop afterwards.
caveats:
  - Cloud sessions with a shell, such as the ones the Claude mobile app starts in a cloud VM, are untested. Nothing here promises them.
  - Recorded runs cover Claude Code and Claude Desktop (29–30 Oct 2026). For Codex, Cursor and pi, setup and who asked follow each app's documented or observed behaviour, and an agent can always name itself with --app (C25::connect-with-a-pager-number).
  - Agents with no machine of their own, such as claude.ai in a browser, can't run the command and are out (SP5).
---

Must supply: a shell that runs the agentpager command, or an MCP client that starts `agentpager mcp` from its config as a local server over stdio and calls its tools. Each client says who it is: over MCP by the name its client gives, from a shell by a marker in its environment or by its process name (C25). A long wait must not lose the answer. Either the client runs a command in the background and wakes the agent when it ends, as Claude Code does, or it keeps the agent's turn going while the agent calls wait again, each call holding at most 50 seconds, as a Claude Desktop chat does.

`agentpager setup` gives each client it finds the same server: the command's own absolute path with the argument `mcp`, since desktop apps don't get the shell's PATH.

- Claude Code, when `claude` is on the PATH: `claude mcp add --scope user agentpager -- <path> mcp`, unless `claude mcp get agentpager` already finds one.
- Codex, when `codex` is on the PATH: `codex mcp add agentpager -- <path> mcp`, unless `codex mcp get agentpager` already finds one.
- Claude Desktop, when `~/Library/Application Support/Claude/` exists: an `agentpager` server in `claude_desktop_config.json` there.
- Cursor, when `~/.cursor/` exists: an `agentpager` server in `~/.cursor/mcp.json`.
- pi, and any other agent with a shell: nothing to add. It runs the command line.

Must never do: put the agent's key or the pager number in a client's config. setup writes only the command's path, and an agent passes only its id (C25).

Proof runs on: the command's own tests against a local server, which drive every command, and the MCP server over stdio with the official MCP SDK client; setup's tests write only into a throwaway home. Real clients are sampled by the owner's dogfood, not by a test.
