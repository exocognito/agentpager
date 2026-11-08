# DESK · Decisions answered from my Mac

> **Status:** queued · **Order:** after CLIENTS, before INSTALL (DEC-2026-11-08-desk-after-clients) · numbered when it starts

## Objective

Sam queued it on Sam's pager on 8 Nov 2026, choosing the card's recommended option. As that card described it:

- Sam links a Mac to a pager from the phone. The Mac then shows that pager's decisions and answers them with the phone's authority.
- The phone still alerts Sam, and nothing changes for agents.
- Sam's cockpit, the local page in `exocognito/cos` that shows all of Sam's agent sessions, lists the decisions on the linked pagers and opens one on the Mac for Sam to answer. The cockpit never answers.
- Every earlier promise still passes.

## What's known

- The proposal, with its claims checked against the code on 8 Nov: [.agents/plans/2026-11-08-desk-client.md](../../../.agents/plans/2026-11-08-desk-client.md). It compares the Mac's key with the phone key and the agent key, and covers how the Mac fits encryption, how it is linked and what the cockpit calls.
- **Why Sam needs it.** Today the cockpit reads AgentPager decisions only from each machine's history file ([B31](../../areas/2-agents.md)), so it sees one machine at a time and no cloud VM. The cockpit's own tests on 8 Nov found that a session never takes another session's message as Sam's consent. So an answer with Sam's authority comes from the session's own app, or from AgentPager.
- **What encryption leaves to it.** ENCRYPT ([M5](../M5-encrypt.md)) seals each answer only to its agent's key. A second device of Sam's can't show what the other answered unless each answer also carries a copy sealed to the pager's key.
- **Lines it would change**, for Sam to approve when it starts: I19.1 and B30.1 ([6 Privacy](../../areas/6-privacy.md)), where the pager's private key and the owner's end are the phone alone; B7.4 ([5 Answering](../../areas/5-answering.md)); I17.5 and L9 ([1 Pagers](../../areas/1-pagers.md)); and PRODUCT.md › Stack, which only Sam changes.
- No QR code: PRODUCT.md's pinned design decisions rule them out, so linking uses a code Sam types or pastes.

## Still open

Sam decides these first, each with the proposal's recommendation:
1. Its form: ★ the iPhone app itself, running on the Mac; or a native macOS app.
2. Linking: ★ a one-time code typed or pasted, then a short comparison code on both screens; or a QR code for linking only, which narrows the pinned decision.
3. What the cockpit can read: ★ what an alert shows; the whole brief; or nothing, only a link that opens the decision.
4. A copy of each answer for the pager's key: ★ yes, so every device shows the answer; or no, so each device shows only that the other answered.
5. Touch ID on each Send from the Mac: ★ always; or only the phone's two steps.
6. The word for a linked Mac in [TERMS.md](../../TERMS.md): the proposal uses desk.

## Out of scope

- Alerts on the Mac: the phone stays the pager that alerts.
- Turning a pager off or on, changing its auto-off or deleting it from the Mac.
- Moving a pager to a new phone (L9), though linking is half of it.
- Accounts, or an owner across pagers on the service.
