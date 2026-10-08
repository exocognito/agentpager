---
id: DEC-2026-09-25-mstart-scope
date: 2026-09-25
decidedBy: Sam
basis:
  - SC1
  - SI2
  - SI5
  - SP2
  - SP5
losers:
  - a first milestone on a local Worker only, with deployment as a second milestone
  - one guarantee SI2 carrying access, honest delivery and expiry together
  - a re-pair flow that transfers a session to a phone that lost its credential
  - a new question allowed once the previous answer is stored, before its acknowledgement
  - Alchemy resource declarations in the first milestone
cost: The first run carries a deployment credential and a real domain, which the loop has not exercised before; a reviewer may raise deploying with wrangler rather than Alchemy as a finding against SP2 until the next milestone adds the declarations.
---

Sam answered the nine questions from the 2026-09-25 outline that took OwnerPager from its round 3 workshop into a Blueprint package.

- The first milestone, MSTART, ships the whole exchange on ownerpager.com: pair, ask, answer, acknowledge, history and the refusals. The owner provides the Cloudflare access it needs.
- The workshop strategy became `strategy/STRATEGY.md` with these edits: the old SI2 split into SI2 (access), SI4 (a service receipt is never shown as an agent acknowledgement) and SI5 (expiry); new SI6 (input limits) and SI7 (one open question), so the invariants that hold them have a guarantee to serve rather than only a principle. SP2 and SP4 now point at SI7 and SI6 instead of restating them.
- Round 4 answers: the phone reads its inbox every 3 seconds and the agent reads its answer every 5 seconds (superseded on 2026-09-26 by the held read in DEC-2026-09-26-agent-reach), so a new question or answer is visible within 5 seconds; a phone that loses its stored credential starts a new session; the agent must acknowledge an answer before asking again.
- The first milestone deploys with wrangler; Alchemy declarations arrive with the next milestone.
