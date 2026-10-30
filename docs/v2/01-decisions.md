# AgentPager v2: decisions so far (29 Oct 2026)

From Sam's review of the 28–29 Oct overnight run, the instruction-flow proposal, the voice call afterwards, his review of the "AgentPager v2 Screens" canvas, and the readiness review (`05-readiness-review-and-stages.md`). Status: decided unless marked open.

## Goal
Improve the system for Sam, then make it easy for ~10 friends and colleagues to install, use and give feedback. Open source, no paid tier.

## Scope
- Supported agents: anything that can run the binary: terminals (Claude Code, Codex, pi, Cursor…), desktop apps (Claude Desktop, Codex app) and cloud/VM sessions.
- Out of scope for the rollout: agents with no machine of their own (claude.ai in the browser), because they can't do end-to-end encryption.
- **Claude mobile-only users: viable in principle, untested.** The mobile app's Code tab starts cloud sessions (Pro/Max) in a fresh Ubuntu VM with a shell, root, curl and Bun; the user can add agentpager.me to their environment's network allowlist, and a setup script can install the binary (cached ~7 days). Sessions are tied to a GitHub repo, so the number goes in that repo's AGENTS.md. The VM is ephemeral, which fits our model (each session is a new agent with its own key). Not documented: whether a stdio MCP server from `.mcp.json` runs there (the CLI path via the shell works regardless), and whether a long blocking `wait` keeps the VM from pausing. Test in Stage 2 once the binary exists; until then, not promised. Sources: code.claude.com/docs/en/mobile, /cloud-environments, /claude-code-on-the-web.

