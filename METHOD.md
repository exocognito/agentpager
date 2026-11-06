# Method

How a product is built here: one owner, agents doing the work, one milestone at a time, working product to working product. This file is meant to be the same in every project that works this way. AGENTS.md holds what is specific to one project: the owner, where its Blueprint lives, its layers, its stages, deploy order and commands, and how to reach the owner.

## Rules of thumb

- **Write down only what the owner would reject.** A fact belongs in the Blueprint when the owner would reject a fresh agent choosing differently. Everything else, agents choose.
- **One home per fact.** Each fact lives in one place, and everything else links to it.
- **Higher wins.** PRODUCT.md outranks the Blueprint's lines, which outrank the design in code, which outranks tests and `generated/`. When two disagree, the higher one is right and the lower one is fixed. Ask the owner only when two at the same level disagree, or the higher one is silent.
- **A fresh agent has enough.** The repo is enough to build and judge the product. An agent never invents intent the owner didn't give: it states its assumption, carries on, and reports the gap.
- **Hold each promise as early as the stack allows**: a type the compiler checks, then a schema, constraint or machine that refuses at run time, then a test.
- **Don't add process** (review rounds, formal models, automation) unless the owner asks. Build only the checks the owner will look at.

## Where things live

The Blueprint is a folder; AGENTS.md says where.

| Path | Holds | Lifetime |
| --- | --- | --- |
| `README.md` | Start here: the milestone table (✅ shipped, 🔨 running, ⏳ queued) and the areas | Living |
| `PRODUCT.md` | Vision, principles, pinned design decisions, stack and the unnumbered roadmap, in the owner's words | Living |
| `TERMS.md` | Words with a specific meaning in this product; short | Always true |
| `areas/<n>-<name>.md` | One product area: its behaviors `Bx`, invariants `Ix`, metrics `Kx` and limits `Lx` | Always true |
| `JOURNEYS.md` | Journeys `Jx`: end-to-end walks across areas | Always true |
| `DECISIONS.md` | Decisions that bind beyond one milestone, with the owner's words as their basis | Append only |
| `milestones/M<n>-<word>.md` | A started milestone: what it adds, changes and retires, its answers and its log; a folder when it holds more, such as agreed artboards in `ui/` | History once done |
| `milestones/next/<WORD>.md` | A queued milestone, under its word: its objective, questions and notes | Until it starts |
| `generated/` | The screens catalogue, what each milestone added, and the untested list; never edited by hand | Always true; the check fails if stale |

**Always true** means as built: what has shipped, plus what the running milestone has built on dev. Never the unplanned roadmap. The Blueprint without `milestones/` is enough to build the product again; the milestones say how it came to be.

## One home per fact

- **Promises** are the numbered clauses of behaviors, invariants, journeys and metrics. A decision is context, a limit is accepted debt, and TERMS is the vocabulary.
- **What a person sees and what must hold**: Blueprint lines. **Choices and why**: the milestone doc, or DECISIONS.md. A decision is never the rule; what it decides lives as a line, a METHOD rule or code, and the decision names that home.
- **Structure** (states and transitions, messages, what each state shows, what is stored and how it grows, infrastructure): code only. Where code can't say it, a comment beside the code does, such as what a table holds and when it is written.
- **Milestone docs** link to lines and never restate them.
- **Outcomes, not wording.** A specific in a line is a requirement: naming a control, a colour, a mechanism, an exact message, path, timing or flag rules out better ones. State the outcome. Specifics live in code and tests, unless the owner means them.
- **Design in code**:
  - State that outlives one request or one render is a machine's state or a stored row, so a test can see it.
  - The wire contract is one schema module that every side in its language imports, never a copy. A side in another language mirrors it, and a test checks the mirror against it. What crosses a boundary is decoded before use.
  - A step with a side effect, a failure, a wait or a clock declares its errors, takes what it needs as something a test can swap, and reads time from a clock a test can move.
- **New UI** is explored on a design canvas before code exists, starting from the screens as built; agreed artboards are copied into the milestone's `ui/`. Once built, the product's own screens, in `generated/`, are the record.

## Ids

- `Bx` behavior, `Ix` invariant, `Jx` journey, `Kx` metric and `Lx` limit, with clauses such as `B25.3`. No dependency ids; an area's header names what it relies on.
- Never reuse or renumber an id: `B25` keeps the old `C25`'s number, and limits start at `L9`, after the retired lessons. Ids don't change when files move.
- `@M<n>` on a heading is the milestone its item was born in. A clause starts with `@M<n>:` only when a later milestone added it.
- A milestone is numbered when it starts and keeps its word: `M5 · ENCRYPT`, written `@M5`. A queued one has only its word.
- Decisions are `DEC-YYYY-MM-DD-slug`.

## Writing lines

