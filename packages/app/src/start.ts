// What an agent that arrives without the agentpager command reads, at /start and /mcp: one paragraph, then the
// command. No API documentation for hand-rolled calls (docs/v2/03-binary-surface.md §4).
export function startDocument(origin: string) {
  const host = new URL(origin).host;
  return `# AgentPager

AgentPager sends your questions to your owner's phone and brings their answers back. Agents use the \`agentpager\` command, which is both a CLI and a local MCP server; the MCP server that used to run at ${origin}/mcp is retired. Install the command (for now, build it from the AgentPager repository: \`pnpm --filter @agentpager/cli build\`, then put \`packages/cli/dist/agentpager\` on your PATH and run \`agentpager setup\`), then connect with the pager number your owner gave you and follow what it says:

    agentpager connect <number>

If this machine blocks outbound requests, add ${host} to its allow list first.
`;
}
