# Working in this repository

AgentPager brings an agent's decisions to its owner's phone. Its product contract is the Blueprint in `packages/blueprint/`.

Read down the ladder before you judge or change anything:
1. the strategy, `packages/blueprint/strategy/STRATEGY.md`;
2. the promises in `packages/blueprint/design/`: capabilities, invariants, metrics, dependencies and journeys;
3. the design code.

The roadmap, `packages/blueprint/roadmap/ROADMAP.md`, says what is next.

**Current state (30 Oct 2026).** v2 is live: the owner makes pagers on the phone, and agents connect with a pager number through the `agentpager` binary. Start with `docs/v2/01-decisions.md`; `docs/v2/03-binary-surface.md` is what agents see. The Blueprint hasn't caught up yet; its update is planned in `docs/v2/06-blueprint-update-plan.md`. Until that lands, where the Blueprint and `docs/v2` disagree, `docs/v2` and the code on `main` win. Don't build to what v2 retired: link, QR and emoji pairing, sessions with end times, the web app and the hosted MCP. That covers capabilities C1–C4, C8, C9, C20, C21 and C24; invariants I1, I2 and I16; journeys J1 and J2; dependency D3; and `recipe.json`. The 06 plan lists what is kept and what is rewritten.

The Blueprint process lives in [exocognito/blueprint](https://github.com/exocognito/blueprint): start at [src/process/README.md](https://github.com/exocognito/blueprint/blob/main/src/process/README.md). The [law](https://github.com/exocognito/blueprint/blob/main/src/process/law.md) is the rulebook, and [files](https://github.com/exocognito/blueprint/blob/main/src/process/files.md) gives each file's shape.

- Work in an isolated worktree off `origin/main`, and preserve other agents' and the owner's edits.
- Open changes as draft pull requests. The owner merges.
- Install with pnpm. Use Node 22.19 or newer.
- Before handing off a change, run `pnpm check` and `pnpm test:all`, which runs every suite: the design, the stories, the server and the binary.
