---
id: I1::first-phone-keeps-the-session
serves:
  - SI2
statement: The first phone to claim a pairing link holds the session; a claimed link admits no one, every later device is refused, and the first phone is never disconnected.
caveats:
  - A device is a browser context holding a phone key; nothing identifies a person or a handset.
  - Recovery for a lost phone key is not built; nothing here proves a recovery path.
  - Link entropy is the Token schema's 192 random bits; resistance to guessing holds by construction, not by an attack.
---

Deprecated. Succeeded by I16::one-agent-one-phone: the code, not the first claim, decides which phone pairs (SI2).

Claiming reserves the session for that browser but does not pair it. Until pairing, that browser can only answer the pairing card or end the session. A second claim, or a read without the key or with another session's key, is refused, and the first phone carries on. Breaking this looks like a second claim that works, or a refusal that also logs the first phone out.
