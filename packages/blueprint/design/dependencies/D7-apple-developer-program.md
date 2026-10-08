---
id: D7::apple-developer-program
statement: Alerts, Universal Links and distribution to other people stand on the owner's Apple Developer Program membership.
providedBy: owner
provided: the owner's paid Apple developer team; an APNs authentication key with its key id and team id, held in the vault for the Worker; App Store Connect access for TestFlight and App Review. The owner creates each of these; no role mints one.
caveats:
  - TestFlight and App Review timing is Apple's. Nothing here promises a review outcome.
---

Must supply: push from the Worker through APNs; associated domains so agentpager.me links open the app; TestFlight builds for invited testers; and App Store submission.

Must never do: let the APNs key reach the app bundle, the worktree, a log or a transcript.

Proof runs on: a TestFlight build on the owner's iPhone, with production APNs.
