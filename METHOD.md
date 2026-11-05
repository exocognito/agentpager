# Method

How a product is built here: one owner, agents doing the work, milestone by milestone, working product to working product. This file is meant to be the same in every project that works this way. AGENTS.md holds what is specific to one project: the owner, where its Blueprint lives, its stages and commands, its layers and their views, how to reach the owner, and who owns which shared files.

## Rules of thumb

- **Write down only what the owner would reject.** A fact belongs in the Blueprint when the owner would reject a fresh agent choosing differently. Everything else, agents choose.
- **One home per fact.** Each fact lives in one place, and everything else links to it.
- **Higher wins.** PRODUCT.md outranks the Blueprint's lines, which outrank the design in code, which outranks tests and views. When two disagree, the higher one is right and the lower one is fixed. Ask the owner only when two at the same level disagree, or the higher one is silent.
- **A fresh agent has enough.** The repo is enough to build and judge the product. An agent never invents intent the owner didn't give: it states its assumption, carries on, and reports the gap.
- **Hold each promise as early as the stack allows**: a type the compiler checks, then a schema, constraint or machine that refuses at run time, then a test.
- **Don't add process** (review rounds, formal models, automation) unless the owner asks.

## Where things live

The Blueprint is a folder; AGENTS.md says where.

| Path | Holds | Lifetime |
| --- | --- | --- |
| `PRODUCT.md` | Vision, principles, pinned design decisions, stack, the milestone table, and the unnumbered roadmap | Living |
| `TERMS.md` | Words with a specific meaning in this product; short | Always true |
| `behaviors/<area>.md` | Capabilities `Cx`, each with numbered clauses, filed by product area | Always true |
| `INVARIANTS.md` | Invariants `Ix`, each with numbered clauses, that hold in every milestone | Always true |
| `JOURNEYS.md` | Journeys `Jx`: end-to-end walks, each listing the ids it covers | Always true |
| `METRICS.md` | Metrics `Kx`: measurable bars | Always true |
| `LIMITS.md` | Limits `Lx`: problems people meet that the owner chose not to fix yet | Always true |
| `DECISIONS.md` | Decisions and why, with the owner's words as their basis | Append only |
| `generated/` | Views of the code, one per layer, plus walks. Written by the review command; never edited by hand | Always true; the check fails if stale |
| `milestones/<id>.md` | One milestone: what it adds, changes and retires, its open questions and its log; a folder instead when it has agreed artboards in `ui/` | History once done |

**Always true** means as built, plus what a running milestone has designed (its lines say `Since` that milestone). Never the unplanned roadmap: a later idea is one roadmap line until a milestone takes it. The Blueprint without `milestones/` is enough to build the product again; the milestones say how it came to be.

## One home per fact

- **Promises** are capability clauses, invariant clauses, journeys and metrics. Every live one has a test named by its id. A decision is context, a limit is accepted debt, and TERMS is the vocabulary.
- **What a person sees and what must hold**: Blueprint lines. **Choices and why**: DECISIONS.md. A decision is never the rule; what it decides lives as a line, a METHOD rule or code, and the decision names that home.
- **Structure** (states and transitions, messages, what each state shows, what is stored and how it grows, infrastructure): code only. Where code can't say it, a comment beside the code does, such as what a table holds and when it is written. Review structure through `generated/`.
- **Milestone docs** link to lines and views and never restate them.
- **A specific in a line is a requirement.** Naming a control, a colour or a mechanism rules out better ones. State the outcome unless the owner means the specific.
- **Design in code**:
  - State that outlives one request or one render is a machine's state or a stored row, so a view can show it.
  - The wire contract is one schema module that every side in its language imports, never a copy. A side in another language mirrors it, and a test checks the mirror against it. What crosses a boundary is decoded before use.
  - A step with a side effect, a failure, a wait or a clock declares its errors, takes what it needs as something a test can swap, and reads time from a clock a test can move.
- **New UI** is explored on a design canvas before code exists, starting from the screens as built; agreed artboards are copied into the milestone's `ui/`. Once built, the product's own screens, in `generated/`, are the record.

## Ids

