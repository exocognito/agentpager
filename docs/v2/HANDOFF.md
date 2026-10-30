# AgentPager v2: handoff to Claude Code (30 Oct 2026)

This folder is the complete design for AgentPager v2, agreed between Sam and Claude on 29–30 Oct 2026 in a claude.ai Project. Nothing else about it exists outside this folder; the chat it came from is not available to you. Read in order:

| File | What it is |
|---|---|
| `01-decisions.md` | Every decision, with status. **Start here.** Where it conflicts with anything else in this folder, it wins. |
| `02-writing-rules.md` | The card contract, `card.yaml` format, the review ("what good looks like", graded ok / good to fix / must fix by a subagent), the mechanical refusals, the 10 overnight cards scored. |
| `03-binary-surface.md` | The `agentpager` binary: files on disk, commands, MCP tools, replies word for word, history file. |
| `04-encryption.md` | Keys, number format, envelope, push preview and the Notification Service Extension, server and phone changes. |
| `05-readiness-review-and-stages.md` | What the current code is and the four build stages. |
| `06-blueprint-update-plan.md` | Deferred. Do after Stage 1 is on Sam's phone. |
| `card-example.yaml` | The M11 decision as a complete `card.yaml`; it is the card drawn in the mocks. |
| `mocks/*.png` | The chosen v2 screens, numbered in navigation order. The brief for the iOS work until UI-test screenshots replace them. |
| `pages/` | Two explainer pages (open in a browser): the agent's lifecycle through the binary, and `card.yaml` mapped to the screens. |
| `regression/` | The 10 cards from 28–29 Oct and what the review should say about them. |

## The job

Get v2 onto Sam's phone, stage by stage, then the binary, then encryption. Order and "done when" are in `05-…` §Staged plan. The Blueprint update and the marketing page come after.

## Decisions already made (don't re-ask)

All of `01-decisions.md`, plus these defaults Sam confirmed on 29 Oct:
- "Defer" / "leave as is" are real options, not padding.
- No cross-machine sharing of agent ids; each machine connects.
- Keep `finish` (optional; phone shows "finished").
- Fingerprint 8 bytes, 36-character number; attachment names encrypted.
- History cap 1,000 lines per pager; contract reminder after 2 hours or 5 cards.
- v2 is a fresh install on the phone: no migration of today's pagers or decisions.
- The binary is built locally with `bun build --compile` and symlinked on PATH; no GitHub Releases, no Actions, for now.
- Rename `session` → `agent` throughout the code in Stage 1.
- Mocks in `mocks/` are canonical until UI-test screenshots exist.
- The pager number lives in AGENTS.md; `AGENTPAGER_PAGER` is the opt-out for people who want it out of transcripts.

## How to work

Follow the repo's `AGENTS.md`. In particular:
- Never work in the primary clone. Fresh worktree off `origin/main` under `~/Projects/agentpager.worktrees/<name>`, one branch per stage, draft PR, never self-merge.
- Delete with `trash` only after Sam approves; otherwise leave it.
- Secrets only through masked `op run`; never print credentials. Cloudflare deploys are Sam's: tell him when a PR is ready to deploy. The pager number in `~/.agents/agentpager.md` is a secret; never echo it.
- Never use the paid Anthropic API without explicit approval. The binary needs no API key; the review is done by the writing agent's own subagent.
- Phone builds and tapping through are Sam's. End each stage with exactly what he should try.

Your first task: commit this folder as `docs/v2/` on a branch (`docs/v2-design`), open the draft PR, then start Stage 1 on its own branch.

## When you need Sam

Page him with AgentPager (the current hosted MCP or HTTP API, number in `~/.agents/agentpager.md`) and keep going with what isn't blocked. Write the card to `02-writing-rules.md` §1 by hand and have a subagent grade it against §2 before you send; you are the first user of the rules you're building. One decision per card, two to four real options, never "revise" or "discuss" as an option.

## Checks before each PR

- `pnpm check`, `pnpm test:unit`, and the acceptance tests against local workerd for server changes.
- `xcodebuild` and the UI tests for iOS changes; save screenshots with `TEST_RUNNER_SCREENSHOT_DIR` and compare with `mocks/`.
- Stage 2: run `agentpager review` on every card in `regression/` and compare the grades with `02-writing-rules.md` §4.
