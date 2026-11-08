# M7 · The agent apps AgentPager supports

> **Status:** planning · **Started:** 8 Nov 2026 · **Order:** after M6; INSTALL follows; its list anchors INSTALL and SITE · **Word:** CLIENTS

## Objective

Sam, 5 Nov 2026: "I actually think AFTER we do MENCRYPT we should get clear on which clients we are supporting... codex pages me it doesn't get the reply (by design I know)... clear point of view on which clients we will support and which we will not (based on our ability to wake an idle agent), and then use that as anchor in our going forward designs (and it will enable us to be opinionated in the marketing page redesign...)"

CLIENTS decides which agent apps AgentPager supports, judged on one test: can an idle agent be woken when its answer arrives? An answer must reach the agent with nothing for the owner to nudge ([M3](M3-command.md), Sam's answers). Sam's answer to D1, below, sets the list: each supported app wakes its agent the way that app allows.

## Owner decides first

### Answered on 8 Nov

The root put three questions, D1 to D3, to Sam on 8 Nov 2026, on its [canvas](https://claude.ai/artifact/WZQnoig563EEVKZSCXigaj) and in its Claude Code session, where Sam answered two of them. D3, the licence, stays open until OPEN ([OPEN](next/OPEN.md), question 1).

**D1, which agent apps, and how each is woken.** Sam typed: "D1 yes", taking the recommendation. It answers the queued doc's first three questions (the list, what an app off it meets, and which wakes to build), except cloud sessions, which wait for the lab (Still open). The pick: each agent is woken the way its app allows, as Plannotator v0.28.53, a tool that sends an owner's feedback to their agents, already does.
- **Claude Code:** a plugin whose mod hands the answer to the agent as a new turn. Today's background wait (B33.2) stays as the fallback where mods don't run: `claude -p`, SDK runs such as the Claude desktop app's Code tab, and Windows.
- **Codex, in the terminal and in the ChatGPT app:** the agentpager command itself runs `codex queue`, with no Codex plugin. What it queues says only that an answer is waiting, never the answer, since its text shows in the process list (`ps`).
- **pi:** an extension that only wakes the agent. The agent uses the agentpager command line, not MCP tools, since pi sends every tool's definition with every request.
- **Claude Desktop chats:** supported as waiting in their turn, as built (B33.3).
- **Every other app** still connects, with a one-line warning, rather than being refused at connect.
- The command stays the only place that holds keys and decrypts.
- The root cross-checked the pick the same day, client by client, against the wakes Plannotator v0.28.53 ships (What's known › What Plannotator ships).

**D2, where FRIENDS goes.** Sam chose B: FRIENDS stays after SITE and OPEN. It is recorded where it binds, in [FRIENDS](next/FRIENDS.md), with DEC-2026-11-08-friends-after-cleanup.

**Decided by the root, on its recommendation, for Sam to overturn** (METHOD › Sessions):
- The wake lab runs first, with no product code, and reports in `docs/research/2026-11-08-clients-wake-lab.md`.
- Each adapter ships through its app's own channel: the Claude Code plugin through a Claude Code plugin marketplace, and the pi extension as a pi package. Codex needs none.
- Setup adds what each supported app needs, plus one reminder line at session start.
- Each supported app has a wake test, recorded with the app's version and rerun at every release. This answers the queued doc's fourth question, how the list stays true as the apps change.
- CLIENTS fixes the not-picked-up warning that never fires when a wait whose client has gone collects the answer (What's known).
- CLIENTS reaches dev, with its upgrade check against the `m6` baseline, before 8 Dec 2026: that baseline's agent is forgotten after 2026-12-08T08:33Z.

### Still open, after the wake lab

Once the lab reports, the root puts these to Sam together. No line is written yet; each names the ids it will touch.
1. B33's clauses for each supported app: B33 changes.
2. B29's setup for the supported apps, with the reminder line at session start: B29 changes.
3. A line for the not-picked-up fix: the clauses that promise the warning are B5.13 and B17.8, with TERMS › Not picked up.
4. Which limits retire: L11, only Claude agents wake by themselves, once the three wakes ship (Claude Code's mod, Codex's queue and pi's extension); L13, cloud sessions are untested, only if the lab runs a cloud session. L12, a Desktop chat stops waiting after two hours, stays: Claude Desktop chats still wait in their turn.

## Slice

| Layer | What M7 delivers there |
| --- | --- |
| Blueprint | this doc; Sam's answers; DEC-2026-11-08-clients and DEC-2026-11-08-friends-after-cleanup; after the lab, the approved lines in 2 Agents and 7 Getting started with the code that makes them true, and the limits that retire |
| Command | Codex's wake: the command runs `codex queue` into the agent's thread, with a note that an answer is waiting and never the answer; the waiting words for each supported app; the one-line warning for an app off the list; still the only place that holds keys and decrypts |
| Service | the not-picked-up fix: an answer that a wait whose client has gone collects still brings the owner's warning |
| Adapters | the Claude Code plugin with its mod, which hands the answer over as a new turn, through a plugin marketplace, with the background wait kept where mods don't run; the pi extension, which only wakes, as a pi package |
| Setup | what each supported app needs, and one reminder line at session start |
| Tests | a recorded wake test for each supported app, with the app's version, rerun at every release; tests named by the ids M7 adds and touches |
| Dev stage | M7's code on dev with `pnpm smoke:dev`'s upgrade check against the `m6` baseline passing, before 8 Dec 2026; the `m7` baseline recorded at the release |

**One new kind of complexity:** AgentPager's own code running inside other agent apps and shipped through their channels, the Claude Code plugin and the pi extension. Codex's wake is the command running Codex's own command, and the not-picked-up fix changes something the service already does. The pull requests, in order, are in [.agents/plans/2026-11-08-m7-clients.md](../../.agents/plans/2026-11-08-m7-clients.md).

## Out of scope

- Waking OpenCode, Qwen Code, Cursor or any other app: each still connects, with the one-line warning. Plannotator wakes OpenCode 2 and Qwen Code, so either could follow later.
- INSTALL's distribution: the one-line install, release builds of the command and the TestFlight build. Only the adapters ship, through their apps' own channels; the command still installs from source (L22).
- Any hosted server, such as a hosted wait for Desktop chats, which the 30 Oct lab found would hold up better. Under ENCRYPT it could carry only ciphertext, and the command stays the only place that holds keys and decrypts.
- Agents with no machine of their own, such as claude.ai in a browser: they can't run the command.

## What's known

Verified on 8 Nov 2026 against `main` at 49d36bd, which dev runs; prod runs `m6.1`, 9fbb490 (`X-AgentPager-Build`). Assumptions are marked.

- **Today's words** (B33; `packages/cli/src/detect.ts`, `commands.ts`): the command gives waking words only to Claude Code and to Claude Desktop chats, and only when it identifies the app for certain. Every other app gets the plain words (B32) and must call wait again itself. One that has ended its turn sees the answer only when it next calls wait, so the owner has to nudge it (L11). That is why Codex doesn't get the reply.
- **Setup today** (B29.1; `packages/cli/src/setup.ts`): it adds the command's MCP server to Claude Code, Codex, Claude Desktop and Cursor, and doesn't set up pi.
- **The 30 Oct wake lab** tested only Claude's apps, at the versions of the day ([docs/research/2026-10-30-agent-wake-lab.md](../../docs/research/2026-10-30-agent-wake-lab.md); its full report is [Waking a waiting agent](https://claude.ai/artifact/Ph2BtiR64UBSde6fbXW5LT)). What still holds:
  - **Claude Code,** in the terminal or the desktop app's Code tab, wakes by itself: a `wait --forever` run in the background ends when the answer arrives. That is what the command tells it today, and it stays the fallback where mods don't run (D1). A wait run as an MCP task also woke it in the terminal; the Code tab doesn't offer MCP tasks. A turn started by a mod, which D1 picks, was one of the leads the lab didn't try.
  - **A Claude Desktop chat** can't be woken once its turn ends. It keeps its turn going by calling wait again, which held 48 minutes through dropped links to the Mac. Each wait is a model step. A hosted wait would hold up better, but needs a hosted server again (Out of scope).
  - **A chat started on claude.ai** can't reach the command at all.
  - The results depend on the apps' versions, which change often, so the lab says to re-test before relying on any of them. The wake lab and the recorded wake tests do.
- **What Plannotator ships,** read from Plannotator v0.28.53's docs and source on 8 Nov, not run by us. Its wakes, client by client:
  - Claude Code: a plugin's mod.
  - Codex CLI and the ChatGPT app's Codex: `codex queue`, with the thread id Codex names on every MCP tool call.
  - pi: an extension.
  - OpenCode 2 and Qwen Code: woken too.
  - Claude's desktop app and other apps that only start MCP servers: not woken.
  - The 30 Oct lab's leads for Codex, pi and OpenCode came from reading the same tool's source then.
- **The ChatGPT app** on pro and air includes Codex. On pro its bundle carries `codex-cli`, checked on 8 Nov.
- **Codex 0.158.0,** observed on 3 Oct, starts MCP servers in the background and doesn't wait for them before its first turn, so an agent may start without AgentPager's tools. With every server marked required, the tools were there in all 18 starts tried. Setup doesn't mark it today.
- **The Claude mobile app's cloud sessions** (L13), from the v2 design on 29 Oct, untested: its Code tab starts each session in a fresh VM with a shell, curl and Bun, tied to a GitHub repository. The owner would add agentpager.me to the environment's network allowlist, a setup script would install the command (cached about 7 days), and the number would go in that repository's AGENTS.md. Not known: whether a stdio MCP server from `.mcp.json` runs there (the command line works regardless), and whether a long wait keeps the VM from pausing.
- **The `m6` baseline,** recorded on dev at M6's release by the `m6` binary (`~/.agentpager-baselines/dev/m6/`): `pnpm smoke:dev`'s upgrade check reads it back, only reading, since #79. Its agent is forgotten if idle after 2026-12-08T08:33Z. So M7's code reaches dev, and passes that check, before 8 Dec 2026; once it is on dev, no `m6` baseline can be recorded again.
- **The not-picked-up gap,** found in M6 ([M6-tidy.md](M6-tidy.md) › Not solved, carried forward; #75): a wait whose client has gone away still runs to its time. If the answer comes meanwhile, the wait collects it, so the owner's warning that no agent picked it up (B5.13, B17.8) never comes. The next wait still gets the answer. It was so before M6.
- **The old per-agent stores** stay on dev and prod, unused, until Sam's dogfooding of M6 on prod clears them; what a pager's store deletes or forgets, it erases from them too ([M6-tidy.md](M6-tidy.md) › Out of scope). M7 leaves them as they are.

## Adds · Changes · Retires

The lines are put to Sam after the lab (Still open); the ids they will touch are named here.
- **Adds:** the Claude Code plugin with its mod; the pi extension; Codex's wake in the command; the not-picked-up fix; a recorded wake test for each supported app. DEC-2026-11-08-clients, and DEC-2026-11-08-friends-after-cleanup for D2.
- **Changes:** B33, for each supported app; B29, so setup covers them, with the reminder line at session start; B5.13 and B17.8, if the not-picked-up fix needs a line.
- **Retires,** if Sam agrees after the lab: L11, only Claude agents wake by themselves (2 Agents), once the three wakes ship; L13, cloud sessions are untested (2 Agents), only if the lab runs a cloud session. L12, a Desktop chat stops waiting after two hours, stays.

## Log

- 5 Nov · queued: Sam added CLIENTS, to run after ENCRYPT.
- 8 Nov · planning: M6 released, and CLIENTS started as M7, led by the root session `AgentPager Clients/Ship Design`, a fork of M6's root, which keeps only M6's follow-ups. Sam answered D1 and D2 in its Claude Code session. This pull request moves this doc out of `next/`, records the answers, the root's other choices and what stays open until the wake lab reports, adds DEC-2026-11-08-clients and DEC-2026-11-08-friends-after-cleanup, and adds the plan, `.agents/plans/2026-11-08-m7-clients.md`.
