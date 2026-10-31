---
id: C29::install-the-command-with-one-line
serves:
  - SP2
  - SP5
statement: Install the agentpager command with one line, and set it up in the agent apps on the machine with `agentpager setup`.
caveats:
  - setup writes Claude Desktop's config where macOS keeps it.
  - Each MCP entry names the command by its path. Moving the command breaks the entries until setup runs again.
---

## Behaviors

1. *Not built yet: comes with the release builds.* One line, `curl -fsSL agentpager.me/install | sh`, installs the command as a single file for the machine. Today the command is built from the AgentPager repository with git, Node 22.19 or newer, pnpm and Bun, as agentpager.me/start says (C18).
2. `agentpager setup` adds the command's MCP server to each agent app it finds: Claude Code and Codex through their own commands, and Claude Desktop and Cursor through their config files. Running it again changes nothing, and `--print` says what it would change and changes nothing. A config file it can't read whole is left alone, and setup says what to add by hand. Claude Desktop needs a restart afterwards.
3. The command is one program: a command line and, run as `agentpager mcp`, a local MCP server over stdio, whose tools give the same replies as the commands.
