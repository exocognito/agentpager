---
id: DEC-2026-10-08-native-ios
date: 2026-10-08
decidedBy: Sam
basis:
  - Sam's iOS canvas "AgentPager iOS — native redesign" (claude.ai artifact SYyjPi2HdYsv7o5Ty2RMUZ) and its Android check (4jzvVsFxUhs7haEr7gu8Ne)
  - Sam's write-up "AgentPager: decisions to port into Blueprint", 2026-10-08, which merges a parallel security review
  - Sam's answers in the Claude Code review of that write-up, 2026-10-08
---

# The product Sam shares is a native iPhone app

Sam will share AgentPager as a native iOS app. Android comes later, with the same behaviour, data and words, and the web app is parked. Designing to iOS conventions simplified the flows, and Sam made these changes along the way:

- **Wording.** The app says pager and end, never session.
- **Links.** One kind of AgentPager link, `agentpager.me/start/<code>`, made by either side. Reading it never uses it up.
- **Pairing.** The agent shows three emoji, in order, and the phone enters them from a palette of 25 drawn for each pager. The service counts three tries, and a third wrong try ends the pager.
- **Lifetimes.** A pager lasts 24 hours, 7 days or 30 days, and the owner can change that later.
- **End reasons.** Every pager records why it ended: timed out, you ended it, agent finished, or pairing failed.
- **Answering.** Send closes the sheet and offers Undo, and a green tick shows when the agent confirms. Answered cards reopen as a thread.
- **Security.** HTTPS only, keys stored as digests, and Registry rows that expire.

Sam answered the review:

1. Cut answering from the Lock Screen. An alert only opens the app.
2. Cut "Never". 30 days is the longest lifetime.
3. Cut the Live Activity. The app icon badge shows the waiting count.
4. Plan a demo agent for App Review.
5. Use SwiftUI.
6. Answered cards live as long as the pager. Everything is cleared when the pager ends.
7. Old `?connect=` links fail.
8. "Ends" counts from now.
9. No short option labels.
10. Keep MCP, which Claude and Codex need.
11. Dogfood first: install on Sam's iPhone over USB with free signing, and set up Apple credentials in parallel without blocking product work.

Sam accepted these defaults, which settle the holes the review found:

1. On a phone's link, the first agent to join takes the pager.
2. Only an agent's start call takes a lifetime.
3. An agent's link opens a web page for a phone without the app.
4. The service keeps an ended pager's name, reason and time for 7 days.
5. Leaving the app during Undo sends at once.
6. A pager holds at most 10 open cards, and starting pagers is limited per network address.
7. The privacy page says that alert text passes through Apple.
8. Only the service keeps the clock.
9. A link the phone made is not listed under Agents until an agent joins it; until then it lives in the Connect sheet. Once an agent joins, the pager is listed as not paired and pairing opens.

This decision rewrites the strategy (SC1, SC2, SI1, SI2, SI5, SP1 to SP6) and parks MCARDS. It adds two milestones:
- MAPP: the app on Sam's iPhone, without alerts.
- MSHIP: alerts, Universal Links, the website, the demo agent and TestFlight.

The web-era promises are deprecated in place, and each names its successor.
