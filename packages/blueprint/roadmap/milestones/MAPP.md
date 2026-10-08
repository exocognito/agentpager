---
id: MAPP
title: AgentPager on my iPhone
deliverables:
  - C2::agent-starts-from-one-url
  - C5::review-and-answer-cards
  - C6::send-feedback
  - C7::revisit-decisions
  - C20::connect-with-an-agentpager-link
  - C21::pair-by-entering-the-agents-code
  - C22::change-or-end-a-pager
  - C23::agents-list
  - I3::independent-decisions
  - I4::payloads-refused-whole
  - I5::answers-never-change
  - I6::send-and-acknowledgement
  - I16::one-agent-one-phone
  - I17::ended-pagers-refuse-and-forget
  - K1::visible-within-five-seconds
  - D1::cloudflare
  - D2::agent-clients
  - D6::iphone-app
  - J3::happy-pager
  - J4::longest-pager
---

# MAPP · AgentPager on my iPhone

## Objective

I install AgentPager on my iPhone from Xcode. To connect, either:
- my agent shows me an AgentPager link, a QR code and three emoji, and opening the link opens the app to pairing; or
- I tap + and give my agent the link my phone makes, and it shows me the three emoji.

I tap the three emoji in order and press Pair. From then on my agent asks me decisions. With the app open I see each one within seconds. I choose an option or ask for changes, press Send, and have a few seconds to undo. The row waits for my agent, then shows that it confirmed. I can reopen any answered decision while the pager lasts.

A pager lasts 24 hours from pairing unless I chose 7 or 30 days. I can change that or end the pager from the agent's menu. However it ends, its decisions are gone and its row says why. My agent learns all of this from agentpager.me/start or the link alone, over HTTPS or MCP, with nothing to install and no account.

## Out of scope

- Alerts: a closed app learns nothing until it is opened. C17 comes with MSHIP.
- Universal Links: an agent's link opens its web page first, whose button opens the app.
- TestFlight, the App Store, and anyone but the owner.
- Answering from the Lock Screen, and Live Activities.
- Android, the web app, accounts, Pro, and product cards. Every card is `generic` ([DEC-2026-10-02-generic-cards-first](../../records/decisions/DEC-2026-10-02-generic-cards-first.md)).
- Carrying out approved actions: the owner's agent does that.
