# INSTALL · AgentPager installs in a minute

> **Status:** queued · **Order:** after CLIENTS, whose list says which agent apps setup covers; SITE follows · numbered when it starts

## Objective

In Sam's voice, as the old MINSTALL doc had it:

Someone I invite opens a TestFlight link and installs AgentPager on their iPhone, and its alerts come through Apple's production push service. One line installs the agentpager command as a single file on the machine their agents run on, and `agentpager setup` adds it to their agent apps. App Review can try the whole exchange from the review notes, with the demo agent. Every earlier promise still passes.

## What's known

- Today the app is the development build, installed from Xcode, with Apple's sandbox push service. The command is built from the repository, for the kind of machine that builds it, and has no way to update itself. [7 Getting started](../../areas/7-getting-started.md) has the limits people meet.
- A TestFlight build needs a release app id, the production push entitlement and an App Store Connect record, all on Sam's paid Apple team; Sam signs. The service already sends each device token to the push service it belongs to. M4 left separate app ids for the dev and prod builds to INSTALL.
- The demo agent (B19) goes back to Sam's 8 Oct answer "Plan a demo agent for App Review". Sam's 27 Oct answer: it is a link, not a public demo on agentpager.me, and owners Sam invites get the link too.
- ENCRYPT's version header lets the service tell an old command to update. INSTALL gives it a way to.

## Still open

Sam decides these first:
1. Where the command downloads from: agentpager.me, which works before the code is public, or GitHub releases, which wait for OPEN.
2. Which machines get a build, for example macOS on Apple silicon and Linux for cloud VMs.
3. How an installed command updates once the service says it is out of date.
4. Whether the demo agent stays. It is here because TestFlight's review of a build for invited testers needs a way to try the app with no agent of its own (assumed, not checked with Apple).

## Out of scope

- A public App Store release.
- Package managers, such as Homebrew, and Windows.

## Adds · Changes · Retires

- **Adds:** B19, whole; the one-line install in B29, with builds for each kind of machine Sam chooses and a command that can update itself; the TestFlight build, whose alerts use Apple's production push service; J5's steps with the demo agent and the TestFlight build.
- **Changes:** B29's title widens back to installing the command with one line; B18, so /start gives that line instead of building from source.
- **Retires:** the limits it fixes, quoted here when they go: L24 "The app installs only from Xcode" and L22 "The command installs only from source" (7 Getting started).

## From the old Blueprint (not built yet)

The lines the old Blueprint held for this milestone, as the [M4 ledger](../M4-house/ledger.md) moved them. Each reaches its area file with the code that makes it true.

**B19 · Try a demo agent** (7 Getting started). Try AgentPager without an agent of your own: a demo agent connects to a pager on your phone, asks a sample decision and acknowledges your answer.
1. The demo is for App Review's notes and for owners Sam invites; agentpager.me doesn't offer it publicly.
2. The demo agent connects to a pager on the owner's phone as any agent does (B25), asks one sample decision, acknowledges the answer with its next steps, and finishes.
3. App Review can complete the demo from the review notes alone.
- The demo shows the exchange, not an agent's judgement.

**B29, widened** (7 Getting started)
- One line installs the agentpager command as a single file built for the machine (planned: `curl -fsSL agentpager.me/install | sh`). B29 then widens back to installing, and /start (B18) and the front page (SITE) give that line.
- The command is built for each kind of machine Sam chooses, not only the one that builds it.
- `agentpager update` updates the command from where it was installed, and an installed command learns when it is out of date. Today it replies that it can't update itself, with how to rebuild.

**The TestFlight build** (1 Pagers, 4 Getting paged)
- A TestFlight build of the app, whose alerts use Apple's production push service.
- Giving the app to invited owners stands on Sam's Apple Developer Program membership: TestFlight for invited testers, and App Review, through App Store Connect access Sam provides. Their timing is Apple's, and nothing promises a review's outcome.

**J5, changed:** J5 is walked on the TestFlight build. In J5.2, the owner gives the pager's text to the demo agent (B19), which connects, asks its sample decision, acknowledges and finishes.

## Log

- 31 Oct · queued in the next roadmap, taking TestFlight, the install line, release builds and the demo agent from FRIENDS.
- 5 Nov · Sam put it after CLIENTS.
