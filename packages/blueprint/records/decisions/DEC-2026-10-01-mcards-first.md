---
id: DEC-2026-10-01-mcards-first
date: 2026-10-01
decidedBy: Sam
basis:
  - Sam's direction to deprecate MSTART and build MCARDS alone
---

# MCARDS first and standalone

Sam deprecated MSTART before it closed. MCARDS is the first milestone and stands alone: one front page `/`, one `/start`, one `/mcp` and one session page `/s/:sessionId`. The short exchange is gone. Pairing is the first card in the queue, opened on arrival and answered with the decision card component, then Send; it takes no feedback. The MSTART spike candidates (PR #96, PR #99) are not regressions for MCARDS.

Design files now live in one folder per design version, which each milestone names in its `design:` field: MCARDS builds `design/v1/`, and the MACCOUNT and MPRORESEARCH drafts are `design/v2/` and `design/v3/`. The requirements were cut to what one channel needs: 7 capabilities, 6 invariants, 1 metric, 2 dependencies and 18 evidence files. Ids were not renumbered. Seven slugs lost their `rich-` prefix: I10, I12, I13, E23, E25, E27, E28.

STRATEGY.md edits that remove the short exchange from SC1, SI6, SI7 and SP1 to SP4 are drafts for Sam's review in the same PR.

SI7 keeps its id with a changed meaning, pending Sam's approval of that STRATEGY draft: it was one short-exchange question at a time; it is now that cards are independent.

## Where each removed id went

| Old id | Now held by |
| --- | --- |
| C2::answer-in-two-taps | C8: choose on a general card, then Send |
| C3::write-an-other-reply | C9: feedback is the cards' own reply in your words |
| C4::revisit-past-decisions | C11 |
| C10::agent-starts-rich-cards | C5 |
| I1::nothing-sends-without-send | I13 |
| I2::sent-answers-never-change | I12 |
| I4::pairing-link-is-one-use | I3 |
| I5::receipt-is-not-acknowledgement | I13 |
| I7::bad-text-refused-whole | I10 |
| I8::one-open-question | Dropped with the short exchange; its pairing gate is in C1 and I9 |
| I11::shared-session-boundary | C7 (latest acknowledgement), I6 (fixed deadline), I3 (keys) |
| E2::answer-in-two-taps | Dropped; E20, E28 and the held reads in E5 and E12 cover it |
| E3::nothing-sends-before-send | E28 |
| E4::receipt-before-acknowledgement | E28 |
| E7::other-reply | E21, E27 |
| E8::sent-answer-never-changes | E25 |
| E9::history-is-read-only | E23 |
| E17::bad-text-refused-whole | E27 |
| E18::one-open-question | Dropped; its pairing gate is in E1 and E24, its acknowledgement errors in E25 |
| E22::cold-rich-agents | E5, E12, E13 |
| E26::shared-session-boundary | E6 (access), E10 (expiry), E16 (ending) |
