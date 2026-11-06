# M1 · AgentPager on my iPhone

> **Status:** shipped · **Started:** 8 Oct 2026 · **Shipped:** marked shipped on 30 Oct 2026, with M2 and M3; its code reached main on 27 Oct (PR #17) · **Tag:** none; prod runs 1ee6c27 · **Word:** APP

## Objective

In Sam's voice, as the old MAPP doc had it after v2:

I install AgentPager on my iPhone from Xcode. My agents ask me decisions as briefs: the question and its lettered options first, the detail one tap away. With the app open I see each one within seconds. With it closed, my phone alerts me with who asked and the question, and opening the alert opens that decision. I choose an option or ask for changes, press Send, and have a few seconds to undo. The row waits for my agent, then shows that it confirmed, and if I have left the app its confirmation arrives as an alert. I can reopen any answered decision (B7).

## Slice

| Layer | What M1 delivered there |
| --- | --- |
| Phone | the SwiftUI app on Sam's iPhone, built from Xcode: answering a brief (B5, B6), reopening it (B7), and alerts with the app closed (B17) |
| Server | the service on Cloudflare at agentpager.me, holding I4, I5, I6 and I18, sending alerts through Apple's push service, and refusing emoji cards once briefs arrived |
| Agents | the first version's ways in: HTTPS and a hosted MCP server, links, emoji pairing and pager lifetimes. M2 and M3 replaced them |
| Tests | the service's acceptance tests, the brief's unit tests, and the app's UI tests in the Simulator |

## Out of scope

- TestFlight, the App Store, and anyone but the owner.
- Answering from the Lock Screen, and Live Activities.
- Android, and product cards; a brief's option can preview one. Every card is a brief.
- Carrying out approved actions: the owner's agent does that.

## Sam's answers

- **8 Oct, to the review of the native iPhone design,** as recorded that day. These still hold: "Cut answering from the Lock Screen. An alert only opens the app." · "Cut the Live Activity. The app icon badge shows the waiting count." · "Use SwiftUI." M1 ran as answer 11 said, "Dogfood first: install on Sam's iPhone over USB with free signing, and set up Apple credentials in parallel without blocking product work", until Sam's paid Apple team signed it on 9 Oct. Answer 4, "Plan a demo agent for App Review", waits in [INSTALL](next/INSTALL.md). v2 replaced the others, on lifetimes, links, ended pagers, option labels and the hosted MCP server.
- **8 Oct, on pager numbers, in Claude Code:** "I think agent numbers are a new product feature, I was way too limited in how I thought about connections needing to be made to get a lot of usage when we designed just the QR code" and "So can we not be treating page numbers as some exception but just part of the core product and will likely evolve over the next few dogfooding sessions". M2 and M3 made numbers the only way in.
- **9 Oct, on alerts, in Claude Code:** "Whats the reason we don't include push notifications in the dogfooded version btw? I feel like that's a kinda important feature but it's pushed to the next milestone - what would be required to pull it into the current dogfooding version". The same day Sam chose to start building, and to test whether a deployed Worker reaches Apple's push service. So B17 came with M1.
- **27 Oct, on briefs, in Claude Code:** "I'm ok with the fact that we need to forgo the one emoji per choice idea, we're now more advanced than that". On AgentPager the same day: "Which milestone ships briefs?": A, add briefs to MAPP; and "What happens to emoji cards once briefs are the main format?": C, refuse emoji cards from now on.

## Adds · Changes · Retires

- **Adds:** B5, B6, B7 and B17; I4, I5, I6, I18 and I23; and the limits marked `@M1`. Some began in earlier milestones that never shipped (MSTART and MCARDS); M1 is the first that shipped them. I23 got its id in M4, for rules M1 built.
- **Changes:** none. Nothing had shipped before.
- **Retires:** I3, independent decisions, which I18 replaced; and emoji cards, which the service has refused since PR #14. M1's ways in, pager lifetimes and Agents list ran here and retired in M2 and M3.

## Log

- 8 Oct · planning: the native iPhone app became the product, and this doc was written. Dogfood builds ran on Sam's iPhone from the `spike/ios-dogfood` branch.
- 9 Oct · PR #8: alerts with the app closed, on the dogfood branch. A deployed service reaches Apple's push service; one run locally on the Mac doesn't.
- 27 Oct · PRs #11, #12 and #14: briefs on the phone, and emoji cards refused. PR #17 brought the service, the app and briefs to main: `pnpm check` green, 94 Blueprint tests, 266 Storybook tests and 17 of 17 server tests.
- 29–30 Oct · M2 and M3 reworked it for v2.
