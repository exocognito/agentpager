# Decisions

Decisions that bind beyond one milestone, with Sam's words as their basis. A milestone's own answers are in its doc. Each decision names the lines, METHOD rules or code it is context for; the decision is never the rule itself.

This file is append only. A reversed or narrowed decision gets a new entry, and an old entry's only edit is `→ DEC-…` naming its replacement. The first entry starts the file, in M4. The entries after it are the older decisions that still bind, shortened from `packages/blueprint/records/decisions/` and in date order, plus DEC-2026-10-29-v2-design, recorded here for the first time from `docs/v2/`; git holds every record whole at tag `blueprint-old-format`. New entries go at the end.

## DEC-2026-11-05-blueprint-destination · The Blueprint by area, one milestone at a time

- **Decided by:** Sam, on 5 Nov 2026, in the root session, on the [Destination v2 canvas](https://claude.ai/artifact/S8LzZkCuAQjurJ1Yb4zLSN).
- **Basis:** "OK this looks much better". Then, to the six simplifications: "I agree with all of these, thank you". Sam then went ahead with ★ on all eight of the canvas's questions.
- **Decided:**
  - **Where things live.** The Blueprint is `blueprint/` at the root of the repository: README.md (the milestone table and the areas), PRODUCT.md, TERMS.md, one file per area under `areas/`, one JOURNEYS.md in the same shape, DECISIONS.md, `milestones/` and `generated/`. It replaces the docs under `packages/blueprint/`.
  - **One shape.** Every item is a heading `### <id> · @M<n> · <short promise>`, with numbered clauses for its promises and bullets for its notes. An area file opens with its Definition, Serves, Relies on, Code, Screens and Walked by.
  - **Ids.** Each C became B with the same number; I, J and K keep theirs; limits start at L9, after the retired lessons; there are no D ids; no id is ever reused, C28 included. B32 (wait for the answer, then acknowledge it), B33 (each agent app is told how it wakes) and I23 (keys stay secret, Sam's ★ in the first conversion step) give their own ids to promises that already held.
  - **Milestones** are numbered when they start, written `@M5`, and a queued one lives under its word in `milestones/next/`. They run one at a time, always. After M4 the order is ENCRYPT, CLIENTS, INSTALL, SITE, OPEN, FRIENDS: CLIENTS comes right after ENCRYPT.
  - **The six simplifications:**
    1. Promises state outcomes, not wording. Exact strings, paths, timings and flags live in code and tests, unless Sam says the specific is meant.
    2. One milestone at a time, always. The leads, the parallel apparatus and the joint-release rule are gone.
    3. History lives in git, not in the tree. Once what is still true has moved, the rest is deleted under an archive tag. Only findings that outlive a milestone, such as the 30 Oct wake lab, go in `docs/research/`.
    4. Decisions only when they bind later milestones. A milestone's answers go in its doc, in Sam's words. This file keeps only the older decisions that still bind.
    5. Build only the checks Sam will look at. The id check reports and doesn't block. Tests get their ids when a milestone touches them, with no mass rename. Dev gets a deploy, a smoke run and a walk, and the full suites stay local. `generated/` holds the screens catalogue, what each milestone added and the untested list, with no per-layer views and no review page.
    6. No D ids. Outside services are each area's "Relies on" line, the per-app wake rules are B33, deploy facts are in AGENTS.md, and security rules are invariants.
  - **METHOD.md** changes here first; atomicpages takes it later.
  - **Earlier calls.** The ★ calls of the first conversion step stand, except where this entry replaces them. The lessons L1 to L8 retire, and their gotchas go to AGENTS.md.
- **Why:** "The repo is feeling VERY disorganized right now and I want to get our house in order before we commit to building E2EE and making the product available to others." (Sam, 5 Nov 2026, M4's objective)
- **Serves:** METHOD.md, as amended in M4 (Where things live, Ids, Writing lines, When things get written, Decisions, History, Tests); README.md; AGENTS.md.
- **Replaces, in part:** DEC-2026-10-31-method and DEC-2026-10-31-next-roadmap, as their entries say.
- → DEC-2026-11-06-store-after-encrypt, in part: three of ENCRYPT's hardening items became their own milestone, between ENCRYPT and CLIENTS.

## DEC-2026-10-08-native-ios · The product Sam shares is a native iPhone app

- **Decided by:** Sam, on 8 Oct 2026.
- **Basis:** Sam's iOS canvas "AgentPager iOS — native redesign", with its Android check; Sam's write-up "AgentPager: decisions to port into Blueprint" (8 Oct 2026), which merged a parallel security review; and Sam's answers in the Claude Code review of that write-up.
- **Decided, and still standing:**
  - The owner's side is a native iPhone app, built in SwiftUI, and follows iOS conventions.
  - The app says pager, never session.
  - An alert only opens the app: there is no answering from the Lock Screen.
  - No Live Activity: the app icon's badge shows how many decisions are waiting.
  - The service is HTTPS only, and stores keys only as digests.
- **Why:** designing to iOS conventions simplified the flows.
- **Serves:** PRODUCT.md › Stack ("My side is a native iPhone app") and › Feel native; B17; I23 and L20 in 6 Privacy.
- → DEC-2026-10-30-v2-promises, in part: links, emoji pairing, lifetimes and end reasons are gone. → DEC-2026-10-31-next-roadmap, in part: Android is off the roadmap.

## DEC-2026-10-27-briefs-are-the-card · Briefs are the card format

- **Decided by:** Sam, on 27 Oct 2026.
- **Basis:** "I'm ok with the fact that we need to forgo the one emoji per choice idea, we're now more advanced than that" (Sam in Claude Code). Sam's AgentPager answers the same day: refuse emoji cards from now on; retire the two emoji-card principles and add two for briefs; take all six smaller calls as written.
- **Decided, and still standing:**
  - A brief is the one card an agent asks. Its Markdown sections lead with the decision and keep the detail one tap away, and its two to four options are lettered A to D.
  - A brief has limits on its length and its attachments, which are PNG, JPEG or Markdown, and HTML only inside code. I4 and the schemas hold the limits.
  - Folding keeps approval exact: every folded part can be opened before Send, the answer refers to the exact brief, and Send doesn't wait for each part to be opened.
- **Why:** one emoji per choice was too little for the decisions agents now ask: "we're now more advanced than that".
- **Serves:** PRODUCT.md › Letters tell options apart; ✶ marks the recommendation · Lead with the decision; keep the rest one tap away · Approval refers to the exact proposal; TERMS › Brief; B5; I4.
- → DEC-2026-10-30-v2-promises, in part: emoji cards asked before 27 Oct no longer stay readable, and pairing is gone.

## DEC-2026-10-29-v2-design · v2: pagers made on the phone, numbers only, one command

- **Decided by:** Sam, on 29 Oct 2026.
- **Basis:** Sam's review of the 28–29 Oct overnight run, the instruction-flow proposal, the voice call afterwards, Sam's review of the "AgentPager v2 Screens" canvas, and the readiness review; then the defaults Sam confirmed the same day. They were recorded in `docs/v2/01-decisions.md` and `docs/v2/HANDOFF.md`, which git keeps.
- **Decided, and still standing:**
  - Pagers are made on the owner's phone, each with its own number and name, and each is on or off: a switch, not a delete. Numbers only: link, QR and emoji pairing are gone.
  - A number is an address, not a credential, and goes in AGENTS.md. Whoever has it can page the owner until the pager is off, and read nothing. An owner who wants it out of transcripts can keep it in the environment instead.
  - Every connect is a new agent, and nothing matches agents by name. An agent has no lifetime of its own. Each machine connects its own agents; an agent id is not shared across machines.
  - Agents reach AgentPager only through one command, which is both a command line and a local MCP server. The hosted MCP is retired. The writing rules and the review list ship inside the command, their single home.
  - The card is `card.yaml`, compiled by the command.
  - Quality is reviewed by judgement, not pattern-matched: one round, in which a subagent grades the card against what good looks like, and the writer chooses what to change. Asking refuses only what is mechanically certain.
  - Notes are answers to one decision, not guidance: not cached, and not shown to other agents.
  - History on disk, never in context.
  - No Settings screen in the app.
  - End-to-end encryption is required before the friends rollout.
  - Rejected as ceremony: regex checks on prose with a flag to override them, a second review round, ratings per card, time-to-answer as a score, the command calling a model itself, making the agent call for the rules, and caching the owner's notes.
- **Why:** the goal, as `docs/v2/01-decisions.md` records it: "Improve the system for Sam, then make it easy for ~10 friends and colleagues to install, use and give feedback. Open source, no paid tier." On the review, Sam's reasoning as recorded there: deterministic prose checks are too hard to get right, and an adversarial loop would make the tool feel slow and wasteful, so start here and see.
- **Serves:** PRODUCT.md › Pinned design decisions and › Stack; B22, B25, B26, B27, B31; I21, I22; TERMS.

## DEC-2026-10-30-screens-from-the-app · The app's own screens are the design record

- **Decided by:** Sam, on 30 Oct 2026.
- **Basis:** "yes to your generating static design images in the repo and deprecating storybook" (Sam in Claude Code).
- **Decided, and still standing:**
  - The screens catalogue is the record of what the product looks like: the real app's screens as checked-in images and text, made from the code by `pnpm designs`, with the front page at a phone's and a laptop's width. Since M4 it lives in `generated/screens/`.
  - Any agent, on any machine, reads the designs from those files. Making them needs a Mac with Xcode; reading them needs nothing.
  - `pnpm check` fails when the app, its UI tests or the front page change without `pnpm designs`, so the record can't quietly go stale.
  - Storybook is gone. Claude Design stays a place to sketch, and a sketch decides nothing until the app draws it.
  - It extends DEC-2026-10-27-swift-app-is-the-brief-design, which first made the Swift app the brief's design, to the whole app and the front page.
- **Why:** the Storybook copies of the phone screens still showed v1, and an agent could see the real screens only by running the Simulator.
- **Serves:** METHOD.md › One home per fact (new UI; the product's own screens in `generated/` are the record); `generated/screens/`; AGENTS.md (`pnpm check`, `pnpm designs`).

## DEC-2026-10-30-v2-promises · The Blueprint states v2's promises

- **Decided by:** Sam, on 30 Oct 2026, approving the restated strategy on Sam's pager.
- **Basis:** Sam in Claude Code on the contract: emoji cards go for good, `kind` comes off the wire, and a decision's title is at most 100 characters (PR #33). Sam's AgentPager answer on how the new promises treat what isn't built yet: tag the stages, approving the restated strategy.
- **Decided, and still standing:**
  - The strategy is restated for v2, and is now PRODUCT.md.
  - Every card is a brief. Emoji cards, `kind` and option emoji are gone from the wire for good.
  - A decision's title is at most 100 characters, and its detail is one line (I4).
  - There is no paid tier: the research offer and the paid-value goal retired with no successor.
  - The pinned design decisions in PRODUCT.md.
  - A deleted id is never reused. There is no C28, and so no B28: the owner's notes are answers to one decision, never guidance handed to other agents.
- **Why:** v2 was live, and the Blueprint still described v1: emoji pairing, one agent per pager, links, end times and 280-character titles.
- **Serves:** PRODUCT.md; I4; TERMS; METHOD.md › Ids.
- → DEC-2026-10-31-method, in part: a promise not built yet no longer stays in place tagged "Not built yet".

## DEC-2026-10-31-method · METHOD.md is how AgentPager is built

- **Decided by:** Sam, on 31 Oct 2026.
- **Basis:** "Interrogate and propose a version of METHOD.md that combines the best of our Blueprint process and the atomic pages method - lets agree on this first" (Sam in Claude Code). Then, on the six questions in PR #41: "all your recs look good", choosing 1a to 6a.
- **Decided, and still standing:**
  - METHOD.md, at the root of the repository, is the rulebook, in place of the law and files spec in exocognito/blueprint. It is written for any project that works this way; AGENTS.md holds what is specific to AgentPager.
  - Every item is a heading with numbered clauses, so every id is kept.
  - Prod deploys only a commit tagged after it was green on dev, and `main` deploys to dev.
  - The strategy folds into PRODUCT.md. The vision and the pinned design decisions stay word for word, the rest becomes principles in Sam's words, and the SC, SI, SG and SP ids retire.
  - Sam gives the root session the go for a milestone, and it merges that milestone's reviewed pull requests. Otherwise Sam merges.
  - The Blueprint holds only what's built, plus what a running milestone has designed. A promise not built yet waits in its milestone's doc, or is a limit where people meet the gap today.
- **Serves:** METHOD.md; PRODUCT.md; AGENTS.md.
- → DEC-2026-11-05-blueprint-destination, in part: `@M<n>` on a heading replaced "Since" on every item; the id check reports untested clauses instead of `pnpm check` enforcing a test per id; the lessons' gotchas go to AGENTS.md, not to decisions.
- → DEC-2026-11-06-verbatim-quotes, in part: PRODUCT.md is as Sam approved it, not in Sam's words.

## DEC-2026-10-31-next-roadmap · The next roadmap gets AgentPager ready for its first owners

- **Decided by:** Sam, on 31 Oct 2026.
- **Basis:** Sam in Claude Code, setting five goals: E2EE; easy installs of the command and TestFlight; a redesigned marketing page that is "simple, clear, up to date and looks good"; cleaned-up code and Blueprint published on GitHub with a clean history, "so people can inspect code, fork and self-host"; then initial external users and their feedback. On what to leave out: "No Android, Lock Screen, Live Activities, Pro version, etc. I don't need them yet, so there's no signal to prioritize them".
- **Decided, and still standing:**
  - The milestones after the shipped ones: ENCRYPT, decisions the service can't read; INSTALL, TestFlight, the one-line install and release builds of the command, and the demo agent for App Review; SITE, a front page for the product as it is now, workshopped with Sam before anything is built; OPEN, cleaned-up code and Blueprint published with a clean history, with a guide to running your own; FRIENDS, Sam invites the first owners and hears back from them.
  - OPEN's cleanup comes after ENCRYPT, since both change the same code, and FRIENDS comes last.
  - Everything else is off the roadmap until owners using AgentPager, Sam included, show they need it. Dropped with Android: the deferred Alchemy, owners' own writing rules, recovering lost keys, a deployed auto-off wait and outcome metrics.
- **Serves:** README.md › Milestones; PRODUCT.md › Roadmap; `milestones/next/`.
- → DEC-2026-11-05-blueprint-destination, in part: the first three "can be done in parallel" gave way to one milestone at a time, with CLIENTS after ENCRYPT.

## DEC-2026-11-06-verbatim-quotes · Quote marks hold only what a person typed

- **Decided by:** Sam, on 6 Nov 2026.
- **Basis:** "agent words should never be quoted, quotations just for human verbatim inputs. Agent words are usually deducable from other info." (Sam in Claude Code, after a check of Sam's typed messages found that 29 of the 57 quotes the Blueprint gave as Sam's were agents' words.) Asked how Serves and Why lines should cite PRODUCT.md, which agents mostly wrote and Sam approved, Sam chose links to its headings.
- **Decided, and still standing:**
  - Quote marks hold only what a person typed, word for word, with where they typed it. An agent's words are never quoted or given as a person's, a pager option's label and a first-person draft included.
  - PRODUCT.md is as Sam approved it, not in Sam's words. Serves and Why lines link its headings instead of quoting it.
  - Older entries here stay as written, since this file is append only. Two of them quote agents' words: DEC-2026-10-08-native-ios names an agent's write-up as Sam's, and DEC-2026-10-29-v2-design quotes the v2 design record.
- **Serves:** METHOD.md › Writing lines; PRODUCT.md; every area's Serves and Why lines.

## DEC-2026-11-06-line-test · A line only where Sam wants one answer

- **Decided by:** Sam, on 6 Nov 2026.
- **Basis:** Sam in the M4 root's Claude Code session, reviewing every Blueprint line at M4's review ([M4-house.md](milestones/M4-house.md) › Sam reviews after merge, question 1): "I write lines for things the owner wants to specify where there are multiple objectively good/fitting answers that an LLM might reasonably choose but I want one solution, or I want to avoid certain solutions. If I don't mind what solution an LLM chooses, and we can easily read that decision in the code, that promise shouldn't get copied to ledger." Then, on how a screen looks: "look is generally held by screens, unless I need a specific non-obvious treatment that is not obvious to an agent refactoring the screen."
- **Decided, and still standing:**
  - A line holds what Sam wants specified where several good answers exist and Sam wants one of them, or wants some ruled out. A choice Sam doesn't mind, which reads plainly in the code, gets no line.
  - How a screen looks is held by the screens, unless Sam needs a treatment that an agent refactoring the screen wouldn't find obvious.
  - As #54 to #56 applied it: guarantees, such as data surviving, one owner per fact and outcomes that may be uncertain, count as things Sam minds; guards against harm count as ruling answers out.
- **Why:** M4's conversion had carried lines into the areas that Sam didn't mind, and Sam gave the test to judge which to keep.
- **Serves:** METHOD.md › Writing lines (What earns a line, Look lives in the screens); every area file and JOURNEYS.md; `generated/screens/`.

## DEC-2026-11-06-store-after-encrypt · ENCRYPT keeps two hardening items; one store per pager follows it

- **Decided by:** Sam, on 6 Nov 2026.
- **Basis:** "Agree with all your recs, though for starting M5 I would like you to give to a herdr pane with fresh Opus 5.5 xhigh thinking bypass perms, and ask them to orchestrate subagents to see it through to green on dev and I'll test there" (Sam in the previous root's Claude Code session, answering its five numbered questions on starting M5; [M5-encrypt.md](milestones/M5-encrypt.md) › Owner decides first records each choice.)
- **Decided, and still standing:**
  - M5 ENCRYPT keeps encryption and two of its five hardening items, an ask request id and a client-version header, since both change the wire contract that encryption changes anyway.
  - The other three become their own milestone, right after ENCRYPT and before CLIENTS, queued as STORE, the word M5's Plan proposed: one store per pager, holding its row, its agents and their decisions, which closes L10; both polls made smaller, so the phone reads one object per pager and a waiting agent is woken rather than checking storage; and the agent's lifecycle, in which finishing closes the agent's open decisions so they can't be answered.
  - The order after M4 is ENCRYPT, STORE, CLIENTS, INSTALL, SITE, OPEN, FRIENDS, one at a time.
- **Why:** the two items that change the wire contract go with the switch that breaks it; the other three are a different kind of change, to how the service stores and reads a pager.
- **Serves:** README.md › Milestones; `milestones/M5-encrypt.md`; `milestones/next/STORE.md`; L10 in 1 Pagers.
