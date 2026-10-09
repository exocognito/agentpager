---
id: DEC-2026-10-08-pager-number-dogfood
date: 2026-10-08
decidedBy: Sam
basis:
  - exocognito/agentpager PR #2, "Pager number", merged by Sam into spike/ios-dogfood at acbc809; its trade-off reads "This is a dogfood exception, not a strategy change."
  - Sam in Claude Code, 2026-10-08: "yes pager number is to be dogfooded"
---

# Sam's dogfood build opens pagers by pager number, an exception to SI2

Sam wants to dogfood with many agents without showing each one a link and tapping its emoji. So the dogfood build gives his phone a pager number. An agent that has the number opens a pager on his phone that is paired from the start.

- Settings shows the phone's one pager number, copies or shares a line to paste into AGENTS.md, and changes the number. The old number then opens nothing, and pagers already open keep working.
- An agent opens a pager with `POST /api/numbers/<number>/pagers` or the MCP tool `page_owner`, then asks, waits and acknowledges as on any pager. The phone lists the pager already paired.
- The service stores numbers only as digests, as it does keys and link codes.

This breaks SI2 and I16 on purpose. Anyone who has the number and can reach the server can open a pager on the phone and put cards on it, though not read other pagers or answer cards. Sam accepted that for himself: the number sits only where agents he trusts read it. SI2 and I16 are unchanged.

PR #2 also names an idea it did not build: several numbers at once, one per trust level, as a premium feature.
