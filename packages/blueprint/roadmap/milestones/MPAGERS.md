---
id: MPAGERS
title: Pagers on my phone
status: shipped
deliverables:
  - C26::make-a-pager-on-the-phone
  - C23::pagers-and-the-pager-screen
  - C22::turn-a-pager-off-and-on
  - C5::review-and-answer-cards
  - C7::revisit-decisions
  - I17::off-pagers-deliver-nothing
  - I19::the-number-names-the-phones-key
  - D1::cloudflare
  - D6::iphone-app
---

Shipped: Stage 1 of the v2 plan (`docs/v2/05-readiness-review-and-stages.md`).

# MPAGERS · Pagers on my phone

## Objective

I make pagers on my phone, as many as I like, each with a name, a number and a switch. I turn one off and nothing from its agents gets through; I turn it on and its open decisions are answerable again. One can also turn off by itself, after 24 hours, 7 days or 30 days. Each pager shows its decisions grouped by project, with who asked. A decision opens full screen, with its options and pages as sheets, and once answered it is a closed record. When I delete a pager, the service forgets its agents and their decisions. The server's address lives in iOS Settings, not in the app.

## Out of scope

- The agentpager command: MCOMMAND.
- Encryption: the service still reads every decision. The agentpager command's own key check (I19) comes with MENCRYPT.
- Moving a pager to a new phone, or recovering its keys.