- `Cx` capability, with clauses `Cx.n`; `Ix` invariant, with clauses `Ix.n`; `Jx` journey; `Kx` metric; `Lx` limit.
- Decisions are `DEC-YYYY-MM-DD-slug`. Milestones are named, `M` and a word, such as `MPAGERS`.
- Every capability, clause, invariant, journey, metric and limit says `Since <milestone>`: the milestone it was born in.
- Never reuse or renumber an id. Ids don't change when files move.

## Writing lines

- **One line per item**, in plain words: what a person sees, or what must hold. No implementation. Add `why:` only when the code can't tell you.
- **A capability** is a heading, `## Cx · Name`, then `Since M…` and one sentence saying what a person can do, then numbered clauses. Each clause is one checkable statement. A "never" is a clause too.
- **An invariant** is the same, ending with one `Why:` line in the owner's words.
- **A journey** is one line of steps joined by arrows, then the ids it covers.
- **A metric** is its bar, plus where and how it is measured.
- **A limit** says what people meet, why it waits, what would fix it, and when to revisit.
- **Words**: use TERMS.md's words and no synonyms. A new concept gets a TERMS entry before any line, decision or code comment uses it.
- **Format**: lists over paragraphs. No hard line wraps in any markdown file. Follow the project's writing practices (AGENTS.md).

## When things get written

- A roadmap item becomes a milestone when the owner commits to it: it gets its name and a row in the milestone table. Until then it is one roadmap line.
- Lines are written only while designing a running milestone, and cite only milestones in the table.
- Milestones run one at a time unless the owner orders several together: rows that share an order number run in parallel. A queued milestone stays one row.

## Changing intent

- Only the owner adds, changes or retires lines and terms. Agents propose them as numbered questions, and write them once approved.
- Rewording that keeps the meaning: edit in place.
- The same promise, widened or narrowed: edit in place, keep its id, and quote the old line under Changes in the milestone doc.
- A promise that no longer holds: delete it, quote it under Retires, and make sure no test names it.
- An invariant grows by a new clause with its own `Since`.
- Each approval is a decision whose basis quotes the owner's words and says where they said them.

## Decisions

- `DECISIONS.md` is append only. Each entry gives its id, who decided, the basis, what was decided, why, and `serves:`, the lines, METHOD rules or code it is context for.
- A reversed or narrowed decision gets a new entry. The only edit an old entry takes is `→ DEC-…` naming its replacement.

## Known limits

- A limit is a problem people using the product will meet, which the owner chose not to fix yet.
- A gap only in what a test shows is a comment beside that test, not a limit.
- A finding with a small fix is fixed now. For any other finding, the owner chooses in a numbered question: fix it now, or write it down as a limit.
- When a milestone fixes a limit, delete its line and quote it under Retires.

## When something is wrong

Ask whether the owner would care if a fresh agent built it differently next time.

| Answer | Fix |
| --- | --- |
| No: it was built wrong against what is written | Fix the code or its tests. The Blueprint doesn't change. |
| Yes, and it is about how it looks or flows | Fix the design: the artboard, or the screen in code. |
| Yes, and it must hold however it is built | Propose a line or a change to one; once approved, the code follows. |
| Yes, and it changes what the product is for | The owner changes PRODUCT.md, then the lines below it. |

Never fix a miss the owner cares about with a test alone. A test follows from a line.

## Tests

- **Naming.** Every live clause, journey and metric has a test whose name starts with its id, such as `C26.4 Create registers the pager`, unless it is on the untested list below. Where a language allows no dot or space in a test's name, the id is written with underscores, such as Swift's `test_C26_4_createRegistersThePager`. No test names a retired or unknown id.
- **The untested list.** A live line with no test yet is named in the id check's untested list, which the owner sees at each walk. The list only shrinks: each entry gets a test, or the owner retires the line.
- **The id check** fails on a live line that has neither a test nor a place on the untested list, on a listed line that has a test or is retired, and on a test that names a retired or unknown id.
- **Proof is real.** Acceptance tests run on the real product: real storage, real endpoints, each stage. A unit test may fake the clock or inject a fault, never the thing it claims to prove. A test that proves a promise by waiting is a finding.
- **Done.** A milestone is done when every test, earlier milestones' included, passes locally, on dev and, after release, on prod.
- **Retries.** A run is green only when its command exits 0. On dev and prod, a failed test runs once more, and one that fails twice fails the run. Local runs never retry.
- **Reports.** Report results from the run's own summary or results file (passed, failed, flaky and skipped counts), never from filtered output.

