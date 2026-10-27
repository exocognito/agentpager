---
id: I3::independent-decisions
serves:
  - SI7
  - SI8
statement: Cards have independent identities and can be queued, answered and acknowledged in any order once pairing is acknowledged.
caveats:
  - The proof answers three cards in one out-of-order sequence (the third before the second). It does not try every order, and never sends two answers at the same moment.
---

Deprecated. Succeeded by I18::independent-cards: there is no pairing card to acknowledge, so pairing itself opens the pager to cards (SI2).

Answering or acknowledging one card never changes another. Until the agent acknowledges the pairing card, it can ask no other card.
