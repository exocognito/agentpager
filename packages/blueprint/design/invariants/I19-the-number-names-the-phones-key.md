---
id: I19::the-number-names-the-phones-key
serves:
  - SI2
  - SI10
statement: A pager number names its pager's public key. The service makes no pager whose number does not match the key it is given, and connects no agent with a number that does not match its pager's key.
caveats:
  - The fingerprint is 8 bytes. That it is enough holds by construction, not by an attack.
  - Until the agentpager command checks the key itself (below), this catches a mistyped or altered number, not a service that swaps the key.
---

The phone makes the number from the pager's 16-byte id and the first 8 bytes of the SHA-256 of its public key: `ap1_` and 32 more characters (C26). When the phone makes the pager, the service works out the fingerprint from the public key and refuses a number that does not match. At every connect, it compares the number's fingerprint with the pager's and refuses a mismatch as a number not in use. A number for another pager, or with any character changed, connects nothing.

*Not built yet: comes with the encryption work.* Before it encrypts anything to a pager, the agentpager command fetches the pager's public key, works out the fingerprint and refuses on a mismatch, so a service that swaps the key is caught on the agent's machine.

**Breaking this looks like:**
1. a pager made with a key its number does not name;
2. an agent connected with a number whose fingerprint does not match its pager's key.
