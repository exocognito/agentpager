# FRIENDS · AgentPager for people I invite

> **Status:** queued · **Order:** last, after SITE and OPEN (DEC-2026-11-08-friends-after-cleanup): Sam invites owners once they can install AgentPager, read what it is, inspect its code, and know the service can't read their decisions · numbered when it starts

## Objective

Sam, 5 Nov 2026, on starting M4, of what comes after it: "making the product available to others".

As the old MFRIENDS doc had it:

I invite the first owners beyond me. They install the app and the command (INSTALL), can read what AgentPager is and what it stores (SITE), can inspect its code (OPEN), and know the service can't read their decisions (ENCRYPT). Their agents page them while they are away, and they answer from their phone. They have an easy way to tell me what works and what doesn't, and I decide what changes next from what they say. Every earlier promise still passes on the deployed product.

## What's known

- **After a first cleanup.** Sam, 8 Nov 2026, in the M7 root's Claude Code session, choosing B for the root's question D2: "D2 B - I most want the site and repo cleaned up before introducing friends, at least a first round of cleanup and update on both, and we can plan another final round of cleanup and polish before distributing to more people". So FRIENDS keeps its place, after SITE and OPEN:
  - Friends are introduced only after at least a first round of cleanup and update of both the site and the repository. SITE's first pass is that round for the site, and OPEN's for the repository.
  - A final round of cleanup and polish is planned before AgentPager goes to more people than the friends this milestone invites. It stays this note, not a milestone, until Sam commits to it.
- Encryption comes before this rollout ([PRODUCT.md](../../PRODUCT.md)).
- K1 waits here (below): it has never been measured, and its probe isn't built. When the probe is built, its second clause, an answer reaching a waiting agent, becomes its own metric in [2 Agents](../../areas/2-agents.md).
- J5 is walked whole here, by an invited owner, with the TestFlight build and the demo agent from INSTALL.
- The v2 design, as recorded on 29 Oct, set the goal of making it easy for about 10 friends and colleagues to install, use and give feedback, and noted a way for testers' feedback to reach Sam, such as opting in to share their local history file. Its principle for feedback: feedback rides on calls the agent already makes and taps the owner already does, adds no step for either, and puts nothing into the agent's context that it didn't ask for.
- The same record parked one question as one that must be handled: rules belong to each owner, and if per-owner rules are ever needed, they come in layers (shipped defaults, then the owner's own, then per-pager); not in v2, where Sam edits the binary. Until then the card contract and review list ship in the command (B27), and a correction that recurs becomes a check in the next binary, never a note (B6).

## Still open

Sam decides these first:
1. Who to invite first, and how many.
2. How owners send feedback, for example from the app, or by choosing to share the command's history file (B31).

## Out of scope

- Features nobody has asked for yet, such as Android, answering from the Lock Screen, Live Activities or a paid tier.
- A public App Store release before I decide on one.

## Adds · Changes · Retires

- **Adds:** K1, whole; J5's walk by an invited owner on the deployed product.

## From the old Blueprint (not built yet)

The lines the old Blueprint held for this milestone, as the [M4 ledger](https://github.com/exocognito/agentpager/blob/m4-house-ledger/blueprint/milestones/M4-house/ledger.md) moved them. Each reaches its area file with the code that makes it true.

**K1 · Visible within five seconds** (4 Getting paged)
1. With the app open, a new decision shows on the phone within 5 seconds of the agent's ask reply.
2. A sent answer reaches a waiting agent within 1 second of the Undo window closing.
3. A probe measures both over 5 exchanges in a row on the deployed product: the real app in the Simulator, open and refreshing, and a real agent holding a wait for the answer. Every interval meets its bar, and any error fails. A local run comes first, but only the deployed result decides, and a timed stand-in for the service never passes.
- Each run records the commit, the target address, the network, all ten intervals, how often the phone refreshes and how long the agent's wait holds. A result goes stale after 7 days.
- It measures how fast AgentPager relays, not finished work, stops prevented or tokens unblocked; those stay unmeasured.
- A result holds only for its recorded target, network and load. Five exchanges are a smoke measurement, not a service level.
- An agent that isn't waiting sees the answer when it next reads. Alerts to a closed app are B17's and aren't timed here.

## Log

- 30 Oct · MSHIP, written on 8 Oct as MAPP's successor, became MFRIENDS.
- 31 Oct · narrowed in the next roadmap: Sam invites the first owners and hears back. INSTALL and SITE took its other parts.
- 5 Nov · Sam kept it last.
- 8 Nov · Sam kept it after SITE and OPEN, with a final round of cleanup and polish to plan before AgentPager goes to more people (What's known, DEC-2026-11-08-friends-after-cleanup).
