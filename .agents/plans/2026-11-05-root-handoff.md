# Handoff to the next root session (5 Nov 2026, end of M4 HOUSE)

Read `AGENTS.md`, then `blueprint/README.md`. This file covers only what those two files don't. Claims are marked [V] verified or [A] assumed; each [V] was checked on 5 Nov 2026, when this was written.

## Where things stand

- **M4 HOUSE is built and awaiting Sam's review** (`blueprint/milestones/M4-house.md`). All its PRs are merged: #42 to #50, nine in all, the id check (#46) last, as d145f61. The wrap-up PR (#51), which marks M4 built and writes this file, is the last. [V]
- **dev** (https://dev.agentpager.me) runs 87d6a66, #50's merge, and redirects plain HTTP to HTTPS. #46 and the wrap-up change no service code. [V, from its build header]
- **The root deploys dev after the wrap-up merges**, from a clean checkout of `main`, and runs `pnpm smoke:dev`. Not done when this was written. [A]
- **prod** (agentpager.me) still runs 1ee6c27, M3's release, from before M4. It still answers plain HTTP until the `m4` release. [V, from its build header]
- **Binaries:** the ones on air, mini and pro are 1ee6c27. [V, `agentpager version` on each]
- **Phones:**
  - HomePhoneLite, the dev phone, has the dev app (`me.agentpager.app.dev`) installed. This Mac's last `pnpm phone:dev` build, pointed at dev, is from 22:19 on 5 Nov, just after #50 merged. [V] That it is the build installed there is [A]; no app code changed after #50. [V]
  - Sam's iPhone Air has 5599b15, the same app code as 1ee6c27, on prod. [A, from agent memory of 30 Oct; not rechecked]

## What Sam does next

1. **Review M4 after the merge**, as M4-house.md › Sam reviews after merge lists: the 95 ⚑ rows in `blueprint/milestones/M4-house/ledger.md` come first, then numbered questions with ★. Sam answers them in the markdown viewer or by asking an agent. Git keeps the old Blueprint at tag `blueprint-old-format`, and the deleted history at `history-archive`. [V, both tags are on GitHub]
2. **Approve the release** (question 11 there). Then the root:
   - tags `m4` on the commit that was green on dev, and pushes the tag;
   - runs `pnpm deploy:prod` from a clean checkout at that tag, which refuses anything else [V, `stages.ts`];
   - runs `pnpm smoke:prod`, which pages no one and deletes its one throwaway pager with its agent [V, `smoke.mjs`]; Sam's go for the release covers it [A];
   - builds the binary at `m4` (`pnpm --filter @agentpager/cli build`), copies it to `~/.agentpager/bin/` on air, mini and pro, and checks `agentpager version` on each. The service goes before the binaries.
   - puts the `m4` build on Sam's iPhone Air: it needs the phone unlocked, so build to the generic iOS destination, then install with devicectl [A, from agent memory].
3. **Then M5 ENCRYPT starts** with its Plan step: `blueprint/milestones/next/ENCRYPT.md` becomes `milestones/M5-encrypt.md` (METHOD.md › When things get written, › Ids).

## Things you inherit

- **Reviews on pro:** Grok stands in for DeepSeek, since there's no Fireworks key [V]: pi in print mode, with `blueprint-loop-grok-review.env` under masked `op run`. Codex runs via `codex exec` with its stored login; never accept its prompt to trust the primary clone.
- **Renders:** `pnpm designs` runs on pro, with Xcode 27.2 and the iPhone 17e Simulator on iOS 27.2 [V]. Its fingerprint hashes every byte of its sources, so a comment change in one needs a re-render too [V, `designs.mjs`].
- **Left open, for Sam to decide** (question 9):
  - stale PRs #25, #16 and #13;
  - the unmerged remote branch `design/ended-copies`, from the closed PR #7;
  - 22 merged branches still on the remote, 23 once `m4/wrap-up` merges [V, `git ls-remote` against `origin/main`].
- **Known leftovers** (question 10):
  - an App Intents log line in Xcode builds;
  - 489 Swift 6 concurrency warnings in the UI tests, shown only with strict checking;
  - the id check's "Known limits" at the top of `scripts/blueprint.mjs`;
  - `DECISIONS.md` still names the retired limit L20.
- **For Sam to approve removing**, by the exact command:
  - the 15 worktrees under `~/Projects/agentpager-worktrees/`: the 13 `m4-*` ones, of which `m4-dev-main` to `m4-dev-main3` are detached deploy checkouts, and `pr45-check-a` and `pr45-check-b` [V, `git worktree list`], plus any the root makes for the next dev deploy;
  - the local refs `refs/remotes/origin/pr45` and `pr45b` in the primary clone, which are the root's own and not on GitHub [V];
  - `/private/tmp/claude-501/claude-501/`, which holds only empty folders [V].
- **The primary clone** sits at ab86f39 on `main`, behind `origin/main`, with a clean tree [V]. No agent works in it.
