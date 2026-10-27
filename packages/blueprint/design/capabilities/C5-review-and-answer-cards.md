---
id: C5::review-and-answer-cards
serves:
  - SC1
  - SI8
  - SP1
statement: Read a question on a card, choose one of the agent's options and press Send, and the agent receives the exact decision.
caveats:
  - The generic card kind and, on the iPhone dogfood app only, the brief kind are built; no product card is drawn. The parked web screen shows a brief's options by letter, without its sections.
  - The proof shows the agent received the exact answer and acknowledged it, not that it carried out the chosen action.
---

## Behaviors

1. Open an agent's screen to see its open cards, and open one. It shows the question, its detail and every option with its emoji, title and detail. The option the agent recommends is tagged.
2. Choose one option, which is marked as chosen, or ask for changes instead (C6), then press Send. Send closes the card and offers Undo for five seconds (I6).
3. The card moves to answered, showing the answer while it waits for the agent. When the agent acknowledges, the row marks the answer confirmed.
4. If the service does not confirm that it stored the answer, the phone says so and offers Retry, which sends the same answer.
