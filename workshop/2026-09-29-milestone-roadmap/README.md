# M1 first, richer guest product second

Status: a historical MSTART-era aid. MSTART is deprecated ([DEC-2026-10-01-mcards-first](../../packages/blueprint/records/decisions/DEC-2026-10-01-mcards-first.md)); its links point at paths from before versioning.

Keep the repaired baseline as M1 and learn from a working exchange before building PR71's richer guest product as M2. Accounts/auth, Pro pilot, native builds, community cards and Pro GA remain draft direction.

- [Visual roadmap, M1 docket and preview gaps](index.html)
- [M1 ready docket form](M1-docket.md)
- [Canonical roadmap](../../packages/blueprint/roadmap/ROADMAP.md)
- [M1 Storybook — PR87](http://localhost:6031/?path=/story/journeys-phone--pair)
- [M2 proposal Storybook — PR71](http://localhost:6018/?path=/story/journeys-agentpager--browse)

## Sources and status

M1: PR86 repair baseline at `bce3cdbe8842d4979dc5c54a125b2e17a168d961`, plus this PR87’s owner-directed pairing, fixed-lifetime and agentpager.me changes. M2: PR71 at `fb2e0a653004fa836de2aa6f464d684e4c8115d8`. PR83 supplied the earlier sharpening method; PR86 repairs main before this roadmap. PR71 stays unmerged. Later numbering is planning language: only stable id MSTART is selected by the active roadmap and resolver. PR71's MQUEUE is a candidate for M2, not an approved next packet.

This PR also changes the canonical MSTART objective, strategy, design and evidence. The HTML and docket remain review aids outside the binding Blueprint root. They do not supersede canonical files, settle future authentication or authorize a live build/deploy. Storybook journeys run the real design machine with in-memory fixture effects; static screen stories show states with mock callbacks. Neither proves the service.

## Preview-to-build gaps

| What you see | What the final build still needs |
| --- | --- |
| M1 imported phone UI and machine; PR86's live history/detail and validation repairs | The app must import `/screen` and `/machine`, wire real effects and preserve the tested draft/retry/acknowledgement behavior. Do not copy the fixtures into production. |
| A fixture agent acknowledges your answer | Real HTTP and MCP clients, exact answer handling, one-question enforcement and receipt/ack separation at the service boundary. E1–E5, E7–E9, E12, E17–E18. |
| Fixture session return, end and expiry states | Durable Object persistence and registry, real browser key storage/resume, one-phone/one-use pairing and deletion/storage observations. E6, E10, E14–E16. |
| Rendered marketing and `/start` stories | Serve the exported documents on the real routes. E5 checks canonical `/start` body equality; E11 checks the front page. |
| Healthy local Storybook | Candidate build identity on agentpager.me, deployment/storage placement, measured deployed polling latency and every available cold client/access mode. E13, E15, E19. MCP-only qualification is still explicitly unproved. |
| M2 rich queue and seven card kinds | Integrate with the completed M1 code and regression suite, sharpen its new behavior and decide what prior evidence must change. The current PR71 branch is not a drop-in extension of PR86. |
| Account and Pro controls in PR71's default Browse/Rich Cards stories | Later workshop mocks. M2 must use the guest gate `accountsAvailable={false}`; the existing Guest Milestone Account Stub demonstrates that gate. M3 auth and M4/M7 paid behavior require later design. |

## M1 → M2 changes to review later

| M1 (PR86 + PR87 feedback) | Draft M2 (PR71) |
| --- | --- |
| One open question until agent acknowledgement | Independent questions answered in any order |
| Select the agent-specified target emoji, then Send | Agent instructs which emoji to choose; reconcile its gesture and service contract |
| Fixed 24 hours from correct pairing | Fixed 24-hour guest lifetime from creation |
| Other is a short answer to the current question | Feedback closes a question; revision is a new question |
| Bounded plain text and generic choice options | Exact rich payloads: general, PR, email, calendar, document, X reply and Discord |
| OwnerPager appearance and exported canonical `/start` | AgentPager appearance and changed package/story layout; PR71 removes that `/start` export and must reconcile it |

These are product and integration changes, not labels. Prior sharpening found full PR-path display (wrap versus expansion), evidence applicability/expiry cleanup, repeated fact ownership and cold-proof scope still needing M2 review. M1's PR86 E13 already owns deployed-only cold-agent proof; do not carry the old PR71 decision count into M1. Retain the existing regression guarantees or obtain explicit owner approval for changed guarantees in M2's design PR.

## Local verification

On this PR87 design: `pnpm check`, `pnpm test` (124 tests), `pnpm diagram:check`, `pnpm build:storybook` passed. The pairing journey covers wrong option, Other refusal and correct selection plus Send; fixed-deadline tests cover later activity. On pinned PR71: the same commands passed (54 unit and 176 story tests). The shared process suite passed 41 tests. The actual packet resolver selected MSTART with 18 deliverables, 19 evidence and no problems. These are design/process checks; no acceptance suite, cleanroom qualification or deployed product run occurred.

Browser inspection used live journey interactions at 390 × 844 and screenshots at 1280 × 900. The M1 assets were refreshed from this PR87’s screen fixtures; the M2 assets retain their PR71 source. The phone captures show M1's inbox/decision and M2's queue/email approval; Storybook controls are fixture-only. The report is offline so its retained screenshots do not depend on a CDN.

## Preview handoff

The M1 captures come from `blueprint-worktrees/pr87-owner-feedback` on port 6031; the old detached PR86 preview at port 6020 does not contain these changes. PR71’s M2 preview comes from `blueprint-worktrees/ownerpager-m1-ui` on port 6018. Local links work only while those servers run; retained images work offline.

Rebase this design branch onto PR86’s eventual main merge and verify the design/preview source has not changed before pinning the actual build loop.
