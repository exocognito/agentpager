# Working in this repository

AgentPager brings an agent's decisions to its owner's phone. Its product contract is the Blueprint in `packages/blueprint/`.

Read down the ladder before you judge or change anything:
1. the strategy, `packages/blueprint/strategy/STRATEGY.md`;
2. the promises in `packages/blueprint/design/`: capabilities, invariants, metrics, dependencies and journeys;
3. the design code.

The roadmap, `packages/blueprint/roadmap/ROADMAP.md`, says what is next.

The Blueprint process lives in [exocognito/blueprint](https://github.com/exocognito/blueprint): start at [src/process/README.md](https://github.com/exocognito/blueprint/blob/main/src/process/README.md). The [law](https://github.com/exocognito/blueprint/blob/main/src/process/law.md) is the rulebook, and [files](https://github.com/exocognito/blueprint/blob/main/src/process/files.md) gives each file's shape.

- Work in an isolated worktree off `origin/main`, and preserve other agents' and the owner's edits.
- Open changes as draft pull requests. The owner merges.
- Install with pnpm. Use Node 22.19 or newer.