- **One shape for every item**: a heading, `### <id> · @M<n> · <short promise>`, then a `Why:` only when the code can't tell you, then numbered clauses and bulleted notes. Notes aren't tested.
- **A clause** is one checkable statement in plain words: what a person sees, or what must hold. No implementation. A "never" is a clause too.
- **An area file** opens with a header: Definition, Serves (PRODUCT.md's phrases, quoted), Relies on, Code, Screens and Walked by. Then `## Behaviors`, `## Invariants`, `## Metrics` and `## Limits`, when not empty.
- **An invariant** always has a `Why:`, in the owner's words.
- **A journey's** clauses are its steps; an `Areas:` note names the areas they walk.
- **A metric's** clauses give its bar, and where and how it is measured.
- **A limit** has only notes: what people meet, why it waits, what would fix it, and when to revisit.
- **Words**: use TERMS.md's words and no synonyms. A new concept gets a TERMS entry before any line, decision or code comment uses it.
- **Format**: lists over paragraphs. No hard line wraps in any markdown file. Follow the project's writing practices (AGENTS.md).

## When things get written

- A roadmap item becomes a milestone when the owner commits to it: it gets a row in the milestone table and a doc in `milestones/next/`. Until then it is one roadmap line.
- Milestones run one at a time, always. When one starts, its doc moves out of `next/`.
- Lines are written only by the running milestone, and cite only milestones in the table. A line reaches its area file with the code that makes it true; until then it waits in the milestone doc.

## Changing intent

- Only the owner adds, changes or retires lines and terms. Agents propose them as numbered questions, and write them once approved.
- Rewording that keeps the meaning: edit in place.
- The same promise, widened or narrowed: edit in place, keep its id, and quote the old line under Changes in the milestone doc.
- A promise that no longer holds: delete it, quote it under Retires, and make sure no test names it.
- Each approval goes in the milestone doc, quoting the owner's words and where they said them.

## Decisions

- A decision goes in `DECISIONS.md` only when it binds later milestones; other answers stay in the milestone doc.
- `DECISIONS.md` is append only. Each entry gives its id, who decided, the basis, what was decided, why, and `serves:`, the lines, METHOD rules or code it is context for.
- A reversed or narrowed decision gets a new entry. The only edit an old entry takes is `→ DEC-…` naming its replacement.

## History

- Git holds history; the tree holds only what is true now. Once what is still true in a file has moved, the file is deleted.
- Tag the commit before a large removal.
- Findings that outlive a milestone, such as a lab run, go in `docs/research/<date>-<slug>.md`.

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

- **Naming.** A test is named by the id it proves when it is written or a milestone touches it, such as `B26.4 Create registers the pager`. Where a language allows no dot or space in a test's name, the id is written with underscores, such as Swift's `test_B26_4_createRegistersThePager`. No test names a retired or unknown id.
- **The id check** reads the Blueprint and the ids the tests name, in a test's name or a comment, and writes what each milestone added and the untested list: clauses no test names, and tests naming a retired or unknown id. It reports and never blocks: the check fails only when what it writes is stale. The owner reads it at each walk.
- **Proof is real.** Acceptance tests run on the real product: real storage, real endpoints. A unit test may fake the clock or inject a fault, never the thing it claims to prove. A test that proves a promise by waiting is a finding.
- **Done.** A milestone is done when every suite passes locally, earlier milestones' tests included, and the smoke run passes on dev and, after release, on prod.
- **Retries.** A run is green only when its command exits 0. A smoke run on dev or prod retries a failed step once; local runs never retry.
- **Reports.** Report results from the run's own summary or results file (passed, failed, flaky and skipped counts), never from filtered output.

## Stages and releases

- Three stages, named for where they run: local, dev and prod. Each has its own data, and dev says it is dev. AGENTS.md has their addresses and commands.
- The Blueprint on `main` describes dev: after each merge, the root deploys `main` there and runs the smoke run. The full suites run locally.
- Prod, and the client builds used with it, run only a commit tagged as green on dev: a milestone tag, or a fix tag between milestones.
- A release deploys the service before the clients that depend on it, in the order AGENTS.md gives.
- A release never loses data. What the previous release stored on dev still opens after the new one deploys there. A client from the previous release either keeps working or is told plainly to update.

## Pull requests and review

- **Every change is a pull request** from its own worktree off `main`, reviewed at the depth its risk warrants (the `pr-adversarial-review` skill):
  - a sanity check by default;
  - the adversarial loop when a failure could cross a trust boundary, lose stored data, break deploys or break the public contract.
- **The reviewer** is a fresh sibling session from another model family, never a subagent of the session whose work it checks. It reads the repo and the results files itself, not the doer's report. It checks that:
  - the report matches the results;
  - every id the change touched has a passing test;
  - every finding is fixed or raised as a question;
  - no line changed without the owner's approval;
  - the code does what the lines say.

  Its verdict is quoted in full on the pull request.
- **Before a release**, a reviewer reads the whole Blueprint as a newcomer, with no commit range. It reports:
  - lines that contradict each other or the code;
  - limits and terms that no longer hold;
  - promises that only a decision, comment or constant makes.
- **Merging.** The owner merges, or gives the root the go for a milestone's pull requests.

## The milestone loop

1. **Plan.** Walk the owner through what the milestone's row commits to, the decisions and limits that bind it, and its open questions. Write its doc with status planning:
   - its objective, in the owner's words;
   - its slice: a table of what it delivers in each layer;
   - what's out of scope, only where a builder would wrongly assume it's in;
   - **Owner decides first**: its numbered questions;
   - the ids it adds, changes and retires.

   Shape it so it delivers at least one new piece of value through every layer it touches, and takes on at most one new kind of complexity.
2. **Design.** Agree lines and terms with the owner. New UI goes on the canvas first. Machines, schemas, storage and tests go in code.
3. **Build until green.** Set the status to building. When something fails, decide whether the design or the code is wrong. If it's the design, fix the design first and note it in the log.
4. **Green on dev.** Deploy to dev and run the smoke run there, including the upgrade check from the last release.
5. **Review.** Regenerate `generated/`. The reviewer checks.
6. **Walk.** The owner uses it on dev, and reads the Blueprint and `generated/` in their markdown viewer.
7. **Release.** Tag the commit that was green on dev, deploy prod and the client builds from that tag, and run the smoke run on prod. Open one real thing that existed before the release. Mark the milestone done and log it. Record this release's upgrade baseline before the next milestone's code reaches dev.

## Sessions

- **The root** is one long-lived session that owns PRODUCT.md, the milestone table, merges, deploys and releases. It is the owner's main contact. It runs the milestone, with one subagent per pull request, each in its own worktree.
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
