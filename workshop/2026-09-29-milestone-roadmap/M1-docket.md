# M1 · The whole exchange on agentpager.me

Status: a historical MSTART-era aid. MSTART is deprecated ([DEC-2026-10-01-mcards-first](../../packages/blueprint/records/decisions/DEC-2026-10-01-mcards-first.md)); its links point at paths from before versioning.

This is the final-form review docket for **M1 = MSTART**, using PR86 at `bce3cdbe8842d4979dc5c54a125b2e17a168d961` plus the owner-directed changes in this PR87. It gathers the packet for owner review; it adds no requirements and is not an acceptance result. The [canonical milestone](../../packages/blueprint/roadmap/milestones/MSTART.md), its deliverables and evidence remain binding. If they change before merge, refresh this snapshot and its preview.

## What the owner gets

After this milestone a person can leave their computer while their agent keeps working. The agent can send decisions to its owner and get answers remotely when needed. To connect the phone and agent, the agent shows a QR code and a link, and tells the owner which randomly selected emoji to choose. The owner scans the code or opens the link, sees a multiple-choice pairing decision, selects that emoji and presses Send. Correct pairing starts the session’s 24-hour lifetime.

The agent can be anywhere: a terminal, a desktop app, or a chat app on the same phone. Whenever the agent needs a decision it sends one multiple-choice question to the phone. The owner answers in two taps, or writes a short reply of their own, and sees the agent confirm what it will do next. Every past decision stays readable and none can be changed. Closing the tab doesn't lose the session; either side can end it, and otherwise it expires 24 hours after correct pairing is established. Later exchanges do not extend it. All of it runs on agentpager.me, with nothing to install and no account: an agent starts from one URL, reaches the service by HTTPS or MCP, and the first phone in is the only phone in.

## What we approve before the build

One guest exchange, on the web, with one agent and one phone. One question stays open until the agent acknowledges it. Multiple-choice answers take a choice tap and a separate Send tap; Other sends the owner's exact valid text. Receipt and agent acknowledgement remain distinct. History stays immutable. The same browser can return; end and expiry enforce the designed retention/deletion behavior.

PR86 supplies the repaired baseline; PR87 applies Sam’s pairing, lifetime and domain changes to its canonical contract and imported UI/machine. Its [decision record](../../packages/blueprint/records/decisions/DEC-2026-09-29-sharpening-repairs.md) records the seven approved product choices: live detail/history, waiting-row timing, invalid-Other feedback, option-row selection with separate detail control, one emoji, named regression/browser coverage, and honest network-uncertainty copy. The [M1 feedback decision](../../packages/blueprint/records/decisions/DEC-2026-09-29-m1-owner-feedback.md) records the later changes without altering the seven repair choices.

Correct pairing starts one fixed 24-hour deadline; later questions, answers, acknowledgements and reads never extend it. Pairing uses the normal multiple-choice component: select the target emoji the agent named, then press Send. Text is plain, bounded by the canonical schema, and refused whole when invalid. A phone ending deletes the exchange; an agent ending can retain its final acknowledgement only until the original remaining deadline, as C7/I6 define. These are M1 behaviors updated by Sam’s PR87 feedback. PR71’s deadline from creation and queue redesign still require M2 review.

## Packet: 18 deliverables → 19 evidence files

The real loop resolver produces this list without errors. Counts describe contract scope, not completed work. All listed evidence must hold on the reviewed candidate; design tests and old run records cannot pass it.

