---
id: DEC-2026-09-29-m1-owner-feedback
date: 2026-09-29
decidedBy: Sam
basis:
  - Sam's replacement M1 objective in PR87 review
  - Correct pairing established starts the clock
  - Require Send and use the normal multiple-choice component
---

Sam changed M1's public domain to `agentpager.me`, clarified the agent's QR-plus-link instruction with a random target emoji, and replaced the rolling 25-hour lifetime with a fixed 24 hours from correct pairing. The owner selects the instructed emoji and presses Send in the normal multiple-choice component; a single selection does not submit.

This supersedes the any-emoji pairing and rolling deadline in older lifecycle decisions for the current design. Those records remain historical. The canonical strategy, C1, I6 and schemas hold the resulting obligations. PR71 remains separate; its broader queue/card design is not adopted here.

This authorizes a design change, not a deployment, credential change or live trial. The old Cloudflare dependency documented ownerpager.com; supply for the new domain must be verified before a build can claim deployment proof.

Later checks of that supply: Sam confirmed the existing Workers key permissions cover both ownerpager.com and agentpager.me (PR88). A read-only probe on 2026-09-29 found the credential, the account field and an active agentpager.me zone accessible with it, and no custom domain bound to Worker ownerpager. Neither check shows a write, a deploy, DNS or a domain binding; D1::cloudflare and E15::deployed-is-the-candidate hold what the candidate deploy must show.
