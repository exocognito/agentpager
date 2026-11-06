# 5 Answering

> **Definition:** Reading and answering a decision on the phone: the brief and its sheets, picking an option or asking for changes, Send and Undo, what the phone says while the answer waits for the agent, and the closed record that never changes. How the agent waits for the answer and acknowledges it is in 2 Agents (B32), and the alerts are in 4 Getting paged (B17).
> **Serves:** "When it needs me, my agent sends a decision: the question first, two to four options, its recommendation, and the detail one tap away." · "I answer, see that my answer was sent, then get the agent's acknowledgement and next steps." · "I can look back at an agent's decisions until its pager is deleted, or until it has been idle 30 days." · "So an answer always takes two taps: I choose an option or write a response, then press Send, and I have a few seconds to undo." · "Choosing alone never sends. The agent receives exactly what I sent." · "I can reread the question, my answer and the agent's acknowledgement, but not change them." · "An acknowledgement is a real message from the agent, never an automatic message from AgentPager." · "Several cards can be open at once and answered in any order." · "Asking for changes is always there when no option fits; it is the fallback, never an option." · "A decision opens on what I need to decide: the question, its context, each option's short label and the agent's recommendation." · "Notes are answers to one decision, never standing guidance for other agents."
> **Relies on:** the owner's iPhone and iOS, which draw the screens, the sheets and the keyboard · the AgentPager service on Cloudflare, which stores each answer and acknowledgement (6 Privacy)
> **Code:** `packages/ios/AgentPager/Views/DecisionView.swift`, `BriefView.swift`, `PagerView.swift`; `packages/ios/AgentPager/Model/AppModel.swift`, `InboxCache.swift`; `packages/app/src/agent.ts`; `packages/contract/`
> **Screens:** [decision](../generated/screens/phone/decision.png) · [selected](../generated/screens/phone/selected.png) · [options](../generated/screens/phone/options.png) · [page](../generated/screens/phone/page.png) · [changes](../generated/screens/phone/changes.png) · [off](../generated/screens/phone/off.png) · [undo](../generated/screens/phone/undo.png) · [notconfirmed](../generated/screens/phone/notconfirmed.png) · [notpickedup](../generated/screens/phone/notpickedup.png) · [answered](../generated/screens/phone/answered.png) · journeys [briefs](../generated/screens/journeys/briefs/README.md) and [undo-and-changes](../generated/screens/journeys/undo-and-changes/README.md)
> **Walked by:** J3, J4, J5

## Behaviors

### B5 · @M1 · Read and answer a decision

1. @M2: A decision opens full screen from its pager (B23) or its alert (B17). It names the pager it is on and who asked, and marks who asked as finished once that agent finishes. It leads with the question, prefixed "Decision:", and when it was asked.
2. @M2: The brief's sections follow: context, options, recommendation, next steps and small print. Each folds under its heading, and next steps and small print start folded.
3. @M2: The options section holds the tradeoffs table, with each rated cell tinted from best to worst, then a way to read each option in full. The recommended option is marked ✶.
4. @M2: Opened in full, the options show one at a time, and the owner moves between them by letter or by swiping. Each shows its title, what it prioritizes, what it changes, why to choose it or pass on it, what it assumes and what it looks like.
5. @M2: Seeing an option never chooses it.
<!-- B5.6 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
7. @M2: A page the brief links to, such as the context's background page, opens in a sheet over the decision, and a page linked from that page opens in the same sheet. Only an https link leaves the app.
<!-- B5.8 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
9. Below the brief, each option shows its letter and short label. Tapping one picks it and outlines its column in the tradeoffs table; tapping it again unpicks it.
10. With an option picked, the owner can send it, and Send names the option's letter (I6). With none picked, the owner can ask for changes instead (B6).
11. Send returns to the pager, which counts down the Undo window with a way to undo (I6).
12. The decision moves to its project's answered decisions (B7). Until the agent acknowledges, its row and the decision itself say the answer is sending, then that it is waiting for the agent, naming who asked.
13. @M3: If no agent has picked up the answer 3 minutes after Send while the pager is on, the row and the decision instead name who asked, its computer and its project, and say the agent may be asleep, closed or disconnected. The owner is also alerted once (B17). Once an agent picks the answer up, they go back to waiting.
14. If the service hasn't confirmed that it stored the answer after several tries, the phone says the answer is not confirmed. The owner can retry, which sends the same answer, or cancel, which keeps the choice as a draft. A refusal is never retried: the phone shows what the service holds.
15. @M2: While the pager is off, the options can't be picked. In place of sending, the phone says that pager is off, by name, and offers to turn it on (B22).
16. @M3: An answer the service hadn't confirmed when the app closed is sent again the next time the app opens.

