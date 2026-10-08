---
id: D4::account-authentication
statement: Account sign-in stands on owner-selected authentication methods and a provider or verifier that supplies verified identity and session lifecycle without leaking credentials.
providedBy: owner
provided: Not selected. Before activation, name the methods, provider, scoped access location, callback origins and recovery/revocation supply; no provider or email-only choice is implied by the preview.
---

Must supply: verified account identity, cold sign-in for each selected method, sign-out, cross-device return, recovery and revocation under the owner-approved policy.

Must never do: equate an email input with verified ownership, hand guest credentials to another account, expose provider credentials to a client or record, or require a subscription for basic account identity.

Proof runs on: the selected real authentication integration, with two independent accounts on two devices, each sign-in method from a cold browser. Every recovery, revocation, sign-out and deletion path is followed by attempted reads and mutations.