| Deliverable | Current contract statement | Evidence |
| --- | --- | --- |
| [C1::pair-a-phone-by-qr](../../packages/blueprint/design/capabilities/C1-pair-a-phone-by-qr.md) | Open the QR code or link your agent shows, select the emoji it names and press Send to pair, then see the agent confirm you are in. | [E1](../../packages/blueprint/design/evidence/E1-pairing-handshake.md) |
| [C2::answer-in-two-taps](../../packages/blueprint/design/capabilities/C2-answer-in-two-taps.md) | Answer an agent's question with one choice tap and one Send tap, and see it reach the agent. | [E2](../../packages/blueprint/design/evidence/E2-answer-in-two-taps.md) |
| [C3::write-an-other-reply](../../packages/blueprint/design/capabilities/C3-write-an-other-reply.md) | When no option fits, write a reply of your own, referring to options by number, and the agent receives exactly that text. | [E7](../../packages/blueprint/design/evidence/E7-other-reply.md) |
| [C4::revisit-past-decisions](../../packages/blueprint/design/capabilities/C4-revisit-past-decisions.md) | Reopen any answered decision to read the question, your answer and the agent's acknowledgement, with nothing to edit. | [E9](../../packages/blueprint/design/evidence/E9-history-is-read-only.md) |
| [C5::agent-starts-from-one-url](../../packages/blueprint/design/capabilities/C5-agent-starts-from-one-url.md) | An agent in any client that allows HTTPS requests or a custom MCP server pairs a phone and completes an exchange using only what agentpager.me/start says. | [E1](../../packages/blueprint/design/evidence/E1-pairing-handshake.md), [E5](../../packages/blueprint/design/evidence/E5-start-page-suffices.md), [E12](../../packages/blueprint/design/evidence/E12-mcp-way-in.md), [E13](../../packages/blueprint/design/evidence/E13-cold-agents-pair.md) |
| [C6::start-from-the-front-page](../../packages/blueprint/design/capabilities/C6-start-from-the-front-page.md) | A person landing on agentpager.me sees what it does, copies the one line to give their agent, and reads how the three steps go. | [E11](../../packages/blueprint/design/evidence/E11-front-page.md) |
| [C7::resume-or-end-a-session](../../packages/blueprint/design/capabilities/C7-resume-or-end-a-session.md) | Close the tab and come back to the same session later, or end the session at once from your phone or from your agent. | [E14](../../packages/blueprint/design/evidence/E14-resume-a-session.md), [E16](../../packages/blueprint/design/evidence/E16-end-a-session.md) |
| [I1::nothing-sends-without-send](../../packages/blueprint/design/invariants/I1-nothing-sends-without-send.md) | Choosing an option, typing an Other reply or opening detail never sends anything; only Send does, and it carries exactly the prepared choice. | [E3](../../packages/blueprint/design/evidence/E3-nothing-sends-before-send.md) |
| [I2::sent-answers-never-change](../../packages/blueprint/design/invariants/I2-sent-answers-never-change.md) | Once the service has stored an answer, no later request changes it and the phone offers nothing that could. | [E8](../../packages/blueprint/design/evidence/E8-sent-answer-never-changes.md) |
| [I3::first-phone-keeps-the-session](../../packages/blueprint/design/invariants/I3-first-phone-keeps-the-session.md) | The first phone to claim a pairing link holds the session; every later device is refused and the first phone is never disconnected. | [E6](../../packages/blueprint/design/evidence/E6-first-phone-wins.md) |
| [I4::pairing-link-is-one-use](../../packages/blueprint/design/invariants/I4-pairing-link-is-one-use.md) | A pairing link admits one phone; claiming it disables it at once, and an unclaimed link is replaced after 420 seconds with the old one refused. | [E6](../../packages/blueprint/design/evidence/E6-first-phone-wins.md) |
| [I5::receipt-is-not-acknowledgement](../../packages/blueprint/design/invariants/I5-receipt-is-not-acknowledgement.md) | After Send the phone shows only that the service stored the answer; it shows the agent received it only once the agent has acknowledged that answer. | [E4](../../packages/blueprint/design/evidence/E4-receipt-before-acknowledgement.md) |
| [I6::expired-sessions-refuse-and-forget](../../packages/blueprint/design/invariants/I6-expired-sessions-refuse-and-forget.md) | Correct pairing starts a fixed 24-hour session deadline; later activity never extends it, and after expiry every operation is refused and the session’s decisions are gone from active storage. | [E10](../../packages/blueprint/design/evidence/E10-expiry.md) |
| [I7::bad-text-refused-whole](../../packages/blueprint/design/invariants/I7-bad-text-refused-whole.md) | Text over 420 code points, malformed Unicode or HTML is refused whole on every agent field and on Other; nothing is truncated or stored. | [E17](../../packages/blueprint/design/evidence/E17-bad-text-refused-whole.md) |
| [I8::one-open-question](../../packages/blueprint/design/invariants/I8-one-open-question.md) | A session holds at most one open decision; asking while one is open, including after its answer and before its acknowledgement, is refused. | [E18](../../packages/blueprint/design/evidence/E18-one-open-question.md) |
| [K1::visible-within-five-seconds](../../packages/blueprint/design/metrics/K1-visible-within-five-seconds.md) | A new question reaches the phone, and a sent answer reaches the agent, within five seconds on the recorded target. | [E19](../../packages/blueprint/design/evidence/E19-visible-within-five-seconds.md) |
| [D1::cloudflare](../../packages/blueprint/design/dependencies/D1-cloudflare.md) | The product runs as one Worker on the agentpager.me zone, with one SQLite-backed Durable Object per session and one registry object, and nowhere else. | [E15](../../packages/blueprint/design/evidence/E15-deployed-is-the-candidate.md) |
| [D2::agent-clients](../../packages/blueprint/design/dependencies/D2-agent-clients.md) | The cold dogfood stands on real agent clients installed on the test host, which the product did not build and the recipe names. | [E13](../../packages/blueprint/design/evidence/E13-cold-agents-pair.md) |

