---
id: I6::send-and-acknowledgement
serves:
  - SI1
  - SI4
statement: Choosing an option or editing feedback never sends; only Send submits the frozen answer, after an Undo window the owner can cancel, and the phone never says the agent received an answer until the agent itself acknowledges it.
caveats:
  - A network capture shows what the app sent, not what a modified client could send; the service accepts only complete answer input (I4).
  - An acknowledgement proves the agent read the answer, not that it did the work or is still running.
---

The Undo window lasts five seconds. Undo cancels the send and reopens the card with the choice kept. Leaving the app during the Undo window sends at once. A pager that ends inside the window stores nothing. A send with no reply retries a few times before the phone says it failed. A refusal never retries, and Retry resends the same answer. Reads never reset a draft. Breaking this looks like an option that sends on tap, an answer stored after Undo, or the phone marking the answer confirmed straight after Send.
