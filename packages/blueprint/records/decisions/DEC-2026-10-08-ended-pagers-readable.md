---
id: DEC-2026-10-08-ended-pagers-readable
date: 2026-10-08
decidedBy: Sam
basis:
  - Sam in Claude Code, 2026-10-08: "I would expect to see its ended and the local client data become static after that, and disappear when older than 24 hours"
  - exocognito/agentpager PR #5
---

# Ended pagers stay readable on the phone for 24 hours

**Dogfooding. Subject to change or removal.**

When a pager ends, the service still deletes its decisions at once (I17). The phone keeps its own last copy, read only, and lists the pager under "Ended in the last 24 hours" until 24 hours after the end, then drops it. Unanswered cards show but can't be answered.

This changes DEC-2026-10-08-native-ios answer 6 for the phone's copy. C22, C23 and I17 say so. SI5 is the owner's to rewrite; a suggested wording: "When a pager ends, its decisions are deleted from the service at once, and my phone keeps a read-only copy for 24 hours."
