---
id: DEC-2026-10-08-pager-numbers
date: 2026-10-08
decidedBy: Sam
basis:
  - exocognito/agentpager PR #2, "Pager number", merged by Sam into spike/ios-dogfood at acbc809
  - Sam in Claude Code, 2026-10-08: "I think agent numbers are a new product feature, I was way too limited in how I thought about connections needing to be made to get a lot of usage when we designed just the QR code"
  - Sam in Claude Code, 2026-10-08: "So can we not be treating page numbers as some exception but just part of the core product and will likely evolve over the next few dogfooding sessions"
---

# Pager numbers are part of the product

**Dogfooding. Subject to change or removal.**

Pairing every agent through a link and three emoji is too much work when an owner runs many agents. So an owner can also give agents they trust a pager number, and each agent opens its own pager on the owner's phone, already paired. PR #2 built it for dogfooding and called it an exception to SI2. Sam then made it part of the product: how agents connect should get more flexible, and dogfooding is how AgentPager finds the right way.

As built at acbc809:
- Settings shows the phone's one pager number, copies or shares a line to paste into AGENTS.md, and changes the number. The old number then opens nothing, and pagers already open keep working.
- An agent opens a pager with `POST /api/numbers/<number>/pagers` or the MCP tool `page_owner`, then asks, waits and acknowledges as on any pager. The phone lists the pager already paired.
- The service stores numbers only as digests, as it does keys and link codes.

Anyone who has the number and can reach the service can open pagers on the phone and ask cards in them, though not read other pagers or answer cards. The owner keeps it where only agents they trust read it.

C25::page-by-pager-number promises it, and I16, C2, C23, the terms and MAPP name it. SI2 is the owner's to rewrite, since it still says a phone pairs only by entering the agent's code. Sam is also sketching how numbers are organised, such as one number per machine and a + menu that offers both. That is not decided, and the promises do not fix how many numbers a phone has.
