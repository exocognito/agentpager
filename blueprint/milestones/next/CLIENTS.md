# CLIENTS · The agent apps AgentPager supports

> **Status:** queued · **Order:** after ENCRYPT; its list anchors INSTALL and SITE · numbered when it starts

## Objective

Sam, 5 Nov 2026: "I actually think AFTER we do MENCRYPT we should get clear on which clients we are supporting... codex pages me it doesn't get the reply (by design I know)... clear point of view on which clients we will support and which we will not (based on our ability to wake an idle agent), and then use that as anchor in our going forward designs (and it will enable us to be opinionated in the marketing page redesign...)"

CLIENTS decides which agent apps AgentPager supports, judged on one test: can an idle agent be woken when its answer arrives? An answer must reach the agent with nothing for the owner to nudge ([M3](../M3-command.md), Sam's answers).

## What's known

- Today the command gives waking words only to Claude Code and to Claude Desktop chats (B33). Every other app gets the plain words (B32) and must call wait again itself. One that has ended its turn sees the answer only when it next calls wait, so the owner has to nudge it. That is why Codex doesn't get the reply.
- The 30 Oct wake lab tested only Claude's apps. Its findings are in [docs/research/2026-10-30-agent-wake-lab.md](../../../docs/research/2026-10-30-agent-wake-lab.md), and its full report is [Waking a waiting agent](https://claude.ai/artifact/Ph2BtiR64UBSde6fbXW5LT).
  - **Claude Code**, in the terminal or the desktop app's Code tab, wakes by itself: a `wait --forever` run in the background ends when the answer arrives. That is what the command tells it today. A wait run as an MCP task also woke it in the terminal, without the agent having to follow a recipe; the Code tab doesn't offer MCP tasks.
  - **A Claude Desktop chat** can't be woken once its turn ends. It keeps its turn going by calling wait again, which held 48 minutes through dropped links to the Mac. Each wait is a model step. A hosted wait that only says "answered", leaving the command to decrypt, would hold up better, but needs a hosted server again.
  - **A chat started on claude.ai** can't reach the command at all.
  - **Codex, Cursor, pi and the rest** weren't tested. Ideas from reading another tool's source on 30 Oct, untested here: Codex can queue a message into a thread, pi and OpenCode can start a turn, and a hook or mod in Claude Code could start one.
- **The Claude mobile app's cloud sessions** (L13), from the v2 design on 29 Oct, untested: its Code tab starts each session in a fresh VM with a shell, curl and Bun, tied to a GitHub repository. The owner would add agentpager.me to the environment's network allowlist, a setup script would install the command (cached about 7 days), and the number would go in that repository's AGENTS.md. Not known: whether a stdio MCP server from `.mcp.json` runs there (the command line works regardless), and whether a long wait keeps the VM from pausing.
- Codex 0.158.0, observed on 3 Oct, starts MCP servers in the background and doesn't wait for them before its first turn, so an agent may start without AgentPager's tools. With every server marked required, the tools were there in all 18 starts tried. Setup doesn't mark it today.
- Under ENCRYPT, a hosted server can carry only ciphertext, which is one reason CLIENTS comes after it.

## Still open

1. The list: which apps are supported and which are not, and what "supported" promises, given that a Desktop chat waits in its turn rather than waking.
2. What an agent in an app that isn't supported meets: refused at connect, or allowed with a plain warning to its owner.
3. Which wakes to build or test for Codex, Cursor, pi and cloud sessions, if any.
4. How the list stays true as the apps change: the lab's results depend on their versions.

## Out of scope

- Agents with no machine of their own, such as claude.ai in a browser: they can't run the command.

## Adds · Changes · Retires

- **Changes:** B33, for each app on the list; B29, so setup covers the apps on the list.
- **Retires:** the limits in [2 Agents](../../areas/2-agents.md) that the list settles, named here when they go: L11, only Claude agents wake by themselves; L12, a Desktop chat stops waiting after two hours; and L13, cloud sessions are untested.

## Log

- 5 Nov · queued: Sam added CLIENTS, to run after ENCRYPT.
