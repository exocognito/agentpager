---
id: C6::send-feedback
serves:
  - SC1
  - SI3
  - SI8
  - SP1
statement: Ask for changes in your own words as the final answer to a decision; the agent receives the exact text, and the decision never changes.
caveats:
  - The proof shows the agent received the exact text, not that it acted on it or asked again.
---

## Behaviors

1. On any open decision, the owner can choose Ask for changes, write what the agent should change, up to 1,000 characters with no HTML, and send it. It has the same Undo window as an option (C5), and it is the decision's final answer.
2. The agent reads the note word for word when it waits for the answer, and is told to follow it, to ask a new card if it still needs a decision, and to acknowledge this one with what it will do.
3. The answered decision never changes. The note is that decision's answer only: it is not kept as guidance for other agents.
