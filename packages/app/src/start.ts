// What an agent that arrives without the agentpager command reads, at /start and /mcp: how to install it, then the
// one command. No API documentation for hand-rolled calls (B18, blueprint/areas/7-getting-started.md). A server other than
// agentpager.me names itself in the command (--server), since the binary defaults to agentpager.me.
export const DEFAULT_ORIGIN = 'https://agentpager.me';
// Any other server, dev.agentpager.me or a local one, says it is dev (METHOD.md › Stages and releases), since each
// has its own data.
function heading(origin: string) {
  return origin === DEFAULT_ORIGIN ? '# AgentPager\n' : `# AgentPager (dev)

This is ${new URL(origin).host}, a dev server for testing AgentPager, not agentpager.me. Its pagers are its own: a pager number from agentpager.me isn't in use here.
`;
}
// What / says to an agent, rather than a browser.
export const frontDocument = (origin: string) => `${heading(origin)}\nAgents start at ${origin}/start.\n`;
export function startDocument(origin: string) {
  const host = new URL(origin).host, server = origin === DEFAULT_ORIGIN ? '' : ` --server ${origin}`;
  return `${heading(origin)}
AgentPager sends your questions to your owner's phone and brings their answers back. Agents use the \`agentpager\` command, which is both a CLI and a local MCP server; the MCP server that used to run at ${origin}/mcp is retired.

If \`agentpager\` isn't installed, there is no download yet: build it from the AgentPager repository (private for now, so ask your owner for access). It needs git, Node 22.19 or newer, pnpm and Bun:

    git clone https://github.com/exocognito/agentpager ~/agentpager
    cd ~/agentpager && pnpm install --frozen-lockfile && pnpm --filter @agentpager/cli build
    mkdir -p ~/.local/bin && ln -sf ~/agentpager/packages/cli/dist/agentpager ~/.local/bin/agentpager
    ~/.local/bin/agentpager version && ~/.local/bin/agentpager setup    # setup adds its MCP server to Claude, Codex, Cursor

If \`~/.local/bin\` isn't on your PATH, call it as \`~/.local/bin/agentpager\` wherever these steps and its replies say \`agentpager\`. If you can't install or run it here (no access to the repository, no Bun, or a sandbox that blocks it), stop and tell your owner that the agentpager command needs installing on this machine. Don't work around it.

Then connect with the pager number your owner gave you and follow what it says:

    ~/.local/bin/agentpager connect <number>${server}

If this machine blocks outbound requests, add ${host} to its allow list first.
`;
}
