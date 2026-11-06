# SITE · A front page for AgentPager as it is now

> **Status:** queued · **Order:** after INSTALL, so the page can give the install line, and after CLIENTS, so it can say plainly which agent apps work; OPEN follows · numbered when it starts

## Objective

Sam, 31 Oct 2026, on the next roadmap: a redesigned marketing page that is "simple, clear, up to date and looks good". And on 5 Nov, of the CLIENTS list: "it will enable us to be opinionated in the marketing page redesign".

In Sam's voice, as the old MSITE doc had it:

Someone who lands on agentpager.me understands in a few seconds what AgentPager does for them, sees it on the phone, and knows how to get the app and the command. The page is simple, true to the product as it is now, and looks good on a phone and a laptop. It says what the service stores and for how long. Nothing on it describes the first version.

## What's known

- Today's front page still describes the first version, with QR codes, emoji pairing and a planned Pro plan: see it at [390 px](../../generated/screens/web/front-page-390-1.png) and [1280 px](../../generated/screens/web/front-page-1280-1.png). Its code is in `packages/app/src/site/`, with a QR picture left over from v1.
- What agents read at /start is already v2 (B18).
- The note on what the service stores changes with ENCRYPT, which also lists what encryption doesn't hide.

## Still open

Sam works through the page in several rounds of visual drafts before anything is built, each round as real pages to look at: who it's for and what it must say, then its structure, then how it looks. B18's front-page clauses are rewritten from what the drafts settle.

## Out of scope

- Pricing or plans: AgentPager has no paid tier.
- A public demo: the demo agent is for App Review and invited owners (B19).

## Adds · Changes · Retires

- **Adds:** B18's front page and its note on what the service stores, as the drafts settle them.
- **Changes:** B18's title widens back to the whole site.
- **Retires:** L21 "The front page still describes the first version" (7 Getting started), quoted here when it goes.

## From the old Blueprint (not built yet)

The lines the old Blueprint held for this milestone, as the [M4 ledger](../M4-house/ledger.md) moved them. Each reaches its area file with the code that makes it true.

**B18, widened** (7 Getting started)
1. The front page says what AgentPager does and how to get the app, and gives the one line that installs the command (B29, once INSTALL builds it).
2. A note on the site lists what the service stores and for how long. For each pager: its public key, its phone key as a digest, whether it is on and when it turns off, and where its phone gets alerts, until the pager is deleted. For each agent: who asked, its project and computer, its key as a digest, and its decisions with their attachments, answers and acknowledgements, until its pager is deleted or it has had no activity for 30 days. The note also says that there is no account, that a pager's name stays on the phone, and that alert text passes through Apple (L17, until ENCRYPT).
- The page's words are design. Nothing measures whether visitors understand them.

## Log

- 31 Oct · queued in the next roadmap, taking B18's front page from FRIENDS.
- 5 Nov · Sam put it after INSTALL. It needs several rounds of visual drafts with Sam before building.
