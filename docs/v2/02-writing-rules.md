# Decision cards: the writing rules, the review and the mechanical checks (draft 6, 30 Oct 2026)

Design item 1. These ship inside the `agentpager` binary and nowhere else: in the `ask` tool's description, in `agentpager rules` and `agentpager review`, and in what `ask` prints when it refuses. The server never sees a card's text.

Derived from the 10 cards of 28–29 Oct and Sam's three notes on them. Section 4 scores those cards against the review list.

Draft history. 1: contract plus regex-based refuse/warn checks in `ask`. 2: `--send-anyway` for warnings; contract reprinted on the binary's clock. 3: notes are answers, not guidance; history on disk. **4: the regex content checks are gone.** `ask` refuses only what is mechanically certain (schema, sizes, fewer than two options, pager off, too many open). Quality is judged by a **review against a description of what good looks like, done by a subagent of the writing agent, one round**, before `ask`: the reviewer grades each point **ok / good to fix / must fix**, and the writer chooses what to change. (Draft 6 corrects draft 4, which had pre-sorted the list into must and nice; severity is the reviewer's call per card.) No hold state, so `--send-anyway` is moot. Sam's reasoning: deterministic prose checks are too hard to get right and risk an adversarial loop that slows agents down and burns tokens; start with judgement and see how it works.

## 1. The card contract (what the agent reads before writing)

This is the whole rules text. It must fit in a tool description, so it is short and every line is a rule, not advice.

