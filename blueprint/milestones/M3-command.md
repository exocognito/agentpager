# M3 · The agentpager command

> **Status:** shipped · **Shipped:** 30 Oct 2026, as Stage 2 of the v2 plan (PRs #23 and #24 on 29 Oct, #26 and #27 on 30 Oct) · **Tag:** none; prod runs 1ee6c27, and so does the command on air, mini and pro · **Word:** COMMAND

## Objective

In Sam's voice, as the old MCOMMAND doc had it:

My agents reach my pagers through the agentpager command, as a command line or a local MCP server, and `agentpager setup` adds it to Claude Code, Codex, Claude Desktop and Cursor. An agent I give a number connects as a new agent, with nothing for me to tap. Before it asks, it has its `card.yaml` reviewed once, and the command refuses only a card that is broken in structure. It waits for my answer or my note, acknowledges it with its next steps, and keeps a history of its decisions on its own machine. The hosted MCP server is retired.

## Slice

| Layer | What M3 delivered there |
| --- | --- |
| Command | `agentpager`, one program that is both a command line and a local MCP server, built on the machine it runs on: connect (B25, I21), review and ask (B27, I22), wait and acknowledge (B32), the words that wake Claude's apps (B33), history (B31) and setup in agent apps (B29) |
| Server | the hosted MCP server retired; /start tells an agent that arrives without the command how to install it (B18); the warning when no agent picks up an answer |
| Phone | who asked and the project on every decision; the not-picked-up row and alert (B5, B17) |
| Tests | the command's suite, which drives every command and the MCP server over stdio against local workerd; the service's acceptance tests; the app's flow tests |

## Out of scope

- The one-line install and release builds: [INSTALL](next/INSTALL.md). The command is built from the AgentPager repository.
- Encryption: [ENCRYPT](next/ENCRYPT.md). The command sends cards over HTTPS, readable by the service.
- Cloud sessions: untested (L13, in [2 Agents](../areas/2-agents.md)).

## Sam's answers

- **29 Oct, Sam, recorded in session notes:** "there is NO point in a pager if I have to then contact the receiver another way manually and say 'hey I replied to your pager'". B32 and B33 follow from it.
- **29 Oct, in the v2 design** (a claude.ai Project, recorded in `docs/v2/`, which git keeps at the tag `history-archive`): "Quality is reviewed by judgement, not pattern-matched", replacing regex checks on prose and a flag to override them. Sam's reasoning, as recorded: "deterministic prose checks are too hard to get right and an adversarial loop would make the tool feel slow and wasteful; start here and see."
- **Defaults Sam confirmed on 29 Oct**, as recorded:
  - "'Defer' / 'leave as is' are real options, not padding."
  - "No cross-machine sharing of agent ids; each machine connects."
  - "Keep `finish` (optional; phone shows 'finished')."
  - "History cap 1,000 lines per pager; contract reminder after 2 hours or 5 cards."
  - "The binary is built locally with `bun build --compile` and symlinked on PATH; no GitHub Releases, no Actions, for now."
  - "The pager number lives in AGENTS.md; `AGENTPAGER_PAGER` is the opt-out for people who want it out of transcripts."
- **30 Oct, after the wake lab** ([report](https://claude.ai/artifact/Ph2BtiR64UBSde6fbXW5LT)), Sam chose, as recorded in session notes: Claude Code runs `wait --forever` in the background; a Claude Desktop chat makes quick waits between its other steps, then held waits, and stops after 2 hours; only Claude's apps get new words, and every other app's replies stay as they were.

## Adds · Changes · Retires

- **Adds:** B18, B25, B27, B29, B31, B32 and B33; I21 and I22; J3, J4, and J5's built steps; and the limits marked `@M3`. B32 and B33 got their ids in M4, for promises M3 built.
- **Changes:** B5 and B17, for the warning when no agent picks up an answer; B5, for an answer resent after a relaunch; B6, for a note that answers only its own decision; B26, for a pager's text that names another server; I4, for the command refusing a broken card before it leaves the machine. Their clauses that M3 added start with `@M3:`.
- **Retires:** the hosted MCP server and plain HTTPS as ways in with nothing to install (C2); C25 as "page by pager number", reborn as connecting with one; and J3 and J4 as link-and-emoji walks. Their text is in git at ac75bcb.

## Log

- 29 Oct · PR #23: the command, as a command line and a local MCP server; its suite 3 of 3. PR #24: the hosted MCP server retired; acceptance tests 14 of 14, flow tests 4 of 4.
- 30 Oct · PR #26: Claude's apps wake when Sam answers; the command's suite 6 of 6. PR #27: the owner is told when no agent picks up an answer; 97 Blueprint tests, 15 server tests and 6 command tests passed.
- 30 Oct · PRs #28–#34: hardening from the engineering review, among them an answer never lost on the phone, and Sam's contract answers in #33 and #34. PRs #35 and #36: the Blueprint rewritten for v2.
- 30 Oct · prod deployed at 1ee6c27, and Sam's phone loaded its pagers and decisions on it. Its command runs on air and mini, and on pro since 5 Nov.
