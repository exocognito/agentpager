---
id: C2::agent-starts-from-one-url
serves:
  - SC1
  - SP5
statement: An agent in any client that can send HTTPS requests or use a custom MCP server connects to a phone and completes a card exchange using only what agentpager.me/start or an AgentPager link says.
caveats:
  - Scripted callers prove the HTTPS and MCP ways in; the cold arrival (D2) samples real agents in the clients the test host can run. The Claude and ChatGPT apps are sampled by the operator and by the owner's dogfood.
  - ChatGPT Free cannot add a custom MCP server or send requests, so it has no way in.
  - A held read is checked to return within the answer wait plus one second.
  - No helper, SDK or agent-specific adapter is promised. Nothing wakes an agent that has stopped; a waiting agent holds a read open.
  - AgentPager only carries the answer; nothing proves the agent carried out the approved action.
---

## Behaviors

1. The owner gives their agent a line or an AgentPager link. The agent fetches agentpager.me/start or the link, a plain page, and learns what AgentPager is and which way in fits it.
2. An agent that can send requests uses HTTPS. One that cannot asks the owner to add the MCP server to its app, once.
3. The agent names its pager. It either starts one and shows the link, QR code and code, or joins the owner's link and shows the code (C20). The owner pairs (C21).
4. The agent asks cards, waits for each answer, acknowledges with its next steps, and finishes when its work is done, which ends the pager (C22).
5. A pager holds at most 10 open cards. An agent that asks for an eleventh is refused and told to wait for answers. Making pagers is limited per network address, whether an agent or a phone makes them, and a refused agent is told when to try again.

Everything the agent needs is on that one page. A fresh agent in a client D2 names completes pairing, one card, the exact answer and a visible acknowledgement within ten minutes of the owner's first prompt.
