---
id: J4::helper-reconnect-revocation-and-isolation
status: draft
for:
  - C14::receive-existing-answers-through-the-helper
  - C15::see-connection-and-activity-without-prompting
  - C4::resume-or-end-a-session
  - I2::expired-sessions-refuse-and-forget
  - I5::answers-never-change
  - I9::owner-channel-only-answers-existing-decisions
  - I10::helper-delivery-stays-bound-and-bounded
---

## Statement

During a helper disconnect and restart, independent sessions preserve their answers and honest status, refuse crossed or revoked delivery, and never turn a retry into an arbitrary or duplicate instruction.

## Steps

1. Pair two real sessions through one helper. Disconnect its relay connection, commit an answer on the phone, and observe stale/unreachable connection state without fabricating idle activity or agent acknowledgement.
2. Restore connectivity and restart the helper with its state preserved. Deliver the still-valid answer to its exact session; replay its event and attempt to cross its decision/session identities. No second answer turn or wrong-session submission occurs.
3. Interrupt submission at an adapter boundary where the result is unknown. After restart the UI still distinguishes uncertain from acknowledged; it does not claim success or blindly repeat a possibly accepted queue call.
4. With another pending answer, end or expire that session before reconnection. Reconnect and confirm no new continuation submission, cached content recovery or session resurrection. Input already accepted before termination is reported separately.
5. Attempt an unsolicited message and a status request carrying a prompt, arbitrary session target or execution parameter. Each is refused before the adapter; ordinary status viewing still creates no inference turn.
6. Re-run the independent remaining session's normal answer and acknowledgement flow, confirming that failure or revocation of one session did not end or redirect the other.

## Caveats

1. Real clients establish integration; deterministic crash-boundary cases additionally exercise the adapter protocol. A bounded failure campaign does not prove every process schedule or provider fault.
2. Relay or endpoint compromise is governed by I10's explicit trust caveats; invalid-input tests are not a proof of resistance to a malicious trusted relay.
