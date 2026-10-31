---
id: DEC-2026-10-31-next-roadmap
date: 2026-10-31
decidedBy: Sam
basis:
  - 'Sam in Claude Code, 2026-10-31, on the next roadmap. Its goals: E2EE; easy installs of the command and TestFlight; a redesigned marketing page that is "simple, clear, up to date and looks good"; cleaned-up code and Blueprint published on GitHub with a clean history, "so people can inspect code, fork and self-host"; then initial external users and their feedback'
  - 'The same message, on what to leave out: "No Android, Lock Screen, Live Activities, Pro version, etc. I don''t need them yet, so there''s no signal to prioritize them". And on order: the first three "can be done in parallel"'
---

# The next roadmap gets AgentPager ready for its first owners

Sam set five goals for what comes next and asked for everything else to come off the roadmap until owners show they need it, himself included.

## The milestones

- MENCRYPT, unchanged in scope: decisions the service can't read.
- MINSTALL, new: TestFlight, the one-line install and release builds of the command, and the demo agent for App Review. It takes these from MFRIENDS.
- MSITE, new: a front page for the product as it is now, workshopped with Sam before anything is built. It takes C18 from MFRIENDS.
- MOPEN, new: cleaned-up code and Blueprint, published with a clean history, with a guide to running your own.
- MFRIENDS, narrowed: Sam invites the first owners and hears back from them.

The first three run in parallel. MOPEN's cleanup waits for MENCRYPT because both change the same code, and MFRIENDS comes last. MINSTALL, MSITE, MOPEN and MFRIENDS are drafts: each lists what Sam decides before it runs. MENCRYPT keeps the product as it is and adds encryption, so it needs only two answers from him, both about the switch-over.

## Strategy

SP2 drops Android and the deferred Alchemy, and says the code is open for anyone to read, fork and run (not built yet). The roadmap's other deferred candidates (owners' own writing rules, recovering lost keys, a deployed auto-off wait, outcome metrics) are dropped with them.
