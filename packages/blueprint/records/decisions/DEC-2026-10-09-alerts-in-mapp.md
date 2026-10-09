---
id: DEC-2026-10-09-alerts-in-mapp
date: 2026-10-09
decidedBy: Sam
basis:
  - Sam in Claude Code, 2026-10-09: "Whats the reason we don't include push notifications in the dogfooded version btw? I feel like that's a kinda important feature but it's pushed to the next milestone - what would be required to pull it into the current dogfooding version"
  - Sam's answers the same day: start building now, and test whether a deployed Worker reaches Apple's push service
  - exocognito/agentpager PR #8
---

# Alerts come with MAPP

C17::get-paged moves from MSHIP to MAPP, with D7::apple-developer-program for its push key. A pager that only works while its app is open does not test what AgentPager is for.

Alerts were left out of MAPP because DEC-2026-10-08-native-ios answer 11 dogfooded with free signing, which has no push. On 2026-10-09 three facts removed that reason:

- The team that signs the app, X3M532E87A, is on the paid Apple Developer Program: Xcode records it as not a free team, and its signing profile lasts a year.
- Sam made an APNs key and put it in the vault item `AgentPager APN.p8 key`. It signs a request that Apple accepts on both the sandbox and the production service.
- A Worker deployed to Cloudflare reaches Apple's push service over HTTP/2. Local workerd does not, so a server run on the Mac sends no alerts and only the deployed service does.

TestFlight, Universal Links, the demo agent and J5::paged-while-away stay with MSHIP.

