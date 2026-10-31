---
id: I20::the-service-holds-nothing-readable
serves:
  - SI10
statement: The service never holds a readable decision, attachment, answer or acknowledgement, only ciphertext and what it needs to route it, and no alert carries one as text.
caveats:
  - Not built yet as a whole. Today the service stores and reads every decision in full, and alerts carry the question as text.
---

*Not built yet: comes with the encryption work (C30).*

Decisions, their attachments, who asked, the project and the computer, and acknowledgements are encrypted to the pager's key on the agent's machine; answers are encrypted to the agent's key on the phone. The service keeps only the ids of pagers, agents, decisions and answers, the public keys and the number's fingerprint, the digests of the keys, timestamps, sizes, whether each pager is on and when it turns off, and the phone's device token. Alerts carry ciphertext, and the phone decrypts them.

**Breaking this looks like:**
1. a decision, answer or acknowledgement readable in the service's storage or logs;
2. an alert that carries the question, the answer or the agent's words as text.
