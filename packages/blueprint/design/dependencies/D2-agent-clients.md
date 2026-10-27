---
id: D2::agent-clients
statement: The cold dogfood stands on real agent clients installed on the test host, which the product did not build and the recipe names.
providedBy: recipe
provided: the clients and start/resume invocations listed in recipe.json's environment; the recipe marks any access mode not yet qualified
caveats:
  - A client that is not installed on the host, or cannot authenticate there, is not sampled, and the way in it would have covered is unproved on that host. The reviewer's table says which.
  - The Claude and ChatGPT apps are sampled by the operator and by the owner's dogfood, not by the loop (C2::agent-starts-from-one-url).
---

Must supply: installed and authenticated real clients capable of fresh isolated sessions with the cold-arrival prompt below, streamed output with stdin closed, bounded execution and continuation after an owner reply; an HTTPS client and a fetch-only client that can use a session-scoped MCP server after owner setup; the owner app the cold arrival uses; exact start and resume invocations for each client and access mode in the [recipe](../../../../recipe.json). The MCP-only client can fetch the start page but cannot send the exchange over HTTPS; adding its MCP server is confined to that session. Every MCP server an invocation configures is usable from its first turn. Its effective access restrictions survive resume. A network flag alone does not establish these facilities.

Must never do: change a client's global configuration to supply the test; present unavailable or unqualified facilities as supplied.

This file owns the cold arrival's scenario, prompt and allowed owner steps, below. The recipe selects installed clients and invocations. The [agent-reach record](../../records/decisions/DEC-2026-09-26-agent-reach.md) preserves historical client observations, not a current roster.

Proof runs on: for scripted cases, a scripted HTTPS caller and the official MCP SDK client with the app in the iOS Simulator (D6). For the cold arrival, the deployed product only: one journey over HTTPS and one over MCP, each with the recipe's client for it. The cold arrival is proved by dogfood, not by a test: the reviewer performs it in the final proof, playing the owner. A journey holds when one of three fresh tries completes. The three are per run, not per turn, and reset only after a change to the product or client setup that bears on the journey. Every try is kept, failures included.

## Cold arrival

On the deployed product only. Each try starts a fresh agent session in an empty directory with no project notes, prompted with exactly [MARKETING](../ui/screens/MarketingScreen.tsx#MARKETING).instruction followed by "use it to ask me on my phone which of two options to take, and wait for my answer".

- Check the full AgentPager link and three-emoji code the agent shows; the agent's copy of the QR code is not decoded.
- Keep one app install in the Simulator as the owner through acknowledgement.
- The tester plays only the owner. It may give owner-only chat replies the agent asks for and the session-scoped MCP setup, then resume the same conversation. No rescue, instruction coaching or global configuration.
- The MCP-only try starts with no AgentPager server configured; a generic fetch facility may be present. It must stay unable to exchange over HTTPS before setup and after resume.

C2 sets the ten-minute bar.