## Observable closure

The owner can start from the front page, let a cold agent use `/start`, pair the phone, answer a question, see its exact answer and the agent's acknowledgement, revisit immutable history, return in the same browser and end the session. The reviewer also exercises forbidden paths: premature sends, changed answers, a second phone or reused link, invalid text, a second open question and operations after expiry.

The evidence files below own the full observations and forbidden observations; these links and targets are a review index, not replacement scenarios.

| Evidence | Required target |
| --- | --- |
| [E1::pairing-handshake](../../packages/blueprint/design/evidence/E1-pairing-handshake.md) | a local instance the test starts from the checkout, then https://agentpager.me; the caller is scripted from /start, the phone is a phone browser at 390 px |
| [E2::answer-in-two-taps](../../packages/blueprint/design/evidence/E2-answer-in-two-taps.md) | a local instance from the checkout, then https://agentpager.me; two viewports, 390 px and 1280 px, each on its own session |
| [E3::nothing-sends-before-send](../../packages/blueprint/design/evidence/E3-nothing-sends-before-send.md) | a local instance from the checkout, then https://agentpager.me; the browser's own network capture, a real phone browser at 390 px |
| [E4::receipt-before-acknowledgement](../../packages/blueprint/design/evidence/E4-receipt-before-acknowledgement.md) | a local instance from the checkout, then https://agentpager.me; a real phone browser at 390 px |
| [E5::start-page-suffices](../../packages/blueprint/design/evidence/E5-start-page-suffices.md) | a local instance from the checkout, then https://agentpager.me; a plain fetch with no custom headers, then a read of the served text |
| [E6::first-phone-wins](../../packages/blueprint/design/evidence/E6-first-phone-wins.md) | a local instance from the checkout, then https://agentpager.me; two separate browser contexts, and one real wait of 421 seconds on each target |
| [E7::other-reply](../../packages/blueprint/design/evidence/E7-other-reply.md) | a local instance from the checkout, then https://agentpager.me; a real phone browser at 390 px |
| [E8::sent-answer-never-changes](../../packages/blueprint/design/evidence/E8-sent-answer-never-changes.md) | a local instance from the checkout, then https://agentpager.me; at the HTTP boundary |
| [E9::history-is-read-only](../../packages/blueprint/design/evidence/E9-history-is-read-only.md) | a local instance from the checkout, then https://agentpager.me; a real phone browser at 390 px |
| [E10::expiry](../../packages/blueprint/design/evidence/E10-expiry.md) | a local instance the test starts with the clock control binding on, from a persist directory outside the worktree; on https://agentpager.me only that the clock control is ignored |
| [E11::front-page](../../packages/blueprint/design/evidence/E11-front-page.md) | a local instance from the checkout, then https://agentpager.me; a browser the test controls at 390 px and 1280 px |
| [E12::mcp-way-in](../../packages/blueprint/design/evidence/E12-mcp-way-in.md) | a local instance from the checkout, then https://agentpager.me; a real MCP client, and a phone browser for the owner's side |
| [E13::cold-agents-pair](../../packages/blueprint/design/evidence/E13-cold-agents-pair.md) | https://agentpager.me only; every agent client the recipe names under D2::agent-clients, each in an empty directory, with the owner's side in one Chromium context at 390 px per client kept open from pairing through the acknowledgement |
| [E14::resume-a-session](../../packages/blueprint/design/evidence/E14-resume-a-session.md) | a local instance from the checkout, then https://agentpager.me; a real phone browser that closes its tab |
| [E15::deployed-is-the-candidate](../../packages/blueprint/design/evidence/E15-deployed-is-the-candidate.md) | https://agentpager.me only, after the builder's deploy of the candidate commit |
| [E16::end-a-session](../../packages/blueprint/design/evidence/E16-end-a-session.md) | a local instance from the checkout, then https://agentpager.me; storage reads and the 24-hour step on the local instance with the controlled clock |
| [E17::bad-text-refused-whole](../../packages/blueprint/design/evidence/E17-bad-text-refused-whole.md) | a local instance from the checkout, then https://agentpager.me; the HTTP boundary for every agent field, and the phone's Other box |
| [E18::one-open-question](../../packages/blueprint/design/evidence/E18-one-open-question.md) | a local instance from the checkout, then https://agentpager.me; the HTTP boundary, and the phone's inbox |
| [E19::visible-within-five-seconds](../../packages/blueprint/design/evidence/E19-visible-within-five-seconds.md) | a local instance from the checkout, then https://agentpager.me; the K1 result is the deployed target's, with a real browser running the phone app and its own polling |

