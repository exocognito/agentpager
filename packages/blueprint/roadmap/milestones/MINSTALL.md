---
id: MINSTALL
title: AgentPager installs in a minute
status: draft
deliverables:
  - C29::install-the-command-with-one-line
  - C19::try-a-demo-agent
  - D6::iphone-app
  - D7::apple-developer-program
  - D8::bun
---

Each deliverable's parts tagged not built yet for the release builds, the TestFlight build or the demo agent land here.

# MINSTALL · AgentPager installs in a minute

## Objective

Someone I invite opens a TestFlight link and installs AgentPager on their iPhone, and its alerts come through Apple's production push service. One line installs the agentpager command as a single file on the machine their agents run on, and `agentpager setup` adds it to their agent apps. App Review can try the whole exchange from the review notes, with the demo agent. Every earlier promise still passes.

## Out of scope

- A public App Store release.
- Package managers, such as Homebrew, and Windows.

## Sam decides first

- Where the command downloads from: agentpager.me, which works before the code is public, or GitHub releases, which wait for MOPEN.
- Which machines get a build, for example macOS on Apple silicon and Linux for cloud VMs.
- How an installed command learns it is out of date. MENCRYPT will refuse commands from before encryption, so their owners need an easy way to update.
- Whether the demo agent stays. It is here because TestFlight's review of a build for invited testers needs a way to try the app with no agent of its own (assumed, not checked with Apple).
