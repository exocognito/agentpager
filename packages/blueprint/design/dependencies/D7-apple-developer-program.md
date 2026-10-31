---
id: D7::apple-developer-program
statement: Alerts and distribution to other people stand on the owner's Apple Developer Program membership.
providedBy: owner
provided: the owner's paid Apple developer team; an APNs authentication key with its key id and team id, in the 1Password item the owner names when supplying it; and App Store Connect access for TestFlight and App Review. The owner creates each of these; no role mints one.
caveats:
  - TestFlight and App Review timing is Apple's. Nothing here promises a review outcome.
---

Must supply: Apple's push service (APNs), TestFlight distribution to invited testers, and App Review.

Must never do: let the APNs key reach the app bundle, the worktree, a log or a transcript.

Proof runs on: the owner's iPhone. In MAPP, a build from Xcode with Apple's sandbox push service; from MFRIENDS, also a TestFlight build with the production service.