- The phone draws the brief that the agentpager command compiled from the agent's `card.yaml` (B27). It never reads `card.yaml` itself.
- An agent picks an answer up when its wait collects it (B32).
- AgentPager carries the answer, and the agent carries out the option chosen. The proof shows that the agent received the exact answer and acknowledged it, not that it did what was chosen.

### B6 · @M1 · Ask for changes in your own words

1. On any open decision whose pager is on, the owner can ask for changes instead of choosing an option, writing what the agent should change.
2. A note has no HTML and keeps within the length a note allows (I4).
<!-- B6.3 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
4. @M3: The note answers that one decision. It is never kept as guidance for other agents.

- The agent reads the note word for word when it waits, and is told what to do with it (B32).
- The proof shows that the agent received the exact text, not that it acted on it or asked again.

### B7 · @M1 · Reopen an answered decision

2. @M2: Each answered decision in its project's list (B23.5) shows the chosen option's letter or a note's mark, the question, who asked and the answer. It shows a green tick once the agent has acknowledged. Until then it says where the answer is (B5).
3. @M2: Reopening an answered decision shows the brief as it was asked, with when it was asked and answered, and the chosen option's whole column outlined in the tradeoffs table.

- The proof reads answered decisions only on the phone that made the pager. Nothing proves it on another device.

## Invariants

### I5 · @M1 · Answers never change

Why: "I can reread the question, my answer and the agent's acknowledgement, but not change them."

1. A stored decision and its answer never change, a note included, whatever is retried.
2. The phone's resend of an answer after a lost reply, as the same request, gets back the stored receipt. Any other send to an answered decision, even of the same option, is refused.
3. An acknowledgement can't be replaced.
4. An answered decision offers no control that could change it.

- One change was made on purpose: each decision stored before 31 Oct 2026 is rewritten once, to drop two fields that decisions no longer carry. Nothing else in it changes.
- Nothing is proved about tampering with storage below the service.

### I6 · @M1 · Only Send sends, and only the agent acknowledges

Why: "Following good UX practice, an action that cannot be undone needs a confirming step." · "An acknowledgement is a real message from the agent, never an automatic message from AgentPager."

1. Choosing an option or writing a note never sends. Only Send sends, and the agent receives exactly the answer as it stood when Send was pressed.
2. The Undo window lasts five seconds. Undo cancels the send and reopens the decision with the choice kept.
3. Leaving the app during the Undo window sends the answer at once.
4. @M2: If the pager is turned off inside the Undo window, the answer is refused, nothing is stored and the decision stays open. A pager deleted inside the window takes the answer with it.
5. The phone's refreshes never reset a draft.
6. The phone never says the agent received an answer until the agent itself acknowledges it.
7. An agent reading an answer is not acknowledging it. The service notes the first read only to decide whether the answer was picked up (B5, B17), and the phone never shows that read as received.

- An acknowledgement shows that the agent read the answer and said what it will do, not that it did the work or is still running.
- A network capture shows what the app sent, not what a changed app could send. The service takes only a complete answer (I4).

### I18 · @M1 · Decisions are independent

Why: "Several cards can be open at once and answered in any order. Answering one never changes another."

1. Each decision has its own identity, and decisions can be asked, answered and acknowledged in any order.
2. Answering or acknowledging one decision never changes another, whether they come from one agent or from several on the same pager.

- No proof tries every order. The phone's journey test answers one of an agent's two open decisions and leaves the other open, and nothing sends two answers at the same moment.

## Limits

### L18 · @M1 · A brief's images and pages need the service

- What people meet: while the service can't be reached, an image or page in a brief that the phone hasn't opened since the app started can't be shown. The brief's text still shows (B7).
- Why it waits: no owner has needed it yet. The phone saves its last read of each pager, but holds a brief's images and pages only in memory, once opened.
- What would fix it: the phone saving each decision's images and pages with its last read, and removing them with the pager.
- When to revisit: when an owner, Sam included, needs a brief's image or page without a connection.
