---
id: C2::agent-starts-from-one-url
serves:
  - SC1
  - SP5
statement: An agent in any client that can send HTTPS requests or use a custom MCP server pairs a phone and completes a card exchange using only what agentpager.me/start says.
caveats:
  - Scripted callers prove the HTTPS and MCP ways in; the cold arrival (D2) samples real agents in the clients the test host can run. The Claude and ChatGPT apps are sampled by the operator and by the owner's dogfood.
  - ChatGPT Free cannot add a custom MCP server or send requests, so it has no way in.
  - A held read is checked to return within the answer wait plus one second.
  - No helper, SDK or agent-specific adapter is promised. Nothing wakes an agent that has stopped; a waiting agent holds a read open.
  - AgentPager only carries the answer; nothing proves the agent carried out the approved action.
---

## Behaviors

1. The owner pastes the front page's line into their agent. The agent fetches agentpager.me/start, a plain page, and learns what AgentPager is and which way in fits it.
2. An agent that can send requests uses HTTPS. One that cannot asks the owner to add the MCP server to its app, once.
3. The agent names the session, shows the pairing link and emoji, and the owner pairs (C1).
4. The agent asks cards, waits for each answer, acknowledges with its next steps, and finishes the session when its work is done.

Everything the agent needs is on that one page. A fresh agent in a client D2 names completes pairing, one card, the exact answer and a visible acknowledgement within ten minutes of the owner's first prompt.
