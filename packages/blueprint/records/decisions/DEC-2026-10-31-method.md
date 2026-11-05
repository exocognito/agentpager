---
id: DEC-2026-10-31-method
date: 2026-10-31
decidedBy: Sam
basis:
  - 'Sam in Claude Code, 2026-10-31, on how to change the Blueprint after comparing it with Atomic Pages: "Interrogate and propose a version of METHOD.md that combines the best of our Blueprint process and the atomic pages method - lets agree on this first"'
  - 'Sam in Claude Code, 2026-10-31, on the six questions in exocognito/agentpager PR #41: "all your recs look good", choosing 1a 2a 3a 4a 5a 6a'
---

# METHOD.md is how AgentPager is built

`METHOD.md`, at the root of the repository, replaces the Blueprint law and files spec in exocognito/blueprint as this repository's rulebook. It combines the rules of thumb, routing tables and proof rules of the Blueprint process with Atomic Pages' smaller Blueprint, tests named by id, limits and stages, and adds the rules for running milestones in parallel. `.agents/plans/2026-10-31-method.md` says where each rule came from and what was left out.

It takes effect when the Blueprint is converted to its format, the step after this one. Until then the Blueprint keeps its current files.

## Sam's answers

1. A capability is a heading with numbered clauses, such as `C26.4`, so every id is kept.
2. Every capability, clause, invariant, journey, metric and limit says `Since <milestone>`.
3. Prod deploys only a commit tagged after it was green on dev. `main` deploys to dev.
4. The strategy folds into `PRODUCT.md`. The vision and the pinned design decisions stay word for word; the rest becomes principles in Sam's words, and the SC, SI, SG and SP ids retire.
5. `METHOD.md` is written for any project that works this way, so Atomic Pages could adopt it. AGENTS.md holds what is specific to AgentPager.
6. Sam gives the root session the go for a milestone, and it merges that milestone's reviewed pull requests. Otherwise Sam merges.

## What else changes

- The Blueprint holds only what's built, plus what a running milestone has designed. A promise not built yet leaves its line and becomes a planned line in its milestone doc, or a limit where people meet the gap today.
- Each promise has a test named by its id, and `pnpm check` enforces it.
- The lessons L1 to L8 retire into decisions, so limits start at L9.

## Supersedes

- [DEC-2026-10-30-v2-promises](DEC-2026-10-30-v2-promises.md), in part: promises not built yet no longer stay in place tagged "*Not built yet*". Everything else it decided stands.
