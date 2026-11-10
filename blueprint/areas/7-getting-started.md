# 7 Getting started

> **Definition:** How someone new finds AgentPager and gets it running: agentpager.me and its /start page for agents, installing the agentpager command and setting it up in agent apps, and how the app and the command are built today. What the command does once it is set up belongs to 2 Agents, and the app's own screens to 1 Pagers and 5 Answering.
> **Serves:** [Reach the agents owners actually use](../PRODUCT.md#reach-the-agents-owners-actually-use) · [Stack](../PRODUCT.md#stack) · [Unblock my agent from my phone](../PRODUCT.md#unblock-my-agent-from-my-phone)
> **Relies on:** Cloudflare, which serves agentpager.me and /start (6 Privacy) · Bun, which compiles the command into one file for the kind of machine that builds it · each agent app's own way of adding a local MCP server, which setup uses (2 Agents) · Xcode on Sam's Mac, which builds the app, signed with Sam's Apple developer team (4 Getting paged)
> **Code:** `packages/app/src/start.ts`, `packages/app/src/worker.ts` (agentpager.me's pages); `packages/app/src/site/` (the front page); `packages/cli/src/setup.ts`, `packages/cli/src/mcp.ts`, `packages/cli/scripts/build.sh`; `packages/ios/project.yml` (the app's build)
> **Screens:** the front page, which still shows the first version (L21): phone width [1](../generated/screens/web/front-page-390-1.png) [2](../generated/screens/web/front-page-390-2.png) [3](../generated/screens/web/front-page-390-3.png) [4](../generated/screens/web/front-page-390-4.png) [5](../generated/screens/web/front-page-390-5.png) [6](../generated/screens/web/front-page-390-6.png) · laptop width [1](../generated/screens/web/front-page-1280-1.png) [2](../generated/screens/web/front-page-1280-2.png) [3](../generated/screens/web/front-page-1280-3.png) [4](../generated/screens/web/front-page-1280-4.png)
> **Walked by:** no journey yet. J3, J4 and J5 start with the command already installed.

## Behaviors

### B18 · @M3 · /start tells an agent how to install

1. An agent that reads agentpager.me/start learns how to install the agentpager command, then how to connect with the pager number its owner gave it (B25).
2. An agent that can't install or run the command where it runs is told to stop and tell its owner, and not to work around it.
3. An agent that reads agentpager.me itself, rather than a person in a browser, is pointed to /start.
4. An agent that arrives at the retired hosted MCP server's address gets the same instructions, and is told that server is retired.
5. @M4: On a dev server, one whose address starts with `dev.`, such as dev.agentpager.me, /start and the page an agent reads at its address say it is a dev server, whose pagers are its own. agentpager.me and every other server don't.

- An agent finds agentpager.me through the text its owner copies from a pager (B25).
- Today the install that /start describes is a build from the repository (L22). It also tells the agent to run setup (B29).
- /start never documents the service's own API for calls made by hand: agents use the command.
- /start's words are design: nothing measures whether arriving agents understand and follow them.
- The front page and the phone (B23.11) count a server as dev the same way, so a local server, which the screens catalogue is drawn from, or a self-hosted one shows no dev mark anywhere.

### B29 · @M3 · Set up the command in agent apps

1. `agentpager setup` adds the command to each agent app it finds on the machine: Claude Code and pi with AgentPager's plugin and extension, Codex, Claude Desktop and Cursor.
<!-- B29.2 and B29.3 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
4. A config file that setup can't read whole is left alone, and setup says what to add to it by hand.
<!-- B29.5 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
6. In an app's config, setup writes only where the command is: never an agent's key or a pager number.
7. The command is one program: a command line, and a local MCP server that agent apps start, whose tools give the same replies as the commands.
8. The built command is one file. Where it runs, it needs neither Bun, Node nor the AgentPager repository.

- Setup finds Claude Desktop's config only where macOS keeps it.

## Limits

### L21 · @M2 · The front page still describes the first version

- What people meet: agentpager.me in a browser shows the first version of AgentPager: pairing by QR code, link and emoji, sessions that end, agents that need nothing installed, and a planned Pro plan. None of that is how AgentPager works now. Its Download buttons lead nowhere, because the app isn't on the App Store. The step that still works is the line it offers to copy for an agent, which sends the agent to /start (B18).
- Why it waits: Sam workshops the new page before anything is built, and the page needs the agent apps AgentPager supports and the one-line install, which CLIENTS and INSTALL settle first.
- What would fix it: a front page for AgentPager as it is now, which says what it does, how to get the app and the command, and what the service stores and for how long.
- When to revisit: SITE.

### L22 · @M3 · The command installs only from source

- What people meet: there is no download of the agentpager command. As /start says, an agent or owner builds it from the AgentPager repository, which is private for now, with git, Node, pnpm and Bun. The build runs only on the kind of machine that built it.
- Why it waits: release builds and a one-line install are INSTALL's work. Sam decides first where the command downloads from and which machines get a build.
- What would fix it: one line that installs the command as a single file built for the machine.
- When to revisit: INSTALL.

### L24 · @M1 · The app installs only from Xcode

- What people meet: there is no TestFlight or App Store build. The app is a development build that Sam installs on a phone from Xcode, signed with Sam's Apple developer team, and its alerts go through Apple's sandbox push service. Someone Sam invites can't install it themselves.
- Why it waits: a TestFlight build needs a release build of the app and its App Store Connect record, which are INSTALL's work.
- What would fix it: a TestFlight build whose alerts use Apple's production push service.
- When to revisit: INSTALL.
