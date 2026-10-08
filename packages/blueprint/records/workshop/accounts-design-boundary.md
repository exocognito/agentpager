# Accounts design boundary

Accounts add durable identity and explicit ownership, not a saved archive or paid entitlement. The [preview](../../roadmap/parked/design/AccountsScreen.tsx) offers no working method and selects no authentication.

Required behavior, including attaching, cross-device return and the free-session clock, is on [C14::return-across-devices](../../design/capabilities/C14-return-across-devices.md) and [I14::account-authorization](../../design/invariants/I14-account-authorization.md). D3::account-authentication remains unsupplied. Choose sign-in methods and their verifier, recovery/device-revocation policy, and account deletion/consent before defining the executable auth schemas, machine, effects and callbacks. Prefer an existing tested identity system once selected; this draft does not invent one.
