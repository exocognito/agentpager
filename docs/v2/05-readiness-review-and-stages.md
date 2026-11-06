# AgentPager readiness review (29 Oct 2026)

> **Status note (30 Oct):** written before several later decisions. Superseded where it conflicts with `01-decisions.md`: numbers only (link/QR dropped); hosted MCP retired, no compatibility layer; browser-only agents out of scope; the Blueprint update is deferred until v2 is on Sam's phone; "notes handed to agents by the phone" in Stage 3 is gone (notes are per-decision answers); the binary's quality step is a subagent review, not checks. The layer-by-layer findings and the four stages still hold.

What the current code is, measured against the v2 decisions, and a staged plan to get it onto ten friends' phones. Read-only review of `packages/app` (Cloudflare Worker), `packages/ios` (SwiftUI) and `packages/blueprint` at main `f9fddf6`.

## Summary

The product is in better shape than the overnight cards suggested. The server is small (about 1,300 lines), carefully written, and has real acceptance tests. The iOS app is 3,800 lines of SwiftUI with UI tests that drive a real server. The Blueprint already has a milestone, MSHIP, whose objective is exactly "AgentPager for people I invite": TestFlight, demo agent, alerts with the app closed.

Three things stand between today and a friends install, and they are all decisions made this week rather than bugs:

1. **The data model is one pager number per phone, one agent per pager, with no off switch.** The v2 model (many pagers, on/off, auto-off, many agents per pager) touches the Registry, the Session object, the contract and every iOS screen.
2. **Nothing is encrypted end to end.** Cards, attachments and answers sit in SQLite on Cloudflare in plain text, and push alerts carry the question text through Apple. Encryption is a requirement for the rollout.
3. **The agent-side helper doesn't exist yet.** Agents talk to the HTTP API or the hosted MCP directly, with the key in their context. The binary (CLI + MCP, rules, review) is new code.

Everything else is either reusable as is, or a renaming.

## Layer by layer

### Server (`packages/app/src`, Cloudflare Worker + two Durable Objects)

**Keep.** The structure is right for v2:
- One `Session` Durable Object per connection, SQLite inside, immutable proposals/answers/acknowledgements via triggers, alarms for expiry, a tombstone for 7 days. Keys stored only as SHA-256 digests. Every refusal is `{error, message, ...}` with a status table. This is the "agent" of the new glossary, and it barely needs to change.
- `Registry`: links, numbers, number→pagers, push tokens, all as digests.
- MCP server over the same code paths as HTTP, stateless, SDK-based.
- Push via APNs with a provider token, collapse ids, expiry, time-sensitive level, "gone" handling.
- Deploy script: clean tree required, secrets from 1Password only into the Wrangler child, custom-domain route, build header check.
- Acceptance tests: 10 files, 979 lines, run against local workerd or the deployed host, with real Chromium and the real MCP SDK.

**Change for v2.**
- *Pagers.* `numbers_v1` holds one number per `phone_hash` (`PRIMARY KEY (phone_hash)`). Many pagers per phone means the number becomes the key, with a name, an `enabled` flag and an optional `off_at`. Creating a new number must stop replacing the old one.
- *Off.* Today nothing checks a pager's state after a connection opens; "change number" only stops new opens. Off must refuse `ask`, `read`, `ack` on every agent opened with that number. The Session object knows its `phoneHash` but not its number, so either `number-page` records `numberHash` in the Session meta and each call checks the Registry, or the Registry fans an off flag out to its sessions. The first is simpler and one extra Durable Object hop per call.
- *Auto-off* is a Registry alarm, or a check of `off_at` on read. Trivial.
- *Agents.* Lifetime (`24h/7d/30d`, `endsAt`, timed-out tombstones) goes away for agents; housekeeping replaces it. The `page` reply must say "you've added a new agent" and return an agent id. Shared ids among agents (coordinator → helpers) is a policy on the agent key, not a server change.
- *Names.* `session` → `agent` through contract, routes, MCP tool names (`start_session`, `finish_session`), tests and docs. Mechanical but wide.
- *Encryption.* The server becomes a carrier of opaque bytes: `proposals.json` and `attachments.data` as ciphertext, `answers.json` as ciphertext to the agent. Server-side schema checks on card content (`QuestionInput`, the brief schema, `acceptsChoice`) can no longer run; they move into the binary and the phone. Push payloads become ciphertext plus a decision id; the phone's Notification Service Extension decrypts. The brief schema in `packages/contract/brief.ts` stays the source of truth for the wire format the binary emits from `card.yaml`.
- *Link/QR/emoji pairing* (`/start/<code>`, palette, 3 tries): dropped (numbers only). Removes about a third of the Session code and tests, and the C1/C20/C21/C24 capabilities.

**Keep an eye on.**
- `MAX_OPEN_DECISIONS = 10` per agent, no other rate limits. Anyone with a number can open agents and send cards; off is the only defence. Fine for friends, worth a per-number cap on open agents.
- `read` with `wait=50` holds a Durable Object request open and polls storage every 100 ms. 435 waits in one night is fine; 10 friends × several agents is still fine on Cloudflare pricing, but it's the first thing to watch.
- The hosted MCP at `agentpager.me/mcp` is retired once the binary ships; it becomes a one-paragraph pointer to the install step.

