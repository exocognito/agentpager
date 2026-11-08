# Handoff to the next root session (6 Nov 2026, M5 ENCRYPT green on dev)

Read `AGENTS.md`, then `blueprint/README.md`. This file covers only what those two files don't. Claims are marked [V] verified or [A] assumed; each [V] was checked on 6 Nov 2026, when this was written.

## Where things stand

- **The root** is session 9c483b84, a Claude Code session in Herdr pane w1:pK on pro, which pages Sam as agentpager agent ap-9tbn. The previous root, session 86f845ec, stepped back on 6 Nov and no longer merges, deploys or touches the repo. [V]
- **7 Nov: M5 is released, and M6 TIDY is planning.** Sam skipped the walk on dev and will dogfood on prod at TIDY; the root tagged `m5` on 464d559, deployed prod, put the `m5` binary on air, mini and pro and the `m5` app on Sam's iPhone Air, and recorded the `m5` baseline on dev (`blueprint/milestones/M5-encrypt.md` › Log). M6's plan is `.agents/plans/2026-11-07-m6-tidy.md`. The rest of this file is as of 6 Nov.
- **M5 ENCRYPT was built and on dev, awaiting Sam's walk** (`blueprint/milestones/M5-encrypt.md`). Its pull requests merged on 6 Nov in this order: #57, #58, #60, #59, #61, #62 and #63; #64 records the milestone as built. The root's plan, with each pull request's merge, is `.agents/plans/2026-11-06-m5-encrypt.md`. [V]
- **M4 HOUSE is shipped:** released and reviewed on 6 Nov (`blueprint/milestones/M4-house.md`). Its ledger left the tree in M5's Plan, kept at tag `m4-house-ledger`. [V]
- **dev** (https://dev.agentpager.me) runs 6e9717a, #64's merge, by its `X-AgentPager-Build` header. `pnpm smoke:dev` passed 14 of 14 there, the upgrade check against the `m4` baseline included. [V]
- **prod** (agentpager.me) runs the `m4` release: the tag `m4`, on 9849671, by its header. [V]
- **Binaries:** the ones on air, mini and pro are 9849671, built at `m4`. [V at the `m4` release, by `agentpager version` on each; no M5 agent touches them]
- **Phones:**
  - HomePhoneLite, the dev phone (iOS 26.7.1), runs `main`'s app at 6e9717a, from `pnpm phone:dev` in a clean checkout of `main`, with https://dev.agentpager.me as its server and the alert extension embedded; the app launched. [V]
  - Sam's iPhone Air has the `m4` build, which works with prod until the release. [V]

## What Sam does next

As of 6 Nov. On 7 Nov Sam skipped step 1 and gave the go for step 3, which the root has done.

1. **Walk M5 on dev,** on HomePhoneLite with `main`'s app, and with a binary built from `main` under its own `AGENTPAGER_HOME`, with `--server https://dev.agentpager.me` (AGENTS.md › Stages): `M5-encrypt.md` › Walk on dev. The walk command on pro is `~/.agentpager-dev/agentpager`, a wrapper around the binary built at 6e9717a that keeps its own `AGENTPAGER_HOME` (`~/.agentpager-dev/home`) and always talks to dev, so it never touches `~/.agentpager`. [V]
2. **The five questions are answered:** Sam answered them on 7 Nov, recorded in `M5-encrypt.md` › Answered on 7 Nov, before the walk. The three that change only words (I4.6, TERMS › Encrypted part, I5's note) are in docs pull request #66; questions 1 and 2 add B30.3 and B7.4, which a phone pull request builds, and the walk follows on that build.
3. **Give the go for the release.** The root then tags `m5` on the commit that was green on dev, runs `pnpm deploy:prod` from a clean checkout at the tag and then `pnpm smoke:prod`, and rebuilds the clients in AGENTS.md's order: the binary built at `m5` on air, mini and pro, then the `m5` app on Sam's iPhone Air. The release's exception applies on prod (`M5-encrypt.md` › The release's exception): what prod stored before the switch is deleted, every pager is kept, Sam's agents connect again, and the iPhone Air can't read its pagers until it has the new app. The root then marks M5 shipped and records the `m5` upgrade baseline on dev (`pnpm baseline:dev --tag m5`, with the binary built at the tag) before the next milestone's code reaches dev.

## The upgrade baselines

- The `m4` baseline is in `~/.agentpager-baselines/dev/m4/` on pro, outside every worktree. It holds keys, so nothing prints it. `pnpm smoke:dev` reads it for the upgrade check. [V]
- Its agent would have been forgotten after 2026-12-06T21:48Z with no activity. That is moot: the switch deleted the agent, and the upgrade check now proves it gone. The pager stays. [V, #58 and #63]
- The `m5` baseline, recorded at the release, holds an agent the service forgets after 30 days with no activity, so the next milestone's upgrade check runs within 30 days of recording it (`packages/app/README.md` › Upgrade baseline). [V]

## Things you inherit

- **Reviews on pro:** [V]
  - Grok, through Sam's xAI subscription login: `env -u XAI_API_KEY pi --model xai/grok-latest --thinking high` in print mode, `--thinking low` for a sanity check, with no `op run`. Sam disabled the old xAI API key on purpose on 6 Nov.
  - Codex, via `codex exec -m gpt-6.1-sol --sandbox read-only` with its stored login; never accept its prompt to trust the primary clone.
  - DeepSeek over Fireworks is Sam's fallback when Grok is unavailable, and has no key on pro.
- **Renders:** `pnpm designs` runs on pro, with Xcode 27.2 and the iPhone 17e Simulator on iOS 27.2 [V]. Its fingerprint hashes every byte of its sources, so a comment change in one needs a re-render too [V, `designs.mjs`]. Agents run Simulators one at a time, under `lockf -k ~/Projects/agentpager-worktrees/.simulator.lock`; never delete the lock file.
- **Known leftovers** from M4 (question 10):
  - the id check's "Known limits" at the top of `scripts/blueprint.mjs`;
  - `DECISIONS.md` still names the retired limit L20.
- **The primary clone** sits on `main` at cfb78c0, behind `origin/main`. No agent works in it. [V]

## For Sam to approve trashing

Nothing is trashed until Sam approves the exact command. Every worktree below is clean, and its branch or head is on `main`, except `m5-walk`'s until its pull request merges. [V]

- **Worktrees** in `~/Projects/agentpager-worktrees/`:
  - Merged pull requests, with their local branches: `m5-plan` (#57), `m5-baseline` (#58), `m5-answers` (#60), `m5-hardening` (#59), `m5-envelope` (#61), `m5-extension` (#62) and `m5-switch` (#63). Their branches are still on GitHub too.
  - Review copies, done: `m5-envelope-review` (26271ec) and `m5-switch-review` (0bef035).
  - Builds at `m4`, done: `m5-baseline-m4` and `m5-hardening-m4`, detached at 9849671. The `m4` baseline keeps its own copy of the binary.
  - `m5-switch-before`, detached at 5f5fd4d, the `m4`-era server for the local upgrade check: done.
  - `m5-deploy`, detached at 6e9717a, from which the root deployed dev: done, since each deploy starts from a fresh one [A].
  - `m5-root-phone`, detached at 7a7a16d, the root's phone build [A]: done, since HomePhoneLite has `main`'s app.
  - `m5-wrapup` (#64), merged: done.
  - `m5-walk` (this walk's docs pull request): once it merges.
- **Temp folders:**
  - `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/9c483b84-af30-4404-8405-a682adc7cdf1/`, this root's, 5.3 GB: logs, review briefs, build output, and test baselines whose keys are for local servers only. After the walk.
  - `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/86f845ec-30ed-4f3f-8a1b-48f4067f3344/`, the previous root's, 5.2 GB.
  - `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/73b382d5-966c-4273-83a1-29b5ba84ea15/` (636 KB) and `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/9896b490-6d8f-4eca-85ec-86cb7768a7dc/` (empty), from other sessions.
  - `/private/tmp/claude-501/claude-501/`, which holds only empty folders.
  - `/private/tmp/claude-501/ap-*.log`, eleven logs from the morning of 6 Nov, before M5 [A: the `m4` release's].
