# Blueprint update plan for v2 (draft 1, 29 Oct 2026)

> **Status note (30 Oct):** deferred until v2 is on Sam's phone (after Stage 1 at the earliest, before Stage 4). It also predates three decisions, so when it's picked up: drop C28 (owner's notes reaching agents) and J6; SI11 and C27 describe a subagent review against "what good looks like", not mechanical content checks, and there is no `check()` beyond the mechanical refusals; the card is `card.yaml` (02-writing-rules.md §2), compiled by the binary to the brief JSON, so the brief schema becomes the wire format rather than what agents write.

What changes in `packages/blueprint`. Written as a file list so the update is a PR with a known shape, not a rewrite. Done in a fresh worktree off `origin/main` as a draft PR.

## Strategy (`strategy/STRATEGY.md`)

- **Vision**: unchanged.
- **SC1** rewrite: pagers (many per phone, on/off) and agents replace "one agent and one phone per pager"; numbers only, the link/QR paragraph goes; the binary is how agents connect; decisions grouped by project with who asked.
- **SC2**: unchanged in substance; add that the alert shows the real question even though it travels encrypted.
- **SI2** rewrite: "Only agents I let in reach my phone" now means: a pager number is an address I hand to agents I trust; I can switch any pager off and nothing from it gets through; a leaked number is a pager I turn off and replace. Drop the link/emoji/tries sentences.
- **SI5** rewrite: a pager turns off when I turn it off or at the time I set; an agent lasts until it finishes or I end it; decisions stay on my phone while a pager is off; when I delete a pager its decisions are deleted from the service.
- **New SI10 · The service can't read my decisions**: cards, attachments, answers and acknowledgements are encrypted on my agent's machine and my phone; the service carries bytes and metadata; the pager number binds the phone's key so the service can't swap it.
- **New SI11 · A card is reviewed before it's sent**: the agent's tool gives the card and a description of a good card to a reviewer; the writer fixes what must be fixed; a card that is structurally broken is refused with the reason.
- **SG3** (paid value) and **SI9** (research/Pro): delete. **SP5** rewrite: "Reach the agents owners actually use" now means anything that can run the binary: terminals, desktop apps, cloud sessions; browser-only agents are out. **SP2**: replace "one agent and one phone per pager" with the pager/agent model; keep "native phone app".
- **SP1**: add the "options are different ways to get the job done" principle and that Ask for changes is the fallback, never an option.
- Strategic Design Decisions: add numbers-only, the binary as the single home for the rules, encryption-first, no Settings screen, `card.yaml` as the card.

## Terms (`design/terms.md`)

Rewrite the table: Pager (the phone's, with a number, active or off, auto-off), Agent (replaces "session"; who asked; project), Decision, Number (format with fingerprint), Agent id, Card (`card.yaml` and its keys), Review, Preview (push), the binary. Remove: AgentPager link, pairing code, palette, pairing window, end time, end reason (replaced by off and auto-off), Agents list, Agent screen (replaced by Pagers, Pager screen, Pager detail).

## Capabilities (`design/capabilities/`)

| Action | Files |
|---|---|
| Delete | C1 pair by QR, C20 connect with a link, C21 pair by entering the code, C24 camera opens the app, C2 agent starts from one URL (replaced by the binary), C3 start from the front page (web app history), C4 resume or end a session, C8 home lists this browser's sessions, C9 connect an agent from the phone |
| Rewrite | C25 page by pager number → "C25 connect with a pager number" (binary, fingerprint check, new-agent reply); C22 change or end a pager → "C22 switch a pager off and on, set when it turns off, delete it"; C23 agents list → "C23 pagers and the pager screen" (grouped by project, who asked, N answered); C5 review and answer cards (full screen, bottom sheets, Options heading); C7 revisit decisions (the closed record, no bubbles); C17 get paged (encrypted preview, extension); C18 website points to the app (install line, what we store) |
| New | C26 make a pager on the phone (name, turns off, the copied instructions); C27 the agent's tool reviews a card before sending (`review`, mechanical refusals in `ask`); C29 install the binary with one line, which sets up Claude and Codex; C30 decisions are encrypted end to end; C31 the binary keeps a history of decisions on the agent's machine |
| Keep | C6 send feedback (Ask for changes), C19 try a demo agent |

## Invariants (`design/invariants/`)

| Action | Files |
|---|---|
| Delete | I1 first phone keeps the session, I2 expired sessions refuse and forget (replaced), I16 one agent one phone |
| Rewrite | I17 ended pagers refuse and forget → "I17 an off pager delivers nothing and queues nothing; a deleted pager is forgotten by the service" |
| Keep | I3 independent decisions, I4 payloads refused whole (now in the binary for cards, server for envelopes), I5 answers never change, I6 send and acknowledgement, I18 independent cards |
| New | I19 the number binds the phone's key (fingerprint check); I20 the service never holds a readable card, answer or acknowledgement; I21 every agent is a new entry on the phone unless it reuses its id; I22 a structurally broken card is never sent |

## Journeys (`design/journeys/`)

J1/J2 (web sessions) delete. J3 happy pager and J4 longest pager rewrite around: make a pager → paste the line → agent connects → review → card → answer → ack; longest adds off/on, auto-off, a note, two agents on one project, a compaction and the contract reminder, delete.  J5 paged while away: keep, add the encrypted preview.

## Dependencies (`design/dependencies/`)

D1 Cloudflare: unchanged. D2 agent clients: rewrite around the binary (which harnesses, how `setup` configures each, the cloud-session case as untested). The root `recipe.json` (the cleanroom run's cold-arrival commands) still configures the retired `https://agentpager.me/mcp` and v1 tools; rewrite it with D2, or retire it if cleanroom runs end. D3 owner browser: delete. D6 iPhone app: add the App Group, the notification extension, the Settings bundle, TestFlight. D7 Apple Developer Program: unchanged. New D8: Bun.

## Schemas, machines, UI

- `design/schemas/exchange.ts`, `values.ts`: numbers, pagers, agents, envelopes; drop pairing. Add the `card.yaml` schema; the brief schema (`ui/components/cards/brief/schema.ts`) stays as the wire format the binary compiles to.
- `design/machines/`: `home.ts` → pagers/pager/detail; `cards.ts`: the decision screen with sheets; off state.
- `design/ui/ios/*`: these Storybook copies of the iOS screens are already an exception (DEC-2026-10-27-swift-app-is-the-brief-design says the Swift app is the brief's design and UI-test screenshots are the record). Extend that decision to the whole app: delete the ios stories, make the UI tests' screenshots the canonical mocks, checked into `design/ui/ios/screenshots/` per screen state, regenerated by a script. `docs/v2/mocks/` is the brief for those screens until the screenshots exist.
- `design/ui/screens/StartScreen*`, `ClaimScreen*`, `HomeScreen*`, `CardScreen*` (web app): delete. `MarketingScreen*`: keep for the marketing page work.

## Roadmap and records

- `roadmap/ROADMAP.md`: MAPP done; replace MSHIP with the four stages from `05-readiness-review-and-stages.md` as milestones M1–M4, keeping MSHIP's deliverables inside M4.
- `roadmap/parked/`: delete MACCOUNT, MPRORESEARCH and their C10–C12, D4, D5, I7, I8 (no paid tier, no accounts for now). Keep MCARDS as history.
- `records/decisions/`: new DEC-2026-10-29 records for: pagers and agents (glossary), numbers only, encryption first, the binary as the rules' home, review over checks, `card.yaml`, notes are answers not guidance, no Settings screen, screenshots as the design record. Each cites `docs/v2/01-decisions.md` and the mocks.
- `records/lessons/`: one lesson from 28–29 Oct: rules read once at connect don't survive a night; the rules must arrive at write time, and the review has to happen where the writer is.

## Order inside the PR

1. Terms and strategy (so every other file has words to use).
2. Decisions records.
3. Capabilities and invariants.
4. Journeys, dependencies.
5. Schemas.
6. Roadmap.
7. UI: remove web screens and ios stories; add the screenshot script and folder.

`pnpm check` and `pnpm test:unit` must pass at each step; the storybook tests will shrink as screens go.
