---
id: C7::revisit-decisions
serves:
  - SC1
  - SI3
  - SI4
statement: Reopen any sent card to read its exact payload, your answer and the agent's acknowledgement, with nothing to edit.
caveats:
  - History is read on the phone that holds the pager; nothing proves it on another device.
---

## Behaviors

1. An agent's screen shows open cards apart from answered ones. Each answered row shows the answer and whether the agent has acknowledged it yet.
2. Reopening an answered card shows the question, the owner's answer and the agent's acknowledgement as a conversation, with the options below. There is nothing to choose or send.
3. History lasts as long as the pager (SI5). Dogfooding, subject to change: the phone keeps a read-only copy for 24 hours after the end (C22).