## Order of work
1. The writing rules and local checks that ship in the binary (Sam's item 1), tested against the 10 cards from 28–29 Oct. Draft 2 in `02-writing-rules.md`.
2. The binary's surface: commands, MCP tools, their replies (connect, refused ask, wait, ack), local key store, project detection. `03-binary-surface.md`.
3. The encryption format: number format with the key fingerprint, envelopes for cards/attachments/answers. `04-encryption.md`.
4. The Blueprint update: glossary, strategy, invariants, capabilities, canonical mocks matching the real SwiftUI screens. `06-blueprint-update-plan.md`.
5. Build per the staged plan in the readiness review.
6. Marketing page.

## Glossary (rename everywhere, code included)
- **Pager**: created on the owner's phone. Has a number and a name. It is either **active or off**: a switch, not a delete.
- **Agent**: something that connected to a pager. It lasts until it finishes or the owner ends it. It has **no lifetime of its own**; any cleanup of old agents is quiet housekeeping. Replaces "session" in the code and "pager" in today's app copy.
- **Decision**: one question from an agent, plus the owner's answer. "Card" only describes how it looks.

## Pagers
- A phone holds many pagers (for example a global one in AGENTS.md, a disposable one for a VM, one per shared project). Each can be switched off and on independently.
- A pager can turn off automatically: Never, after 24 hours, 7 days or 30 days. Auto-off lands in the same off state as the manual switch.
- Off means nothing gets through. An agent calling an off pager, whether connecting or acting on an already-connected agent, gets a plain refusal: "This pager is turned off. Your message was not delivered." Nothing is queued.
- The phone keeps everything while a pager is off. Answered and open decisions stay visible. An open decision shows "[name] pager is off · Turn on" in place of the answer bar.
- Switching it back on makes open decisions answerable again. If a number leaks, make a new pager rather than switching the old one back on.
- A pager can be deleted from its detail screen.
- Wording: "Active · Stays on", "Active · Turns off in 18h", "Off since yesterday". The verb is always "turn off"; never "disabled".
- **Numbers only.** The link/QR/emoji pairing path is dropped in v2 (C1, C20, C21, C24 and the pairing code in the Session object go).

## App structure (canvas "AgentPager v2 Screens", page "Chosen screens")
```
Pagers (root)                 + → New pager (sheet, Cancel / Create)
└── Pager, e.g. "Work"        ‹ Pagers · gear → Pager detail
    ├── Pager detail          ‹ Work: active switch, name, turns off, Give agents this, Delete pager
    ├── Decision              ‹ Work · full screen; Options, background page and Ask for changes are bottom sheets
    ├── Decision, pager off   same screen; bar reads "[pager] is off · Turn on"
    └── Answered decision     same screen; bar is the closed record
```
- **Pagers** (root): rows with name, status dot and wording, a blue badge with the open-decision count, a chevron. No number on the row. Gear nowhere on this screen. The app may launch into the last-opened pager, like Mail.
- **Pager**: decisions grouped by project, oldest first within a project; each shows who asked and when; answered decisions fold into an "N answered" row per project. No status line or counts in headers.
- **No Settings screen.** Notifications are managed in iOS Settings → AgentPager. The server address ships as a Settings bundle there too (advanced, for self-hosters); it is global, not per pager, because the number and the copied instructions name the server.
- **Pager detail** (pushed, changes apply as made). **New pager** is a sheet without a grab handle.
- The text given to agents, copied as one block (copy icon only; no share; no syntax highlighting, the `$` and spacing are enough):
  > When I'm away and you need my decision, use agentpager.me MCP or CLI to send me decisions:
  > $ agentpager connect ap1_…
- **No install instructions in the app.** The install line lives on the marketing page; the copied text names agentpager.me so an agent that lacks the tool can find the install step.
- **The number goes in AGENTS.md** (decided 29 Oct). It is an address, not a credential: whoever has it can page you until the pager is off, and read nothing. We control the copied text, and developers who want it out of transcripts can set `AGENTPAGER_PAGER` and write `agentpager connect` alone.
- **Decision screen**: pushed full screen with a back chevron naming the pager (today it is a sheet). Options, background pages and Ask for changes open as bottom sheets with a grab handle, so swipe down returns to the decision. Images stay full-screen covers. The Options sheet carries the A/B picker at its top.
- Keep from today's design: the "Options" heading (not "Tradeoffs"), the TableBlock styling (filled rating cells, 4pt grid, 11pt-radius outline around the chosen column), the "Read more on options" row.
- **Answered decision**: the brief stays as it was, with the chosen option's whole column outlined in the Options table. The bottom bar replaces the A/B tiles with: a small "Closed decisions can't be changed." line, the chosen option (filled letter badge, "You chose A · Small + manual", when), then the agent's confirmation and next steps in a grey box with a green tick. No chat bubbles, nothing tappable. A note answer shows the owner's text in the chosen-option slot.
- Minimal helper text. Keep only lines that clearly help.
- Rejected variants (Home B, Home C, Answered A–C) are on the canvas page "Not chosen".

## Agents and grouping
- Each connect creates a new agent. The connect reply always says so: you've added a new agent to your owner's pager; keep using it for this piece of work; connecting again adds another.
- No name matching. Two agents with the same name are fine.
- Answers route by decision id, so several agents may share one agent id. A coordinator can hand its id to its helpers.
- Each decision shows **who asked** (Codex, Claude…). Decisions are grouped by **project**, which defaults to the git repo name (or the folder name outside a repo). An agent can override it with `--group "<name>"`. Keep this loose and pick better defaults from real use.

## Rules and feedback across an agent's lifecycle
Page: "Where agents learn the brief, v2" (`pages/agent-journey-v2.html`). Detail in `02-writing-rules.md` §3.
- **Principle:** feedback rides on calls the agent already makes and taps the owner already does. No step is added for either, and nothing is put into the agent's context that it didn't ask for.
- **Quality is reviewed by judgement, not pattern-matched** (decided 29 Oct, replacing the regex checks and `--send-anyway`). We write what good looks like (twelve points: one question; 2–4 real options; stands alone; context says what / what breaks / how likely; a recommendation with why; no unexplained labels; a plain preview line; short context; option stories; tradeoff rows that separate; next steps; two-minute read). `agentpager review card.yaml` prints the card with that list; the writing agent hands it to a subagent, which grades each point **ok / good to fix / must fix** for this card; the writer fixes the must-fixes, chooses among the rest, and sends. Severity is the reviewer's call, not baked into the list. One round; `ask` never bounces a card on content. Sam's reasoning: deterministic prose checks are too hard to get right and an adversarial loop would make the tool feel slow and wasteful; start here and see.
- **`ask` refuses only what is mechanically certain:** it doesn't parse, fewer than two options, a referenced attachment is missing, a size limit, 10 open decisions, pager off. One line per problem.
- **The card is `card.yaml`** (decided 29 Oct): the whole card is structure, each key landing in one slot on the phone (title, detail, context + background page, options with their stories, tradeoffs with rated cells, recommendation, next steps, attachments). Page: "One card, from card.yaml to the phone" (`pages/card-yaml.html`). The binary compiles it to today's JSON and markdown brief, so the phone is unchanged for Stage 1; later the app can take the structure directly. Free-form briefs are gone; small decisions omit optional keys. Mechanical checks become key checks with no prose parsing.
- **MCP agents carry the contract every turn** in the `ask` tool's description. CLI agents get it from `connect` ("Before your first card: agentpager rules", a prompt not a gate) and from `rules`.
- **The binary reprints the short contract on its own clock:** inside an `ask` reply when more than 2 hours or 5 cards have passed since it was last shown to this agent. This covers context compaction without relying on the agent's memory. State lives in the agent's local file (`rulesShownAt`, `cardsSinceRules`).
- **Notes are answers, not guidance** (decided 29 Oct). An Ask for changes note is about that decision; the agent that asked reads it once in `wait` and acts on it. Notes are not cached, not shown to other agents, not encrypted from the phone to each agent, and there is no "remember for every agent" toggle. Last night's three notes were writing feedback only because nothing enforced the rules; each is now a check. A correction that recurs becomes a check in the next binary.
- **History on disk, never in context.** The binary appends every ask, answer and acknowledgement to `~/.agentpager/history/<pager>.jsonl`; `agentpager history` (CLI and MCP tool) reads it when an agent wants to know what was already decided. Nothing from it is printed unasked.
- **A clean card gets nothing extra:** "Sent." and the inbox preview.
- **Rejected as ceremony:** regex checks on prose that hold a card and a flag to override them, a pre-sorted must/nice list, a second review round, thumbs up/down per card, time-to-answer as a score, the binary calling a model itself (no key, no cost to friends), a mandatory `rules` call, caching and injecting the owner's notes.
- **Not fixable from our side:** a harness prompt that pulls toward "approve this?"; the list names it and a reviewer will usually catch it, but nothing can make the writer think of the second real option. If reviews miss padded options in practice, back that one item with a mechanical check, decided with data.

## End-to-end encryption: required before the friends rollout
- The phone makes a key pair per pager. The pager number carries the public key's fingerprint, so the server can't swap keys.
- The agent encrypts each decision to the phone. The phone encrypts its answer to the agent's key, which is sent at connect.
- The server sees only ciphertext plus metadata (timings, sizes).
- Push notifications carry ciphertext. An iOS Notification Service Extension decrypts them on the phone and shows the real question.
- Design identifiers and the number format with this in mind now.

## Agent-side helper: one binary, CLI and MCP
- A single-file Bun binary per platform, installed with `curl -fsSL agentpager.me/install | sh` (shown on the marketing page). **No npx path.**
- It is both the CLI and a **local MCP server over stdio**. Claude Desktop, Claude Code, Codex and Cursor load it like any local tool server; the installer writes those config entries. The MCP tools are the same operations as the CLI commands and carry the same rules text in their descriptions.
- **The hosted MCP at agentpager.me/mcp is retired**, with no compatibility layer; it becomes a short message pointing an arriving agent at the install step. The HTTP API stays as the binary's transport only.
- Commands roughly: `agentpager connect <number>`, `ask <card file>`, `wait`, `ack`.
- `connect` returns a short, non-secret agent id (for example `ap-7f3k`). The secret key and that agent's encryption keys stay in a private file under the user's home folder, filed by id. Later commands pass `--agent <id>`, so the agent never handles the secret.
- `ask` runs only mechanical checks locally (parse, option count, attachments, sizes), then encrypts and sends. Content quality comes from `agentpager review` plus a subagent, before `ask`.
- The writing rules and the review list ship inside the binary (help text, MCP tool descriptions, `rules`, `review`). That is their single home. This replaces the server-side draft review in the 29 Oct flow proposal, because an end-to-end encrypted server can't read cards.
- agentpager.me must explain the install step clearly to an agent that arrives without the tool.

## Multi-user (parked, must be handled)
- Rules belong to each owner. If per-owner rules are ever needed, they come in layers: shipped defaults, then the owner's own, then per-pager. Not in v2; Sam edits the binary.
- A way for testers' feedback to reach Sam, for example opting in to share their local history file.

## Open
- Writing rules: "defer / leave as is" as real options; small decisions with optional keys omitted; reminder threshold tuning; whether to back the padded-option item with a mechanical check later.
- Binary: cross-machine sharing of an agent id; keep `finish`; history cap (1,000 lines per pager); harness markers for app detection.
- Encryption: 8-byte fingerprint; whether attachment names are encrypted.
- Claude mobile-only users: test the cloud-session path in Stage 2 (see Scope).
- The "N answered" row: it opens a list of that project's answered decisions; not drawn.
