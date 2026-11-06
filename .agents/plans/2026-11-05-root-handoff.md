# Handoff to the next root session (5 Nov 2026, end of M4 HOUSE)

Read `AGENTS.md`, then `blueprint/README.md`. This file covers only what those two files don't. Claims are marked [V] verified or [A] assumed; each [V] was checked on 5 Nov 2026, when this was written, or on 6 Nov for the release.

## Where things stand

- **M4 HOUSE is built, released on 6 Nov, and awaiting Sam's review** (`blueprint/milestones/M4-house.md`). All its PRs are merged: #42 to #50, nine in all, the id check (#46) last, as d145f61. The wrap-up PR (#51), which marked M4 built and wrote this file, merged last, as 9849671. [V]
- **dev** (https://dev.agentpager.me) runs 9849671, #51's merge, and `pnpm smoke:dev` passed 7 of 7. [V, 6 Nov]
- **prod** (agentpager.me) runs the `m4` release: the tag `m4`, on 9849671. Sam chose "Release all" on the pager before the review; `pnpm deploy:prod` ran from a clean checkout at the tag, and `pnpm smoke:prod` passed 7 of 7. [V, 6 Nov]
- **Binaries:** the ones on air, mini and pro are 9849671, built at `m4`. [V, `agentpager version` on each, 6 Nov]
- **Phones:**
  - HomePhoneLite, the dev phone, has the dev app (`me.agentpager.app.dev`) installed. This Mac's last `pnpm phone:dev` build, pointed at dev, is from 22:19 on 5 Nov, just after #50 merged. [V] That it is the build installed there is [A]; no app code changed after #50. [V]
  - Sam's iPhone Air has 5599b15, the same app code as 1ee6c27, on prod. [A, from agent memory of 30 Oct; not rechecked] Its `m4` build is the one release step left.

## What Sam does next

1. **Review M4 after the merge**, as M4-house.md › Sam reviews after merge lists: the 95 ⚑ rows in `blueprint/milestones/M4-house/ledger.md` come first, then numbered questions with ★. Sam answers them in the markdown viewer or by asking an agent. Git keeps the old Blueprint at tag `blueprint-old-format`, and the deleted history at `history-archive`. [V, both tags are on GitHub]
2. **The release is done** (question 11, answered 6 Nov), except Sam's iPhone Air. When Sam is at pro with it unlocked, build the app from the `m4` checkout at `~/Projects/agentpager-worktrees/m4-release` to the generic iOS destination, then install it with devicectl [A, from agent memory].
3. **Then M5 ENCRYPT starts** with its Plan step: `blueprint/milestones/next/ENCRYPT.md` becomes `milestones/M5-encrypt.md` (METHOD.md › When things get written, › Ids).

## Things you inherit

- **Reviews on pro:** Grok stands in for DeepSeek, since there's no Fireworks key [V]: pi in print mode, with `blueprint-loop-grok-review.env` under masked `op run`. Codex runs via `codex exec` with its stored login; never accept its prompt to trust the primary clone.
- **Renders:** `pnpm designs` runs on pro, with Xcode 27.2 and the iPhone 17e Simulator on iOS 27.2 [V]. Its fingerprint hashes every byte of its sources, so a comment change in one needs a re-render too [V, `designs.mjs`].
- **Left open, for Sam to decide** (question 9):
  - stale PRs #25, #16 and #13;
  - the unmerged remote branch `design/ended-copies`, from the closed PR #7;
  - the merged branches still on the remote: 23 on 6 Nov [V, each remote branch checked against `origin/main`].
- **Known leftovers** (question 10):
  - the App Intents log line and the UI tests' 489 concurrency warnings are fixed (6 Nov);
  - the id check's "Known limits" at the top of `scripts/blueprint.mjs`;
  - `DECISIONS.md` still names the retired limit L20.
- **For Sam to approve removing**, by the exact command:
  - the 16 finished worktrees under `~/Projects/agentpager-worktrees/`: the 14 `m4-*` ones other than `m4-release` and `m4-release-record`, and `pr45-check-a` and `pr45-check-b`, with the local refs `refs/remotes/origin/pr45` and `pr45b`, which are the root's own and not on GitHub. All are merged or superseded [V, 6 Nov]. The pager card d_n47s asks Sam to trash them, with the exact commands; if Sam hasn't answered, ask again. `m4-release` stays for the iPhone Air build, and `m4-release-record` can go once its PR (the release record) merges;
  - `/private/tmp/claude-501/claude-501/`, which holds only empty folders [V].
- **The primary clone** sits at ab86f39 on `main`, behind `origin/main`, with a clean tree [V]. No agent works in it.
