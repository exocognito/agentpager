# Regression set: the 10 cards of 28–29 Oct 2026

`cards-2026-10-28.txt` is extracted from Codex transcripts: every `pagerCard` / `m9Card` / … object the agent sent that night, with timestamps, plus Sam's answers and notes. Pacific time is UTC−7.

What they are for: `agentpager review` is judged by how a subagent grades these. Eight of ten should get a must-fix on point 2 (an option that asks the owner to write instead of choose); the two that shouldn't (4:31pm M8, 8:03am M11 rev 4) are the two Sam answered without complaint. The 10:17pm M11 card, rewritten as `card.yaml`, is `EXAMPLE` in `../../src/rules.ts`. `../../scripts/regression-cards.mjs` rebuilds the cards from this file.

Also a conversion test: each card is in today's JSON brief format; the binary's `card.yaml` → brief compiler should be able to round-trip the clean ones.

No secrets: bearer keys appear only as variable names.
