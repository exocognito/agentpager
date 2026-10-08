---
id: I7::account-authorization
serves:
  - SI2
  - SI5
statement: Account access requires verified account identity, and attaching a guest session requires both that identity and the session's current phone key with explicit confirmation.
caveats:
  - The provider, recovery threat model, session revocation and deletion policies must be selected before this draft is executable.
---

Account identity is durable; free-session content remains ephemeral. Authentication alone is never evidence of guest ownership. Every account read or mutation checks account identity and ownership before touching session contents. Ending and expiry keep the shared deletion obligations, seen from every device signed in to the account. Any account-owned exception to that retention rule needs owner-approved design first. Breaking this looks like a second account, a forged callback, or a forged identity or guest claim reaching a session, or a credential showing in a URL, in client storage or in a run record.