## Out of scope

Accounts and auth; PR71's independent queue and rich cards; paid Pro; native apps; community cards. MSTART also excludes Alchemy, background/lock-screen notifications, lost-key re-pair, Markdown rendering and agent helper SDKs. SG2 has no metric with a bar and is not claimed. M2–M7 are draft direction in [Horizons](../../packages/blueprint/roadmap/ROADMAP.md#horizons).

## What “ready” still needs

- **Design approval:** PR86 is ready for owner review. This PR87 contract change also needs its own review and merge. The source pin for launch is the merged revision, not a moving PR head.
- **Host qualification:** the recipe explicitly marks the candidate Codex MCP-only mode unqualified. D2 requires fetch-only discovery, session-scoped MCP setup and access restrictions that survive resume. Demonstrate those facilities or resolve a changed host/contract with the owner. An unqualified row remains unproved, never a pass. No new auth-provider decision is needed for M1.
- **Dependencies:** verify D1’s agentpager.me zone, DNS, custom-domain binding and credential scope and D2's installed/authenticated clients on the actual cleanroom host. This documentation run did not access credentials or qualify the host.
- **Build and proof:** the builder supplies `packages/app/`, imports the design exports, runs the acceptance suite, deploys the exact candidate and retains the required local/deployed/protocol/browser/storage/cold-client observations. Run the actual loop only after the design is merged and the operator authorizes that run.
- **Owner closeout:** walk the candidate with the per-file report, then accept its implementation PR. Closure deletes MSTART's active roadmap line; the loop does not close it on its own.

## Decisions and effort

**Sam resolved the M1 feedback choices:** use the specified random emoji with normal selection and Send, start a fixed 24-hour clock on correct pairing, and use agentpager.me. No further owner choice is pending for those edits. The unpaired session has no session deadline; the separate pairing-link rotation still applies. Domain supply and host qualification remain unverified. The two owner checkpoints are approval by design merge and acceptance after the product walk. Host qualification, service implementation and evidence gathering are engineering work, not nineteen owner decisions.

The 19 evidence files are the useful effort inventory. They cover UI/interaction, real HTTP/MCP boundaries, persistence and deletion, deployment identity/storage placement, latency and cold agents. E6 alone requires a real 421-second wait on each of the local and deployed targets (842 seconds total before other work). E13 allows each available client/access mode at most ten minutes to finish a cold exchange; that is a pass limit, not a schedule estimate. Build duration and repeat count are unknown until the host is qualified and the implementation begins.

**Reward to test:** can a person step away while an agent reliably asks and receives a decision on their phone? M1 answers that core product question without account design or payments. It does not prove adoption, paid demand or financial stability. User feedback at this release should shape M2 rather than requiring all seven stages first.
