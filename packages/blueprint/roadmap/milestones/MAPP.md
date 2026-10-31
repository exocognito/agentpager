---
id: MAPP
title: AgentPager on my iPhone
status: shipped
deliverables:
  - C5::review-and-answer-cards
  - C6::send-feedback
  - C7::revisit-decisions
  - C17::get-paged
  - I18::independent-cards
  - I4::payloads-refused-whole
  - I5::answers-never-change
  - I6::send-and-acknowledgement
  - D1::cloudflare
  - D6::iphone-app
  - D7::apple-developer-program
---

Shipped. MAPP first ran with the first version's ways in, pager lifetimes and Agents list. v2 replaced them ([DEC-2026-10-30-v2-promises](../../records/decisions/DEC-2026-10-30-v2-promises.md)), so their promises left this list, and MPAGERS and MCOMMAND carry what replaced them. K1::visible-within-five-seconds has no recorded measurement, so it moves to MFRIENDS.

# MAPP · AgentPager on my iPhone

## Objective

I install AgentPager on my iPhone from Xcode. My agents ask me decisions as briefs: the question and its lettered options first, the detail one tap away. With the app open I see each one within seconds. With it closed, my phone alerts me with who asked and the question, and opening the alert opens that decision. I choose an option or ask for changes, press Send, and have a few seconds to undo. The row waits for my agent, then shows that it confirmed, and if I have left the app its confirmation arrives as an alert. I can reopen any answered decision (C7).

## Out of scope

- TestFlight, the App Store, and anyone but the owner.
- Answering from the Lock Screen, and Live Activities.
- Android, and product cards; a brief's option can preview one. Every card is a brief ([DEC-2026-10-27-briefs-are-the-card](../../records/decisions/DEC-2026-10-27-briefs-are-the-card.md)).
- Carrying out approved actions: the owner's agent does that.