## Stages and releases

- Three stages, named for where they run: local, dev and prod. Each has its own data, and dev says it is dev. AGENTS.md has their addresses and commands.
- `main` deploys to dev after each merge. Prod deploys only a commit tagged as green on dev: a milestone tag, or a fix tag between milestones.
- A release deploys the service before the clients that depend on it, in the order AGENTS.md gives.
- A release never loses data. What the previous release stored on dev still opens after the new one deploys there. A client from the previous release either keeps working or is told plainly to update.
- Only the root session deploys.

## Pull requests and review

- **Every change is a pull request** from its own worktree off `main`, reviewed at the depth its risk warrants (the `pr-adversarial-review` skill):
  - a sanity check by default;
  - the adversarial loop when a failure could cross a trust boundary, lose stored data, break deploys or break the public contract.
- **The reviewer** is a fresh sibling session from another model family, never a subagent of the session whose work it checks. It reads the repo and the results files itself, not the doer's report. It checks that:
  - the report matches the results;
  - every id the change touched has a passing test;
  - the views are current, and nothing in them is unexplained;
  - every finding is fixed or raised as a question;
  - no line changed without the owner's approval;
  - the code does what the lines say.

  Its verdict is quoted in full on the pull request.
- **Before a release**, a reviewer reads the whole Blueprint and the views as a newcomer, with no commit range. It reports:
  - lines that contradict each other or the code;
  - limits and terms that no longer hold;
  - promises that only a decision, comment or constant makes;
  - state that no view shows.
- **Merging.** The owner merges, or gives the root the go for a milestone's pull requests.

## The milestone loop

1. **Plan.** Walk the owner through what the milestone's row commits to, the decisions and limits that bind it, and its open questions. Write the milestone doc with status planning:
   - its objective, in the owner's words;
   - what's out of scope, only where a builder would wrongly assume it's in;
   - **Owner decides first**: numbered questions, each with options and ★ on the recommendation;
   - the ids it adds, changes and retires.

   Shape it so it delivers at least one new piece of value through every layer it touches, and takes on at most one new kind of complexity.
2. **Design.** Agree lines and terms with the owner. New UI goes on the canvas first. Machines, schemas, storage and tests go in code.
3. **Build until green.** Set the status to building. When something fails, decide whether the design or the code is wrong. If it's the design, fix the design first and note it in the log.
4. **Green on dev.** Deploy and run every test there, including the upgrade check from the last release.
5. **Review.** Regenerate the views. The milestone isn't ready while a part it touches has no view, or while the walks show something nobody can explain. The reviewer checks.
6. **Walk.** The owner uses it on dev and reads the review page, which renders the Blueprint and the views together.
7. **Release.** Tag the commit that was green on dev, deploy prod, and run the tests there. Open one real thing that existed before the release. Mark the milestone done and log it. Record this release's upgrade baseline before the next milestone's code reaches dev.

## Sessions

- **The root** is one long-lived session that owns PRODUCT.md, the milestone table, merges, deploys and releases. It is the owner's main contact.
- **Leads.** When milestones run in parallel, the root starts a lead for each, in its own worktree and its own pane. A lead runs steps 1 to 5 for its milestone; the root runs 6 and 7 with the owner. One milestone runs in the root's own session.
- **Writers and shared files.**
  - Each worktree has one writer.
  - A file that several milestones touch has one owner, named in AGENTS.md. A lead that needs another lead's file asks the root.
  - The root sequences merges that touch the same file.
- **Reports.** Every build step ends with a report:
  - what's done;
  - test counts from each run's results file;
  - what to look at in `generated/`;
  - each finding, fixed or raised as a question;
  - anything that would change a line.
- **Questions to the owner** are numbered, each with options and ★ on the recommendation, so the owner can answer "1a 2b". When the owner is away, page them the way AGENTS.md says, one decision per card, recommendation first.
- **Logs are short.** A milestone's log gets a few lines per step: what changed, the test counts, the pull request. The evidence stays in the pull request and the results files.

## Don't

- Detail a milestone before it runs.
- Put plans or design notes at the top of the Blueprint. They belong in the milestone doc or `.agents/plans/`.
- Build to what the Blueprint retired.
