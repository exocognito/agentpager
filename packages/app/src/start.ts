// What an agent that arrives without the agentpager command reads, at /start and /mcp: how to install it, then the
// one command. No API documentation for hand-rolled calls (docs/v2/03-binary-surface.md §4). A server other than
// agentpager.me names itself in the command, since the binary defaults to agentpager.me.
export const DEFAULT_ORIGIN = 'https://agentpager.me';
export function startDocument(origin: string) {
  const host = new URL(origin).host;
  // Kept in its config file, so the CLI and its MCP server both use this server, not only one command.
  const server = origin === DEFAULT_ORIGIN ? '' : `This server isn't agentpager.me, so tell the command first:

    mkdir -p ~/.agentpager && printf '{"server":"${origin}"}\\n' > ~/.agentpager/config.json

`;
  return `# AgentPager

AgentPager sends your questions to your owner's phone and brings their answers back. Agents use the \`agentpager\` command, which is both a CLI and a local MCP server; the MCP server that used to run at ${origin}/mcp is retired.

If \`agentpager\` isn't installed, there is no download yet: build it from the AgentPager repository (private for now, so ask your owner for access). It needs git, Node 22.19 or newer, pnpm and Bun:

    git clone https://github.com/exocognito/agentpager ~/agentpager
    cd ~/agentpager && pnpm install --frozen-lockfile && pnpm --filter @agentpager/cli build
    mkdir -p ~/.local/bin && ln -sf ~/agentpager/packages/cli/dist/agentpager ~/.local/bin/agentpager
    export PATH="$HOME/.local/bin:$PATH"    # and add this line to your shell profile if ~/.local/bin isn't on PATH
    agentpager version && agentpager setup  # setup adds its MCP server to Claude, Codex, Cursor

If you can't install or run it here (no access to the repository, no Bun, or a sandbox that blocks it), stop and tell your owner that the agentpager command needs installing on this machine. Don't work around it.

${server}Then connect with the pager number your owner gave you and follow what it says:

    agentpager connect <number>

If this machine blocks outbound requests, add ${host} to its allow list first.
`;
}
