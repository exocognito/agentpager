---
id: MCARDS
title: Guest decision cards on agentpager.me
deliverables:
  - C1::pair-a-phone-by-qr
  - C2::agent-starts-from-one-url
  - C3::start-from-the-front-page
  - C4::resume-or-end-a-session
  - C5::review-and-answer-cards
  - C6::send-feedback
  - C7::revisit-decisions
  - C8::home-lists-this-browsers-sessions
  - C9::connect-an-agent-from-the-phone
  - I1::first-phone-keeps-the-session
  - I2::expired-sessions-refuse-and-forget
  - I3::independent-decisions
  - I4::payloads-refused-whole
  - I5::answers-never-change
  - I6::send-and-acknowledgement
  - K1::visible-within-five-seconds
  - D1::cloudflare
  - D2::agent-clients
  - D3::owner-browser
  - J1::happy-session
  - J2::longest-session
---

Parked: the web app is parked (ROADMAP). Several of its deliverables are deprecated, and each names its successor. MAPP carries the product forward on the iPhone.

# MCARDS · Guest decision cards on agentpager.me

## Objective

My agent shows a QR code and a link and tells me which emoji to choose. I open it on my phone and the pairing card is already open; I choose that emoji and press Send. From then on my agent can queue decision cards, and I answer them in any order on phone or desktop. Every card is a plain question: its title and detail say what my agent needs, and its options say what my agent will do. Every card offers my agent’s emoji options and Feedback, each answered with a choice and then Send, with five seconds to undo. The card then shows my answer until my agent confirms it. My agent receives exactly my answer and confirms its next steps; the service never carries out the action. When I come back to agentpager.me, my phone lists my sessions by the name each agent gave, and + gives me a line to copy to an agent, which joins my phone directly and still confirms itself with the emoji. When an agent shows me a link instead, I scan it or type it into my phone's browser.

When a proposal needs work I send feedback, which closes it, and my agent asks again with a new card. I can reread every card, my answer and the acknowledgement while the session lasts. The first phone in is the only phone in, and the session ends when I end it or 24 hours after pairing. When my agent finishes, I can still read the whole session until then. Agents start from `/start` alone over HTTPS or MCP. There is nothing to install and no account.

## Out of scope

- Accounts, cross-device identity, saved archives, Pro entitlements and subscriptions.
- Carrying out approved actions: the owner's agent does that.
- A merged inbox across agents, a session list across browsers or devices, notifications, native apps or community cards. The home screen lists one browser's sessions, each its own queue.
- Product cards: a Gmail draft, pull request, calendar invitation or X reply drawn the way that product draws it. Every MCARDS card is `generic`; product kinds come later, one at a time ([DEC-2026-10-02-generic-cards-first](../../records/decisions/DEC-2026-10-02-generic-cards-first.md)).
- Claims about product-market fit, revenue or growth.
- Alchemy: SP2 defers it; deploy with wrangler.
