---
id: MHELPER
title: Optional helper for several agents and answer delivery
status: draft
---

# MHELPER · Optional helper for several agents and answer delivery

## Objective

I can give an agent the remote AgentPager MCP server and use the complete pairing, decision, feedback, answer, acknowledgement and history flow without installing a helper. When I choose to install one helper on my laptop or a spike VM, it helps connect several supported agent clients there, keeps their sessions separate, shows their connection and activity state on my phone, and brings my answer back to the agent that asked even after its turn has gone idle. My phone cannot start a new task, send an arbitrary instruction, restart a process or grant tool permissions.

One installation configures supported clients; it is not one shared agent identity. Every agent session still pairs with its own phone authorization and remains independently endable. The same phone browser can hold those sessions through the existing home screen. An installed client is not claimed to be supported until its named setup, answer delivery and status capabilities have been qualified.

## Proposed deliverables

This is a draft sketch, not a runnable selection. `deliverables` is deliberately absent: the process requires selected promises to be active. On owner approval and completion of the design/verification gates, copy the following full IDs into the milestone's `deliverables` block and promote the approved draft promises. A missing selection must never be treated as an empty successful run.

1. C13::set-up-supported-agents-with-one-helper
2. C14::receive-existing-answers-through-the-helper
3. C15::see-connection-and-activity-without-prompting
4. I9::owner-channel-only-answers-existing-decisions
5. I10::helper-delivery-stays-bound-and-bounded
6. K2::helper-answer-starts-an-idle-turn
7. D6::qualified-helper-hosts-and-adapters
8. J3::several-agents-on-one-helper
9. J4::helper-reconnect-revocation-and-isolation
10. C1::pair-a-phone-by-qr
11. C2::agent-starts-from-one-url
12. C4::resume-or-end-a-session
13. C5::review-and-answer-cards
14. C6::send-feedback
15. C7::revisit-decisions
16. C8::home-lists-this-browsers-sessions
17. I1::first-phone-keeps-the-session
18. I2::expired-sessions-refuse-and-forget
19. I3::independent-decisions
20. I4::payloads-refused-whole
21. I5::answers-never-change
22. I6::send-and-acknowledgement
23. K1::visible-within-five-seconds
24. D1::cloudflare
25. D2::agent-clients
26. D3::owner-browser
27. J1::happy-session
28. J2::longest-session

## Out of scope

1. Arbitrary phone instructions, model-generated status requests, remote shell, process launch/restart, permission approvals and changing an agent's execution policy.
2. Native phone apps, background notifications, replacing the browser polling transport, accounts, device recovery, shared machine-wide pairing and merging agents into one decision queue.
3. Universal client support, auto-installing agent clients or authenticating them for the owner, configuring other machines over SSH, and claiming a helper installed on one machine controls an unrelated backend elsewhere.
4. End-to-end confidentiality or a claim that a compromised relay cannot forge owner messages. The trust choice must be explicitly accepted or replaced before activation; the current relay-readable design is not silently renamed secure against relay compromise.
5. A required Bun implementation, a particular packaging tool, a WebSocket rewrite or any new protocol chosen only for its own sake.

## Entry and approval gates

1. MCARDS is the predecessor. Its still-applicable promises remain regression obligations; MHELPER does not close it or imply its implementation exists.
2. The owner reviews the statements and their required items, the proposed host/client scope and thresholds, and the activation amendments in the proposal record.
3. Host integrations are qualified against actual client APIs. A client that cannot report activity or accept bounded answer delivery remains unsupported for that capability; no transcript guessing substitutes for an event interface.
4. Schemas, state machines, effects/routes, screens and verification are completed and approved at one exact cumulative revision. Draft prose and the HTML proposal are not that executable design or formal proof.
5. Only after those gates, with all selected promises active, is the full deliverables block added and status changed to active. No helper build, deployment or driver launch is authorized by this proposal.

See [proposal and exact amendment patch](../../records/workshop/mhelper/PROPOSAL.md) for assumptions, reversals and remaining decisions.