### iOS app (`packages/ios`)

**Keep.** SwiftUI, iOS 26, observable `AppModel`, keys in the Keychain per pager, `InboxCache` for 24-hour read-only history, push registration, `BriefView`'s rendering of the Markdown brief (tables, diffs, Mermaid flowcharts, chat blocks, image strips, attached pages), undo window on send, retries with "Answer Not Confirmed". UI tests exist and can save screenshots (`TEST_RUNNER_SCREENSHOT_DIR`), which is the route to canonical mocks later.

**Change for v2.**
- *Distribution.* Bundle id `me.agentpager.app.dev`, `aps-environment: development`, installed by Xcode Run and "trust the developer". Friends need TestFlight: a release bundle id, production APNs entitlement, App Store Connect record, and the server's push code mapping sandbox vs production per token (already modelled: `PushTarget.environment`).
- *Server default.* `AGENTPAGER_SERVER_URL` in `project.yml` is a LAN address (`http://192.168.4.99:8787`); release builds must default to `https://agentpager.me`. Remove the in-app Server screen; move it to a Settings bundle.
- *Screens.* Agents list → Pagers root; new Pager screen (decisions grouped by project, who asked); Pager detail; New pager sheet; decision pushed instead of sheet, Options/background/Ask for changes as `presentationDetents` sheets; answered bar per the mocks; pager-off bar. Mostly rearrangement of existing views; the brief renderer is untouched.
- *Model.* `PagerNumber` becomes `[Pager]` with name, enabled, offAt, and its own key pair. `PagerKey` (one per session) becomes per agent. Grouping by project needs a `project` field on the agent, sent by the binary.
- *Encryption.* Key pair per pager in the Keychain (software keys in an App Group). Decrypt cards and attachments on read; encrypt answers to the agent's public key. A Notification Service Extension target to decrypt pushes; it needs an App Group to share the Keychain.
- *Polling.* Foreground poll every 3 seconds across all keys. With several pagers and agents this fans out; fine for ten users, but a single "what changed" endpoint per phone would be cleaner. Not a blocker.

### Blueprint (`packages/blueprint`)

Deferred; see `06-blueprint-update-plan.md`.

### What's missing entirely

- The **binary**: Bun build, `connect/review/ask/wait/ack/history`, local key store by agent id, project detection from git, the rules and the review list, MCP server mode, `setup` that writes Claude and Codex MCP config. This is the largest new piece.
- **Marketing page** for the new product.
- **A demo agent** (MSHIP C19) so a friend can see a card before wiring up their own agent.

## Stability today

For Sam alone, on the current build, it's usable. The known weak spots:
- The pager number is a bearer secret with no revocation except replacement; it's in `~/.agents/agentpager.md` and in Codex transcripts.
- Alerts need the deployed server; the local dogfood server can't send them.
- An agent that loses its key can never page again; the owner must end the pager in the app.
- Attachments over 20,000 characters are refused with an unreadable error.

None of these block personal use. All of them would surface within a day for a friend.

## Staged plan

Each stage ends with something Sam can use on his phone, and the order keeps the risky change (encryption) from blocking the model change. The Blueprint update follows the stages, not precedes them.

**Stage 1 · The v2 model, unencrypted (server + app).**
Pagers with names, on/off, auto-off; agents without lifetimes; off refusal on every call; rename session → agent everywhere; numbers only (delete link/QR/pairing); Pagers root, Pager screen, detail, new pager sheet; decision as a pushed screen with bottom sheets; answered bar; pager-off bar; no Settings screen (Settings bundle for the server URL). Fresh install, no migration. The HTTP API keeps working so the hosted MCP can page Sam until Stage 2.
*Done when:* Sam runs v2 on his own phone with his own agents.

**Stage 2 · The binary.**
`agentpager` CLI + MCP in one Bun binary, built locally (`bun build --compile`, symlink on PATH); `connect` with agent id and local key store; project detection and `--project`; `card.yaml`; the contract, `rules`, `review`, mechanical refusals in `ask`; the contract reminder on the binary's clock; history on disk; `setup` that configures Claude Code, Claude Desktop and Codex. Hosted MCP retired.
*Done when:* Sam's agents page him through the binary. The 10 cards in `regression/` are the test set for `review`.

**Stage 3 · End-to-end encryption.**
Number format with the phone's key fingerprint; envelope format for cards, attachments, identity, answers, acks; binary encrypts, phone decrypts; Notification Service Extension with App Group keychain; server stops reading card content.
*Done when:* the server holds nothing readable and pushes still show the question.

**Stage 4 · Ship to ten people.**
TestFlight (release bundle id, production APNs), `https://agentpager.me` default, the install script and release binaries, the demo agent, the marketing page, a one-paragraph "what we store" note. Blueprint update lands here or just before. Invite ten.
*Done when:* a friend installs from TestFlight, runs one curl line, pastes one line into AGENTS.md, and gets paged.
