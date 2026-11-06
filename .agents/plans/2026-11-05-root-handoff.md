# Handoff to the next root session (5 Nov 2026, end of M4 HOUSE)

Read `AGENTS.md`, then `blueprint/README.md`. This file covers only what those two files don't. Claims are marked [V] verified or [A] assumed; each [V] was checked on 5 Nov 2026, when this was written, or on 6 Nov for the release.

## Where things stand

- **M4 HOUSE is shipped: released and reviewed on 6 Nov** (`blueprint/milestones/M4-house.md`). Sam's review is applied in the pull request from `m4/review`. [V] All its PRs are merged: #42 to #50, nine in all, the id check (#46) last, as d145f61. The wrap-up PR (#51), which marked M4 built and wrote this file, merged last, as 9849671. [V]
- **dev** (https://dev.agentpager.me) runs 9849671, #51's merge, and `pnpm smoke:dev` passed 7 of 7. [V, 6 Nov]
- **prod** (agentpager.me) runs the `m4` release: the tag `m4`, on 9849671. Sam chose "Release all" on the pager before the review; `pnpm deploy:prod` ran from a clean checkout at the tag, and `pnpm smoke:prod` passed 7 of 7. [V, 6 Nov]
- **Binaries:** the ones on air, mini and pro are 9849671, built at `m4`. [V, `agentpager version` on each, 6 Nov]
- **Phones:**
  - HomePhoneLite, the dev phone, has the dev app (`me.agentpager.app.dev`) installed. This Mac's last `pnpm phone:dev` build, pointed at dev, is from 22:19 on 5 Nov, just after #50 merged. [V] That it is the build installed there is [A]; no app code changed after #50. [V]
  - Sam's iPhone Air has the `m4` build, installed from `~/Projects/agentpager-worktrees/m4-release`. [V, 6 Nov]

## What Sam does next

1. **M4's review is answered** (M4-house.md › Sam reviews after merge). Still open for Sam: question 8, whether the 29 quotes in agents' words lose their quote marks, and ⚑ rows 62 and 91. ⚑ row 82 goes to ENCRYPT's Plan. [V]
2. **The dev-mark follow-up:** B18.5 narrows to dev.* servers and B18.6 goes, with the code that says "dev" at / and /start, in its own pull request; then dev is redeployed and smoke-run. [V, planned 6 Nov]
3. **Then M5 ENCRYPT starts** with its Plan step: `blueprint/milestones/next/ENCRYPT.md` becomes `milestones/M5-encrypt.md` (METHOD.md › When things get written, › Ids).

## Things you inherit

- **Reviews on pro:** Grok stands in for DeepSeek, since there's no Fireworks key [V]: pi in print mode, with `blueprint-loop-grok-review.env` under masked `op run`. Codex runs via `codex exec` with its stored login; never accept its prompt to trust the primary clone.
- **Renders:** `pnpm designs` runs on pro, with Xcode 27.2 and the iPhone 17e Simulator on iOS 27.2 [V]. Its fingerprint hashes every byte of its sources, so a comment change in one needs a re-render too [V, `designs.mjs`].
- **Question 9, done on 6 Nov:** #16 and #13 are closed, and `design/ended-copies` and the merged branches are deleted. #25 stays open. [V]
- **Known leftovers** (question 10):
  - the App Intents log line and the UI tests' 489 concurrency warnings are fixed (6 Nov);
  - the id check's "Known limits" at the top of `scripts/blueprint.mjs`;
  - `DECISIONS.md` still names the retired limit L20.
- **For Sam to approve removing**, by the exact command:
  - the worktrees `m4-release`, `m4-release-record` and `m4-leftovers` under `~/Projects/agentpager-worktrees/`, whose work is merged or done. Sam chose "Trash them" for the 16 before them (pager card d_n47s), and they and the refs `pr45` and `pr45b` are gone [V, 6 Nov];
  - `/private/tmp/claude-501/claude-501/`, which holds only empty folders [V].
- **The primary clone** sits at ab86f39 on `main`, behind `origin/main`, with a clean tree [V]. No agent works in it.
