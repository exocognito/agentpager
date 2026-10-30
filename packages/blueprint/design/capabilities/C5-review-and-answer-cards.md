---
id: C5::review-and-answer-cards
serves:
  - SC1
  - SI8
  - SP1
  - SP7
  - SP8
statement: Read a question on a card, choose one of the agent's options and press Send, and the agent receives the exact decision.
caveats:
  - Every new card is a brief (DEC-2026-10-27-briefs-are-the-card). An emoji (generic) card asked before that stays readable and answerable. No product card is drawn; a brief's option can preview one. The parked web screen shows a brief's options by letter, without its sections.
  - The proof shows the agent received the exact answer and acknowledged it, not that it carried out the chosen action.
---

## Behaviors

1. Open an agent's screen to see its open cards, and open one. A brief shows the question, its context and each option by letter and label, with the recommended one marked ✶ (SP7). Its Options screen shows what each option changes, why to choose or pass on it and what it assumes (SP8). Image attachments show as thumbnails and open full screen, where they swipe from one to the next; a Markdown page opens as its own page.
2. Choose one option, which is marked as chosen, or ask for changes instead (C6), then press Send. Send closes the card and offers Undo for five seconds (I6).
3. The card moves to answered, showing the answer while it waits for the agent. When the agent acknowledges, the row marks the answer confirmed. If no agent has read the answer 3 minutes after Send, the wait turns into a warning that names the agent, its computer and its project and says AgentPager can't reach it, so the owner checks on it directly (C17 alerts once). Once an agent reads the answer, the row goes back to waiting.
4. If the service does not confirm that it stored the answer, the phone says so and offers Retry, which sends the same answer.
