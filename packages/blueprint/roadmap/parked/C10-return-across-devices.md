---
id: C10::return-across-devices
serves:
  - SC1
  - SI2
statement: Authenticate to the same account on another device and return to an explicitly attached active session without exposing an unattached guest session.
caveats:
  - Authentication methods, recovery, device revocation and account deletion remain owner decisions.
---

## Behaviors

Sign in with an owner-approved method. A guest session remains guest until the session's current phone key authorizes an explicit attach-to-account confirmation. Another device authenticated to that same account can then return to the active session. Another account cannot read or attach it. Signing in alone attaches no guest session, and neither signing in nor attaching changes pairedAt or expiresAt. A free account does not create an archive after expiry or end.

The [account design boundary](../../records/workshop/accounts-design-boundary.md) owns the unresolved adapter and lifecycle design. Its preview is appearance for review, not a working sign-in mechanism.
