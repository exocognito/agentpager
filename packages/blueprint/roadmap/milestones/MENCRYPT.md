---
id: MENCRYPT
title: Decisions the service can't read
deliverables:
  - C30::decisions-are-encrypted-end-to-end
  - I20::the-service-holds-nothing-readable
  - I19::the-number-names-the-phones-key
  - C17::get-paged
  - D6::iphone-app
---

Stage 3 of the v2 plan (`docs/v2/05-readiness-review-and-stages.md`). Each deliverable's parts tagged "Not built yet: comes with the encryption work" land here.

# MENCRYPT · Decisions the service can't read

## Objective

My decisions, their attachments, my answers and my agents' acknowledgements are encrypted between my agent's machine and my phone, and the service carries only ciphertext and what it needs to route it. The agentpager command checks my pager's key against its number before it encrypts anything to it. Alerts still show me the real question: an extension on my phone decrypts them. Every earlier promise still passes.

## Out of scope

- Hiding which pager and which agent, when, and how big each part is (C30).
- Moving a pager's keys to a new phone, or recovering them.

## Sam decides first

The product stays the same, with encryption added, so two questions are Sam's:

- What happens to decisions stored before the switch: deleted then, or kept readable until the service forgets them as usual (I17).
- What an agent sees when its command is from before the switch: refused, with how to update (MINSTALL).
