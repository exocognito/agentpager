# Working in this repository

AgentPager brings an agent's decisions to its owner's phone. Its product contract is the Blueprint in `packages/blueprint/`.

Read down the ladder before you judge or change anything:
1. the strategy, `packages/blueprint/strategy/STRATEGY.md`;
2. the promises in `packages/blueprint/design/`: capabilities, invariants, metrics, dependencies and journeys;
3. the design code, and the design catalogue in `packages/blueprint/design/screens/`: the real app's screens and journeys as images and text, to read without a Simulator.

The roadmap, `packages/blueprint/roadmap/ROADMAP.md`, says what is next.

**Current state (31 Oct 2026).** v2 is live: the owner makes pagers on the phone, and agents connect with a pager number through the `agentpager` binary. The Blueprint describes v2: its strategy, terms, capabilities, invariants, journeys and roadmap (`DEC-2026-10-30-v2-promises`). A promise that isn't built yet says "Not built yet"; don't take it as shipped. `docs/v2/` holds the decisions behind it, and `docs/v2/03-binary-surface.md` is what agents see. The phone's design is the SwiftUI app; the catalogue shows each of its screens (`DEC-2026-10-30-screens-from-the-app`). One part still shows v1: the front page's copy. Don't build to what v2 retired: link, QR and emoji pairing, sessions with end times, emoji cards, the web app, the hosted MCP and `recipe.json`.

**M4 HOUSE (from 5 Nov 2026).** M4 HOUSE is moving the Blueprint to `blueprint/`, in the area shape that the amended [METHOD.md](METHOD.md) describes. Its doc is [blueprint/milestones/M4-house.md](blueprint/milestones/M4-house.md), and its plan is `.agents/plans/2026-11-05-m4-house.md`. Until the conversion pull request merges, `packages/blueprint/` is still the contract.

The Blueprint process lives in [exocognito/blueprint](https://github.com/exocognito/blueprint): start at [src/process/README.md](https://github.com/exocognito/blueprint/blob/main/src/process/README.md). The [law](https://github.com/exocognito/blueprint/blob/main/src/process/law.md) is the rulebook, and [files](https://github.com/exocognito/blueprint/blob/main/src/process/files.md) gives each file's shape. [METHOD.md](METHOD.md) replaces them once the Blueprint is converted to its format (`DEC-2026-10-31-method`); until then the Blueprint keeps its current files.

- Work in an isolated worktree off `origin/main`, and preserve other agents' and the owner's edits.
- Open changes as draft pull requests. The owner merges.
- Install with pnpm. Use Node 22.19 or newer.
- Before handing off a change, run `pnpm check` and `pnpm test:all`, which runs every suite: the design, the server and the binary. `pnpm check` fails when the iPhone app, its UI tests, the brief fixtures, the wire contract or the front page changed without `pnpm designs`, which remakes the catalogue on a Mac with Xcode.
