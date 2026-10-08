---
id: L2::codex-drops-a-server-that-answers-a-notification-with-a-body
learnedIn: MSTART, simple-loop run 02, candidate d30b6f4, 2026-09-26 (PR #40)
---

What happened: candidate d30b6f4 answered the MCP `notifications/initialized` message with a JSON body. The official MCP SDK client accepted that, so the builder's own check passed. Codex 0.154 did not: it dropped the server without an error the agent could see and never loaded the tools, so an agent on Codex had no MCP way in.

What a role does now: the requirement lives in the design: [MCP](../../design/effects/routes.ts#MCP) owns the notification response, and [C5::agent-starts-from-one-url](../../design/capabilities/C5-agent-starts-from-one-url.md) and [D2::agent-clients](../../design/dependencies/D2-agent-clients.md) own the required behaviour and clients. This file keeps the why. A client may drop a server in silence over a detail another client tolerates, so when an MCP client lists no tools, check the notification answer first, and prove a way in with more than one real client. Guidance, never a requirement: if this turns out to be a requirement it is promoted to design and this file points at it.
