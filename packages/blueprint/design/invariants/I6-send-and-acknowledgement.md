---
id: I6::send-and-acknowledgement
serves:
  - SI1
  - SI4
statement: Choosing an option or editing feedback never sends; only Send submits the frozen answer, after an Undo window the owner can cancel, and the phone never says the agent received an answer until the agent itself acknowledges it.
caveats:
  - A network capture shows what the app sent, not what a modified client could send; the service accepts only complete answer input (I4).
  - An acknowledgement proves the agent read the answer, not that it did the work or is still running.
  - The service records when an agent first reads an answer, but only to decide the warning that none has (C5, C17); reading is not acknowledging, and the phone never shows it as received.
---

The Undo window lasts five seconds. Undo cancels the send and reopens the decision with the choice kept. Leaving the app during the Undo window sends at once. If the pager is turned off inside the window, the answer is refused, nothing is stored and the decision stays open; a pager deleted inside it takes the answer with it. A send with no reply is tried four times before the phone says it is not confirmed. A refusal is never retried, and Retry resends the same answer. Reads never reset a draft. Breaking this looks like an option that sends on tap, an answer stored after Undo, the phone marking the answer confirmed straight after Send, or an agent reading the answer turning it confirmed without an acknowledgement.
