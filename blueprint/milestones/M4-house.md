# M4 · House in order

> **Status:** shipped · **Started:** 5 Nov 2026 · **Released:** 6 Nov 2026 · **Reviewed:** 6 Nov 2026 · **Tag:** `m4`, on 9849671 · **Order:** runs alone, before ENCRYPT

## Objective

"The repo is feeling VERY disorganized right now and I want to get our house in order before we commit to building E2EE and making the product available to others." (Sam, 5 Nov 2026)

## Decided

Sam agreed the destination on the [Destination v2 canvas](https://claude.ai/artifact/S8LzZkCuAQjurJ1Yb4zLSN), in the root session on 5 Nov 2026:
- "OK this looks much better"
- to the six simplifications: "I agree with all of these, thank you"
- "orchestrate subagents to get all this M4 House done, and then I'll review when it's merged (I approve you merging the merge-ready PRs) and before we start with MENCRYPT"
- ★ on all eight of the canvas's questions, confirmed when Sam went ahead.

What they settle:
- [METHOD.md](../../METHOD.md), as amended in M4: one file per area, one shape for every promise, outcomes not wording, milestones numbered when they start, one milestone at a time, decisions only when they bind later milestones, history in git, and the dev stage. It changes here first; atomicpages takes it later.
- Ids: each `C` becomes `B` with the same number; I, J and K keep theirs; limits start at L9; there are no D ids, and no id is reused.
- The dev stage is built in M4.
- The order after M4: ENCRYPT, CLIENTS, INSTALL, SITE, OPEN, FRIENDS, one at a time.
- The earlier Step 0 calls stand at ★, except where the destination replaces them. Lessons L1 to L8 retire, and their gotchas go to AGENTS.md.
- The ENCRYPT hardening items, agreed earlier, go in `next/ENCRYPT.md`: an ask request id, a client-version header, one writer per pager, a lifecycle state machine that says what finish does to open decisions, and a smaller poll.
- The root merges each M4 pull request once it is merge-ready: review passed, `pnpm check` and `pnpm test:all` green, no open finding. Sam reviews M4 after it has merged.

Sam answered two more on 5 Nov 2026, relayed by the root to PR #49:
- On HTTPS only (question 2 below): "Yes fix plain http".
- On the phone's server setting: "It's ok in the settings screen for now, let's leave the settings decision as it was for now, and we'll see how it goes with it in the OS settings". The server address stays in iOS Settings (B23.10).
- On the dev phone: "can you change the setting yourself in the dev build, I give you permission to automatically control the dev iPhone". So the dev phone's build points at dev, from `pnpm phone:dev` (AGENTS.md › Stages), and agents may install and launch it there.

The plan, with the pull requests in order, is [.agents/plans/2026-11-05-m4-house.md](../../.agents/plans/2026-11-05-m4-house.md).

## Slice

| Layer | What M4 delivers there |
| --- | --- |
| Blueprint | `blueprint/` in the area shape; every old line has a row in the ledger: its new home, the code or test that now holds its specific, or dropped and why. The wire contract moves to `packages/contract` and the front page to `packages/app/src/site`, so the Blueprint holds no code |
| Server | a dev Worker with its own data, at dev.agentpager.me; the root deploys `main` there after each merge |
| Phone | the dev phone runs a build that points at dev (`pnpm phone:dev`), with a "dev" mark; separate app ids wait for INSTALL |
| Binary | builds from main talk to dev with `--server`; air, mini and pro run only tagged builds |
| Tests | tests M4 touches are named by id; the id check writes what each milestone added and the untested list, and doesn't block; dev gets a smoke run, and the full suites stay local |

## Out of scope

- No new behavior for anyone using AgentPager, except HTTPS only, which Sam asked for. Prod changes only by its tag.
- No prod deploy without Sam's go. Prod stayed at 1ee6c27 until Sam chose, on 6 Nov, to release before the review (question 11).
- No mass rename of tests: only the ones M4 touches get ids.

## Sam reviews after merge

1. **The 95 ⚑ rows** in [the ledger's ⚑ section](M4-house/ledger.md#-for-sam): 89 from the conversion, 3 from the history cleanup and 3 from PR #49, the dev marks and HTTPS only. Each drops a line, changes its meaning, adds a line no old line held, or cuts a specific that no test holds. A specific moved into a test that holds it isn't flagged.
   **Answered 6 Nov:** Sam reviewed every line, not only the ⚑ rows, by a test Sam gave that day: "I write lines for things the owner wants to specify where there are multiple objectively good/fitting answers that an LLM might reasonably choose but I want one solution, or I want to avoid certain solutions. If I don't mind what solution an LLM chooses, and we can easily read that decision in the code, that promise shouldn't get copied to ledger." For how a screen looks: "look is generally held by screens, unless I need a specific non-obvious treatment that is not obvious to an agent refactoring the screen." A check against Sam's typed messages since 30 Sep kept the lines that hold Sam's own words. What changed is under Adds · Changes · Retires. Three ⚑ rows outside the areas stay open: 62 and 91 for Sam, and 82 for ENCRYPT's Plan.
2. **HTTPS only** (L20): answered "Yes fix plain http" (above). PR #49 adds I23.4 and retires L20; prod gets it with the `m4` tag.
3. **The old copy of AgentPager in exocognito/blueprint**, question 6 of DEC-2026-10-27-pr1-sign-off, has no home. (a) ★ it is OPEN's: add it to OPEN's questions; (b) it is no longer open.
   **Answered 6 Nov:** "why not archive? tag so we can recover it if we need but leave to git history". Done: exocognito/blueprint PR #216 removed `toy-examples/agentpager`, which tag `archive/agentpager-toy-example-20261106` keeps.
4. **New lines from what is built and tested**, with no old line behind them: B5.16 (an answer resent after a relaunch), B25.11–.13, B32.2–.4 and B32.7–.10, B33.1–.3, B27.1's `agentpager example`, I22.4, I22.6, B18.5, the dev mark the dev-stage pull request (#44) built, and B18.6 and B23.11, the dev marks on the front page and the phone. (a) ★ keep them; (b) name the ones to retire.
   **Answered 6 Nov** by the line test (question 1): kept, except B25.12, B32.3, B32.4, B32.9, I22.4, B27.1's `agentpager example` and I22.6's last sentence, which go. B18.5 narrows to dev.* servers and B18.6 goes in their own pull request, since the code changes with them.
5. **B5.12 and B5.13** now say the decision itself, not only its row, shows sending, waiting and not picked up, as the app does. (a) ★ keep; (b) narrow back to the row.
   **Answered 6 Nov:** "See #4": kept.
6. **L10**, from `packages/app/README.md`: turning a pager off can let one call through. (a) ★ keep it as a limit until ENCRYPT's one writer per pager; (b) fix it sooner.
   **Answered 6 Nov:** (a), L10 stays a limit.
7. **What tests don't show:** B29.8 (the built command needs no Bun, Node or repository) is proven only in part, and nothing tests dark appearance or the largest text size, which the old Blueprint claimed. (a) ★ leave both on the untested list; (b) add the tests before the `m4` tag. The tag went out first (question 11), so (b) now means before ENCRYPT starts.
   **Answered 6 Nov:** "Both of those sound a bit odd to me, leave untested but also apply #4". Both stay untested, and no line promises dark appearance or the largest text size (⚑43).
8. **Sam's words quoted from session notes** in M3's answers (29 and 30 Oct), which no repository file held. (a) ★ keep them; (b) take them out.
   **Asked 6 Nov:** "Are we sure they are my words and not agent words? Can I see them to confirm". Of the 57 quotes the Blueprint gives as Sam's, Sam's own typed messages hold 21 word for word and 7 closely; 29 are agents' words. Still open: whether those 29 lose their quote marks.
9. **Stale pull requests and branches**, none of them M4's, left as they were: #25, which hides a project whose agents haven't asked anything (30 Oct, the app and its UI tests); #16 and #13, drafts from 27 Oct, before v2; the unmerged remote branch `design/ended-copies`, one commit from the closed PR #7, for the Storybook that is gone; and the merged branches still on the remote (23 on 6 Nov). (a) ★ close #16 and #13, delete `design/ended-copies` and the merged branches, and leave #25 for a later milestone, since it changes what an owner sees; (b) name what to keep.
   **Answered 6 Nov:** "Yes to rec". Done: #16 and #13 are closed, and `design/ended-copies` and the merged branches are deleted. #25 stays open.
10. **Known leftovers**, each written down where it is:
    - App Intents logs one "metadata extraction skipped" line per target in Xcode builds; it isn't an Xcode issue (PR #50).
    - The UI tests hold 489 Swift 6 concurrency warnings, shown only with complete (strict) checking; clearing them means moving the tests to Swift 6 (PR #50).
    - The id check's "Known limits", at the top of `scripts/blueprint.mjs`: forms of test name that no test here uses.
    - `DECISIONS.md` still names the retired limit L20, in DEC-2026-10-08-native-ios's Serves line; the file is append only.

    (a) ★ leave them; (b) name one to fix before the `m4` tag. The tag went out first (question 11), so (b) now means before ENCRYPT starts.
    **Answered 6 Nov:** Sam asked why leave them. The first two cost little, so they are fixed (Log). The id check's known limits stay, since no test uses those forms; the L20 mention stays, since DECISIONS.md is append only and M4 records the retirement.
11. **The release**, once Sam has reviewed: the root tags `m4` on the commit that is green on dev, runs `pnpm deploy:prod` from a clean checkout at the tag and then `pnpm smoke:prod`, copies the binary built at `m4` to air, mini and pro, and puts the `m4` build on Sam's iPhone Air, in the order AGENTS.md › Stages gives. Prod ran 1ee6c27 until then. (a) ★ release `m4` once the answers above are in; (b) hold prod at 1ee6c27.
    **Answered 6 Nov** on the pager: "Release all", before the review. Done, except Sam's iPhone Air (Log).

## Adds · Changes · Retires

- **Adds:** on prod, nothing an owner sees but HTTPS only (I23.4), since the `m4` release on 6 Nov. A dev stage, whose addresses and deploy order are in AGENTS.md, B18.5, the dev mark an agent reads there, B18.6 and B23.11, the dev marks on the front page and on the phone's pagers, and I23.4, the service answers only over HTTPS. B32 and B33, for promises that hold today but have no id of their own. Limits from L9, for what people meet today.
- **Changes:** every `C` id becomes `B` with the same number. Promise text moves into areas, trimmed to outcomes, and each line that drops or changes its meaning has a ledger row. The D ids become "Relies on" lines, behaviors, invariants and facts in AGENTS.md. Unbuilt promises, such as B30 and K1, move to their milestones in `next/`.
- **Retires:** lessons L1 to L8; the D ids; the old docs under `packages/blueprint/`, kept at tag `blueprint-old-format`; `docs/v2`, the workshop, `recipe.json`, parked work and superseded plans, kept at tag `history-archive`; and L20 "The service still answers plain HTTP" (6 Privacy), which I23.4 fixes. Its id is never reused. The 30 Oct wake lab moves to [docs/research/](../../docs/research/2026-10-30-agent-wake-lab.md).
- **Sam's review, 6 Nov:**
  - Adds I24, a restart loses nothing (J4.4's promise), and J4.8, the whole of J4 in one line.
  - Changes B5.1 (it leads with "Decision:"), B5.9 (the picked option is outlined), B5.10 (Send names the option's letter), B7.2, B23.7 (only when the service says the pager is gone), B23.8 (no line while all is well), B26.7 (pressing Create again makes the same pager), B27.1, B33.1, I4.4 (Sam's 280 and 1,000 are back), I22.2, I22.3, I22.5 and I22.6. PRODUCT.md's number principle now holds the sentence area 6 quotes, "The pager number binds my phone's key".
  - Retires 43 clauses: B5.6, B5.8, B6.3, B7.1, B7.4 to B7.6, B17.6, B17.9, B17.10, B22.1, B23.1 to B23.3, B23.6, B25.1, B25.3, B25.8 to B25.10, B25.12, B26.6, B27.5, B29.2, B29.3, B29.5, B31.2, B32.1, B32.3, B32.4, B32.9, I19.5, I22.4, J3.1, J3.4, J3.5 and J4.1 to J4.7. It also retires L23 "Moving the command breaks its setup" (7 Getting started), which INSTALL's install line fixes with L22. Each still holds or isn't Sam's choice, and the code or a test shows it; the screens hold how each screen looks. Their text is at tag `m4`. A comment marks each gap inside a list, so the list shows its real numbers, and no id is reused.

## Left for the follow-up PR

Nothing: PR #49 re-pointed the seven references to `docs/v2` in files `pnpm designs` draws from, and made the screens again.

## Log

- 5 Nov · building: Sam agreed Destination v2, its six simplifications and all eight ★ answers. PR #43 amends METHOD.md, sets the roadmap order and starts this doc; `pnpm check` green, `pnpm test:all` 60 passed (34, 16 and 10).
- 5 Nov · building: PR #42 moves the code out of `packages/blueprint`: the wire contract to `packages/contract`, the front page to `packages/app/src/site` and the screens catalogue to `blueprint/generated/screens`. The images needed no re-render, since nothing they are drawn from changed content; the catalogue carries the new fingerprint. `pnpm check` green, `pnpm test:all` 60 passed (32 and 2, 16 and 10).
- 5 Nov · building: PR #45 writes `blueprint/` in the area shape: 7 areas with 23 entries and 162 clauses, limits L9 to L24, 3 journeys, and the six queued milestones' docs. The [ledger](M4-house/ledger.md) maps every old line in 743 rows, 89 flagged ⚑ for Sam after two fresh ledger checks. The old docs under `packages/blueprint` are deleted, kept at tag `blueprint-old-format`, and AGENTS.md is rewritten. `pnpm check` green, `pnpm test:all` 60 passed (32 and 2, 16 and 10).
- 5 Nov · building: PR #44 adds the dev stage, live at https://dev.agentpager.me: Worker `ownerpager-dev` with its own data, `pnpm deploy:dev`, `pnpm deploy:prod` only at a release tag, `pnpm smoke:dev`, and the dev mark on /start and the page an agent reads. `pnpm check` green, `pnpm test:all` 66 passed (32 and 2, 22 and 10). After the merge (6c58e60) the root deployed dev, and `pnpm smoke:dev` passed 6 of 6; prod still runs 1ee6c27.
- 5 Nov · building: PR #45 merged (64512bd) after #44, adding B18.5, the dev mark, and homing #44's D1 edits; 89 ⚑. `pnpm check` green, `pnpm test:all` 66 passed (32 and 2, 22 and 10).
- 5 Nov · building: PR #47 deletes `docs/v2`, the root `workshop/`, `recipe.json` and four superseded plans (42 files, about 29,000 words), after the tag `history-archive` (64512bd). The regression cards move to `packages/cli/test/regression/`, and the 30 Oct wake lab to `docs/research/`. Four fresh checks found 14 still-true lines without a home: 11 now have one, and 3 are dropped ⚑ (the ledger's PR 4 section). Five files drawn from by `pnpm designs` keep seven stale references, listed above.
- 5 Nov · building: Sam answered question 2, "Yes fix plain http", and the dev phone's setting (quoted under Decided); both join PR #49.
- 5 Nov · building: PR #49 adds B18.6 and B23.11, the dev marks: the front page on dev.agentpager.me shows a dev strip, and the phone marks a pager made there on Pagers and its screen. It adds I23.4, HTTPS only, and retires L20, with a smoke step for it on dev; adds `pnpm phone:dev`, which puts a build pointing at dev on HomePhoneLite; and re-points the seven `docs/v2` references in files `pnpm designs` draws from. The screens were made again on iOS 27.2: no image shows a mark, and the 18 that changed differ only in clock times, random pager numbers and keyboard predictions. `pnpm check` green, `pnpm test:all` 70 passed (32 and 3, 25 and 10).
- 5 Nov · building: PR #50 clears the Xcode 27.2 warnings. `BriefView`'s options-table header uses `Text` interpolation instead of the `+` that iOS 26 deprecates. The project takes Xcode's recommended settings (script sandboxing, asset symbol extensions, string catalog symbols), with LastUpgradeCheck at 2720; signing and the team are unchanged. The build now has 0 warnings in Debug and Release. Two things are left. App Intents logs one "metadata extraction skipped" line per target, which is not an Xcode issue. The UI tests hold 489 concurrency diagnostics that show only under complete checking, so clearing them means moving the tests to Swift 6. The screens were made again: the header is pixel-identical, and the 14 images that changed differ only in clock times, ports and pager numbers. `pnpm check` green, `pnpm test:all` 70 passed (32 and 3, 25 and 10).
- 5 Nov · building: PR #46 adds the id check, `pnpm blueprint` (`scripts/blueprint.mjs`), which writes [generated/by-milestone.md](../generated/by-milestone.md) and [generated/untested.md](../generated/untested.md): 41 entries and 185 clauses, 3 tested (B18.6, B23.11 and I23.4, whose tests carry their ids) and 182 untested, and no warnings. A test counts only when its name carries the id: Sam chose that simpler rule (option C, "Simplify first") after five review rounds on a comment-and-string scanner. Sam then chose option B, "Fix and review", so `--check` runs through a symlinked path, and then option A, "Use real parser": TypeScript test names come from the `typescript` parser, and Swift's from a small reader that skips comments, nested ones included, and every kind of string. It reports and never blocks; `pnpm check` fails only when the two files are stale. `pnpm check` green, `pnpm test:all` 78 passed (32 and 3, 8, 25 and 10).
- 5 Nov · built, awaiting Sam's review: PR #51 marks M4 built, completes "Sam reviews after merge" with the release, the stale pull requests and branches and the known leftovers (95 ⚑, recounted), and replaces the root handoff with `.agents/plans/2026-11-05-root-handoff.md`. Dev runs 87d6a66 until the root deploys `main` after this merge. `pnpm check` green, `pnpm test:all` 78 passed (32 and 3, 8, 25 and 10).
- 6 Nov · released, awaiting Sam's review: after #51 merged, the root deployed `main` (9849671) to dev, and `pnpm smoke:dev` passed 7 of 7. Sam then chose "Release all" on the pager, before the review. The root tagged `m4` at 9849671 and deployed prod from a clean checkout at the tag, and `pnpm smoke:prod` passed 7 of 7, HTTPS only included. The binary built at `m4` is on pro, mini and air, and `agentpager version` shows 9849671 on each. Sam's iPhone Air keeps its 5599b15 app until Sam is at pro with it unlocked.
- 6 Nov · released, awaiting Sam's review: two of question 10's leftovers are fixed. `LM_SKIP_METADATA_EXTRACTION` skips the App Intents metadata step, so builds no longer log "Metadata extraction skipped"; the app is unchanged. The UI test classes and helpers run on the main actor, which clears all 489 concurrency warnings under complete checking; the UI test target stays in Swift 5 mode. The screens were made again, differing only in clock times.
- 6 Nov · shipped: Sam reviewed the Blueprint on a keep/drop page, one line at a time, and answered questions 1 and 3 to 9 (above). This pull request applies it: 44 lines go, 2 come and 14 change (Adds · Changes · Retires). The id check counts 41 entries and 144 clauses. The dev-mark change to B18.5 and B18.6 follows in its own pull request.