> **A decision card asks your owner one question and gives them everything they need to answer it on a phone.**
>
> 1. **One question per card.** The title is the question, under 100 characters. Two decisions are two cards.
> 2. **Write for someone who wasn't there.** Your owner reads this on a phone, hours later, without your context. No ticket numbers, milestone codes, variable names or document labels unless you say what they are. If a term needs the project to understand, explain it or leave it out.
> 3. **Context says three things:** what is happening, what breaks or is lost if nobody decides, and how likely or how often. Three short paragraphs at most. History goes in an attached page, not here.
> 4. **Options are different ways to get the job done.** Two to four, each something you will carry out as soon as it is chosen. Never offer "revise", "discuss", "give me changes", "partial", "review later" or "other": the phone has an Ask for changes button for that. If you have one idea, find the other real one: usually the cheap option with a cost your owner will feel, against the thorough one.
> 5. **Each option tells its story:** what it changes, why choose it, why pass on it, what it assumes, and what it looks like (a diff, a mockup, a sample). Its `prioritizes` line says what it optimises for, in your owner's terms.
> 6. **Options compares them on what your owner cares about.** One row per concern, one column per option, every cell rated green to red. Not a restatement of the option titles.
> 7. **Recommend one, say why in one line, and say what would change your mind.**
> 8. **Next steps: what happens after each answer, and what happens if nobody answers.**
> 9. **Everything needed to decide is in the card.** Attach images and pages; a link is extra reading, never required reading. Never ask your owner to open another tool to decide.
> 10. **Each part has one job.** `detail` is the one-line preview in the inbox: say what the decision is about, in plain words. No bookkeeping anywhere: not "this replaces card X", not "approval is not implied", not apologies.
> 11. **Short.** A card your owner can read in two minutes. Detail belongs in option stories and attachments, not in Context.
> 12. **Before you send, get it reviewed once.** Run `agentpager review card.yaml` and give its output to a subagent (or do it yourself if you can't start one). It grades each point ok, good to fix or must fix. Fix the must-fixes, use your judgement on the rest, then send. One round; don't review the review.

### The short version (reprinted later in the session)

About 600 characters, printed inside an `ask` reply when the binary decides the agent needs a reminder (section 3). Same numbering as the contract.

> It's been 9 hours since you last read the card contract. The short version:
> 1. One question per card. 2. Write for someone who wasn't there. 3. Context: what's happening, what breaks if nobody decides, how likely. 4. Options are different ways to get the job done; never "revise" or "discuss". 5–8. Each option's story; a tradeoffs table on what your owner cares about; recommend one; next steps. 9. Everything needed to decide is in the card. 10. Each part has one job. 11. Short. 12. One review by a subagent before you send (`agentpager review card.yaml`); fix the must-fixes, judge the rest.

## 2. The review

### What `agentpager review card.yaml` prints

The card, then what good looks like and the reviewer's instructions, as one block the agent hands to a subagent. The binary does no judging itself; it has no model and no API key. The list is not pre-sorted by severity: the reviewer decides, for this card, how much each shortfall matters.

```
Review this decision card for the person who will answer it. Read it as they will: on a
phone, hours from now, without the writer's context, in under two minutes.

Below is what a good card looks like. Grade each point for this card:
  ok            it holds
  good to fix   it falls short in a way the owner would notice
  must fix      the owner can't answer well without this fixed
For anything not ok, say in one line what to change, quoting the text. Do not rewrite the
card. Output the twelve grades in order, one per line, and nothing else.

WHAT GOOD LOOKS LIKE
 1  One question. The title is a question the owner can answer with one tap.
 2  Two to four options, each something the writer will do as soon as it is chosen. None
    asks the owner to write instead of choosing ("revise", "discuss", "partial", "review
    later", "other"). If only one option is real, say what the other should be.
 3  The card stands alone. The owner can decide from the card without opening a link or
    another tool. Attachments may add detail; nothing required lives outside.
 4  Context says what is happening, what breaks or is lost if nobody decides, and how
    likely or how often.
 5  One option is recommended, with one line of why and what would change the writer's
    mind.
 6  No unexplained labels: ticket numbers, milestone codes, variable or document names.
 7  `detail` is a plain one-line preview of what the decision is about; no bookkeeping
    ("replaces card X", "approval is not implied"), no apologies.
 8  Context is three short paragraphs at most; detail lives in the option stories or the
    background page.
 9  Each option says what it changes, why choose it, why pass on it, what it assumes, and
    shows what it looks like where that helps.
10  Each tradeoffs row separates the options on something the owner cares about; no row
    rates every option the same.
11  Next steps say what happens after each answer and if nobody answers.
12  Readable in two minutes.

--- card.yaml ---
<the card, verbatim>
```

A reviewer's output for last night's 10:17pm M11 card, for example:

```
 1  must fix     Two questions in one: "Two decisions: (a) the retry policy and (b) the UI". Split them.
 2  must fix     Option C "Request changes or give a partial decision" asks the owner to write. Drop it; A and B are the real choices.
 3  must fix     "Must review: all seven promise changes (B54)" points at an attachment. Put what's needed to decide in the card.
 4  good to fix  Context says what is happening but not what breaks if nobody decides.
 5  ok
 6  good to fix  "B54", "2 KiB", "r3" are unexplained.
 7  ok
 8  good to fix  Context is 1,840 characters; the history belongs on the background page.
 9  ok
10  ok
11  good to fix  No "if nobody answers".
12  good to fix  About five minutes as written.
```

### What the writing agent does with it

One round. Fix the must-fixes. Read the good-to-fixes and fix what is worth it; one the writer disagrees with is left alone. Then `ask`. No second review, no justification, nothing recorded about what was skipped. If the reviewer marks something must-fix that the writer thinks is wrong, the writer decides; `ask` never bounces a card on content.

For an MCP agent the `review` tool returns the same block; the harness's subagent mechanism (Claude Code's Task, Codex's sub-agents) does the review. A harness with no subagents reads the block and self-reviews; weaker, but still a deliberate pass with the list in front of it.

### What `ask` still refuses, mechanically

Only things that are certain and would break the phone or the server. These exist today.

| # | Condition | Message |
|---|---|---|
| R1 | The YAML doesn't parse; a required key is missing; `recommendation.option` names no option; a tradeoffs row or `next_steps` line names a letter that isn't an option, or a tradeoffs row is missing an option; a cell's rating isn't green/yellow/orange/red; a heading, table or HTML inside a prose field. | `context.summary is missing.` / `recommendation.option is C but there are two options.` / `tradeoffs[1] has no cell for B.` |
| R2 | Fewer than 2 options. | `A decision needs at least two options.` |
| R3 | A link or image names an attachment that isn't attached. | `Context links to background.md but no attachment has that name.` |
| R4 | Over a size limit: title 100, detail 280, prioritizes 280, label 20, markdown 20,000, a page 20,000, an image 1 MB, attachments 3 MB / 8. | `Attachment owner-packet.md is 31,204 characters; the limit is 20,000. Split it, or cut it.` |
| R5 | More than 10 open decisions on this agent's pager (server rule, surfaced before sending). | `Your owner already has 10 unanswered decisions from you. Wait for answers before asking more.` |
| R6 | Pager off. | `Not sent. This pager is turned off and your message was not delivered.` |

A refusal prints the problems, one line each, and nothing else. No warnings, no hold state, no `--send-anyway`. Last night's M13 refusal printed 20,000 characters of schema; this prints three lines.

### What a successful send looks like

```
Sent. Your owner sees it as:
  When a reply from the service is lost, should we add retries or just make it visible?
  A rare bug can leave a job stuck. Fix it the cheap way, or the thorough way.
Decision d_4k2m. Wait for the answer with: agentpager wait --agent ap-7f3k d_4k2m
```

The inbox preview is printed back so the agent sees what the owner will see first. Nothing else.

### Why judgement over regexes

The draft-1 checks were pattern matches on prose: "revise|discuss|partial" in an option title, three tokens like `B54`, "must review" near a link. They catch last night's cards, and they'd also flag "Add a discussion thread to the page" as a padded option and miss "Push back on this plan". Every false positive is a hold the agent has to argue with, and every miss is a rule the agent learns it can ignore. A subagent reading the list handles paraphrase in both directions and costs a few thousand tokens per card, once. If the review turns out to miss the padded option (the one failure that matters most), M2 can be backed by a mechanical check later, with the data to justify it.

### The card format: `card.yaml`

The whole card is structure. Each key lands in exactly one place on the phone, so rule 10 is enforced by the shape and the reviewer checks keys, not headings. Prose fields allow paragraphs, bullets, bold and `![…](file)` for an attached image; no headings, tables or HTML.

| Key | Required | On the phone |
|---|---|---|
| `title` | yes, ≤ 100 chars, a question | Row in the pager list; push title; screen header |
| `detail` | yes, ≤ 280 | Push body |
| `context.heading`, `context.summary` | summary | The Context card at the top of the decision |
| `context.more.title`, `.body` | no | One tappable row under Context, opening a bottom sheet |
| `options[].label` (≤ 20), `.title`, `.prioritizes` | yes, 2–4 options | Buttons; Options table column headers; options sheet header |
| `options[].changes`, `.why`, `.why_not`, `.assumes`, `.looks_like` | no (review point 9) | Options sheet, one page per option |
| `tradeoffs[].concern` and one `"rating: text"` cell per option letter; rating green / yellow / orange / red | no (review point 10) | The Options table with rated cells |
| `recommendation.option`, `.why`, `.changes_my_mind` | option and why | Recommendation card; ✶ on the option |
| `next_steps.heading`, one line per option letter, `.if_no_answer` | no (review point 11) | Next steps row |
| `attachments[]` | when referenced | Files next to the card; images open full screen |

The binary compiles this into today's `{title, detail, card:{type:"brief", recommended, options, markdown}, attachments}` before encrypting, so the phone's parser is unchanged and the Stage 1 build is unaffected. Later the app can take the structure directly and drop the markdown parser. `agentpager example` writes a complete `card.yaml` to start from; the M11 example is in §5.

## 3. Where the agent meets the rules, across the whole session

The principle: feedback rides on calls the agent already makes and taps the owner already does, plus one review the agent runs itself. Nothing is put into the agent's context that it didn't ask for. The binary keeps two counters per agent (`rulesShownAt`, `cardsSinceRules`) so the contract reminder runs on its own clock, not on the agent's memory, which compaction erases.

| Moment | What it gets | Cost |
|---|---|---|
| Every turn (MCP agents) | The `ask` tool's description is the contract, verbatim (about 1,600 characters). Field descriptions repeat the relevant rule. The harness resends this on every turn, so the rules never leave context. | None |
| `agentpager connect <number>` | `Connected as agent ap-7f3k…`, then `Before your first card: agentpager rules`. A prompt, not a gate. | One call the agent makes anyway |
| `agentpager rules` | The contract, the `card.yaml` template, one complete example. Sets `rulesShownAt`. | One call |
| `agentpager review card.yaml` | The card plus what good looks like and the reviewer instructions, for a subagent, which grades each point ok / good to fix / must fix. The binary judges nothing. | One subagent run, a few thousand tokens, once per card |
| `agentpager ask card.yaml` | Mechanical refusals only, one line each; or `Sent.` with the inbox preview. When more than 2 hours or 5 cards have passed since `rulesShownAt`, the short contract is appended. | Two lines; ~600 characters occasionally |
| `agentpager wait` returning an answer | `Answered at 4:33 PM: option A "Proceed".` and the `ack` command. | None |
| `agentpager wait` returning a note (Ask for changes) | The note, then `Follow the note. If you still need a decision, ask a new card. Acknowledge this one with what you'll do.` The note is about this decision; not saved as guidance, not shown to any other agent. | The note the owner would write anyway |
| `agentpager history` (optional) | The pager's decisions from this machine, newest first. Never injected. | Only when called |

Rejected as ceremony: regex checks on prose that hold a card; a reason string for overriding them; a second review round; thumbs up/down per card on the phone; time-to-answer as a score; the binary calling a model itself (no key, no cost to friends); a mandatory `rules` call; caching the owner's notes and injecting them into later agents' context.

What this does not fix: a harness prompt that pulls the agent toward "approve this package?" point 2 names it; a reviewer will usually catch it; nothing can make the writer think of the second real option.

## 4. Last night's cards against the list

How a reviewer grading against the list would most likely have scored each card, and what `ask` would have refused mechanically. The grades are the reviewer's call; these are my guesses. Pacific time.

| Card | Likely must fix | Likely good to fix | Mechanical |
|---|---|---|---|
| 4:31pm M8 recovery | — | 6 (M7, M8), 7 (detail: "The same question is pending in Codex") | sent |
| 7:36pm M9 policies | 2 "Revise particular choices… reply with the numbers" | 6, 9 (no option stories), 7 | sent |
| 8:29pm M9 mockup | 2 ×2 "Revise the mockup", "Review later"; 3 (Context is a chatgpt.com link, "review its four local tabs") | — | sent. This is the one you sent back. |
| 8:33pm M9 mockup, attached | 2 ×2 | 7 ("This replaces the earlier card… orchestration omission") | sent |
| 9:17pm M10 | 2 "Revise policy or UI; reply with what to change"; 3 ("Must review: all seven…") | 6 (12a, 13a, B44), 8 | sent |
| 10:17pm M11 | 1 ("Two decisions:"); 2 "Request changes or give a partial decision"; 3 | 6 (B54, 2 KiB), 8 | sent. The one you called "very unclear". |
| 10:43pm M12 | 2 "Request specific changes" | 6 (14a, 14b, B38, I7.5) | sent; A/C/D are real options |
| 1:06am M13 | 2; 3 | 6, 8, 12 | **refused, R4** (31k-char attachment), three lines instead of 20,000 |
| 7:30am M11 rev 3 | 2 "Discuss or change the proposal" (leaves one option) | 7 ("replaces the unclear earlier proposal") | sent. The one you answered "Option B isn't an option". |
| 8:03am M11 rev 4 | — | 6 mild (r4, B54/B56, r3), 7 ("Questions or partial replies are feedback, not approval") | sent |

Eight of ten would most likely get a must-fix on point 2, the padded option, and the two that don't are the two you answered without complaint. Whether last night's helper would have fixed its M2s after one review is the open empirical question; it's what dogfooding is for.

## 5. The worst card, rewritten under the rules

The 10:17pm M11 card as `card.yaml`. This is the card drawn on the v2 canvas screens.

```yaml
title: Which M11 guarantee should we build?
detail: Two real alternatives: a smaller fix with occasional manual recovery, or precise automatic recovery.

context:
  heading: a lost reply
  summary: |
    The service hands the agent job A, but the reply is lost on the way. When the agent
    asks again it gets job B, and A is stuck. We don't know how often this happens in
    production.
  more:
    title: How the mix-up happens
    body: |
      Every few seconds the agent asks the service "is there work for me?". Usually the
      answer is "no", and that's normal.

      Sometimes the service says "yes, here is job A" but the reply never arrives: the
      connection dropped on the way back. The service has already marked A as running.
      The agent, having heard nothing, asks again, and this time gets job B.

      Now A sits marked as running forever, with nobody working on it. That's the stuck
      job you'd see on the page.

      ![Flowchart](flow.png)

      We don't know how often this happens in production. Option A makes the stuck state
      visible so you can clear it by hand; option B makes the service remember the
      hand-off so a retry gets A back.

options:
  - label: Small + manual
    title: Smaller fix with manual recovery
    prioritizes: less code and state, accepting an occasional Cancel or Run again after a connection failure
    changes: |
      - Stop automatically repeating an unresolved Run.
      - Report an unanswered work-taking call as unknown, not empty.
      - Keep normal idle waits, live-run recovery and Cancel.
    why: |
      - No permanent receipt store and no new endpoint.
      - Fixes the one path that looked empty but wasn't.
    why_not: |
      - After a connection failure you may have to inspect the page, Cancel a stuck job, or press Run again.
    assumes: |
      - Lost replies are rare enough that manual recovery is acceptable.
    looks_like: warning.png
  - label: Precise + automatic
    title: Precise automatic recovery
    prioritizes: never leaving a job stuck, at the cost of durable request identities and more code
    changes: |
      - Every hand-off gets a stored id and result; a retry with the same id gets the same job back.
      - A stuck job is recovered automatically from the stored acceptance.
    why: |
      - Stuck jobs recover on their own; you never touch them.
    why_not: |
      - Stored ids and results for the life of the page, more code, and a second place a bug can hide.
    assumes: |
      - Lost replies are common enough to be worth the machinery.

tradeoffs:
  - concern: Lost connection
    A: "yellow: May need inspection, Cancel or Run again"
    B: "green: Recover original job or stored acceptance automatically"
  - concern: Complexity
    A: "green: No permanent receipts or new endpoint"
    B: "yellow: Durable request identities and more code"
  - concern: Idle waits
    A: "green: Normal idle waits stay"
    B: "green: Normal idle waits stay; no permanent empty history"

recommendation:
  option: A
  why: Fix the misleading timeout and stop risky automatic repeats; accept occasional manual recovery instead of building precise replay.
  changes_my_mind: If stuck jobs turn out to be frequent, pick B.

next_steps:
  heading: build only the chosen one
  A: Ship the warning and Cancel this week.
  B: Design the id and storage first, about a week.
  if_no_answer: Nothing changes; stuck jobs stay invisible.

attachments: [warning.png, flow.png]
```

One question, two real options, no unexplained labels, nothing to open elsewhere. (A reviewer would probably mark point 10 good to fix: the "Idle waits" row is green in both cells and separates nothing.) The binary turns this into today's JSON and markdown brief before encrypting.

## 6. Decided and open

Decided 29 Oct:
- **Quality is reviewed, not pattern-matched.** We write what good looks like; one subagent review grades each point ok / good to fix / must fix; one round; the writer chooses what to change; then send. `ask` refuses only mechanical problems. No warnings, no hold, no `--send-anyway`.
- **Notes are per decision, not guidance.** Not cached, not shown to other agents.
- **History on disk, never in context.**
- **`card.yaml` is the card** (decided 29 Oct): the whole card is structure, each key lands in one slot on the phone. See the page "One card, from card.yaml to the phone" (`pages/card-yaml.html`). The binary compiles it to today's JSON and markdown brief, so the phone is unchanged for now. Free-form briefs are gone; small decisions omit optional keys.

Open for Sam:
1. **"Defer" and "leave as is":** point 2 does not count them as padding, because leaving things alone is an outcome the agent carries out. Agree?
2. **Small decisions** omit `context.more`, the option stories, `tradeoffs` and `next_steps`; a reviewer should grade those good to fix at most on a small card. Say so in the reviewer instructions?
3. **Reminder threshold:** 2 hours or 5 cards. Tune after the first week.
4. **If the review misses padded options in practice**, back point 2 with a mechanical check? Decide with data, not now.
