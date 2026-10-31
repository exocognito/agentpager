---
id: C30::decisions-are-encrypted-end-to-end
serves:
  - SI10
statement: Your decisions, their attachments, your answers and your agents' acknowledgements are encrypted between the agent's machine and your phone, so the service can't read them.
caveats:
  - The service still sees which pager and which agent, when, and how big each part is.
  - Nothing here protects a phone or an agent's machine that someone else controls.
---

*Not built yet: comes with the encryption work.* Today the phone makes each pager's key pair and the number names its public key (behaviours 1 and 2). The rest is to come.

## Behaviors

1. The phone makes a key pair for each pager and keeps the private key in its Keychain. The service gets only the public key.
2. The pager's number carries the first 8 bytes of the SHA-256 of that public key, and the service refuses a pager whose number does not match its key (I19).
3. *Not built yet.* The command checks the pager's public key against the number before it encrypts anything to it.
4. *Not built yet.* The command encrypts each decision and its attachments, and who asked, the project and the computer, to the pager's key, and gives the service the agent's own public key at connect. The phone encrypts its answer to the agent's key, and the agent encrypts its acknowledgement to the pager's key.
5. *Not built yet.* The service stores and passes on only ciphertext, with what it needs to route it: which pager, which agent, when, and sizes.
6. *Not built yet.* Alerts carry ciphertext, and an extension on the phone decrypts them to show the real question (C17).
