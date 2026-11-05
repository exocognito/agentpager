---
id: MCOMMAND
title: The agentpager command
status: shipped
deliverables:
  - C25::connect-with-a-pager-number
  - C27::review-a-card-before-sending
  - C29::install-the-command-with-one-line
  - C31::history-on-the-agents-machine
  - C6::send-feedback
  - I4::payloads-refused-whole
  - I21::every-connect-is-a-new-agent
  - I22::a-broken-card-is-never-sent
  - D2::agent-clients
  - D8::bun
  - J3::happy-pager
  - J4::longest-pager
---

Shipped: Stage 2 of the v2 plan (`docs/v2/05-readiness-review-and-stages.md`).

# MCOMMAND · The agentpager command

## Objective

My agents reach my pagers through the agentpager command, as a command line or a local MCP server, and `agentpager setup` adds it to Claude Code, Codex, Claude Desktop and Cursor. An agent I give a number connects as a new agent, with nothing for me to tap. Before it asks, it has its `card.yaml` reviewed once, and the command refuses only a card that is broken in structure. It waits for my answer or my note, acknowledges it with its next steps, and keeps a history of its decisions on its own machine. The hosted MCP server is retired.

## Out of scope

- The one-line install and release builds (C29, D8): MINSTALL. The command is built from the AgentPager repository.
- Encryption: MENCRYPT. The command sends cards over HTTPS, readable by the service.
- Cloud sessions: untested (D2).
