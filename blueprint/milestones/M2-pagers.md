# M2 · Pagers on my phone

> **Status:** shipped · **Shipped:** 29 Oct 2026, as Stage 1 of the v2 plan (PR #22) · **Tag:** none; released at 1ee6c27 · **Word:** PAGERS

## Objective

In Sam's voice, as the old MPAGERS doc had it:

I make pagers on my phone, as many as I like, each with a name, a number and a switch. I turn one off and nothing from its agents gets through; I turn it on and its open decisions are answerable again. One can also turn off by itself, after 24 hours, 7 days or 30 days. Each pager shows its decisions grouped by project, with who asked. A decision opens full screen, with its options and pages as sheets, and once answered it is a closed record. When I delete a pager, the service forgets its agents and their decisions. The server's address lives in iOS Settings, not in the app.

## Slice

| Layer | What M2 delivered there |
| --- | --- |
| Phone | the Pagers, Pager and Pager detail screens and New pager (B22, B23, B26); each pager's key pair, made on the phone; a decision full screen, with its options and pages as sheets; the server's address in iOS Settings |
| Server | pagers that are on or off, by the switch or by auto-off; an off pager refuses every call (I17); agents with no lifetime, forgotten after 30 days idle; a deleted pager's agents and decisions forgotten; the number checked against the pager's key (I19) |
| Agents | no new way in: the HTTP API and the hosted MCP server kept paging Sam until M3 |
| Tests | 96 unit tests, 15 acceptance tests on local workerd, and the app's flow tests in the Simulator, 4 of 4 |

## Out of scope

- The agentpager command: M3.
- Encryption: the service still reads every decision. The agentpager command's own key check (I19) comes with [ENCRYPT](next/ENCRYPT.md).
- Moving a pager to a new phone, or recovering its keys.

## Sam's answers

Sam and Claude agreed the v2 design on 29–30 Oct, in a claude.ai Project; its record is `docs/v2/`, which M4 removed from the tree; git keeps it at the tag `history-archive`. For M2, as recorded there:
- Sam's review of the "AgentPager v2 Screens" canvas chose the screens M2 built, on its page "Chosen screens".
- Defaults Sam confirmed on 29 Oct: "v2 is a fresh install on the phone: no migration of today's pagers or decisions." · "Rename `session` → `agent` throughout the code in Stage 1."

## Adds · Changes · Retires

- **Adds:** B22, B23 and B26; I17 and I19; and the limits marked `@M2`. I19 also holds what was built of B30: the phone makes each pager's key pair, and the number names its public key.
- **Changes:** B5 and B7, for a decision that opens full screen and reopens as a closed record; B17, so nothing alerts while a pager is off and an alert Apple can't deliver within 24 hours is dropped; I6, for a pager turned off inside the Undo window. Their clauses that M2 added start with `@M2:`.
- **Retires:** pairing by link, QR code and emoji (C20, C21, C24); pager lifetimes and end reasons (C22 as "change or end a pager"); the Agents list (C23 as "Agents list"); one agent per phone (I16); and ended pagers (I17 as "ended pagers refuse and forget", with the phone's 24-hour copy of an ended pager). The v2 rewrite deleted their lines; their text is in git at ac75bcb.

## Log

- 29 Oct · PR #22: the v2 model, unencrypted, on the service and the iPhone app. `pnpm check` green; 96 unit tests, 15 acceptance tests and 4 of 4 flow tests passed.
