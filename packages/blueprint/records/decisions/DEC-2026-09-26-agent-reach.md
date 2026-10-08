---
id: DEC-2026-09-26-agent-reach
date: 2026-09-26
decidedBy: Sam
basis:
  - SP2
  - SP5
  - C5
losers:
  - HTTPS only (misses every chat app; 77% reach, 43% without setup)
  - an npm CLI or other helper (curl and MCP do the same)
  - SSE streaming (a held read is as fast and also works over MCP)
  - push that wakes an idle agent (Claude Code channels are a research preview; a later milestone)
  - OAuth on the MCP server (holding the agent key already works as a token)
  - a 99% reach target (ChatGPT Free has no way in)
cost: ChatGPT Free has no way in. The agent key passes through MCP tool arguments, so it sits in the chat transcript for the session's life. MSTART grows by the MCP server, the held read, the QR image and a rewritten /start.
---

Sam's own dogfood on 2026-09-26 failed: a chat agent read `/start`, which listed HTTP routes, and could not pair his phone, because a chat app can only fetch pages. He decided OwnerPager must work for an agent in a terminal, a desktop app, pi or opencode, or a chat app on a phone, and that the choice rests on the reference data below.

- Target: every client that allows HTTPS requests or a custom MCP server (SP5), not a percentage.
- Ways in: HTTPS and a stateless, no-login remote MCP server at `/mcp` (SP2). The agent waits by holding its answer read open, up to 50 seconds (the answer wait term).
- The service serves the QR image, so no agent has to draw one.
- Agents dogfood it: T13 draws real clients at random and runs them cold from the front page's line. Sam asked for this so the product is tried the way he would try it.
- It ships in MSTART: a milestone the owner cannot use from their phone is not done.
- Pairing tokens and agent keys on test sessions are disposable and expire; evidence records them as hash prefixes, and seeing one is not a credential exposure.

## Reference: where owners' agents run

Reference data for the purpose of this decision, researched on 2026-09-26 with four Haiku agents and the vendors' docs (✓ checked in the vendor's own docs). The shares are estimates, not measurements; the decision assumes they are right. Revisit when they change.

| Client | Est. share | HTTPS | Remote MCP | Held read (≤50 s) | Push to an idle agent |
| --- | --- | --- | --- | --- | --- |
| Claude Code | 28% | yes, prompts on first domain | yes, `claude mcp add` | yes | channels, research preview ✓ |
| Codex CLI, desktop, IDE | 18% | after enabling network | yes, config | yes, under its 120 s tool limit | no |
| Cursor, VS Code, Windsurf (assumed, not researched) | 16% | agent mode only | yes | yes | no |
| Claude apps: web, desktop, mobile | 12% | page fetch only | custom connector, including mobile ✓ | yes, under its 60 s tool limit | no |
| ChatGPT Plus and above | 9% | page fetch only | developer mode on web ✓; mobile unconfirmed | yes, else on the next turn | no |
| pi, Gemini CLI, other terminals | 6% | yes | pi via an adapter only | yes | no |
| opencode, zcode | 5% | yes | yes (a stateless server avoids a reported session-header bug) | yes, under 300 s | no |
| Custom scripts, hosted agents | 4% | yes | optional | yes | own webhook |
| ChatGPT Free | 2% | page fetch only | no | no | no |

Reach by method, summing the shares: HTTPS 77% (43% with no setup); MCP 98%; either 98%; a 5-second polling loop 98% but wasteful; a held read 98%; SSE 77%; push 37%, none of it without setup.

Sources: Anthropic, "Custom connectors using remote MCP" (updated 2026-08-11); OpenAI, developer mode and MCP apps; Anthropic, Claude Code channels; the live candidate ca6ab26 checked with curl and headless Chromium on 2026-09-26.
