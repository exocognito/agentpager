---
id: J2::longest-session
for:
  - C1::pair-a-phone-by-qr
  - C2::agent-starts-from-one-url
  - C4::resume-or-end-a-session
  - C5::review-and-answer-cards
  - C6::send-feedback
  - C8::home-lists-this-browsers-sessions
  - I1::first-phone-keeps-the-session
  - I2::expired-sessions-refuse-and-forget
  - I3::independent-decisions
  - I6::send-and-acknowledgement
statement: One browser lives through a session from pairing to expiry, a restart and a second session that the agent finishes, keeping its state throughout.
caveats:
  - Runs locally with local lifetimes; the deployed lifetimes are D1's to show.
---

Deprecated. Succeeded by J4::longest-pager.

## Steps

On the local product, in real time, in one browser context. Preserve state except the explicit new session:

1. Create; attempt rejected access; pair wrongly, then correctly; acknowledge.
2. Ask three cards; answer third then second with feedback; acknowledge second then third.
3. Close and reopen through home; open the session; stop the service, record its exit, restart unchanged storage.
4. Cross expiry; claim a new session in the same browser; answer and acknowledge, then the agent finishes it. Open home in a second tab, reread the finished session there, and cross its expiry.
