---
id: C20::connect-with-an-agentpager-link
serves:
  - SC1
  - SI2
  - SP5
  - SP6
statement: Connect an agent with one AgentPager link, either by opening the link or QR code your agent shows or by giving your agent a link your phone makes; either way the app opens to pairing.
caveats:
  - Until D7::apple-developer-program, free signing has no Universal Links. Scanning or tapping an agent's link opens its web page first, and the page's Open in AgentPager button opens the app.
  - The Simulator has no camera. The proof opens the link's URL directly, and nothing scans a printed QR code until the owner's walk.
  - Anyone holding a phone's link can join it before the owner's agent does. The code (C21) stops them from pairing; the owner's agent is refused, says so, and the owner makes a new link.
---

## Behaviors

1. **Agent's link.** The agent starts a pager with its name and, if the owner asked, an end time of 24 hours, 7 days or 30 days. It shows the AgentPager link, a QR code of the link, and the three-emoji code (C21).
2. Opening an agent's link on a phone with AgentPager opens the app straight to pairing for that agent. On a phone without the app, the link's page says what AgentPager is and how to get it.
3. **Phone's link.** The + on the Agents list opens Connect an Agent. It shows a new link as text and as a QR code, with Copy, Share, and Pager ends after (24 hours, 7 days or 30 days). The owner gives the link to an agent.
4. The agent reads the link, learns how to join, and joins with its name. The first agent to join takes the pager; a later join is refused as already joined. The joined agent shows its three-emoji code, and the phone opens pairing for it.
5. Reading or opening a link never uses it up and never joins or pairs anything, whoever reads it: a person, a browser, a link preview or an agent. A link works for the pager's first 15 minutes; after that it is refused as expired.
