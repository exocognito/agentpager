# AgentPager Blueprint

Start here. [PRODUCT.md](PRODUCT.md) says what AgentPager is for, as Sam approved it. Each area file holds the promises for one part of the product, and only what is built. The milestones say how it got here, and [METHOD.md](../METHOD.md) says how it is built.

**Reading a promise:** `### B25 · @M3 · Short promise` · numbered clauses are promises, each named by its id, such as B25.2, in the test that proves it · bullets are notes, not tested · `@M3` on a heading means since M3; `@M4:` at the start of a clause means M4 added it · the Blueprint on `main` describes dev.

## Milestones

| | Milestone | What it delivers |
| --- | --- | --- |
| ✅ | [M1 · APP](milestones/M1-app.md) | AgentPager on my iPhone |
| ✅ | [M2 · PAGERS](milestones/M2-pagers.md) | Pagers on my phone |
| ✅ | [M3 · COMMAND](milestones/M3-command.md) | The agentpager command |
| ✅ | [M4 · HOUSE](milestones/M4-house.md) | House in order: the Blueprint by area, a dev stage and the id check |
| 🔨 | [M5 · ENCRYPT](milestones/M5-encrypt.md) | Decisions the service can't read |
| ⏳ | [TIDY](milestones/next/TIDY.md) | Tidy state: one store per pager, lighter polls and the agent's lifecycle |
| ⏳ | [CLIENTS](milestones/next/CLIENTS.md) | The agent apps AgentPager supports |
| ⏳ | [INSTALL](milestones/next/INSTALL.md) | AgentPager installs in a minute |
| ⏳ | [SITE](milestones/next/SITE.md) | A front page for AgentPager as it is now |
| ⏳ | [OPEN](milestones/next/OPEN.md) | AgentPager in the open |
| ⏳ | [FRIENDS](milestones/next/FRIENDS.md) | AgentPager for people I invite |

✅ shipped · 🔨 building · ⏳ queued. One at a time, in this order. Prod runs the `m4` release (9849671) since 6 Nov.

## Areas

| # | Area | Holds | Ids |
| --- | --- | --- | --- |
| 1 | [Pagers](areas/1-pagers.md) | Making a pager and giving out its number, the Pagers and Pager screens, turning a pager off and on, and deleting it | B22 B23 B26 · I17 I24 · L9 L10 L25 |
| 2 | [Agents](areas/2-agents.md) | The agent's side, through the agentpager command: connecting as a new agent, waiting for the answer, acknowledging it, and the history on its machine | B25 B31 B32 B33 · I21 · L11 L12 L13 L14 L15 |
| 3 | [Cards](areas/3-cards.md) | What an agent writes and sends: `card.yaml`, the one review before sending, and the checks that refuse a broken card | B27 · I4 I22 · L16 |
| 4 | [Getting paged](areas/4-getting-paged.md) | Alerts when the app is closed, opening one to its decision, the badge, and the warning when no agent picks up an answer | B17 · L17 |
| 5 | [Answering](areas/5-answering.md) | Reading and answering a decision on the phone: options or changes, Send and Undo, and the closed record | B5 B6 B7 · I5 I6 I18 · L18 |
| 6 | [Privacy](areas/6-privacy.md) | What the service is and what it can see: the keys and the number's fingerprint that tie a pager to its phone, and how keys and the service's own secrets are kept | I19 I23 · L19 |
| 7 | [Getting started](areas/7-getting-started.md) | How someone new finds and sets up AgentPager: `/start` and setting up the command in agent apps | B18 B29 · L21 L22 L24 |

Limits (`L`) are what people meet today and the fix that waits; they start at L9. Lines not built yet wait in their milestone's doc, under [milestones/](milestones/).

Also: [TERMS.md](TERMS.md) · [JOURNEYS.md](JOURNEYS.md) (J3 J4 J5) · [DECISIONS.md](DECISIONS.md) · [milestones/](milestones/) · [generated/screens/](generated/screens/README.md): the app's own screens and journeys, made by `pnpm designs` · [generated/by-milestone.md](generated/by-milestone.md): what each milestone added · [generated/untested.md](generated/untested.md): the clauses no test names, and tests that name an unknown id. The id check, `pnpm blueprint`, writes these two; it reports and never blocks, and `pnpm check` fails only when they are stale.
