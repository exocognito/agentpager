# M4 HOUSE: the conversion ledger

Every line of the old Blueprint, and where it went when M4 converted it to the area shape ([METHOD.md](../../../METHOD.md)). The old files are at tag `blueprint-old-format`. A specific that moved into code or a test names what holds it. Sam reviewed the ⚑ rows, and every line, on 6 Nov 2026: what it changed is in [M4-house.md](../M4-house.md#sam-reviews-after-merge), under question 1 and Adds · Changes · Retires.

## Totals

- **Rows:** 743, from 109 old files and sources, grouped by old file below. 53 rows are gaps the integrator filled (listed under Gaps filled). PR 4, the history cleanup, adds 24 more in its own section at the end, and PR 5b, the dev marks and HTTPS only, 4 more after it.
- **⚑ for Sam:** 95: 89 from the conversion, 3 from PR 4, the history cleanup ([PR 4](#pr-4-the-history-cleanup)), and 3 from PR 5b, the dev marks and HTTPS only ([PR 5b](#pr-5b-the-dev-marks-and-https-only)).
- **The new Blueprint:** 7 areas with 23 entries (14 behaviors and 9 invariants) and 162 clauses, 16 limits (L9 to L24), and 3 journeys with 20 steps.
- **Ids:** each C became B with the same number; I, J and K kept theirs; B32, B33 and I23 are new; limits are L9 to L24; no D id remains, and C28 is never reused. Not built, and waiting in `milestones/next/`: B19 (INSTALL), B30 and I20 (ENCRYPT), K1 (FRIENDS).
- **Words:** the old Blueprint docs this pull request deletes held 25,789 words (strategy, design, roadmap, decisions and lessons), plus 5,219 in the workshop's notes. The new `blueprint/` holds 25,343, without `generated/` and this ledger. Its always-true part (README, PRODUCT, TERMS, the areas and JOURNEYS) holds 14,186, against 12,403 in the old strategy and design.

## ⚑ for Sam

Each row drops a line, changes its meaning, adds a line no old line held, or cuts a specific that no test holds. The full row is in its file's table below.

| # | Old | New | Why it is flagged |
| --- | --- | --- | --- |
| 1 | C5.1 | B5.1 · @M2 | B5.1 cuts the "Decision:" lead-in to "leads with the question"; only code holds it. |
| 2 | C5.2, tradeoffs table and ✶ | B5.3 · @M2 | The "Read more on options" label, the Options heading and the table's styling now live only in code and the screens. |
| 3 | C5.4, grab handle and swipe down | B5.8 · @M2 | "Every sheet has a grab handle" becomes "every sheet closes with a swipe down"; the handle is code only. |
| 4 | C5.5, Send or Ask for changes | B5.10 | The "Send option A" label is cut, and no test holds it. |
| 5 | C5.6, "Send returns to the pager and shows 'Sending in 5s' with Undo" | B5.11 | The "Sending in 5s" countdown words are cut, and no test holds them. |
| 6 | C5.7, the row's states | B5.12 | "Sending…" is cut to an outcome, and only code holds it. |
| 7 | C5.7, the row and the decision | B5.12, B5.13 | B5.12 and B5.13 are widened: the decision itself, not only its row, says sending, waiting and not picked up. |
| 8 | C6.1, ask and write | B6.1 | B6.1 narrows "any open decision" to one whose pager is on, as the phone does. |
| 9 | C6.1, "up to 1,000 characters with no HTML" | B6.2 | Sam's 1,000 characters for a note leave the Blueprint for I4 and the schemas; a test holds them. |
| 10 | C7 caveat 2: an image or page not opened since the app started can't be shown offline | L18 · A brief's images and pages need the service | L18's why, fix and revisit are the drafter's words. |
| 11 | C17 caveat 1: Apple delivers; the proof shows the hand-off to Apple and the phone showing it, not delivery time | B17, first note | The old claim that a test shows the phone displaying an alert is dropped; none does. |
| 12 | C17 caveat 3: until encryption, the question, detail, recommendation and the warning's names pass through Apple as text | L17 · Alerts pass through Apple as plain text (area 4) | L17 is widened to every alert's title and the acknowledgement's words, as the code sends them. |
| 13 | C22.3 row "Off since 9:40 AM" / "Off since yesterday", grey dot | B22.2 + B22 note | The off row's grey dot is cut; only code holds it. |
| 14 | C23.1 rows | B23.1 | The rows' green and grey dots and the blue open-count badge are cut; only code holds them. |
| 15 | C23.2 | B23.3 | The gear that opens a pager's detail is cut; only code holds it. |
| 16 | C23.4 | B23.5 | "N answered" and its example wording are cut; only code and the catalogue hold them. |
| 17 | C23.5 | B23.6 | The "about every 3 seconds" refresh is cut; only code holds it. |
| 18 | C23.6 unreachable: last read, "Can't Reach Server" with when | B23.8 | "Can't Reach Server" is cut to an outcome; only code holds it. |
| 19 | C25.1 | B25.1 | B25.1 now says the text names the pager's own server, as the code does; the old line said agentpager.me. |
| 20 | C25.6 | B25.6 | B25.6 adds "the key is never printed", which no old line said. |
| 21 | C26.1 | B26.1, B26.2 | New pager's missing grab handle is cut; only code holds it. |
| 22 | C26.2 first sentence | B26.3 | The "Give agents this" label and the copy icon are cut; only code and the catalogue hold them. |
| 23 | C26.2 code block (the text given to agents) | B26.4 (outcome) + B26 note (exact text) | The text given to agents is kept only as a note; Sam may mean its exact words as a promise. |
| 24 | C26.2 "--server" sentence | B26.5 (@M3) | The phone's `--server` in the text is cut to an outcome; only code holds it. |
| 25 | C27.1 `agentpager rules` prints the contract, template and example | B27.1 | B27.1 adds `agentpager example`, built but in no old line. |
| 26 | C27.2 the writer's one round | B27.4 | B27.4 now promises what the card contract tells the agent, not what the agent does (L16). |
| 27 | C27 caveat 1, "nothing proves that the agent ran the review or followed it" | L16 · Nothing makes an agent review its card | New limit L16: nothing makes an agent run the review. The old ledger sent it to a test comment. |
| 28 | C31.2 | B31.2 | History's 20 most recent decisions is cut; only code holds it. |
| 29 | C31 caveat 3 (deleting a pager leaves its history) | L15 · Deleting a pager leaves its agents' files | L15's fix, and revisiting it at FRIENDS, are the drafter's guesses. |
| 30 | I5 body, "Repeating a send with the same request id returns the stored receipt. Changing its input, or answering again with a new request id, is refused." | I5.2 | I5.2's same-request receipt and its refusals have no test; the clause keeps the old line's same-request rule. |
| 31 | I19 serves SI2, SI10 | I19 Why: "The pager number binds my phone's key" | I19's new Why quotes the half of SI10 that holds today; "so the service can't swap it" waits for ENCRYPT. |
| 32 | I21 caveat 1 (sharing works only on one machine) | L14 · An agent id works on one machine only | L14's revisit is the drafter's guess. |
| 33 | I22 ¶1 s1, what broken in structure means | I22.2, I22.3, I22.5 | I22's "broken" is widened to what the command refuses today: an unreadable card, a character that breaks the table, an unreadable attachment. |
| 34 | I22 ¶1 s2, the brief held to the service's own contract | I22.6 | I22.6 adds that each problem is named by the card's own key, which no old line said. |
| 35 | J4 step 7 · Delete | J4.7 | J4.7's refusal is corrected to what the code does: the agent is unknown, not its pager gone. |
| 36 | (none) | J5.6 "The agent's wait returns the owner's answer (B32)." | J5 gains a step, the wait returning the answer, which no old step said. |
| 37 | D1 must supply: HTTPS on the apex, every plain HTTP request redirected, every response with Strict-Transport-Security; must never: answer over plain HTTP; deployed check: plain HTTP redirects and HTTPS carries HSTS | L20 · The service still answers plain HTTP (6 Privacy); next/ENCRYPT (I23's clause, unless M4 fixes it first) | D1's "HTTPS only" isn't true (5 Nov): new limit L20, and the clause waits in ENCRYPT. Sam was asked whether to fix it in M4. |
| 38 | D1 deployed check: every response surface, across repeated requests, carries the candidate's build | the dev stage's smoke run (M4's dev-stage pull request decides what it checks) | The deploy checks one path's build header, not every reply's; the dev-stage smoke run decides. |
| 39 | D1 deployed check: a pager's turn-off time is exactly its auto-off after it was turned on | the dev stage's smoke run (M4's dev-stage pull request decides what it checks) | Nothing checks a deployed pager's auto-off time; the dev-stage smoke run decides. |
| 40 | D1 caveat 1: a green deploy doesn't show the zone's DNS is the only path in, or anything about Cloudflare's availability | dropped | D1's caveat that a green deploy doesn't prove DNS is the only way in is dropped; no comment holds it yet. |
| 41 | D2 setup list: Claude Code (`claude mcp add --scope user`, unless `claude mcp get` finds one), Codex (`codex mcp add`), Claude Desktop, Cursor, pi | code `setup.ts`; B29.1 names the apps (area 7) | How setup reaches Claude Code and Codex is code only, and no test runs those paths. |
| 42 | D2 caveat 1 (cloud sessions untested) | L13 · Cloud sessions are untested | L13 adds the wake lab's sightings, and its fix and revisit are the drafter's. |
| 43 | D6 Proof runs on: "in light and dark appearance, with the Pager and decision screens also at the largest standard text size" | AGENTS.md › Gotchas, as a gap: light appearance only; dark and the largest text untested | The old claim that dark appearance and the largest text are tested was untrue; it is now a gap in AGENTS.md. |
| 44 | D8 proof: "the compiled binary … connects with it, reads its status, serves MCP and runs setup with no Bun or Node on the PATH; it is skipped until the binary is built, and `pnpm test:cli` builds it first" | nothing (test comment) | B29.8 (no Bun, Node or repository needed) is proven only in part. |
| 45 | SI6 · UTF-8 with Markdown … never truncated | PRODUCT › Principles › same heading, without its numbers, linking I4 | PRODUCT's text-limits principle loses its numbers; I4 and the schemas hold them. |
| 46 | SP5 · Reach the agents owners actually use, first sentence "Any agent that can run the agentpager command can use AgentPager: terminal agents, and desktop apps like Claude Desktop and Cursor." | PRODUCT › Principles › Reach the agents owners actually use | SP5's first sentence is cut to its true part; the rest of it moves to a note, marked as not Sam's words, pointing to CLIENTS. |
| 47 | SP5, rest | PRODUCT › same principle | SP5's "within a second … nothing to nudge" stays as Sam's aim, though unmeasured and untrue for an agent that stops waiting. |
| 48 | STRATEGY § Strategic Design Decisions, its italic note | PRODUCT › Pinned design decisions, lead line | The pinned decisions' lead note loses "Technically, SD:" and Sam's "Lets just see…" aside. |
| 49 | SI6, a decision and each Markdown page 20,000 characters | I4.4 | SI6's 20,000 characters leave the Blueprint for the schemas, and no test holds them. |
| 50 | SI6, at most 8 attachments | I4.4 | SI6's 8 attachments leave the Blueprint for the schemas, and no test holds them. |
| 51 | SI6, at most 1 MB per image | I4.4 | SI6's 1 MB per image leaves the Blueprint for the schemas, and no test holds it. |
| 52 | SI6, at most 3 MB of attachments in all | I4.4 | SI6's 3 MB in all leaves the Blueprint for the schemas, and no test holds it. |
| 53 | (new) Serves: "The pager number binds my phone's key" | area 6 Serves | Area 6's Serves quotes only part of SI10's sentence, which PRODUCT.md doesn't hold; ENCRYPT's Objective quotes it whole. |
| 54 | (term) "card contract" | TERMS | New TERMS entry "Card contract", a word the areas and the command already use. |
| 55 | (term) the sheet that makes a pager | TERMS › Pagers, Pager, Pager detail, New pager | New TERMS name "New pager", for the sheet that makes a pager. |
| 56 | MENCRYPT question 2 "What an agent sees when its command is from before the switch: refused, with how to update (MINSTALL)." | next/ENCRYPT.md Still open 2; What's known adds that INSTALL now comes after ENCRYPT | ENCRYPT's question 2 loses its tie to INSTALL, which now runs after it. |
| 57 | MINSTALL question 3 "How an installed command learns it is out of date. MENCRYPT will refuse commands from before encryption, so their owners need an easy way to update." | next/INSTALL.md Still open 3 "How an installed command updates once the service says it is out of date." | INSTALL's question 3 is narrowed: how a command learns it is out of date moves to ENCRYPT. |
| 58 | MOPEN question 5 "What the cleanup removes, for example `docs/v2/`, the workshop notes, the parked web milestone and the retired hosted MCP's answer." | next/OPEN.md Still open 5 "What the cleanup still removes after M4, for example the retired hosted MCP server's answer." | OPEN's question 5 is narrowed to what is left after M4's cleanup. |
| 59 | — (Sam's go) | next/OPEN.md status line: publishing needs Sam's own go | "Publishing needs Sam's own go" is a new line in OPEN, from the drafter's brief. |
| 60 | DEC-2026-10-08-storybook-is-the-design | dropped | DEC-2026-10-08-storybook-is-the-design's dark-mode 4.5:1 contrast rule is held nowhere now. |
| 61 | DEC-2026-10-27-pr1-sign-off, "Questions 5 and 6 (how MAPP gets built, and the old copy in the blueprint repo) change nothing here and stay open." | dropped | DEC-2026-10-27-pr1-sign-off's question 6, the old copy in exocognito/blueprint, has no home: is it still open? |
| 62 | docs/v2/02 §6.2, small decisions: should reviewers grade missing optional keys good to fix at most? | dropped | docs/v2/02's open question on grading small cards is dropped unsettled. |
| 63 | docs/v2/02 §6.3, "tune after the first week" | dropped | docs/v2/02's "tune after the first week" is dropped; the reminder's numbers stay as built. |
| 64 | docs/v2/03 §2 `agentpager agents` | B25.12 | New clause B25.12 (list the agents), built and tested, with no old line. |
| 65 | docs/v2/03 §2 `agentpager finish`; TERMS "Agent"; Sam's 29 Oct default to keep `finish` | B25.13 | New clause B25.13 (finish), built and tested, with no old line. |
| 66 | docs/v2/03 §2–§3, §6 (wait holds up to 50 s; `seconds` up to 50) | B32.2 | New clause B32.2 (one wait returns within apps' limits), from docs/v2/03. |
| 67 | docs/v2/03 §4 wait, pending | B32.3 | New clause B32.3 (a pending reply), from docs/v2/03. |
| 68 | docs/v2/03 §4 wait, option chosen | B32.4 | New clause B32.4 (a chosen option arrives), from docs/v2/03. |
| 69 | docs/v2/03 §2, §4 `--forever` (50 s rounds, retry every 10 s through an unreachable service; a reply not understood ends it) | B32.7 | New clause B32.7 (a wait with no end), from docs/v2/03. |
| 70 | docs/v2/03 §2–§4 ack (next steps, green tick, only the first counts, refused before the answer) | B32.8 | New clause B32.8 (acknowledge); "refused before the answer" has no test. |
| 71 | docs/v2/03 §2 `agentpager status` | B32.9 | New clause B32.9 (status), from docs/v2/03. |
| 72 | docs/v2/03 §4 unreachable, no reply, reply not understood | B32.10 | New clause B32.10 (a reply not got or not read is never success), from docs/v2/03. |
| 73 | docs/v2/03 §6, positive identification (`claude-code`, `local-agent-mode-<server>`, `CLAUDECODE=1` with no other marker) | B33.1 | New clause B33.1 (wake words only for an app identified for certain), from docs/v2/03 §6 and the wake lab. |
| 74 | docs/v2/03 §6, Claude Code's words | B33.2 | New clause B33.2 (Claude Code's background wait), from docs/v2/03 §6 and the wake lab. |
| 75 | docs/v2/03 §6, Claude Desktop's words (seconds 1 between steps, 50 s holds, `sleep 10` up to 10 times, stop after 2 hours) | B33.3 | New clause B33.3 (a Desktop chat keeps its turn), from docs/v2/03 §6 and the wake lab. |
| 76 | docs/v2/03 §6, the 2-hour stop | L12 · A Desktop chat stops waiting after two hours | New limit L12: a Desktop chat stops waiting after two hours. |
| 77 | 04 §2 "the server rate-limits connects per pager" | next/ENCRYPT | docs/v2/04's connect rate limit isn't built; it waits in ENCRYPT. |
| 78 | docs/v2/04 specifics: the number's byte layout (§2), the envelope's byte layout and info string (§4), the push payload, its 4 KB limit, the 1 KB preview and the extension's 30-second budget (§5), table columns and the key route's path (§6) | cut from the tree; `docs/v2/04-encryption.md` stays in git, and next/ENCRYPT.md names it | docs/v2/04's byte layouts and payload sizes leave the tree; git keeps them. |
| 79 | (new) `packages/app/README.md` › Limits: "Off is not atomic with a write (accepted 30 Oct for dogfooding, to fix later)" | L10 "Turning a pager off can let one call through" + I17 note | New limit L10, from packages/app/README.md: turning a pager off can let one call through. |
| 80 | memory `agent-wake-research` (30 Oct lab and the deployed run) | B33 notes, L11 · Only Claude agents wake by themselves | New limit L11 (only Claude agents wake), from the wake lab in agent memory. |
| 81 | memory pager-must-deliver-unprompted (Sam, 29 Oct: "there is NO point in a pager…") and agent-wake-research (Sam's 30 Oct wake choices) | M3-command.md Sam's answers | M3 quotes Sam's words that exist only in agent memory. |
| 82 | hardening item 3 "one writer per pager" and item 5 "a smaller poll" | next/ENCRYPT.md items 3 and 5 | Hardening items 3 and 5 are defined nowhere; ENCRYPT's Plan picks what they cover. |
| 83 | code `commands.ts › connect` (`--server`, 8a64d0e) | B25.11 | New clause B25.11 (another server), built and tested, with no old line. |
| 84 | (none; from the code) | I22.4 | New clause I22.4 (parts that don't match), built and tested, with no old line. |
| 85 | (PR #44, `start.ts`) a server other than agentpager.me says it is dev, at / and /start | B18.5 · @M4: | New clause B18.5, the dev mark #44 built and tested, with no old line. |
| 86 | (none): an answer still sending when the app is closed goes again on the next launch | B5.16 · @M3: | New clause B5.16: an unconfirmed answer is sent again when the app reopens. Built and tested, with no old line. |
| 87 | (new) I23 · @M1 · Keys stay secret | I23 | New invariant id I23 (Sam's A4 ★), retitled "Keys stay secret" and widened to the service's own secrets. |
| 88 | (new) I23 Why: "Only agents I give a number reach my phone" | I23 Why | I23's Why quotes SI2's heading, the drafter's choice. |
| 89 | — (new milestone) | next/CLIENTS.md | Sam's 5 Nov words quoted in CLIENTS and SITE have no record in the repo or memory before this pull request. |
| 90 | docs/v2/01, Rejected as ceremony: "a pre-sorted must/nice list" | dropped (PR 4) | DEC-2026-10-29-v2-design's rejected list leaves it out, and DECISIONS.md is append only; B27.3, where the reviewer grades each point for the card at hand, holds it in effect. |
| 91 | docs/v2/01, App structure: minimal helper text, keeping only lines that clearly help | dropped (PR 4) | The v2 design's guidance for the app's words has no line; the screens in `generated/screens/` record the words as built. |
| 92 | docs/v2/03 §5, what history is for: "an agent that wants to know what was already decided …; a coordinator reviewing its helpers; and the owner's own analysis later" | dropped (PR 4) | B31 says what the history holds, not why; FRIENDS' question 2 names sharing it for feedback. |
| 93 | (none; M4's plan, PR 5): a "dev" mark on the site | B18.6 · @M4: (PR 5b) | New clause B18.6: the front page on dev.agentpager.me says it is a dev server. Built and tested, with no old line. |
| 94 | (none; M4's plan, PR 5, and M4's slice, Phone): a "dev" mark on the phone | B23.11 · @M4: (PR 5b) | New clause B23.11: a pager made on dev.agentpager.me is marked dev on Pagers and its screen. Built and tested, with no old line. |
| 95 | D1 "every plain HTTP request redirected" (row 37), the text row 37 gave for when it is built | I23.4 · @M4: (PR 5b) | Built as Sam asked ("Yes fix plain http"), but narrower than row 37's text: only a request to read a page is sent to HTTPS, any other is refused unread, and a local server keeps plain HTTP. |

## Gaps filled

Old files and lines that no drafter's part covered, checked against the step-0 inventory of every old file:
- I3, a deprecated tombstone; the eight lessons L1 to L8; the old AGENTS.md's lines; the workshop and `roadmap/parked`, deleted here; the code PR #42 moved; and what PR 4 deletes outside `packages/blueprint`: the rest of `docs/v2`, the root `workshop/`, `recipe.json` and superseded plans.
- A clause the root asked for: B5.16, an unconfirmed answer sent again on relaunch. And B18.5, the dev mark the dev-stage pull request (#44) built, with D1's edits from #44, which merged before this one.
- Two TERMS entries: "Card contract" and "New pager".
- I17.2's last sentence, from C22.2: an agent of an off pager is told to ask again once it is on, or to ask for another number.
- L20, the plain HTTP limit, in place of I23's note that HTTPS only isn't built (the root's call).
- Rows bound for AGENTS.md give the drafters' proposed text. AGENTS.md words it more briefly, and the row's New column says where.
- Fixed cross-references: area 4's "B5.7" is B5.13; every `L?` is its L number.

## Old → new, by old file

Old clause numbers are the old behaviour numbers: C26.3 is C26's third behaviour. An invariant's rows name the paragraph (¶) and sentence (s) of its old body.

### `packages/blueprint/design/capabilities/C5-review-and-answer-cards.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C5.7, C17.6 (no agent picked up the answer) | B5, B17.8 (areas 5, 4) | stay there; a B32 note links them |  |
| C5.7 / C17.6 split ("ids that don't fit") | B17.8 (the alert); B5.13 (the row) | per areas.md; B17.8 cites (B5) |  |
| C5 | B5 · @M1 · Read and answer a decision | C→B, same number. Retitled from "Review and answer a decision": "Review" is TERMS' word for the agent's read of its card (B27), so the owner "reads" |  |
| C5 statement | B5.1–B5.4, B5.11; I6.1 | "read it as one headed page with the detail one tap away" is B5.1–B5.4; "choose an option and press Send" is B5.9–B5.11; "the agent receives exactly that answer" joins I6.1 (one home with SI1's words) |  |
| C5 serves: SC1, SI1, SI8, SP1, SP6, SP7, SP8 | area 5 Serves | dissolved; SC1, SI1, SP1 and SP8 quoted exactly. SI8, SP6 and SP7 are not quoted here (their substance is B5.3–B5.5 and B5.9) |  |
| C5.1 | B5.1 · @M2 | "The back button names the pager" → "names the pager it is on"; "adding 'finished'" → "marks who asked as finished", held by `FlowTests.testPagerJourney` (who asked reads "Codex", then "Codex · finished"). The "Decision:" lead-in cut to "leads with the question": only code holds it (`BriefView.swift`, header) | ⚑ |
| C5.2, sections and folding | B5.2 · @M2 | section names kept as the brief's parts; "Next steps and Small print start folded" kept. Code `BriefView.swift` (`folded`); `BriefTests.testBriefs` opens Small print before picking |  |
| C5.2, tradeoffs table and ✶ | B5.3 · @M2 | "each rated cell tinted from best to worst" and ✶ kept (✶ is Sam's, SP7). The row's label "Read more on options" cut to "a way to read each option in full": `BriefTests.testBriefs` taps that row by its id, but no test holds the label; code `BriefView.swift`. docs/v2/01-decisions lists that row, the "Options" heading and the table's styling as kept from Sam's chosen screens; all three now live only in code and the screens | ⚑ |
| C5.3 | B5.4, B5.5 · @M2 | split. "the Options sheet … chosen with the letters at its top or by swiping" → "by letter or by swiping". `BriefTests.testBriefs` holds the parts (what B changes, why choose and pass on it, its assumptions, images after) and swiping from B to C. "Seeing an option never chooses it" kept as B5.5; no test asserts it |  |
| C5.4, images | B5.6 · @M2 | "thumbnails" → "show small". `BriefTests.testBriefs` holds full screen and the swipe ("1 of 2" → "2 of 2") |  |
| C5.4, linked pages and https | B5.7 · @M2 | kept. "Only an https link leaves the app" kept as written: it is a security rule and the drafter wasn't sure whether Sam meant the specific. No test holds it; code `BriefView.swift` (`OpenURLAction`). `BriefTests.testBriefs` holds the background page and a page opened inside the Options sheet |  |
| C5.4, grab handle and swipe down | B5.8 · @M2 | "Every sheet has a grab handle" cut to the outcome, a swipe down closes it. `BriefTests.testBriefs` closes each sheet by dragging it down; the visible handle is code only (`DecisionView.swift`, `presentationDragIndicator`) | ⚑ |
| C5.5, tiles | B5.9 | "The answer bar has a tile per option" → "each option shows its letter and short label". `FlowTests.testUndoChangesAndNotConfirmed` holds a pick (tile B selected); unpicking by a second tap is code only (`DecisionView.swift`, `OptionTiles`) |  |
| C5.5, Send or Ask for changes | B5.10 | the label "Send option A" cut to "can send it"; `FlowTests.testPagerJourney` holds that nothing can be sent until an option is picked, but no test holds the label (code `DecisionView.swift`, `AnswerBar`). "Picking alone never sends (SI1)" moved to I6.1, its one home | ⚑ |
| C5.6, "Send returns to the pager and shows 'Sending in 5s' with Undo" | B5.11 | the countdown's words cut to "counts down the Undo window with a way to undo"; no test holds them (code `DecisionView.swift`, `UndoPill`; `PagerView.swift`, `SendStatusLine`). The five seconds live in I6.2 | ⚑ |
| C5.6, Undo keeps the choice; leaving the app sends at once | I6.2, I6.3 | they repeated I6's body word for word; one home in I6 |  |
| C5.7, the row's states | B5.12 | "Sending…" and "Waiting for Codex…" → "says the answer is sending, then that it is waiting for the agent, naming who asked". `FlowTests.testPagerJourney` holds "Waiting for Codex"; "Sending…" is code only (`PagerView.swift`, `SendStatusLine`) | ⚑ |
| C5.7, the row and the decision | B5.12, B5.13 | widened from "the row" to "the row and the decision itself": the closed record shows the same state until the agent acknowledges (`DecisionView.swift`, `ClosedBar`; screen `phone/notpickedup`), SC2 says "by an alert and on the decision", and area 4's B17.8 says the decision "says so too (B5)". Sam to confirm | ⚑ |
| C5.7, not picked up | B5.13 · @M3 | the areas.md pick: the row stays in B5, the alert in B17 (B17.8 cites B5). "3 minutes" kept: Sam's number in SC2. "(C17 alerts once)" → "The owner is also alerted once (B17)". `FlowTests.testAnswerNotPickedUp` holds the row's words and the return to waiting (it skips unless the server runs a short pickup clock); `push.test.ts › not picked up: one alert and a warning when no agent collects an answer in time` holds the service's side |  |
| C5.8 | B5.14 | "after four tries" → "after several tries". The four tries are held by `FlowTests.testUndoChangesAndNotConfirmed` (four failed sends bring the alert, then Retry gets through) and code `AppModel.retryDelays`. "Answer Not Confirmed" → "says the answer is not confirmed", held by the same test. Retry and Cancel → "retry" and "cancel"; Retry is tested, Cancel keeping a draft is code only (`AppModel.cancelNotConfirmed`). `FlowTests.testTwoAnswersNotConfirmed` (two answers named together, both resent) is covered by this clause. "A refusal is never retried" kept; no test holds it |  |
| C5.9 | B5.15 · @M2 | "the tiles are greyed and the bar reads '[name] pager is off' with Turn on" → "the options can't be picked … says that pager is off, by name, and offers to turn it on". `FlowTests.testOffAndOn` holds the disabled options, the off bar and Turn on, not the exact words (code `DecisionView.swift`, `OffBar`). (C22) → (B22). Area 1's B22.4 links here |  |
| C5 caveat 1: the proof shows the agent received and acknowledged the exact answer, not that it acted | B5, third note | kept as a note, with SC1's "AgentPager only carries my answer" in plain words |  |
| C5 caveat 2: the phone draws the brief the command compiled from `card.yaml`, never `card.yaml` itself | B5, first note | the old ledger said clause; kept as a note, since it is how the brief arrives, not something the owner sees. Links B27 |  |

### `packages/blueprint/design/capabilities/C6-send-feedback.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C6.2 | B32.5 | moved (areas.md pick); `cli.test.ts › the binary…` holds the note's exact words |  |
| C6 | B6 · @M1 · Ask for changes in your own words | C→B, same number; title as areas.md |  |
| C6 statement | B6.1, B6.3; B32.5 (area 2) | "the agent receives the exact text" is B32.5 and I6.1; "the decision never changes" links I5 |  |
| C6 serves: SC1, SI3, SI8, SP1 | area 5 Serves | dissolved; SP1's fallback sentence and SI3 quoted |  |
| C6.1, ask and write | B6.1 | "On any open decision" narrowed to "whose pager is on", to agree with B5.15 and B22.4: while off, the phone offers only Turn on (`DecisionView.swift`, `bar`) | ⚑ |
| C6.1, "up to 1,000 characters with no HTML" | B6.2 | "no HTML" kept; "1,000 characters" → "the length a note allows (I4)", as area 3's I4.4 does for every limit but the title's 100. Held by contract test `exchange.test.ts › counts body characters and refuses 1001 whole` and the phone's check in `DecisionView.swift`, `AskChangesView`. The number is Sam's (SI6: "my written feedback allows 1,000"); the root kept I4 as the limits' one home | ⚑ |
| C6.1, same Undo window; final answer | B6.3 | links I6 and I5 |  |
| C6.2 | B32.5 (area 2) | moved per the areas.md pick; B6's first note links it |  |
| C6.3, "The answered decision never changes" | B6.3 | merged; links I5 |  |
| C6.3, the note is that decision's answer only | B6.4 · @M3 | wording only |  |
| C6 caveat: the proof shows the exact text arrived, not that the agent acted or asked again | B6, second note | kept as a note |  |

### `packages/blueprint/design/capabilities/C7-revisit-decisions.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C7 | B7 · @M1 · Reopen an answered decision | C→B, same number |  |
| C7 statement | B7.3, B7.4 | wording only |  |
| C7 serves: SC1, SI3, SI4 | area 5 Serves | dissolved; SC1's look-back sentence, SI3 and SI4 quoted |  |
| C7.1, the "N answered" row, newest first | B7.1 · @M2 | the row itself is B23.5 (area 1), so "an 'N answered' row" → "one row (B23)"; newest first kept (code `AppModel.groups`) |  |
| C7.1, each row's content | B7.2 · @M2 | "a note's bubble" → "a note's mark" (code `PagerView.swift`, `ChoiceBadge`). "green tick" kept: the command's ack reply tells agents the owner sees one (`cli.test.ts › the binary: connect, refusals, ask, wait, ack, …`), and `FlowTests` hold the tick as "Agent confirmed". the drafter wasn't sure Sam meant the colour |  |
| C7.2 | B7.3 · @M2 | "Options table" → "tradeoffs table" (TERMS' card word); code `BriefView.swift` draws the outline; no test asserts it |  |
| C7.3 | B7.4 · @M2 | "Closed decisions can't be changed." kept as its meaning; the example "You chose A · Small + manual" cut, held by `FlowTests.testPagerJourney` ("You chose B", the next steps, no option left to pick); the note in its place held by `FlowTests.testUndoChangesAndNotConfirmed`. "There is nothing to choose or send" links I5.4 |  |
| C7.4 | B7.5 · @M2 | "until their agent has had no activity for 30 days" → "until … their agent is forgotten (I17)": the 30 days live in I17 (area 1) |  |
| C7.5 | B7.6 | it repeats C23.6 (B23); kept here for answered decisions, linking B23. Code `InboxCache.swift` |  |
| C7 caveat 1: history is read on the phone that made the pager; nothing proves another device | B7, note | kept as a note; "history" → "answered decisions", since History in TERMS is the command's record on the agent's machine (B31) |  |
| C7 caveat 2: an image or page not opened since the app started can't be shown offline | L18 · A brief's images and pages need the service | caveat → Limit (people meet it; old ledger "offline attachments"). "What people meet" is the caveat. "Why it waits", "What would fix it" and "When to revisit" are the drafter's words, from the roadmap's rule that a feature waits until owners show they need it; Sam to check | ⚑ |

### `packages/blueprint/design/capabilities/C17-get-paged.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C17 | B17 · @M1 | C→B with the same number; heading "Get paged" kept. @M1: born in MSHIP on 8 Oct, joined MAPP on 9 Oct (3bfec92, DEC-2026-10-09-alerts-in-mapp) |  |
| C17 statement | B17.1, B17.2, B17.4; area Definition | its three parts are already clauses 1, 2 and 4 |  |
| C17 serves: SC2 | area 4 Serves | SC2's three sentences quoted exactly from STRATEGY, with the Vision's pager sentence and SG1's first sentence |  |
| C17.1 | B17.1 | outcome kept: the app asks once, then each pager alerts the phone. "gives its device token to each of its pagers" left to code `AppModel.swift › givePushToken` and test `push.test.ts › alerts: a pager whose phone gave its token alerts when an agent asks and acknowledges` |  |
| C17.2, title, body and expanded alert | B17.2 | the example title "Codex · atomic-pages" left to test `push.test.ts › alerts: a pager whose phone gave its token…`, which asserts the title "Claude Code · alerts" and the body |  |
| C17.2, "as time sensitive" | B17.3 | merged with C17 caveat 2 (Focus mode) into one clause. "Time sensitive" kept: it is the name iOS shows the owner. Test `push.test.ts › alerts: …` holds the level |  |
| C17.3 | B17.4 | (C5) → (B5) |  |
| C17.4, first sentence | B17.5 | wording only |  |
| C17.4, the decision banner with the app open | B17.6 | split from the acknowledgement. @M1: 3809f1a (9 Oct) showed a banner only for a decision from an agent not on screen; fa7e441 reworded it for pagers. B17.6 links B17.8 for the other banner, so neither clause claims a decision is the only alert with one (`Alerts.swift` shows both) |  |
| C17.4, "or a warning" | B17.8, last sentence | moved into the not-picked-up clause, @M3 with it (7a57c01, PR #27) |  |
| C17.5 | B17.7 | the badge, @M1 (3809f1a). Its "on pagers that are on" moved to B17.9, @M2 (fa7e441) |  |
| C17.6 | B17.8 | @M3 (7a57c01, PR #27). "3 minutes" kept: Sam's number in SC2. The alert's exact words left to test `push.test.ts › not picked up: one alert and a warning when no agent collects an answer in time`. (C5) → (B5). The row on the decision stays in B5.13 (areas.md pick: row in B5, alert in B17, B32 notes it) |  |
| C17.7 | B17.9 | @M2 (1176286 and fa7e441, 29 Oct); merged with C17.5's "on pagers that are on"; cites I17. Tests `push.test.ts › alerts: …` ("Off: nothing is sent") and `› not picked up: …` ("no alert while off") hold it |  |
| C17.8 | B17.10 | @M2: `ALERT_EXPIRY_MS` came in 1176286 (29 Oct); in M1 the bound was the pager's end. "24 hours" kept, because the drafter wasn't sure whether Sam chose it. Test `push.test.ts › alerts: …` holds it ("never delivered more than a day late") |  |
| C17.9 | next/ENCRYPT | not built: the encrypted alert. Text: **B17, changed by ENCRYPT.** A new clause: the alert travels encrypted, and the phone decrypts it to show the real question (B30). Old text: "The alert travels encrypted, and an extension on the phone decrypts it to show the real question (C30)."<br>- The design is `docs/v2/04-encryption.md` §5. Each alert carries a small encrypted preview, and a notification service extension with an App Group decrypts it on the phone. If the extension can't decrypt it, the alert says only that there is a new decision.<br>- Once the service can't read decisions, it can no longer write who asked, the project or the question into an alert. B17.2's title and body, and the names in B17.8's alert, must then come from the phone.<br>- ENCRYPT retires area 4's L17 "Alerts pass through Apple as plain text"; quote it under Retires. |  |
| C17 in MENCRYPT's deliverables | next/ENCRYPT | covered by the C17.9 row |  |
| C17 caveat 1: Apple delivers; the proof shows the hand-off to Apple and the phone showing it, not delivery time | B17, first note | kept: delivery time is Apple's and nothing measures it. Dropped: the claim that the proof shows the phone displaying an alert. No test does: `push.test.ts` hands alerts to a stand-in for Apple, and no iOS UI test receives an alert | ⚑ |
| C17 caveat 2: a Focus mode lets the alert through only while time-sensitive alerts are allowed | B17.3 | caveat → clause: it is a promise, and SC2 names it |  |
| C17 caveat 3: until encryption, the question, detail, recommendation and the warning's names pass through Apple as text | L17 · Alerts pass through Apple as plain text (area 4) | caveat → Limit: people meet it, and it waits for ENCRYPT. @M1: the MAPP version of C17 already had it ("The question text passes through Apple's push service"). Widened to match the code: every alert's title (who asked · project) and the acknowledgement's words go as text too (`agent.ts › alertPhone`) | ⚑ |
| C17 caveat 4: alerts need the deployed service; a local server keeps the token but its alerts fail | AGENTS.md › Gotchas | Text: "Alerts need the deployed service. A server on the Mac can't reach Apple's push service, so it keeps device tokens but sends no alerts." The comment at the top of `push.ts` also holds it |  |
| C17 in code comments (`push.ts`, `Alerts.swift`) and `packages/ios/README.md` | stays | they cite `C17::get-paged`; for whoever re-points old ids, since conversion edits no code |  |

### `packages/blueprint/design/capabilities/C18-website-points-to-the-app.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C18 heading "agentpager.me points to the app" and statement | B18 heading "/start tells an agent how to install" | Sam-agreed retitle (built only). The statement's other halves, the front page and the what-we-store note, go to next/SITE below |  |
| C18 serves (SC1, SP5) | area header, Serves | quotes copied from STRATEGY SC1 and SP5 |  |
| C18.1, first sentence: "An agent that reads agentpager.me/start … learns how to install the agentpager command and then how to connect with the number its owner gave it (C25)." | B18.1 | wording only; tested by `packages/app/test/start.test.ts` › "/start and /mcp tell an arriving agent to install the agentpager command; numbers only" |  |
| C18.1: "or the retired agentpager.me/mcp" | B18.4 | path cut to "the retired hosted MCP server's address"; held by the same test (`/mcp` answers with the same page, status 410, and the page says "retired") |  |
| C18.1, second sentence: stop and tell your owner, don't work around it | B18.2 | wording only; same test ("stop and tell your owner") |  |
| C18.1, third sentence: "An agent that reads agentpager.me itself is pointed to /start." | B18.3 | wording only. Built in `packages/app/src/worker.ts` (a non-browser request to `/`); no test reads that reply's body, so the id check will list B18.3 as untested |  |
| C18.2: "*Not built yet: comes with the marketing page.* The front page says what AgentPager does and how to get the app, and gives the one line that installs the command (C29)." | next/SITE | not built. Text for SITE: "The front page says what AgentPager does and how to get the app, and gives the one line that installs the command (B29, once INSTALL builds it)." |  |
| C18.2: "Today it still describes the first version, with QR codes, emoji pairing and a planned Pro plan." | L21 · The front page still describes the first version | a limit people meet today; widened with what the page shows now (`MarketingScreen.tsx` and the catalogue's web/front-page-*): sessions that end, agents needing nothing installed, Download buttons that lead nowhere, and the copy line to /start that still works |  |
| C18.3: "*Not built yet: comes with the marketing page.* A note on the site lists what the service stores and for how long. …" | next/SITE | not built. Text for SITE, whole: "A note on the site lists what the service stores and for how long. For each pager: its public key, its phone key as a digest, whether it is on and when it turns off, and where its phone gets alerts, until the pager is deleted. For each agent: who asked, its project and computer, its key as a digest, and its decisions with their attachments, answers and acknowledgements, until its pager is deleted or it has had no activity for 30 days. The note also says that there is no account, that a pager's name stays on the phone, and that alert text passes through Apple." (Alert text through Apple is area 4's limit until ENCRYPT.) |  |
| C18 caveat: "The page's words are design. Nothing about conversion or comprehension is measured." | B18 note (for /start) + next/SITE (for the front page) | split by page: "/start's words are design: nothing measures whether arriving agents understand and follow them." The front page half goes to SITE as a note |  |

### `packages/blueprint/design/capabilities/C19-try-a-demo-agent.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C19 heading "Try a demo agent" and statement | next/INSTALL | not built; id B19 kept and reserved. Text for INSTALL: "### B19 · Try a demo agent. Try AgentPager without an agent of your own: a demo agent connects to a pager on your phone, asks a sample decision and acknowledges your answer." |  |
| C19 tag "*Not built yet: there is no demo agent; it comes with the TestFlight build.*" | next/INSTALL | whole entry is INSTALL's; the TestFlight link stays as context |  |
| C19.1: "The demo is for App Review's notes and for owners Sam invites; agentpager.me does not offer it publicly (DEC-2026-10-27-pr1-sign-off)." | next/INSTALL B19.1 | moved whole |  |
| C19.2: "The demo agent connects to a pager on the owner's phone as any agent does (C25), asks one sample decision, acknowledges the answer with its next steps, and finishes." | next/INSTALL B19.2 | moved whole; C25 → B25 |  |
| C19.3: "App Review can complete the demo from the review notes alone." | next/INSTALL B19.3 | moved whole |  |
| C19 caveat: "The demo shows the exchange, not an agent's judgement." | next/INSTALL B19 note | moved whole |  |
| C19 serves (SC1, SC2) | dropped | frontmatter serves dissolve; INSTALL's doc may quote them when B19 is built |  |

### `packages/blueprint/design/capabilities/C22-turn-a-pager-off-and-on.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C22 statement | B22 heading | id C→B; retitled "Turn a pager off and on, or delete it", since the statement and C22.6 cover delete |  |
| C22 serves (SI2, SI5, SP1, SP6) | area Serves line; I17 Why | quotes from SI2 and SI5 |  |
| C22.1 | B22.1 | kept. "opens from the gear (C23)" → B23.3; "The name lives only on the phone" → B26.2 |  |
| C22.2 off refusal, nothing queued | I17.2, I17.3 | merged into the invariant, its one home; B22.3 links I17. Exact refusal text cut, held by `pagers.test.ts › off: nothing gets through and nothing is queued…` (asserts "This pager is turned off. Your message was not delivered.") and `contract.ts` `refuse.pagerOff` |  |
| C22.2 "The agentpager command tells the agent to ask again once the owner turns it on, or to ask for another number" | I17.2 (1 Pagers); B25.9 for a connect (2 Agents) | the agent's side of an off pager. Its one home is I17.2's last sentence, which the integrator added from this line; held by `cli/src/commands.ts` `offNotSent` |  |
| C22.3 row "Off since 9:40 AM" / "Off since yesterday", grey dot | B22.2 + B22 note | outcome kept; strings kept as note examples; held by `Wording.status`, `PagersView.swift`; `FlowTests.testOffAndOn` asserts "Off since" | ⚑ |
| C22.3 keeps everything, readable, can't answer until on | B22.4 | kept |  |
| C22.3 bar "[name] pager is off" with Turn on (C5) | B5 (5 Answering, old C5.9) | one home in B5; B22.4 links it |  |
| C22.4 | B22.5 | kept |  |
| C22.5 choices and counting | B22.6 | kept (Sam's numbers); held also by `pagers.test.ts › auto-off lands in the same off state…`, `contract.ts` `AUTO_OFF` |  |
| C22.5 "Active · Stays on" / "Active · Turns off in 18h" | B22.2 + B22 note | outcome kept; strings kept as note examples; held by `Wording.status`, catalogue `phone/pagers.txt` |  |
| C22.5 "lands in the same off state … off since it was due" | B22.7 | kept |  |
| C22.6 confirm | B22.9 | kept; "Delete pager" label cut, held by `PagerDetailView.swift`, `FlowTests.testDeletePager` |  |
| C22.6 removal and service deletion | B22.10 + I17.5 | the list of what the service deletes, and "next call finds it forgotten, number connects nothing", go to I17.5 |  |
| C22.7 | B22.8 | kept |  |
| C22 Never 1 | I17.2, I17.3 | merged |  |
| C22 caveat 1 (no real 24h/7d/30d wait; local clocks) | dropped | held by the comment on `clocks` in `packages/app/src/env.ts` and `packages/app/README.md` › Limits ("The local auto-off and housekeeping proofs run on seconds, not the production days") |  |
| C22 caveat 2 (stops agents reaching the owner, not the agents) | B22.3 | caveat → clause |  |

### `packages/blueprint/design/capabilities/C23-pagers-and-the-pager-screen.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C23 statement | B23 heading | id C→B, title kept |  |
| C23 serves (SC1, SI2, SP6) | area Serves line | as C26 |  |
| C23.1 rows | B23.1 | outcome kept. Cut "green dot … grey", "blue badge": held by `PagersView.swift` `PagerRow`; open count asserted by `FlowTests.testPagerJourney` ("3 open"). "status worded as in C22" → B22.2 link | ⚑ |
| C23.1 "Rows show no number" | B26.8 | merged |  |
| C23.1 empty state | B23.2 | kept |  |
| C23.1 "The + button makes a pager (C26)" | B26.1 | merged |  |
| C23.2 | B23.3 | outcome kept; "gear" cut, held by `PagerView.swift` toolbar (`pager-settings`, driven by FlowTests) | ⚑ |
| C23.3 | B23.4 | kept |  |
| C23.4 | B23.5 | outcome kept; exact "N answered" and "5 answered · Codex, pi" cut, held by `PagerView.answeredLabel` and catalogue `phone/pager.txt` | ⚑ |
| C23.5 | B23.6 | outcome kept; "about every 3 seconds" cut, held by `AppModel.pollSeconds`; FlowTests waits about 5 s for the badge. The measured bar is K1 (next/FRIENDS) | ⚑ |
| C23.6 "lists the pagers whose keys it holds, as the service reports" | B23.7 | kept |  |
| C23.6 "the service knows no pager's name" | B26.2 | merged; held by `pagers.test.ts` ("the name stays on the phone") |  |
| C23.6 "A pager the service says no longer exists is dropped" | B23.7 | kept |  |
| C23.6 unreachable: last read, "Can't Reach Server" with when | B23.8 | outcome kept; exact title cut, held by `AppModel.statusLine` | ⚑ |
| C23 Never 1 | B23.9 | Never → clause |  |
| C23 caveat 1 (the list belongs to one phone) | L9 "A pager lives only on the phone that made it" + B23.9 | caveat → limit, merged into L9 |  |
| C23 caveat 2 (keys on this device only) | Limit, same | merged |  |
| C23 caveat 3 (refresh only while open; closed app learns only through alerts) | B23.6 second sentence | caveat → clause |  |
| C23 caveat 4 (pagers belong to the server they were made on) | B23.10 | caveat → clause, joined with D6's Settings bundle part |  |

### `packages/blueprint/design/capabilities/C25-connect-with-a-pager-number.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C25 statement | B25 heading, B25.4, I21.1 | dissolves into the heading and clauses |  |
| C25 serves SC1, SI2, SP5 | header Serves | SC1 and SP5 quoted exactly; SI2's substance is B25.7 |  |
| C25.1 | B25.1 | the text names the pager's own server (B26.4), whose /start tells an agent how to install the command, as `AppModel.instructions` and `worker.ts` do; the old line said agentpager.me, untrue for any other server, dev included. "For example in AGENTS.md" becomes a note | ⚑ |
| C25.2 | B25.2 | `agentpager connect <number>` and "the connect tool" become "connects from the command line or through the command's MCP server", held by `cli.test.ts › the binary: connect, refusals…` (both ways). `AGENTPAGER_PAGER` kept: Sam confirmed it on 29 Oct as the opt-out for keeping the number out of transcripts (docs/v2/HANDOFF.md); the same test connects with it |  |
| C25.3 | B25.3 | `--app` and `--project` cut to "names itself" and "unless the agent names one", held by `cli.test.ts › the binary…` and `binary.test.ts › the compiled binary…`. "Claude Desktop" made precise as "a Claude Desktop chat", and "whatever the agent passes" spelled out from `commands.ts › connect`, held by `wait.test.ts › waiting words…` (a chat passing "Claude" is named Claude Desktop) |  |
| C25.4 | B25.4, I21.2 | "even with the same app and project; nothing matches agents by name" moves to I21.2, its one home |  |
| C25.5 | B25.5 | exact reply and the `ap-7f3k` example left to `cli.test.ts › the binary…`, which asserts the whole reply. "Before your first card: agentpager rules" becomes a prompt to read the card contract (B27) |  |
| C25.6 | B25.6 | `~/.agentpager/agents/` and `--agent <id>` cut; held by `store.ts` and `cli.test.ts › the binary…` (the file under `agents/` is mode 600). Adds "is never printed", held by the same test ("the key is never printed") and `decode.test.ts › an agent file that can't be read…` | ⚑ |
| C25.7, first sentence | B25.8 | adds "has been deleted", from I17 and J4 step 7, held by `pagers.test.ts › delete takes the agents…`. Exact refusal left to `cli.test.ts › the binary…`; the fingerprint mismatch is held by `pagers.test.ts › pagers and agents…` |  |
| C25.7, second sentence | B25.9 | exact refusal left to `cli.test.ts › the binary…` (connect while off) |  |
| C25.8 | B25.7 | merged with Never 1 |  |
| C25 Never 1 | B25.7 | turned from a Never into a clause; meaning kept |  |
| C25 Never 2 | B25.9 | "makes no agent"; `pagers.test.ts › off: nothing gets through…` shows the refused connect adds no agent |  |
| C25 caveat 1 (128-bit id, by construction) | B25 note | caveat stays a note |  |
| C25 caveat 2 (who asked from the environment; `--app` unchecked) | B25.3, B25 note | how it's detected is code (`detect.ts` MARKERS, NAMES, CLIENTS); "nothing checks the name" is a note |  |

### `packages/blueprint/design/capabilities/C26-make-a-pager-on-the-phone.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C26 statement | B26 heading | id C→B, title kept; statement dissolves into B26.1–.9 |  |
| C26 serves (SC1, SI2, SP6) | area Serves line | quotes from SC1, SI2 and SP6 copied exactly from STRATEGY |  |
| C26.1 | B26.1, B26.2 | outcome kept: start a pager from Pagers, name, turn-off choice, Never default. Cut "+", "a sheet with Cancel and Create and no grab handle": held by `PagersView.swift` (new-pager button) and `PagerDetailView.swift` `NewPagerSheet` (`presentationDragIndicator(.hidden)`), drawn in catalogue `phone/new.png`, driven by `FlowTests.makePager`. "Name only this phone sees" → B26.2 | ⚑ |
| C26.2 first sentence | B26.3 | outcome kept: number made on the phone, text shown before Create, copied as one block. "Key pair" → I19 (6 Privacy), linked. Cut label "Give agents this" and "copy icon": held by `PagerDetailView.swift` `InstructionsBlock`, catalogue `phone/new.txt` | ⚑ |
| C26.2 code block (the text given to agents) | B26.4 (outcome) + B26 note (exact text) | the clause now promises what the text names; the exact wording is kept as a note, not a promise. Held by `AppModel.instructions` and catalogue `phone/new.txt`, `phone/detail.txt`; no test asserts it. Sam chose it on 29 Oct (docs/v2/01, App structure) and pastes it into AGENTS.md files, so Sam may mean it as a promise | ⚑ |
| C26.2 "--server" sentence | B26.5 (@M3) | outcome kept; flag name cut, held by `AppModel.instructions`. Tagged @M3: `--server` reached the text in 8a64d0e (PR #24, MCOMMAND); in M2 the text only named the server's host (03aec45), which is B26.4 | ⚑ |
| C26.3 "registers … number, public key, when it turns off" | B26.6 | outcome kept; what is sent cut, held by `pagers.test.ts › pagers and agents: the phone makes a pager…` (create body) |  |
| C26.3 "service refuses a number whose fingerprint does not name that key (I19)" | I19 (6 Privacy) | moved to its one home; B26.3 links I19 |  |
| C26.3 "new pager opens, active and with no decisions yet" | B26.6 | kept |  |
| C26.4 | B26.7 | kept; "sheet" → New pager |  |
| C26.5 | B26.8 | kept; merged with C23.1 "Rows show no number" |  |
| C26.6 | B26.9 | kept |  |
| C26 caveat 1 (keys in this phone's Keychain, device only, no backup, no recovery) | L9 "A pager lives only on the phone that made it" | caveat → limit; merged with C23 caveats 1–2. Why/fix from MPAGERS and MENCRYPT "Out of scope"; revisit from step 0's ★ sample. Device-only held by `Keychain.swift` (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) |  |
| C26 caveat 2 (text works only once the command is installed, C29) | B26 note | caveat → note, linking B29 and B18. It names the server's /start, not agentpager.me, as B25.1 does |  |

### `packages/blueprint/design/capabilities/C27-review-a-card-before-sending.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C27.4, how to wait | B32.1 | moved (areas.md pick). The "Sent." reply stays in B27 |  |
| C27 | B27 · @M3 | C→B with the same number; heading "Review a card before sending" kept |  |
| C27 statement | B27.3, B27.5; I22.1 | dissolved into the clauses that say it: one review, refuse only broken structure, one line per problem |  |
| C27 serves: SI11, SG2, SP1, SP8 | area 3 Serves | SC1's decision sentence, SI11's first sentence, SI6's heading and the two Strategic Design Decisions about the rules and `card.yaml` quoted exactly. SG2, SP1 and SP8 aren't quoted here: SP1 and SP8 are how the phone reads a decision (5 Answering) |  |
| C27.1 contract, "twelve points", "two minutes" | B27.1 | outcome kept, with "two minutes" (a Sam-decided writing target, 29 Oct, docs/v2/01-decisions). "Twelve points" cut: the points live once, in `packages/cli/src/rules.ts` `CONTRACT`; `cli.test.ts › the binary: connect, refusals, ask, wait, ack, status, history, off, finish, and the same over MCP` asserts point 12 in the ask tool's description |  |
| C27.1 `agentpager rules` prints the contract, template and example | B27.1 | kept. Added: `agentpager example` writes that example out to start from (built: `main.ts`, `commands.ts › example`; no old line named it) | ⚑ |
| C27.1 "every connect ends by prompting the agent to read it" | B27.1 → B25.5 (2 Agents) | one home: the connect reply's prompt is B25's; B27.1 links to it. Exact "Before your first card: agentpager rules" left to `cli.test.ts › the binary: …` |  |
| C27.1 MCP ask tool description | B27.2 | kept |  |
| C27.2 review prints the list then the card; grades; quoting | B27.3 | kept; "as twelve points" cut, held by `rules.ts` `REVIEW` and `cli.test.ts › the binary: …` (the review block starts "Review this decision card" and ends with the card). The grades ok, good to fix and must fix kept: they are TERMS' words (Review) |  |
| C27.2 the writer's one round | B27.4 | reworded as what the card contract tells the agent, since the command can't make it happen (see the limit) | ⚑ |
| C27.3 | B27.5; I22.2–I22.6 | one home: the list of what `ask` refuses lives in I22, and B27.5 links to it |  |
| C27.4 "Sent.", the question and detail as the owner sees them | B27.6 | outcome kept; exact reply text left to `cli.test.ts › the binary: …` |  |
| C27.4 the short id and how to wait in the agent's own app | B32.1 (2 Agents) | moved, per `areas.md` "Ids that don't fit"; B27.6 links (B32). The example id `d_2x8w` is left to B32 |  |
| C27.5 an eleventh open decision, "10 unanswered" | B27.7 | outcome kept; "10" cut, held by `MAX_OPEN_DECISIONS` in `packages/contract/exchange.ts` and `pagers.test.ts › pagers and agents: the phone makes a pager, every connect is a new agent, the phone reads them all` ("Ten unanswered decisions per agent"). Exact refusal words in `packages/app/src/contract.ts` and `packages/cli/src/commands.ts` |  |
| C27.5 "and anything while the pager is off (C22)" | B27 note 2 → I17 (1 Pagers) | one home: I17 says what an off pager refuses |  |
| C27.6 reminder after 2 hours or 5 cards | B27.8 | kept with its numbers: Sam confirmed a contract reminder after 2 hours or 5 cards as a default on 29 Oct (docs/v2/HANDOFF.md, "Decisions already made"), but docs/v2/02 §6.3 says "tune after the first week", so the drafter is unsure Sam means the numbers. If not, cut them to `REMINDER_MS` and `REMINDER_CARDS` in `commands.ts`. The fifth card is held by `cli.test.ts › the binary: …`; no test holds the 2 hours |  |
| C27.6, what restarts the count | B27 note 3 | new note, from the code: connect, `rules` with the agent's id, and each reminder reset `rulesShownAt` (`commands.ts`) |  |
| C27 Never 1 "`ask` refuses or holds a card for how it is written" | I22.7 | merged with I22 ¶1 s3 and I22's breaking 2 and 3 |  |
| C27 caveat 1, "the command judges nothing" | B27.3 | becomes a clause |  |
| C27 caveat 1, "nothing proves that the agent ran the review or followed it" | L16 · Nothing makes an agent review its card | a caveat people meet becomes a limit (BRIEF rule 5): the owner gets the badly written card. Why, fix and revisit from docs/v2/01-decisions ("start here and see", 29 Oct) and docs/v2/02 §6.4. The old ledger sent it to a test comment | ⚑ |
| C27 caveat 2, an agent calling the service directly | I22 note 2 | merged with I22 caveat 1 |  |

### `packages/blueprint/design/capabilities/C29-install-the-command-with-one-line.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C29 heading "Install the command with one line" and statement | B29 heading "Set up the command in agent apps" | Sam-agreed retitle (built only). "Install … with one line" goes to next/INSTALL with C29.1 |  |
| C29 serves (SP2, SP5) | area header, Serves | quotes copied from STRATEGY SP2 and SP5 |  |
| C29.1: "*Not built yet: comes with the release builds.* One line, `curl -fsSL agentpager.me/install \| sh`, installs the command as a single file for the machine." | next/INSTALL | not built. Text for INSTALL: "One line installs the agentpager command as a single file built for the machine (planned: `curl -fsSL agentpager.me/install \| sh`). B29 then widens back to installing, and /start (B18) and the front page (SITE) give that line." |  |
| C29.1: "Today the command is built from the AgentPager repository with git, Node 22.19 or newer, pnpm and Bun, as agentpager.me/start says (C18)." | L22 · The command installs only from source | a limit people meet today. The Node version is cut; it is held by `packages/app/src/start.ts` (the /start text) and the root `package.json` engines |  |
| C29.2: "`agentpager setup` adds the command's MCP server to each agent app it finds: Claude Code and Codex through their own commands, and Claude Desktop and Cursor through their config files." | B29.1 | app names kept (Sam's MCOMMAND objective names them). How each app is reached is cut, per A20, to `packages/cli/src/setup.ts`; `packages/cli/test/setup.test.ts` covers the Desktop and Cursor config files, while Claude Code's and Codex's own commands run only in the code and Sam's dogfood |  |
| C29.2: "Running it again changes nothing" | B29.2 | wording only; `setup.test.ts` › "setup adds the MCP entry … idempotently; --print changes nothing" |  |
| C29.2: "`--print` says what it would change and changes nothing" | B29.3 | flag name cut; held by the same test |  |
| C29.2: "A config file it can't read whole is left alone, and setup says what to add by hand." | B29.4 | wording only; same test (a commented config is left byte for byte) |  |
| C29.2: "Claude Desktop needs a restart afterwards." | B29.5 | now says setup tells the owner, which it does; same test ("restart Claude Desktop") |  |
| C29.3: "The command is one program: a command line and, run as `agentpager mcp`, a local MCP server over stdio, whose tools give the same replies as the commands." | B29.7 | `agentpager mcp` and stdio cut; held by `packages/cli/test/cli.test.ts` › "the binary: connect, … and the same over MCP" and `binary.test.ts`, code in `packages/cli/src/mcp.ts` |  |
| C29 caveat 1: "setup writes Claude Desktop's config where macOS keeps it." | B29 note | a note, not a promise |  |
| C29 caveat 2: "Each MCP entry names the command by its path. Moving the command breaks the entries until setup runs again." | L23 · Moving the command breaks its setup | a limit people meet today; the repository case added because /start's install links the command from the repository's build |  |

### `packages/blueprint/design/capabilities/C30-decisions-are-encrypted-end-to-end.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C30 heading and statement: "Decisions are encrypted end to end … so the service can't read them" | next/ENCRYPT, as B30 whole | Not built. B30 keeps its id and waits whole in ENCRYPT; its heading is born there. Text for ENCRYPT: "Your decisions, their attachments, your answers and your agents' acknowledgements are encrypted between the agent's machine and your phone, so the service can't read them." |  |
| C30 intro note "Not built yet … behaviours 1 and 2 … The rest is to come" | dropped | A status note; the split itself replaces it: built clauses in I19, the rest in next/ENCRYPT |  |
| C30.1 | I19.1 | Folded into I19 (brief rule 2). "In its Keychain" cut from the clause: the Keychain is named in Relies on and held by `Keychain.swift › Keychain.save`. That the keys never leave this phone or reach backups is area 1's (B26 Relies on and its lost-phone limit) |  |
| C30.2 | I19.2, I19.3 | Folded. "The first 8 bytes of the SHA-256" cut from the clause and kept as I19's first note. Held by `packages/app/test/support.ts › pagerKeys`, `worker.ts › fingerprint`, `Keychain.swift › LocalPager.make`. The refusal at make is tested by `pagers.test.ts › pagers and agents: the phone makes a pager, every connect is a new agent, the phone reads them all` |  |
| C30.3 | next/ENCRYPT (I19's new clause) | Not built: the command checks the pager's public key against the number before it encrypts anything to it. Same promise as I19's command-side check (below), so its one home is I19, and B30 links to it |  |
| C30.4 | next/ENCRYPT (B30) | Not built. Text: "The command encrypts each decision and its attachments, and who asked, the project and the computer, to the pager's key, and gives the service the agent's own public key at connect. The phone encrypts its answer to the agent's key, and the agent encrypts its acknowledgement to the pager's key." |  |
| C30.5 | next/ENCRYPT (I20) | Not built: the service stores and passes on only ciphertext, with what it needs to route it. The same promise as I20, so one home there; B30 links to it |  |
| C30.6 | next/ENCRYPT (B30, linking B17's new clause) | Not built: alerts carry ciphertext, and an extension on the phone decrypts them to show the real question. Area 4 sent the same clause as B17's change (ledger-4, C17.9); the ENCRYPT drafter keeps one home |  |
| C30 caveat 1: the service still sees which pager and agent, when, and sizes | next/ENCRYPT | A limit once encryption is built (it describes the encrypted product). Also ENCRYPT's out of scope, as MENCRYPT.md says |  |
| C30 caveat 2: nothing protects a phone or agent machine someone else controls | next/ENCRYPT | A limit once encryption is built |  |
| C30 serves SI10 | I19 Why (its first half); next/ENCRYPT Objective (whole) | Ids are gone. The half of SI10's sentence that holds today is I19's Why, and ENCRYPT's Objective quotes the whole sentence |  |
| — (C30 caveat 2) | next/ENCRYPT.md Out of scope 3 "Protecting a phone or an agent's machine that someone else controls." | ledger-6 sends the caveat to ENCRYPT; this is its home |  |

### `packages/blueprint/design/capabilities/C31-history-on-the-agents-machine.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| C31 statement | B31 heading, B31.1–.3 | dissolves |  |
| C31 serves SC1, SG2 | header Serves | SG2 isn't quoted; the area's quotes cover what B31 serves (notes are answers, never guidance) |  |
| C31.1 | B31.1 | `~/.agentpager/history/<pager>.jsonl` and `AGENTPAGER_HOME` cut; held by `store.ts` (historyPath, home) and by every CLI test, which sets `AGENTPAGER_HOME` (`decode.test.ts › a 200 that isn't AgentPager's reply…` checks the history folder). "Only the machine's user can read" kept; `store.ts` holds it, no test does |  |
| C31.2 | B31.2 | `agentpager history --agent <id>` and "the history tool" become "an agent can read"; "20 unless asked for more" becomes "the most recent decisions unless asked for more". The 20 is held by `commands.ts › history`, no test. The fields are held by `cli.test.ts › the binary…` | ⚑ |
| C31.3 | B31.3 | unchanged |  |
| C31.4 | B31.4 | 1,000 kept: Sam confirmed the cap on 29 Oct (docs/v2/HANDOFF.md). Held by `store.ts` HISTORY_CAP, no test |  |
| C31 caveat 1 (only what this machine asked) | B31 note |  |  |
| C31 caveat 2 (an answer is recorded once received here) | B31 note |  |  |
| C31 caveat 3 (deleting a pager leaves its history) | L15 · Deleting a pager leaves its agents' files | caveat → Limit, merged with I17 caveat 4 (the agent files stay too). "What would fix it" and "When to revisit: FRIENDS" are assumed | ⚑ |

### `packages/blueprint/design/invariants/I3-independent-decisions.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I3 · Independent decisions (deprecated) and its caveat | retired; M1 › Retires names it | already a tombstone: I18 replaced it once there was no pairing card, and its caveat is I18's note. git keeps it at tag `blueprint-old-format` |  |

### `packages/blueprint/design/invariants/I4-payloads-refused-whole.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I4 | I4 · @M1 | heading reworded from "Payloads refused whole" to "What doesn't fit is refused whole, never cut": "payloads" isn't a TERMS word |  |
| I4 serves: SI6, SI8 | I4 Why; area 3 Serves | SI6's "Anything else is refused whole…" sentence quoted as the Why (A7). SI8 is how the owner answers the exact version (5 Answering) |  |
| I4 statement | I4.1 | kept |  |
| I4 ¶1 s1, visible characters, a combined emoji counts as one | I4.3 | kept; SI6's "Count spaces and Markdown punctuation" joined to it. Held by `values.test.ts › Text accepts exactly 280 visible characters, counting a combined emoji as one` |  |
| I4 ¶1 s2, what is refused, with a reason that says what to fix, writing nothing | I4.1, I4.2 | split in two. Held by `briefs.test.ts › briefs: refused whole, with a reason that says what to fix` ("nothing refused was stored") and `exchange.test.ts › rejects excess card fields and unknown card types rather than silently dropping them`, `› refuses malformed Unicode in card prose`, `› refuses an answer naming an option the card does not offer`. Raw bytes that aren't UTF-8 are refused by `shared.ts › body`, which no test sends. I4.2 names the field only when there is one: a body that isn't JSON, or an option the card doesn't offer, has none (`shared.ts`, `agent.ts`) |  |
| I4 ¶1 s3, a wrong key wins over invalid input | I4.6 | kept; `keys.test.ts › a wrong key wins over invalid input` |  |
| I4 ¶2 s1, the command holds a card to the same schemas | I4.8 → I22.6 | merged: I4.8 links to I22, where the check lives; `@M3:` per `areas.md` |  |
| I4 ¶2 s2, compiling `card.yaml` trims spaces and joins wrapped lines | I4.8 | kept, `@M3:`. held by `cli.test.ts › the binary: …` ("hard-wrapped prose is joined") and `› review rounds: concurrent asks, an unwritable home, attachments, unsafe cells, fences, bad input` (a fenced diff kept whole) |  |
| I4 ¶3 s1, stores exactly the text it accepts | I4.7 | kept; `briefs.test.ts › briefs: the four canvas examples ask, read back as sent, answer, and go with the pager when it is deleted` |  |
| I4 ¶3 s2, the decision screen shows it whole | I4.7 | kept; no test checks that the phone shows the whole text (untested clause) |  |
| I4 ¶3 s2, a list row or an alert may shorten a long question | I4 note 1 | note. The cuts are in `PagerView.swift` (line limits) and `push.ts › questionBody` |  |
| I4 breaking: "a title stored cut to fit, or a `<script>` that reaches the phone" | dropped | they restate I4.1 and I4.5; held by `values.test.ts › holds a title to 100 visible characters` and `briefs.test.ts › briefs: refused whole, …` ("HTML outside code"). Tests aren't renamed in M4 (simplification 5), so A6 doesn't apply |  |
| I4 caveat 1, HTML detection is an opening tag or a comment; `<` or `>` as text passes | I4.5 | outcome kept; the exact rule left to `ValidProse` in `packages/contract/values.ts` and `values.test.ts › Text refuses HTML, lone surrogates and blank text, and keeps Markdown` |  |
| I4 caveat 2, HTML only outside fenced code and code spans | I4.5 | outcome kept; fences and code spans left to `brief.ts › proseLines, withoutCodeSpans` and `brief.test.ts › treats fenced code as code: HTML and headings inside it are text`, `› pairs code spans by equal backtick runs, so an unpaired run hides no link` |  |

### `packages/blueprint/design/invariants/I5-answers-never-change.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I5 | I5 · @M1 · Answers never change | kept |  |
| I5 statement | I5.1, I5.4 | wording only |  |
| I5 serves: SI3, SI8 | I5 Why | SI3 quoted exactly. SI8 not quoted |  |
| I5 body, "Repeating a send with the same request id returns the stored receipt. Changing its input, or answering again with a new request id, is refused." | I5.2 | outcome kept: the stored receipt comes back only for the same request, as the phone resends it after a lost reply (its first request id, the same answer), and any other send to an answered decision, even of the same option, is refused, as `agent.ts › answer` does. "Request id" is cut. No test sends a replay or a second answer; code only: `agent.ts` (`answer`, `AlreadyAnswered`) and `AppModel.swift` (`PreparedAnswer.requestId`) | ⚑ |
| I5 body, "An acknowledgement cannot be replaced." | I5.3 | held by `cli.test.ts › the binary: …` ("only the first acknowledgement counts") and the `acknowledgement_immutable` trigger in `agent.ts` |  |
| I5 body, the 31 Oct rewrite of decisions stored with `kind` and option emoji | I5, first note | kept as a note, since the code still makes it on an old agent's first start; `kind`, the emoji, PR #33 and DEC-2026-10-30-v2-promises cut (git and the DEC hold them). Held by `briefs.test.ts › briefs: a decision stored with kind and keycaps reads back without them` |  |
| I5 caveat: nothing proved about tampering below the API | I5, second note | kept as a note |  |

### `packages/blueprint/design/invariants/I6-send-and-acknowledgement.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I6 | I6 · @M1 · Only Send sends, and only the agent acknowledges | retitled from "Send and acknowledgement" to a short promise |  |
| I6 statement | I6.1, I6.2, I6.6 | "only Send submits the frozen answer" → "sends … the answer as it stood when Send was pressed"; C5's "the agent receives exactly that answer" joins I6.1 |  |
| I6 serves: SI1, SI4 | I6 Why | SI1's rule and SI4's first sentence quoted exactly |  |
| I6 body, "The Undo window lasts five seconds. Undo cancels the send and reopens the decision with the choice kept." | I6.2 | "five seconds" kept: Sam's number, in TERMS' Undo window. `FlowTests.testPagerJourney` holds the wait ("the answer waited out the Undo window"); `FlowTests.testUndoChangesAndNotConfirmed` holds Undo keeping the choice and nothing sent |  |
| I6 body, leaving the app sends at once | I6.3 | `FlowTests.testUndoChangesAndNotConfirmed` ("sent on leaving, before the 5 s window ran out") |  |
| I6 body, off or deleted inside the window | I6.4 · @M2 | per the areas.md pick. `pagers.test.ts › off: …` holds the service refusing the phone's answer while off; the phone's side and the delete case are code only (`AppModel.commit`) |  |
| I6 body, "A send with no reply is tried four times … A refusal is never retried, and Retry resends the same answer." | B5.14 | merged: it repeated C5.8 |  |
| I6 body, "Reads never reset a draft." | I6.5 | "Reads" → "The phone's refreshes"; "draft" is TERMS' word. No test holds it |  |
| I6 "Breaking this looks like" (4 examples) | I6.1, I6.2, I6.6, I6.7 | each example names its clause's test when a milestone next touches those tests (A6): an option that sends on tap (I6.1), an answer stored after Undo (I6.2), the phone marking the answer confirmed straight after Send (I6.6), a read turning it confirmed without an acknowledgement (I6.7) |  |
| I6 caveat 1: a network capture shows what the app sent, not a modified client | I6, second note | kept as a note; links I4 |  |
| I6 caveat 2: an acknowledgement proves the agent read the answer, not that it did the work | I6, first note | the old ledger said clause; kept as a note, since it is a disclaimer with nothing to test |  |
| I6 caveat 3: the service records the first read only for the warning; reading is not acknowledging | I6.7 | caveat → clause: it is a promise, and SI4 makes it one. Held by `push.test.ts › not picked up: …` ("collected is not acknowledged") and contract test `exchange.test.ts › records collection and the pickup warning only for an answer, and neither is an acknowledgement`. Area 2's B32 notes link here |  |

### `packages/blueprint/design/invariants/I17-off-pagers-deliver-nothing.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I17 statement | I17 heading | kept; statement dissolves into I17.1–.6 |  |
| I17 serves (SI2, SI5) | I17 Why; area Serves line | Why quotes SI2 exactly (new: no Why existed; ★ A7) |  |
| I17 ¶ What turns a pager off: owner's switch or auto-off; nothing else; no activity puts it off | I17.1 | kept |  |
| I17 ¶1 durations "never, or 24 hours, 7 days or 30 days after it was last turned on (C22)" | B22.6 | one home in B22; I17.1 links B22 |  |
| I17 ¶1 "Auto-off lands in the same off state …" | B22.7 | duplicate of C22.5; one home |  |
| I17 ¶ While off: refused calls, connects, phone answers | I17.2 | kept; exact message cut (see C22.2 row) |  |
| I17 ¶2 "Nothing is queued: nothing refused arrives later" | I17.3 | kept |  |
| I17 ¶2 agent can ask whether on; phone reads everything | I17.4 | kept |  |
| I17 ¶2 "turning the pager on makes the open ones answerable again" | B22.5 | duplicate; one home |  |
| I17 ¶ When it is deleted | I17.5 | kept |  |
| I17 ¶ Housekeeping | I17.6 | kept (30 days: Sam's number); held also by `pagers.test.ts › delete takes the agents…; housekeeping forgets an idle agent`, `contract.ts` `AGENT_IDLE_MS` |  |
| I17 Breaking 1 | I17.2, I17.3 | list dropped; it restates the clauses (★ A6: becomes test names when tests are touched) |  |
| I17 Breaking 2 | I17.1 | as above |  |
| I17 Breaking 3 | I17.5 | as above |  |
| I17 caveat 1 (no real waits; local clocks) | dropped | held by `env.ts` `clocks` comment and `packages/app/README.md` › Limits |  |
| I17 caveat 2 (retention in backups, Cloudflare point-in-time recovery, not proved) | I17 note | caveat → note, worded as "nothing is claimed", as `packages/app/README.md` › Limits says |  |
| I17 caveat 3 (deleted pager's agents told at once; retried every minute; forgets itself on next call) | dropped | outcome is I17.5; the retry is held by the comment on `Registry.erase` in `registry.ts` and on `pagerState` in `agent.ts` |  |
| I17 caveat 4 (the command's files, history among them, stay after delete) | I17 note → 2-agents L15 "Deleting a pager leaves its agents' files" | the limit lives in 2-agents (merged there with C31 caveat 3); the note links it by name |  |

### `packages/blueprint/design/invariants/I18-independent-cards.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I18 | I18 · @M1 · Decisions are independent | retitled from "Independent cards": "decision" is TERMS' word for one question and its answer |  |
| I18 statement | I18.1 | wording only |  |
| I18 body | I18.2 | wording only |  |
| I18 serves: SI7, SI8 | I18 Why | SI7 quoted exactly (old ledger: SI7 absorbed into I18's Why) |  |
| I18 caveat: no proof tries every order | I18, note | kept as a note |  |

### `packages/blueprint/design/invariants/I19-the-number-names-the-phones-key.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I19 heading "The number names the phone's key" | I19 · @M2 · The number names the pager's key | Retitled: "the phone's key" reads as TERMS' "phone key", the bearer key, but it means the pager's public key. Meaning kept |  |
| I19 serves SI2, SI10 | I19 Why: "The pager number binds my phone's key" | A new Why line, quoted exactly from SI10 (A7: Sam approves Why lines). SI10 may stay out of PRODUCT.md (A18), so the quote's source is STRATEGY.md, and ENCRYPT's Objective quotes it whole. The Why stops before "so the service can't swap it", which holds only once ENCRYPT builds the command's check (the sanity review's finding); the Why says so | ⚑ |
| I19 statement, sentence 1 | I19.2 |  |  |
| I19 statement, sentence 2, first half (makes no pager …) | I19.3 |  |  |
| I19 statement, sentence 2, second half (connects no agent …) | I19.4 |  |  |
| I19 body, sentence 1: number from the 16-byte id and the first 8 bytes of SHA-256, `ap1_` and 32 more characters (C26) | I19.2; I19 note 1 | Lengths cut from the clause. Held by `support.ts › pagerKeys`, `Keychain.swift › LocalPager.make`, `worker.ts › parseNumber`, `store.ts › pagerOf` and `packages/contract/exchange.ts › PagerNumber`. "`ap1_` and 32 more characters" stays in TERMS (Pager number) |  |
| I19 body, sentence 2: at make, the service works out the fingerprint and refuses a mismatch | I19.3 | Test `pagers.test.ts › pagers and agents: …` (a mismatched key is refused, and the reason names the fingerprint) |  |
| I19 body, sentence 3: at every connect, a mismatch is refused as a number not in use | I19.4 | Test `pagers.test.ts › pagers and agents: …` (bad numbers get NumberInvalid). The refusal's words are B25's |  |
| I19 body, sentence 4: a number for another pager, or with any character changed, connects nothing | I19.5 | "For another pager" made plain as "for a pager that doesn't exist". Test `pagers.test.ts › pagers and agents: …` (a fresh number, and the last character changed) |  |
| I19 command-side check, "Not built yet" | next/ENCRYPT (I19, a clause added by ENCRYPT) | Not built: `packages/cli/src` has no fingerprint check, and the service has no route that gives a pager's public key (5 Nov). Text: "Before it encrypts anything to a pager, the command fetches the pager's public key, works out the fingerprint and refuses on a mismatch, so a service that swaps the key is caught on the agent's machine." The mismatch gets its own reply, telling the agent to check the number and, if it's right, to stop and tell its owner (docs/v2/03 §4) |  |
| I19 caveat 1: 8 bytes, enough by construction, not by an attack | I19 note 1 | Kept as a note; no test can hold it |  |
| I19 caveat 2: until the command checks the key, a service that swaps it isn't caught | I19 note 2; the limit's "What would fix it" |  |  |
| I19 "Breaking this looks like" 1: a pager made with a key its number doesn't name | dropped; held by test | `pagers.test.ts › pagers and agents: …` proves I19.3. The test is renamed by id when a milestone touches it |  |
| I19 "Breaking this looks like" 2: an agent connected with a mismatched number | dropped; held by test | The same test proves I19.4 |  |

### `packages/blueprint/design/invariants/I20-the-service-holds-nothing-readable.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I20 heading and statement: "The service holds nothing readable" | next/ENCRYPT, whole | Not built (brief rule 2). Text: "The service never holds a readable decision, attachment, answer or acknowledgement, only ciphertext and what it needs to route it, and no alert carries one as text." |  |
| I20 body: what is encrypted, and to whom | next/ENCRYPT (I20 clause) | Decisions, their attachments, who asked, the project and the computer, and acknowledgements are encrypted to the pager's key on the agent's machine; answers to the agent's key on the phone |  |
| I20 body: what the service keeps | next/ENCRYPT (I20 clause) | Only the ids of pagers, agents, decisions and answers; the public keys and the number's fingerprint; the keys' digests; timestamps; sizes; whether each pager is on and when it turns off; the phone's device token |  |
| I20 body: alerts carry ciphertext, and the phone decrypts them | next/ENCRYPT (I20 clause) | One home with C30.6 and B17's ENCRYPT clause |  |
| I20 "Not built yet" note | dropped | A status note; I20 now waits whole in ENCRYPT |  |
| I20 caveat: today the service stores and reads every decision in full, and alerts carry the question as text | L19 · The service can read every decision | People meet it, and it waits for ENCRYPT (brief rule 5). The alert half links to area 4's L17 "Alerts pass through Apple as plain text" rather than repeating it. "@M1" is the drafter's pick: true of every shipped milestone |  |
| I20 "Breaking this looks like" 1–2 | next/ENCRYPT | The names of I20's tests once built: a decision, answer or acknowledgement readable in storage or logs; an alert carrying the question, the answer or the agent's words as text |  |
| I20 serves SI10 | next/ENCRYPT | I20's Why, from SI10, once it is written |  |

### `packages/blueprint/design/invariants/I21-every-connect-is-a-new-agent.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I21 statement | I21.1, I21.2, I21.4 | split into clauses |  |
| I21 serves SC1, SI2 | I21 Why | Why quotes SC1 exactly (A7 ★) |  |
| I21 body: the service gives each connect a new id and key; the pager lists it with who asked and project | I21.1, B25.4 |  |  |
| I21 body: an agent's key acts only on its own decisions | I21.3 |  |  |
| I21 body: the command gives each connect a new short id | I21 note | with TERMS' "Agent id": unique on its machine, not a secret |  |
| I21 body: helpers share the id, as `agentpager share` says | I21.4 | the command name cut; `commands.ts › share` holds it, `decode.test.ts › an agent file…` runs it, and `cli.test.ts › review rounds…` proves shared asks from separate processes |  |
| I21 breaking 1 | I21.1 | test `pagers.test.ts › pagers and agents…` (a second connect gets another id) |  |
| I21 breaking 2 | I21.2 | same test |  |
| I21 breaking 3 | I21.3 | same test (one agent's key is refused on another agent) |  |
| I21 caveat 1 (sharing works only on one machine) | L14 · An agent id works on one machine only | caveat → Limit. "Why it waits" is Sam's 29 Oct default that no agent id is shared across machines and each machine connects (docs/v2/HANDOFF.md); the fix is docs/v2/03 §7's export idea | ⚑ |
| I21 caveat 2 (a lost connect reply may leave an unusable agent) | B25.10 | caveat → clause; exact words left to `decode.test.ts › a 200 that isn't…` and `› sent, no reply…` |  |

### `packages/blueprint/design/invariants/I22-a-broken-card-is-never-sent.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| I22 | I22 · @M3 | heading "A broken card is never sent" kept |  |
| I22 serves: SI6, SI11 | I22 Why | SI11's second sentence quoted as the Why (A7) |  |
| I22 statement | I22.1 | kept |  |
| I22 ¶1 s1, what broken in structure means | I22.2, I22.3, I22.5 | split into three clauses. Widened to what `card.ts › compile` refuses today: a card that can't be read (not UTF-8, no such file), a character that would break the Options table, and an attachment that is missing or can't be read. Held by `cli.test.ts › the binary: …` and `› review rounds: …` | ⚑ |
| I22 ¶1 s2, the brief held to the service's own contract | I22.6 | kept. Added: each problem is named by the card's own key, held by `decode.test.ts › a card the server would refuse is refused here, in card.yaml words, before anything is sent` | ⚑ |
| I22 ¶1 s3, nothing about how a card is written is refused | I22.7 | merged with C27 Never 1 and breaking 2 and 3 |  |
| I22 ¶2, the service doesn't check one-line fields | I22 note 1 | note |  |
| I22 caveat 1, an agent calling the service directly skips the command | I22 note 2 | note, merged with C27 caveat 2 |  |
| I22 caveat 2, once encrypted the command's check is the only one | next/ENCRYPT | not built. Text for ENCRYPT › Changes: "I22 and I4: once cards are encrypted, the service can't read a card to refuse it. The command's check (I22) becomes the only check of a card's text, and I4 then holds on the service only for what it can still read." |  |
| I22 breaking 1, a broken card the command sends | I22.1 | held by `decode.test.ts › a card the server would refuse …` (the server counts zero requests) |  |
| I22 breaking 2, a card refused for how it is written | I22.7 | no test asks a well-formed but badly written card and checks it is sent; the many small cards in `cli.test.ts` pass |  |
| I22 breaking 3, a card cut or changed to fit a limit | I22.7 | held by the refusals in `cli.test.ts › the binary: …` ("title is 147 characters; the limit is 100.") |  |

### `packages/blueprint/design/journeys/J3-happy-pager.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| J3 frontmatter `id` | JOURNEYS.md J3 · @M3 | born @MCOMMAND (areas.md) = M3 |  |
| J3 frontmatter `for:` (C26, C25, C27, C23, C5, C7, I6) | J3 steps' bracketed ids and its Areas note | C→B. C7 is walked by J3.5's answered list (B7 in area 5) |  |
| J3 `statement` | J3 heading "Happy pager: one agent asks and hears back" | folded into the heading |  |
| J3 caveat 1 "One agent on one pager; nothing here proves two agents at once (J4)." | J3 note | kept as a note |  |
| J3 caveat 2 "The agent's reviewer judges the card …" | J3 note | kept as a note; C27 → B27 |  |
| J3 setting line "On the local product with its real persistent storage, …" | J3 note "Where:" | wording |  |
| J3 step 1 | J3.1 | outcome kept; the controls (+, Give agents this, Create) left to FlowTests › `testPagerJourney` (makePager taps new-pager and create-pager) and the screens catalogue `journeys/pager` |  |
| J3 step 2 | J3.2 | `agentpager connect` → "connects with the number through the agentpager command"; `agentpager rules` → "the card contract" (TERMS). The connect reply's prompt is held by cli.test.ts › "the binary: connect, refusals, ask, wait, ack, status, history, off, finish, and the same over MCP" (asserts "Before your first card: agentpager rules") |  |
| J3 step 3 | J3.3 | `agentpager review`, `agentpager ask` and the exact reply "Sent." left to cli.test.ts › same test (asserts the ask reply text and the review tool); `card.yaml` kept, a product name |  |
| J3 step 4 | J3.4 | unchanged in meaning |  |
| J3 step 5 | J3.5 | kept "the green tick": Sam chose it (DEC-2026-10-08-native-ios). FlowTests checks the "Agent confirmed" label, not the tick; the screens catalogue shows it. Unsure whether Sam means the specific |  |

### `packages/blueprint/design/journeys/J4-longest-pager.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| J4 frontmatter `id` | JOURNEYS.md J4 · @M3 | born @MCOMMAND = M3 |  |
| J4 frontmatter `for:` (C26, C25, C23, C5, C6, C7, C22, I6, I17, I18, I21) | J4 steps' bracketed ids and its Areas note | C→B |  |
| J4 `statement` | J4 heading "Longest pager: one pager from making to deleting" | folded into the heading; its list (two agents, a note, off and on, a restart, an auto-off) is the steps |  |
| J4 caveat 1 "Runs locally with a short local auto-off clock. No real 24-hour, 7-day or 30-day wait is observed (I17)." | J4 note | kept as a note |  |
| J4 caveat 2 "Both agents run on one machine …" | J4 note | kept as a note |  |
| J4 setting line | J4 note "Where:" | wording |  |
| J4 step 1 · Two agents on one project | J4.1 | sub-bullets joined into one step |  |
| J4 step 2 · Answer out of order, with a note | J4.2 | sub-bullets joined |  |
| J4 step 3 · Turn off and on | J4.3 | sub-bullets joined. The bar's exact words '"[name] pager is off"' → "it says its pager is off, with Turn on", held by DesignTests › `testOff` and DecisionView.swift; "Turn on" kept, the product's verb |  |
| J4 step 4 · Survive a restart | J4.4 | "its exit recorded" dropped: test procedure, held by packages/app/test/support.ts `restart()` |  |
| J4 step 5 · Auto-off | J4.5 | "After 24 hours" kept (Sam's number). "Off since" → "it has been off since the time it was due", held by FlowTests › `testOffAndOn` and Wording.swift. "It comes due on the local clock" → the J4 note on the short local clock |  |
| J4 step 6 · Revisit | J4.6 | unchanged in meaning |  |
| J4 step 7 · Delete | J4.7 | sub-bullets joined. The refusal is the one the code gives, an unknown agent (I17.5; `pagers.test.ts` asserts UnknownAgent), not "its pager is gone" | ⚑ |

### `packages/blueprint/design/journeys/J5-paged-while-away.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| J5 frontmatter `id` | JOURNEYS.md J5 · @M3 | born @MCOMMAND for its built steps (areas.md); it was an MFRIENDS deliverable, born in MSHIP |  |
| J5 frontmatter `for:` C26, C25, C17, C5 | J5 steps' bracketed ids and its Areas note | C→B |  |
| J5 frontmatter `for:` C19, C30 | dropped from J5 | not built; their steps go to next/ (rows below) |  |
| J5 `statement` | J5 heading "Paged while away, answer and hear back" and the note "A new owner needn't open AgentPager first …" | heading from the sample |  |
| J5 setting line "On the deployed product, with the app on a real iPhone" | J5 note "Where:" | joined with the built half of caveat 2 |  |
| J5 caveat 1 "Alerts need the deployed service and Apple's push service (D7). Delivery time is Apple's and is not measured." | J5 note | kept; "(D7)" dropped, since D ids dissolve |  |
| J5 caveat 2, built half "Today the app is built from Xcode, and its alerts go through Apple's sandbox push service." | J5 note "Where:" | kept |  |
| J5 caveat 2, not built "*Not built yet: comes with the TestFlight build, which uses Apple's production push service (D7).*" | next/INSTALL | not built: J5 walked on a TestFlight build, whose alerts go through Apple's production push service |  |
| J5 step 1 | J5.1 | unchanged |  |
| J5 step 2, built half "Until it exists, any agent with the agentpager command stands in. The agent connects." | J5.2 | "The owner gives the pager's text to an agent that has the agentpager command, and the agent connects." |  |
| J5 step 2, not built "*Not built yet: comes with the demo agent (C19).* The owner gives the pager's text to the demo agent." | next/INSTALL | not built: in J5.2, the owner gives the pager's text to the demo agent (B19), which connects, asks its sample decision, acknowledges and finishes |  |
| J5 step 3 | J5.3, J5.4 | split: the alert (J5.3); expanding it shows the detail and the recommended option (J5.4) |  |
| J5 step 4 "*Not built yet: comes with the encryption work.* The alert travels encrypted, and an extension on the phone decrypts it to show the question (C30)." | next/ENCRYPT | not built: after J5.3, the alert travels encrypted, and an extension on the phone decrypts it to show the question (B30, and B17's encrypted alert) |  |
| J5 step 5 | J5.5 | unchanged in meaning |  |
| (none) | J5.6 "The agent's wait returns the owner's answer (B32)." | added, from the agreed sample: old step 6's acknowledgement implies it, but no step said how the answer reaches the agent | ⚑ |
| J5 step 6 | J5.7, J5.8 | split: the acknowledgement alert (J5.7); the badge clears (J5.8) |  |
| J5 caveat 2: "Today the app is built from Xcode, and its alerts go through Apple's sandbox push service. *Not built yet: comes with the TestFlight build.*" | L24 · The app installs only from Xcode | shared with JOURNEYS; J5 should link the limit |  |

### `packages/blueprint/design/metrics/K1-visible-within-five-seconds.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| K1, the answer-to-agent half | next/FRIENDS | area 4's K1 row carries the split into an area 2 metric |  |
| K1 | next/FRIENDS | not built: no probe in the code and no recorded measurement. It gets no @ until measured. Text:<br>### K1 · Visible within five seconds<br>1. With the app open, a new decision shows on the phone within 5 seconds of the agent's ask reply.<br>2. A sent answer reaches a waiting agent within 1 second of the Undo window closing.<br>3. A probe measures both over 5 exchanges in a row on the deployed product: the real app in the Simulator, open and refreshing, and a real agent holding a wait for the answer. Every interval meets its bar, and any error fails. A local run comes first, but only the deployed result decides, and a timed stand-in for the service never passes.<br>- Each run records the commit, the target address, the network, all ten intervals, how often the phone refreshes and how long the agent's wait holds. A result goes stale after 7 days.<br>- It measures how fast AgentPager relays, not finished work, stops prevented or tokens unblocked; those stay unmeasured.<br>- A result holds only for its recorded target, network and load. Five exchanges are a smoke measurement, not a service level.<br>- An agent that isn't waiting sees the answer when it next reads.<br>- Alerts to a closed app are B17's and aren't timed here.<br>- When FRIENDS builds the probe, clause 2 becomes its own metric in area 2 (areas.md pick). |  |
| K1 statement | next/FRIENDS K1.1, K1.2 | wording only |  |
| K1 bar | next/FRIENDS K1.1–K1.3 | 5000 ms and 1000 ms kept as 5 seconds and 1 second: Sam's numbers (MSTART scope, 25 Sep; SP5 "within a second of the Undo window closing") |  |
| K1 probe | next/FRIENDS K1.3 and its first note | the old probe linked the phone's 3-second refresh and the Undo window's 5 seconds to code; left to `AppModel.swift › pollSeconds` and `undoSeconds` (TERMS also gives the Undo window's five seconds) |  |
| K1 caveat 1: relay latency, not completed work; SG1 unmeasured | next/FRIENDS, second note | SG1's id retires, so the note names the outcome instead |  |
| K1 caveat 2: one recorded target; five exchanges are a smoke measurement | next/FRIENDS, third note |  |  |
| K1 caveat 3: the agent side is the probe's own held read | next/FRIENDS K1.3 ("a real agent holding a wait") and fourth note |  |  |
| K1 caveat 4: the answer interval excludes the Undo window | next/FRIENDS K1.2 ("of the Undo window closing") | caveat → part of the bar |  |
| K1 caveat 5: the app is open; alerts to a closed app are C17's | next/FRIENDS, fifth note; B17, second note | C17 → B17 |  |
| K1 staleAfterDays: 7, method: probe | next/FRIENDS, first note; K1.3 |  |  |
| K1 serves: SG1 | area 4 Serves | SG1's first sentence, quoted exactly |  |

### `packages/blueprint/design/dependencies/D1-cloudflare.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| D1 id and heading "Cloudflare" | dissolved | No D ids (brief rule 4) |  |
| D1 statement: one Worker on the agentpager.me zone, one SQLite Durable Object per agent and one registry for the pagers, and nowhere else | Relies on (area 6); PRODUCT.md › Stack | Serves quotes SP2's own sentence. "Nowhere else" is "where the whole service runs"; `build.mjs` holds it (one custom-domain route, `workers_dev: false`) |  |
| D1 provided: Worker `ownerpager`; SQLite classes `Agent` (made as `Session` at tag v1, renamed at v3) and `Registry` (v2); keep the names and applied tags, and add a later tag for any new class | AGENTS.md › Deploying and secrets (keep the names and applied tags; a new class needs a later tag); `packages/app/README.md` › Deployment names them | Deploy fact. `build.mjs` holds the migrations |  |
| D1 provided: vault item "Cloudflare agentpager.me" (id k2rptzp2jwfoxsqvrguxxizsgi), fields credential and account_id | AGENTS.md › Deploying and secrets points to `packages/app/README.md` › Deployment; `deploy.mjs` holds the id | Deploy fact. `deploy.mjs` holds the id |  |
| D1 provided: the deploy creates and verifies the domain binding, DNS and HTTPS on the zone | `packages/app/README.md` › Deployment, which AGENTS.md points to | Deploy fact. `deploy.mjs` checks the binding, the proxied DNS record, SQLite placement, the bindings, the APNs secret, and the build header over HTTPS |  |
| D1 provided: DEC-2026-09-29-m1-owner-feedback records the credential's dated checks | dropped | That DEC goes to the tag (A10); git keeps it |  |
| D1 must supply: HTTPS on the apex, every plain HTTP request redirected, every response with Strict-Transport-Security; must never: answer over plain HTTP; deployed check: plain HTTP redirects and HTTPS carries HSTS | L20 · The service still answers plain HTTP (6 Privacy); next/ENCRYPT (I23's clause, unless M4 fixes it first) | Not built. On 5 Nov 2026, `http://agentpager.me/` and `/start` answered 200 and `POST /api/agents` answered 400, all over plain HTTP with no redirect, and HTTPS responses had no Strict-Transport-Security. The phone keeps to HTTPS outside the local network (iOS's default, `Info.plist` allows local networking only), and the command defaults to `https://agentpager.me`, but `--server` accepts `http://`. DEC-2026-10-08-native-ios lists "HTTPS only" as Sam's call. A small fix (a Cloudflare zone setting, or the header in `worker.ts`), so Sam may want it now, perhaps in M4's dev-stage PR, rather than in ENCRYPT. Text when built: "The service answers only over HTTPS: a plain HTTP request is sent to HTTPS, and every response tells browsers to keep to HTTPS." | ⚑ |
| D1 must supply: Durable Objects with SQLite, one per agent plus the registry (DEC-2026-09-26-registry-object) | Relies on (area 6); code | `registry.ts` and `agent.ts` comments say what each object holds |  |
| D1 must supply: `deploy:app` reads the vault item with op into the one wrangler process's environment; its log records the Worker, the account and the zone, never a token | `packages/app/README.md` › Deployment, which AGENTS.md points to | Deploy fact, held by `deploy.mjs`. "As the recipe's environment describes" dropped: the recipe is retired |  |
| D1 must never: serve a build other than the candidate; every response carries `X-AgentPager-Build` | AGENTS.md › Deploying and secrets | Deploy check. `worker.ts` sets the header; `start.test.ts › /start and /mcp tell an arriving agent …` checks it on every path locally; `deploy.mjs` waits for it on `/start` |  |
| D1 must never: store an agent key or phone key other than as its SHA-256 digest | I23.1 | Outcome kept. "SHA-256" is held by `start.test.ts › keys are stored only as SHA-256 digests` and `shared.ts › sha256`. Matches TERMS (Keys) |  |
| D1 must never: compare a presented key with its stored digest other than in constant time | I23.2 | Stated as the outcome: a refusal's timing tells nothing. "Constant time" is held by `shared.ts › sameDigest` (the platform's timing-safe comparison; it refuses to run without one). No test holds it, so it goes on the untested list |  |
| D1 must never: hold an agent outside its Durable Object, or a pager outside the registry | nothing: code holds it | Structure. The comments in `agent.ts` and `registry.ts` hold it |  |
| D1 must never: the token reaches the worktree, the evidence directory, a log or a transcript; a leaked token is flagged at once | I23.3; AGENTS.md for "flag a leak at once" | A security rule, so an invariant (brief rule 4), alongside D7's APNs-key rule (root's call). Held by `deploy.mjs` (secrets in memory and the one child's environment; output redacted). "The evidence directory" dropped: there is none now. Agent conduct on a leak goes to AGENTS.md |  |
| D1 must never: run a deployed build with local clocks | AGENTS.md › Deploying and secrets | Deploy fact. `env.ts` (zero means the production value) and `build.mjs` (local clocks only with `--local`) hold it |  |
| D1 local runs: the root `package.json` pins wrangler; `--persist-to` outside the worktree; local clocks set per instance | AGENTS.md › Gotchas (each test file starts its own wrangler, ports and storage) | "As the builder names in its handoff (recipe environment)" and "where the local host differs from the zone is the recipe's business" dropped: the recipe is retired |  |
| D1 proof runs on: the local candidate and agentpager.me, through public paths with real services; the shortest local clocks in real time; production clocks when deployed; storage probes, auto-off and housekeeping locally only | METHOD.md › Tests ("Proof is real"); `env.ts` (local clocks); the stages table the dev-stage pull request adds to AGENTS.md | METHOD's "Proof is real" holds the rule; `env.ts` holds the local clocks |  |
| D1 deployed check: every response surface, across repeated requests, carries the candidate's build | the dev stage's smoke run (M4's dev-stage pull request decides what it checks) | Narrower today: `deploy.mjs` stops at the first `/start` that matches; only the local test checks every path | ⚑ |
| D1 deployed check: a pager's turn-off time is exactly its auto-off after it was turned on | the dev stage's smoke run (M4's dev-stage pull request decides what it checks) | Not checked on deploy today; no deployed test holds it | ⚑ |
| D1 deployed check: the Worker's namespace, classes and SQLite placement, inspected apart from the product | `packages/app/README.md` › Deployment, which AGENTS.md points to | `deploy.mjs` does it |  |
| D1 caveat 1: a green deploy doesn't show the zone's DNS is the only path in, or anything about Cloudflare's availability | dropped | a gap in what a green deploy proves (that the zone's DNS is the only way in, and Cloudflare's availability), which nobody using AgentPager meets. METHOD puts such a gap in a comment beside its check; none is beside `deploy.mjs`'s checks yet, and the dev-stage pull request owns them | ⚑ |
| D1 caveat 2: the deploy doesn't show the credential's scope; if it can't create the binding or deploy, ask Sam for scoped access | AGENTS.md › Deploying and secrets (ask Sam for scoped access; never make a credential) | `deploy.mjs` says so on a failed Cloudflare call; the global rules forbid minting a credential |  |
| (edited by PR #44 after the tag) the statement: one Worker per stage, prod's `ownerpager` at agentpager.me and dev's `ownerpager-dev` at dev.agentpager.me, each with its own Durable Objects | area 6 Relies on; AGENTS.md › Stages | this pull request deletes D1, which #44 edited after tag `blueprint-old-format`; git keeps that version at 6c58e60. AGENTS.md's Stages table, from #44, names each Worker and address, and area 6 says each stage has its own data |  |
| (edited by PR #44 after the tag) must supply: deploy with `deploy:dev`, or `deploy:prod` at a release tag only | AGENTS.md › Stages; `packages/app/README.md` › Deployment | both say it, as #44 wrote them |  |

### `packages/blueprint/design/dependencies/D2-agent-clients.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| D2 id | retired | no D ids (BRIEF rule 4) |  |
| D2 statement | header Relies on | the stack sentence also lives in PRODUCT.md (SP2) |  |
| D2 provided: the owner installs and signs in to the apps | header Relies on |  |  |
| D2 provided: setup adds the server; restart Claude Desktop | B29.1, B29.5 (area 7) | linked from Relies on (B29) |  |
| D2 must supply: a shell, or an MCP client that starts `agentpager mcp` over stdio | header Relies on, B29.7 (area 7) | `agentpager mcp` cut; held by `cli.test.ts › the binary…` and `binary.test.ts`, which drive it over stdio |  |
| D2 must supply: each client says who it is (MCP name, env marker, process name) | B25.3, B33.1 | the mechanism is code (`detect.ts › harness`, `detectApp`), held by `wait.test.ts › harness: Claude Code and Claude Desktop only when positively identified` |  |
| D2 must supply: a long wait must not lose the answer; background wake (Claude Code) or a kept turn with waits of at most 50 seconds (Desktop) | B32.2, B32.6, B33.2, B33.3 | "50 seconds" becomes "well within agent apps' time limits", held by `exchange.ts` ANSWER_WAIT_MAX_SECONDS, `mcp.ts` (wait's maximum 50) and `cli.test.ts › review rounds…` ("--seconds takes a number from 1 to 50.") |  |
| D2 setup: the command's absolute path with `mcp`, since desktop apps lack the shell's PATH | L23 · Moving the command breaks its setup (area 7), B33.2 | area 7 holds the reason; B33.2 keeps "by the command's full path" for Claude Code's background wait |  |
| D2 setup list: Claude Code (`claude mcp add --scope user`, unless `claude mcp get` finds one), Codex (`codex mcp add`), Claude Desktop, Cursor, pi | code `setup.ts`; B29.1 names the apps (area 7) | A20 ★: code only. Claude Desktop and Cursor held by `setup.test.ts`. The Claude Code and Codex commands are held by no test: `setup.test.ts` runs with neither on PATH | ⚑ |
| D2 must never: a key or pager number in an app's config | B29.6 (area 7) | linked, not repeated |  |
| D2 proof runs on: command tests on a local server, MCP over stdio with the SDK client, setup in a throwaway home | nothing | test comments already say it (`setup.test.ts`, `binary.test.ts`, `cli.test.ts`) |  |
| D2 proof: real apps are sampled by Sam's dogfood, not by a test | AGENTS.md › Gotchas (Sam's dogfood samples real agent apps) |  |  |
| D2 caveat 1 (cloud sessions untested) | L13 · Cloud sessions are untested | caveat → Limit, with SP5's own words as "Why it waits". Adds the lab's sightings (a Desktop chat's cloud VM blocked from agentpager.me until allowed, and pausing a few minutes after its turn) | ⚑ |
| D2 caveat 2 (recorded runs cover Claude Code and Desktop; Codex, Cursor and pi follow each app's documented behaviour; `--app`) | B33 note, B25.3 | `detect.ts` comment also holds the who-asked half |  |
| D2 caveat 3 (claude.ai in a browser is out) | PRODUCT.md (SP5) | dropped here; SP5 already says it |  |
| D2 must-never: "put the agent's key or the pager number in a client's config. setup writes only the command's path" | B29.6 | shared with area 2 (D2); placed here because setup is B29's. Held by `setup.test.ts` and `binary.test.ts` (the entry is exactly the command's path and `mcp`) |  |
| D2: "the command's own absolute path with the argument `mcp`, since desktop apps don't get the shell's PATH" | L23 · Moving the command breaks its setup, "Why it waits" | shared with area 2 (D2); held by `binary.test.ts` (setup names the binary by its full path) |  |

### `packages/blueprint/design/dependencies/D6-iphone-app.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| D6 id | dissolved | no D ids |  |
| D6 statement (native SwiftUI app on iPhone) | Relies on line (iPhone, iOS 26) + Definition + Serves ("My side is a native iPhone app.") | SwiftUI and iOS 26 as stack facts → PRODUCT.md › Stack (PRODUCT drafter); iOS 26 held by `project.yml` deploymentTarget |  |
| D6 providedBy / provided (Xcode and Simulator on Sam's Mac; Sam's iPhone in Developer Mode over USB, signed with Sam's team; Sam signs, no agent creates or uses a signing credential) | AGENTS.md › Deploying and secrets (Sam signs) and › Gotchas (Sam's walk on Sam's iPhone) | text: "The app builds and runs with Xcode on a Mac. Sam's walk runs on Sam's iPhone in Developer Mode over USB, signed with Sam's Apple developer team. Sam signs: never create, request or use an Apple signing identity, certificate or account on Sam's behalf." |  |
| D6 Must supply: macOS, Xcode, iOS 26 Simulator runtime driven through the app's interface; Sam's iPhone for the walk | AGENTS.md › Gotchas (UI tests drive the real app in Simulators, one run at a time). A second phone being a second Simulator is how `AgentHarness.swift` runs it | text: "UI tests drive the real app in an iPhone Simulator with the iOS that Xcode ships. A second phone is a second Simulator. One Simulator run at a time." |  |
| D6 Must supply: Keychain keeps each pager's keys on this device only | Relies on line + L9 "A pager lives only on the phone that made it" | held by `Keychain.swift` |  |
| D6 Must supply: Settings bundle Server field for self-hosters; no Settings screen | B23.10 + B23 note + Relies on | Settings field held by `Settings.bundle/Root.plist`; "no Settings screen" is also a pinned decision in PRODUCT.md |  |
| D6 Must never: a preview or fixture stands in for the app's own screen | dropped | held by METHOD ("the product's own screens, in `generated/`, are the record") and `DesignTests.swift`, which captures the real app |  |
| D6 Must never: create, request or use an Apple signing identity on Sam's behalf | AGENTS.md › Deploying and secrets | AGENTS.md: "Never create, request or use an Apple signing identity, certificate or account on Sam's behalf." |  |
| D6 Proof runs on: Simulator, through Pagers, Pager, Pager detail and the decision screen; second phone = second Simulator; Sam's walk on the iPhone | AGENTS.md › Gotchas | in the Must supply row's text above |  |
| D6 Proof runs on: "in light and dark appearance, with the Pager and decision screens also at the largest standard text size" | AGENTS.md › Gotchas, as a gap: light appearance only; dark and the largest text untested | no test runs dark or the largest text size: `DesignTests.swift`'s comment says light only (dark tried 30 Oct, screenshots stayed light), and nothing sets the text size. ★ A17 put both on the untested list | ⚑ |
| D6 caveat 1 (one simulated iPhone stands for every iPhone; Sam's iPhone is sampled at the walk) | AGENTS.md › Gotchas (Sam's walk samples real devices) | text: "One simulated iPhone stands for every iPhone; Sam's iPhone is sampled at the walk." |  |
| D6 caveat 2 (not built: an App Group and a notification service extension that decrypts alerts on the phone) | next/ENCRYPT | text: "The app gains an App Group and a notification service extension that decrypts alerts on the phone, so an alert shows the real question (B17, B30)." |  |
| D6 caveat 3 (not built: a TestFlight build) | next/INSTALL | text: "A TestFlight build of the app, whose alerts use Apple's production push service." |  |
| D6 caveat 3 (today: the development build `me.agentpager.app.dev`, sandbox push) | 7-getting-started L24 "The app installs only from Xcode" + link in this area's Definition | area 7 holds the one home for this limit (its ledger and INTEGRATOR-NOTES say so); area 1 links it and doesn't repeat it. Bundle id held by `project.yml`; sandbox push by `AgentPager.entitlements` (`aps-environment: development`) |  |
| D6 caveat 3: "*Not built yet: comes with the TestFlight build.* A TestFlight build. Today the app is the development build `me.agentpager.app.dev`, and its alerts use Apple's sandbox push service." | L24 · The app installs only from Xcode + next/INSTALL | shared with area 1 (D6); this area holds the builds. The bundle id is cut, held by `packages/ios/project.yml`. Text for INSTALL: "A TestFlight build of the app whose alerts use Apple's production push service." |  |

### `packages/blueprint/design/dependencies/D7-apple-developer-program.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| D7 | dissolved | no D ids (rule 4) |  |
| D7 statement: alerts stand on the owner's Apple membership | area 4 Relies on |  |  |
| D7 statement: distribution to other people | next/INSTALL | see the "TestFlight, App Review" row |  |
| D7 provided: the paid team, the APNs key with its key id and team id in the 1Password item the owner names; the owner creates each, no role mints one | AGENTS.md › Deploying and secrets | Text: "Sam's paid Apple developer team signs the app. Alerts use Sam's APNs key, with its key id and team id, in the 1Password item Sam names. Sam creates each of these, and the App Store Connect access; agents never make one.". AGENTS.md words it: "Sam's paid Apple team signs the app; Sam keeps its push key in 1Password", with the signing rule of the D6 row. The key id and team id are in `scripts/build.mjs` |  |
| D7 must supply: Apple's push service | area 4 Relies on |  |  |
| D7 must supply: TestFlight and App Review; provided: App Store Connect access; caveat: their timing is Apple's | next/INSTALL | not built. Text: "Distribution to invited owners stands on Sam's Apple Developer Program membership: TestFlight for invited testers, and App Review, through App Store Connect access Sam provides. Their timing is Apple's, and nothing promises a review outcome." |  |
| D7 must never: the APNs key reaches the app bundle, the worktree, a log or a transcript | I23.3 (6 Privacy); a one-line pointer in AGENTS.md | root's call: a security rule becomes an invariant (BRIEF rule 4), merged with D1's token rule into I23.3. Held by `build.mjs` (the key is the Worker's secret, never in a build) and `deploy.mjs` (sent to wrangler on stdin, output redacted) |  |
| D7 proof runs on: the owner's iPhone; in MAPP an Xcode build with the sandbox push service | AGENTS.md › Gotchas (Sam's walk); the sandbox push service is L24 | Text: "The walk runs on Sam's iPhone. Builds from Xcode use Apple's sandbox push service." |  |
| D7 proof runs on: from MINSTALL, a TestFlight build with the production push service | next/INSTALL | not built. Text: "From INSTALL, the walk also runs a TestFlight build, whose alerts use Apple's production push service." |  |
| D7 providedBy: owner | dissolved | the AGENTS.md row says Sam provides each |  |
| D7 proof: "In MAPP, a build from Xcode with Apple's sandbox push service; from MINSTALL, also a TestFlight build with the production service." | L24 · The app installs only from Xcode + next/INSTALL | shared with area 4 (D7); the today half is the limit, the TestFlight half is INSTALL's |  |

### `packages/blueprint/design/dependencies/D8-bun.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| D8 id | dissolves | no D ids |  |
| D8 statement: "built with Bun into one file that runs on the kind of machine that built it" | area header, Relies on (Bun) + L22 · The command installs only from source | split: the service is a Relies-on line; "only the building machine's kind" is part of the limit |  |
| D8 provided: "Bun on the machine that builds the command, installed by the owner. `pnpm --filter @agentpager/cli build` runs `bun build --compile` on the command's source and writes `packages/cli/dist/agentpager`. No Bun version is pinned." | AGENTS.md › Gotchas | a build fact. Text for AGENTS.md: "The command: `pnpm --filter @agentpager/cli build` runs `bun build --compile` and writes `packages/cli/dist/agentpager`, for this machine only. Bun is installed by Sam on the building machine; no Bun version is pinned.". AGENTS.md keeps the build command, this machine only, and no Bun version pinned; the output path is in `packages/cli/scripts/build.sh` |  |
| D8 must supply: "a compiler that bundles the command's TypeScript, its dependencies and a runtime into one executable, with Node's built-in modules, fetch, and standard input and output for the MCP server" | area header, Relies on (Bun) | the list of what the compiler must bundle is cut; `binary.test.ts` exercises it (the compiled binary connects, reads status, serves MCP over stdio and runs setup) |  |
| D8 must never: "need Bun, Node or the repository where the built command runs" | B29.8 | wording only |  |
| D8 proof: "the compiled binary … connects with it, reads its status, serves MCP and runs setup with no Bun or Node on the PATH; it is skipped until the binary is built, and `pnpm test:cli` builds it first" | nothing (test comment) | `binary.test.ts`'s own comment and the root `test:cli` script hold it. But the test clears the PATH only for setup: connect, status and MCP run with the test's own PATH, which has Node, and the binary runs from inside the repository. So B29.8 is proven only in part | ⚑ |
| D8 caveat 1: "The build makes a binary for the building machine's own system only. *Not built yet: comes with the release builds.* Binaries for other machines, and the one-line install (C29)." | L22 · The command installs only from source + next/INSTALL | today's part is the limit. Text for INSTALL: "Builds of the command for each kind of machine Sam chooses, not only the one that builds it." |  |
| D8 caveat 2: "Run from source, as its tests run it, the command runs on Node instead." | AGENTS.md › Gotchas | a build fact. Text for AGENTS.md: "Run from source, as its tests run it, the command runs on Node." |  |

### `packages/blueprint/strategy/STRATEGY.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| STRATEGY frontmatter `items:` (SP3, SP4, SI9, SG3 deprecated, with successors) | dropped | the deprecations are history; DECISIONS DEC-2026-10-27-briefs-are-the-card and DEC-2026-10-30-v2-promises record them |  |
| STRATEGY `# AgentPager` and § Vision | PRODUCT.md title and › What it's for | verbatim |  |
| STRATEGY section headings and their italic "_Technically: …_" lines (Hero Features, Guarantees, Goals, Principles) | dropped | the SC, SI, SG and SP ids retire (DEC-2026-10-31-method answer 4); the goals go under What it's for, and every other item becomes a principle under PRODUCT › Principles, in Sam's order |  |
| SC1 · Unblock my agent from my phone | PRODUCT › Principles › Unblock my agent from my phone | verbatim, three paragraphs; id retires |  |
| SC2 · Get paged when my agent needs me | PRODUCT › Principles › Get paged when my agent needs me | verbatim; id retires |  |
| SI1 · Sending a decision requires confirmation | PRODUCT › Principles › same heading | verbatim; id retires |  |
| SI2 · Only agents I give a number reach my phone | PRODUCT › Principles › same heading | verbatim; id retires |  |
| SI3 · Sent decisions cannot be changed | PRODUCT › Principles › same heading | verbatim; id retires |  |
| SI4 · An acknowledgement always comes from the agent | PRODUCT › Principles › same heading | verbatim; id retires |  |
| SI5 · A pager is on until I turn it off | PRODUCT › Principles › same heading | verbatim; id retires |  |
| SI6 · UTF-8 with Markdown … never truncated | PRODUCT › Principles › same heading, without its numbers, linking I4 | Sam's words kept, but the numbers come out. Root's call: their one home is I4 (3 Cards), which keeps only the title's 100 characters as a clause, and the schemas in `packages/contract/` hold the rest. PRODUCT now says every text and a decision's attachments have limits, and links I4. The 3 Cards rows on SI6 name the test that holds each number; four have none | ⚑ |
| SI7 · Cards are independent | PRODUCT › Principles › same heading | verbatim, so I18's Why can quote it (A7 ★); id retires |  |
| SI8 · Approval refers to the exact proposal | PRODUCT › Principles › same heading | verbatim ("rich card" kept as Sam wrote it); id retires |  |
| SI9 · Research never pretends to be an available paid upgrade | dropped | deprecated 30 Oct (DEC-2026-10-30-v2-promises): no paid tier; history; git holds it at tag blueprint-old-format |  |
| SI10 · The service can't read my decisions | next/ENCRYPT | not built: "Decisions, attachments, answers and acknowledgements are encrypted on my agent's machine and on my phone. The service carries bytes and the little it needs to route them: which pager, which agent, when. The pager number binds my phone's key, so the service can't swap it." It is ENCRYPT's objective (A18 ★). What is built of it, the number naming the phone's key, is I19 (6 Privacy). The pinned "Encryption comes before the friends rollout" stays in PRODUCT |  |
| SI11 · A decision is reviewed before it's sent | PRODUCT › Principles › same heading | verbatim; id retires |  |
| SG1 · Return to completed work, not an unseen question | PRODUCT › What it's for › same heading | verbatim; id retires. Its "Later, measure …" stays as Sam's aim; K1 goes to next/FRIENDS (area 4's drafter) |  |
| SG2 · Agents use a helpline instead of bad decisions | PRODUCT › What it's for › same heading | verbatim; id retires |  |
| SG3 · Learn which paid value can sustain the product | dropped | deprecated 30 Oct: no paid tier; history; git holds it at tag blueprint-old-format |  |
| SP1 · Make the usual answer easy and clear | PRODUCT › Principles › same heading | verbatim; id retires |  |
| SP2 · Keep the first version focused and its foundations explicit | PRODUCT › Stack | verbatim, its heading as the section's lead and one sentence per bullet; id retires |  |
| SP2 "The code is open: anyone can read it, fork it and run their own (*not built yet*)." | next/OPEN | not built: "The code is open: anyone can read it, fork it and run their own." OPEN's objective (A18 ★) |  |
| SP3 · Agents choose the options; AgentPager keeps them easy to answer | dropped | deprecated → SP7 (DEC-2026-10-27-briefs-are-the-card): emoji cards are gone; history; git holds it at tag blueprint-old-format |  |
| SP4 · Keep the decision short; make detail optional | dropped | deprecated → SP8; history; git holds it at tag blueprint-old-format |  |
| SP5 · Reach the agents owners actually use, first sentence "Any agent that can run the agentpager command can use AgentPager: terminal agents, and desktop apps like Claude Desktop and Cursor." | PRODUCT › Principles › Reach the agents owners actually use | not true for waking today: only Claude Code and a Claude Desktop chat are told how to wake (B33), and other agents must call wait again (L11). Kept the true part, "Any agent that can run the agentpager command can use AgentPager.", word for word. The rest of Sam's sentence is quoted in a note after the principle, marked as not Sam's words, which says CLIENTS decides which apps it covers. The drafter's sentence on which apps wake today was taken out of PRODUCT: B33, L11 and CLIENTS hold it. Areas 2 and 7 quote only the kept part | ⚑ |
| SP5, rest | PRODUCT › same principle | verbatim. "A waiting agent has my answer within a second of the Undo window closing, with nothing for me to nudge" kept as Sam's aim. It is literally true of an agent that is waiting, but the second is unmeasured (K1's answer half, next/FRIENDS), and an agent that stops waiting needs a nudge (area 2's limit) | ⚑ |
| SP6 · Feel native | PRODUCT › Principles › same heading | verbatim; id retires |  |
| SP7 · Letters tell options apart; ✶ marks the recommendation | PRODUCT › Principles › same heading | verbatim; id retires |  |
| SP8 · Lead with the decision; keep the rest one tap away | PRODUCT › Principles › same heading | verbatim except "SI6 sets the hard limits" → "the text limits (I4) set the hard limits": the id retired |  |
| STRATEGY § Strategic Design Decisions, its six sentences | PRODUCT › Pinned design decisions | word for word, one sentence per bullet |  |
| STRATEGY § Strategic Design Decisions, its italic note | PRODUCT › Pinned design decisions, lead line | kept Sam's phrase "a temporarily true design constraint or limitation we choose to apply as we explore the design space" and its sense (made top down, maybe not permanent). Dropped "Technically, SD:" (the id retires) and "(Lets just see what actually gets written here and review if useful)": the section now holds six decisions | ⚑ |
| SI6, a question's title allows 100 visible characters | I4.4 | kept: Sam chose it (DEC-2026-10-30-v2-promises basis: "a decision's title is at most 100 characters", PR #33). `values.test.ts › holds a title to 100 visible characters`, `exchange.test.ts › holds a title to 100 characters, as asked and as stored` |  |
| SI6, the one-line detail 280 | I4.4 | cut: `TEXT_MAX_CHARACTERS` in `values.ts`; `exchange.test.ts › holds the one-line detail to 280 characters, as asked and as stored`, and the "a detail over 280 characters" case in `briefs.test.ts › briefs: refused whole, …` |  |
| SI6, an option's title and what it prioritizes, 280 each | I4.4 | cut: `BriefOption` (`Text`) in `brief.ts`; `decode.test.ts › a card the server would refuse is refused here, in card.yaml words, before anything is sent` (an option title over 280) and `values.test.ts › Text accepts exactly 280 …` |  |
| SI6, an acknowledgement 280 | I4.4 | cut: `AcknowledgementInput` (`Text`) in `exchange.ts`; the `Text` limit is held by `values.test.ts › Text accepts exactly 280 …`, though no test sends a 281-character acknowledgement |  |
| SI6, an option's answer label 20 | I4.4 | cut: `BRIEF_LABEL_MAX_CHARACTERS` in `brief.ts`; the "a label too long for its tile" case in `briefs.test.ts › briefs: refused whole, …` |  |
| SI6, written feedback 1,000 | I4.4 | cut: `BODY_MAX_CHARACTERS` in `values.ts`; `exchange.test.ts › counts body characters and refuses 1001 whole`. 5 Answering's B6.2 links I4 for it |  |
| SI6, a decision and each Markdown page 20,000 characters | I4.4 | cut: `BRIEF_MAX_CHARACTERS` in `brief.ts`; no test holds it | ⚑ |
| SI6, at most 8 attachments | I4.4 | cut: `ATTACHMENTS_MAX` in `brief.ts`; no test holds it | ⚑ |
| SI6, at most 1 MB per image | I4.4 | cut: `IMAGE_MAX_BYTES` in `brief.ts`; no test holds it | ⚑ |
| SI6, at most 3 MB of attachments in all | I4.4 | cut: `ATTACHMENTS_MAX_BYTES` in `brief.ts`; no test holds it | ⚑ |
| SI6, attachments are PNG, JPEG or Markdown | I4.4 | kept |  |
| SI6, "Titles, labels and the detail are one line" | I22.3; I22 note 1 | the command refuses a line break in a one-line field; the service doesn't check it (I22 ¶2) |  |
| SI6, "Text is valid UTF-8 with Markdown and no HTML"; "HTML is allowed only inside code, where it shows as text" | I4.1, I4.5 | kept as outcomes |  |
| SI7 | I18 Why | quoted in full; the PRODUCT drafter decides whether SI7 also stays in PRODUCT.md |  |
| (new) Serves: "The pager number binds my phone's key" | area 6 Serves | An exact part of SI10's sentence. The rest, "so the service can't swap it", is left out of Serves because it holds only once ENCRYPT builds the command's check; it is I19's Why | ⚑ |

### `packages/blueprint/design/terms.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| terms.md title and intro | TERMS.md | verbatim |  |
| terms.md, all 27 terms (Owner · Pager · Pager number · Off · Auto-off · agentpager · Agent · Agent id · Who asked · Project · Decision · Card · Detail · Brief · Review · Option · Recommended · Feedback · Draft · Undo window · Answer · Receipt · Not picked up · Acknowledgement · Keys · History · Pagers, Pager, Pager detail) | TERMS.md | verbatim (diffed). No term carries a C id, so no id changed. None is retired: each still names something built, checked in code (the `ap1_` number in Keychain.swift and store.ts; 3 min PICKUP_MS and 30-day AGENT_IDLE_MS in contract.ts; undoSeconds 5 in AppModel.swift; review in cli main.ts; digests in registry.ts) |  |
| (term) "card contract" | TERMS | added by the integrator: "Card contract: the command's rules for writing a card the owner can answer on a phone, with the `card.yaml` template and an example. `agentpager rules` prints it." I22 and I4 avoid "contract" for the service's checks, so the word has one meaning | ⚑ |
| (term) the sheet that makes a pager | TERMS › Pagers, Pager, Pager detail, New pager | added by the integrator: 1 Pagers names the sheet "New pager", as the app titles it (`PagerDetailView.swift`), and TERMS had no entry for it | ⚑ |

### `packages/blueprint/roadmap/ROADMAP.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| ROADMAP list, order M4 HOUSE → MENCRYPT → MCLIENTS → MINSTALL → MSITE → MOPEN → MFRIENDS | README.md › Milestones | the order as a table, by word; titles from each milestone doc; CLIENTS's line from ROADMAP "settles which agent apps AgentPager supports". The milestones drafter covers the rest of ROADMAP and roadmap/milestones |  |
| ROADMAP Horizons "Next, AgentPager gets ready for the first owners beyond Sam" | PRODUCT › Roadmap | kept, with "one milestone at a time" (DEC-2026-11-05-blueprint-destination) |  |
| ROADMAP Horizons "Nothing else is planned. No Android, no answering from the Lock Screen, no Live Activities and no paid tier: nobody has needed them yet. A feature joins the roadmap when owners using AgentPager, Sam included, show they need it." | PRODUCT › Roadmap | Sam's own words from DEC-2026-10-31-next-roadmap quoted in place of the paraphrase; the last sentence kept |  |
| ROADMAP Horizons, the sentences on why each milestone waits (CLIENTS before INSTALL and SITE; OPEN after ENCRYPT; FRIENDS last) | DECISIONS DEC-2026-10-31-next-roadmap; next/ docs | the milestones drafter writes each milestone's reasons |  |
| ROADMAP.md title and ordered list (1 M4 HOUSE, running now … 7 MFRIENDS) | README.md milestone table (README drafter); each doc's **Order** in its status line | names lose their M prefix when queued (ENCRYPT, CLIENTS…); M1–M3 numbered per BRIEF |  |
| ROADMAP Horizons ¶1: "MAPP, MPAGERS and MCOMMAND have shipped." | M1-app.md, M2-pagers.md, M3-command.md status lines; README ✅ |  |  |
| ROADMAP Horizons ¶1: "Next, AgentPager gets ready for the first owners beyond Sam (DEC-2026-10-31-next-roadmap)." | PRODUCT.md › Roadmap (PRODUCT drafter); next/FRIENDS.md Order |  |  |
| ROADMAP Horizons ¶1: "On 5 Nov Sam set this order, one milestone at a time (M4 HOUSE)." | M4-house.md › Decided (exists); each next/ doc's Log "5 Nov" line |  |  |
| ROADMAP Horizons ¶2: "M4 HOUSE first puts the repo in order: the Blueprint by area, a dev stage, and the id check." | M4-house.md › Slice (exists, not edited) |  |  |
| ROADMAP Horizons ¶2: "MCLIENTS, new, settles which agent apps AgentPager supports; MINSTALL and MSITE wait for it, because both need that list." | next/CLIENTS.md Objective and Order; next/INSTALL.md and next/SITE.md Order |  |  |
| ROADMAP Horizons ¶2: "MOPEN's cleanup waits for MENCRYPT, since both change the same code." | next/OPEN.md Order | kept as the reason, though one-at-a-time makes it automatic |  |
| ROADMAP Horizons ¶2: "MFRIENDS comes last: Sam invites owners once they can install AgentPager, read what it is, inspect its code, and know the service can't read their decisions." | next/FRIENDS.md Order, word for word |  |  |
| ROADMAP Horizons ¶2: "Encryption comes before that rollout (STRATEGY, Strategic Design Decisions)." | PRODUCT.md pinned decisions (PRODUCT drafter); next/FRIENDS.md What's known links PRODUCT |  |  |
| ROADMAP Horizons ¶3: "Nothing else is planned. No Android, no answering from the Lock Screen, no Live Activities and no paid tier: nobody has needed them yet. A feature joins the roadmap when owners using AgentPager, Sam included, show they need it." | PRODUCT.md › Roadmap (PRODUCT drafter, which quotes Sam's 31 Oct words); next/FRIENDS.md Out of scope 1 |  |  |
| ROADMAP Horizons ¶3: "The web app (MCARDS, parked before it closed) stays as history in parked/." | dropped | MCARDS goes to the tag only: Sam agreed simplification 3, which names `roadmap/parked` |  |

### `packages/blueprint/roadmap/milestones/MAPP.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| MAPP frontmatter `id`, `title`, `status: shipped` | M1-app.md heading "M1 · AgentPager on my iPhone" and status line (Word: APP) | shipped date: marked shipped 30 Oct (c28857e); code on main 27 Oct (PR #17), from GitHub |  |
| MAPP deliverables C5, C6, C7, C17, I18, I4, I5, I6 | M1-app.md Adds: B5, B6, B7, B17, I4, I5, I6, I18 | C→B; heading labels per areas.md (@M1). I23 (new in M4, area 6) added too, as area 6 labels it @M1 |  |
| MAPP deliverables D1, D6, D7 | dissolve | outside services become "Relies on" lines in areas 6, 1 and 4 (area drafters) |  |
| MAPP intro: "Shipped. MAPP first ran with the first version's ways in, pager lifetimes and Agents list. v2 replaced them (DEC-2026-10-30-v2-promises), so their promises left this list, and MPAGERS and MCOMMAND carry what replaced them." | M1-app.md Slice (Agents row), Retires and Log | which of M2 or M3 retired each v1 id is the drafter's reading of the v2 stage plan and PR titles (assumed); DEC link dropped |  |
| MAPP intro: "K1::visible-within-five-seconds has no recorded measurement, so it moves to MFRIENDS." | next/FRIENDS.md What's known and Adds | K1's text comes from ledger-4-getting-paged |  |
| MAPP Objective | M1-app.md Objective, word for word | "(C7)" → "(B7)" |  |
| MAPP Out of scope 1, 2 and 4 | M1-app.md Out of scope, word for word |  |  |
| MAPP Out of scope 3 "Android, and product cards; a brief's option can preview one. Every card is a brief ([DEC-2026-10-27-briefs-are-the-card])." | M1-app.md Out of scope 3 | DEC link dropped; Sam's 27 Oct briefs answers quoted under M1 › Sam's answers |  |

### `packages/blueprint/roadmap/milestones/MPAGERS.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| MPAGERS frontmatter `id`, `title`, `status: shipped` | M2-pagers.md heading and status line (Word: PAGERS) | shipped 29 Oct (PR #22, local time) |  |
| MPAGERS deliverables C26, C23, C22, I17, I19 | M2-pagers.md Adds: B26, B23, B22, I17, I19 | B30's built part (key pair, fingerprint) is named under I19, as BRIEF rule 2 folds it |  |
| MPAGERS deliverables C5, C7 | M2-pagers.md Changes (B5, B7, and B17 and I6 per areas.md's @MPAGERS clauses) | B17 and I6 added from areas.md's born labels |  |
| MPAGERS deliverables D1, D6 | dissolve | "Relies on" lines (area drafters) |  |
| MPAGERS intro "Shipped: Stage 1 of the v2 plan (`docs/v2/05-readiness-review-and-stages.md`)." | M2-pagers.md status line | the docs/v2 path dropped: M4 removes docs/v2 |  |
| MPAGERS Objective | M2-pagers.md Objective, word for word |  |  |
| MPAGERS Out of scope 1 "The agentpager command: MCOMMAND." | M2-pagers.md Out of scope 1 | "MCOMMAND" → "M3" |  |
| MPAGERS Out of scope 2 "Encryption: … The agentpager command's own key check (I19) comes with MENCRYPT." | M2-pagers.md Out of scope 2 | "MENCRYPT" → link to next/ENCRYPT.md |  |
| MPAGERS Out of scope 3 | M2-pagers.md Out of scope 3, word for word |  |  |

### `packages/blueprint/roadmap/milestones/MCOMMAND.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| MCOMMAND frontmatter `id`, `title`, `status: shipped` | M3-command.md heading and status line (Word: COMMAND) | shipped 30 Oct; prod 1ee6c27 deployed 30 Oct (memory v2-dogfood-setup; GitHub) |  |
| MCOMMAND deliverables C25, C27, C29, C31, I21, I22, J3, J4 | M3-command.md Adds: B25, B27, B29, B31, I21, I22, J3, J4 | plus B18, B32, B33 and J5's built steps, per areas.md's @MCOMMAND labels |  |
| MCOMMAND deliverables C6, I4 | M3-command.md Changes (B6, I4; and B5, B17 for not picked up, per areas.md) |  |  |
| MCOMMAND deliverables D2, D8 | dissolve | D2 → B33 and area 2's "Relies on"; D8 → area 7's "Relies on" (area drafters) |  |
| MCOMMAND intro "Shipped: Stage 2 of the v2 plan (`docs/v2/05-…`)." | M3-command.md status line | docs/v2 path dropped |  |
| MCOMMAND Objective | M3-command.md Objective, word for word |  |  |
| MCOMMAND Out of scope 1 "The one-line install and release builds (C29, D8): MINSTALL. The command is built from the AgentPager repository." | M3-command.md Out of scope 1 | "(C29, D8)" dropped (B29 is now setup only; D ids dissolve); "MINSTALL" → link to INSTALL |  |
| MCOMMAND Out of scope 2 "Encryption: MENCRYPT. …" | M3-command.md Out of scope 2 | "MENCRYPT" → link to ENCRYPT |  |
| MCOMMAND Out of scope 3 "Cloud sessions: untested (D2)." | M3-command.md Out of scope 3 | "(D2)" → a link to area 2's L13 "Cloud sessions are untested" |  |

### `packages/blueprint/roadmap/milestones/MENCRYPT.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| MENCRYPT frontmatter `id`, `title` (no status) | next/ENCRYPT.md heading; status "queued" |  |  |
| MENCRYPT deliverables C30, I20, I19, C17, D6 | next/ENCRYPT.md Adds: B30 whole, I20 whole, I19's command-side check, B17's encrypted alert with D6's App Group and extension | D6 dissolves; its not-built part is in ledger-1/ledger-7 rows bound for ENCRYPT |  |
| MENCRYPT intro "Stage 3 of the v2 plan (`docs/v2/05-…`). Each deliverable's parts tagged 'Not built yet: comes with the encryption work' land here." | next/ENCRYPT.md Adds | "Stage 3" dropped with docs/v2; the not-built parts arrive through the area ledgers |  |
| MENCRYPT Objective | next/ENCRYPT.md Objective, word for word | preceded by Sam's 5 Nov words (M4-house.md) and SI10's text (ledger row of the PRODUCT drafter sends SI10 here) |  |
| MENCRYPT Out of scope 1 "Hiding which pager and which agent, when, and how big each part is (C30)." | next/ENCRYPT.md Out of scope 1 | "(C30)" dropped: B30 waits in the same doc |  |
| MENCRYPT Out of scope 2 | next/ENCRYPT.md Out of scope 2, word for word |  |  |
| MENCRYPT "Sam decides first" lead: "The product stays the same, with encryption added, so two questions are Sam's:" | next/ENCRYPT.md Still open lead "Sam decides these first:" | now three questions |  |
| MENCRYPT question 1 (decisions stored before the switch) | next/ENCRYPT.md Still open 1, word for word |  |  |
| MENCRYPT question 2 "What an agent sees when its command is from before the switch: refused, with how to update (MINSTALL)." | next/ENCRYPT.md Still open 2; What's known adds that INSTALL now comes after ENCRYPT | "(MINSTALL)" dropped. Under the 5 Nov order there is no install line at the switch, so "how to update" means rebuilding from the repository, and only Sam's machines run the command | ⚑ |

### `packages/blueprint/roadmap/milestones/MINSTALL.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| MINSTALL frontmatter `id`, `title`, `status: draft` | next/INSTALL.md heading; status "queued" |  |  |
| MINSTALL deliverables C29, C19, D6, D7, D8 | next/INSTALL.md Adds: B19 whole, B29's one-line install, builds per machine, the TestFlight build | D ids dissolve; their not-built text arrives in ledger-7 rows |  |
| MINSTALL intro "Each deliverable's parts tagged not built yet for the release builds, the TestFlight build or the demo agent land here." | next/INSTALL.md Adds |  |  |
| MINSTALL Objective | next/INSTALL.md Objective, word for word |  |  |
| MINSTALL Out of scope 1–2 | next/INSTALL.md Out of scope, word for word |  |  |
| MINSTALL question 1 "… or GitHub releases, which wait for MOPEN." | next/INSTALL.md Still open 1 | "MOPEN" → "OPEN" |  |
| MINSTALL question 2 | next/INSTALL.md Still open 2, word for word |  |  |
| MINSTALL question 3 "How an installed command learns it is out of date. MENCRYPT will refuse commands from before encryption, so their owners need an easy way to update." | next/INSTALL.md Still open 3 "How an installed command updates once the service says it is out of date." | how it *learns* moves to ENCRYPT's client-version header (hardening item 2); INSTALL keeps how it updates. The old reason no longer applies, since ENCRYPT ships first | ⚑ |
| MINSTALL question 4 (whether the demo agent stays) | next/INSTALL.md Still open 4, word for word |  |  |

### `packages/blueprint/roadmap/milestones/MSITE.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| MSITE frontmatter `id`, `title`, `status: draft` | next/SITE.md heading; status "queued" |  |  |
| MSITE deliverables C18 | next/SITE.md Adds: B18's front page and its what-we-store note | their text arrives in ledger-7 rows |  |
| MSITE intro "Each part of C18 tagged not built yet for the marketing page lands here." | next/SITE.md Adds |  |  |
| MSITE Objective | next/SITE.md Objective, word for word | preceded by Sam's 31 Oct words (DEC-2026-10-31-next-roadmap basis) and Sam's 5 Nov words on CLIENTS |  |
| MSITE Out of scope 1 "Pricing or plans: AgentPager has no paid tier (SP2)." | next/SITE.md Out of scope 1 | "(SP2)" dropped: strategy ids retire |  |
| MSITE Out of scope 2 "… (C19)." | next/SITE.md Out of scope 2 | C19 → B19 |  |
| MSITE "Sam decides first": "Sam workshops the page before anything is built, each round as real pages to look at: who it's for and what it must say, then its structure, then how it looks. C18's behaviours are rewritten from what the workshop settles." | next/SITE.md Still open | "workshops" → "works through … in several rounds of visual drafts" (Sam's ask, memory next-roadmap); C18 → B18 |  |
| — (code and catalogue) | next/SITE.md What's known: today's page, its screens and `packages/app/src/site/` with the v1 QR picture | from the ledger's A16 row and PR #42's notes |  |

### `packages/blueprint/roadmap/milestones/MOPEN.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| MOPEN frontmatter `id`, `title`, `status: draft` | next/OPEN.md heading; status "queued" |  |  |
| MOPEN deliverables D1, D6, D7 | dissolve | OPEN's guide relies on Cloudflare and Apple; What's known says what Apple's signing means for alerts |  |
| MOPEN Objective | next/OPEN.md Objective, word for word | preceded by Sam's 31 Oct words and SP2's "The code is open: anyone can read it, fork it and run their own" (the PRODUCT drafter's SP2 row sends it here) |  |
| MOPEN Out of scope | next/OPEN.md Out of scope, word for word |  |  |
| MOPEN questions 1–3 (licence, where it lives, the clean history) | next/OPEN.md Still open 1–3, word for word |  |  |
| MOPEN question 4 "Alerts on a service someone else runs. Apple delivers alerts only from the team that signed the app, so someone else's service can't alert the TestFlight app. A self-hoster builds the app under their own Apple team, or goes without alerts." | next/OPEN.md What's known (the fact) and Still open 4 (the choice) | split, words kept |  |
| MOPEN question 5 "What the cleanup removes, for example `docs/v2/`, the workshop notes, the parked web milestone and the retired hosted MCP's answer." | next/OPEN.md Still open 5 "What the cleanup still removes after M4, for example the retired hosted MCP server's answer." | narrowed: M4 removes docs/v2, the workshop, lessons, parked and old plans (Sam's simplification 3); What's known says so | ⚑ |
| — (Sam's go) | next/OPEN.md status line: publishing needs Sam's own go | from the brief; new | ⚑ |

### `packages/blueprint/roadmap/milestones/MFRIENDS.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| MFRIENDS frontmatter `id`, `title`, `status: draft` | next/FRIENDS.md heading; status "queued" |  |  |
| MFRIENDS deliverables J5, K1 | next/FRIENDS.md Adds: K1 whole; J5's walk by an invited owner | K1's text comes from ledger-4 |  |
| MFRIENDS Objective | next/FRIENDS.md Objective, word for word | "(MINSTALL)", "(MSITE)", "(MOPEN)", "(MENCRYPT)" lose the M; preceded by Sam's 5 Nov words |  |
| MFRIENDS Out of scope 1–2 | next/FRIENDS.md Out of scope, word for word |  |  |
| MFRIENDS questions 1–2 | next/FRIENDS.md Still open 1–2 | "(C31)" → "(B31)" |  |

### `packages/blueprint/records/decisions/DEC-2026-09-25-mstart-scope.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-09-25-mstart-scope | dropped | history; git holds it at tag blueprint-old-format. MSTART never shipped, and no line rests on it |  |

### `packages/blueprint/records/decisions/DEC-2026-09-26-agent-reach.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-09-26-agent-reach | dropped | history; git holds it at tag blueprint-old-format. v2 replaced its ways in with the command (DEC-2026-10-30-v2-promises); the held wait it began is in code (ANSWER_WAIT_MAX_SECONDS) and B32 |  |

### `packages/blueprint/records/decisions/DEC-2026-09-26-registry-object.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-09-26-registry-object | dropped | history; git holds it at tag blueprint-old-format. The Registry still holds the pagers, but that is structure: code (registry.ts's comment) and PRODUCT › Stack ("one Durable Object for the pagers and one per agent"). The first conversion step kept it (A10); simplification 4 lets git hold it |  |

### `packages/blueprint/records/decisions/DEC-2026-09-26-session-lifecycle.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-09-26-session-lifecycle | dropped | history; git holds it at tag blueprint-old-format. v1 session lifetimes, retired by v2 |  |

### `packages/blueprint/records/decisions/DEC-2026-09-29-m1-owner-feedback.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-09-29-m1-owner-feedback | dropped | history; git holds it at tag blueprint-old-format. v1 emoji pairing and lifetimes. Its domain, agentpager.me, is in PRODUCT › Stack; its dated credential checks are history |  |

### `packages/blueprint/records/decisions/DEC-2026-09-29-sequential-guest-cards.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-09-29-sequential-guest-cards | dropped | history; git holds it at tag blueprint-old-format. Web guest cards, retired |  |

### `packages/blueprint/records/decisions/DEC-2026-09-29-sharpening-repairs.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-09-29-sharpening-repairs | dropped | history; git holds it at tag blueprint-old-format. MSTART repairs to retired ids |  |

### `packages/blueprint/records/decisions/DEC-2026-09-30-fetch-only-host.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-09-30-fetch-only-host | dropped; its Codex finding to next/CLIENTS › What's known | history; git holds it at tag blueprint-old-format. The v1 cold-client recipe, retired with recipe.json. Its finding that Codex starts MCP servers in the background, so tools can be missing on the first turn unless the server is marked required, still holds for agents in Codex |  |

### `packages/blueprint/records/decisions/DEC-2026-10-01-home-screen.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-01-home-screen | dropped | history; git holds it at tag blueprint-old-format. The web home screen, retired |  |

### `packages/blueprint/records/decisions/DEC-2026-10-01-mcards-first.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-01-mcards-first | dropped | history; git holds it at tag blueprint-old-format. The web milestone order; MCARDS never shipped |  |

### `packages/blueprint/records/decisions/DEC-2026-10-02-generic-cards-first.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-02-generic-cards-first | dropped | history; git holds it at tag blueprint-old-format. Superseded by DEC-2026-10-27-briefs-are-the-card; the 5-second Undo window it began is in TERMS › Undo window and AppModel.undoSeconds |  |

### `packages/blueprint/records/decisions/DEC-2026-10-08-ended-pagers-readable.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-08-ended-pagers-readable | dropped | history; git holds it at tag blueprint-old-format. v2 has no ended pagers |  |

### `packages/blueprint/records/decisions/DEC-2026-10-08-native-ios.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-08-native-ios | DECISIONS.md DEC-2026-10-08-native-ios | shortened to what stands: native iPhone app in SwiftUI, pager never session, an alert only opens the app, no Live Activity and the badge counts what waits, HTTPS only and keys as digests; marked → v2-promises and → next-roadmap in part |  |
| DEC-2026-10-08-native-ios, "It adds two milestones: MAPP: the app on Sam's iPhone, without alerts" and answer 11 "Dogfood first: install on Sam's iPhone over USB with free signing, and set up Apple credentials in parallel without blocking product work." | milestones/M1-app.md | M1's starting answers, quoted |  |
| DEC-2026-10-08-native-ios, answer 4 "Plan a demo agent for App Review." | next/INSTALL | the demo agent's origin (B19), with DEC-2026-10-27-pr1-sign-off answer 3b |  |
| DEC-2026-10-08-native-ios, the rest: links, pairing, lifetimes, end reasons, "Ends" counts, `?connect=` links, MSHIP, Android later, the 10-open-cards-per-pager default, the privacy-page default | dropped | history; git holds it at tag blueprint-old-format. Retired by v2 and the 31 Oct roadmap; the open-decision cap is now 10 per agent, in code (MAX_OPEN_DECISIONS); the privacy-page note waits in next/SITE (the milestones drafter's, from MSITE). Default 6's limit on starting pagers per network address has its successor in ENCRYPT's connect rate limit |  |
| DEC-2026-10-08-native-ios, answers 1, 3, 5 and 11 | M1-app.md Sam's answers, quoted as recorded | MAPP's own answers. Cross-ref: the DECISIONS drafter keeps or drops the DEC itself |  |
| DEC-2026-10-08-native-ios, answer 4 | M1-app.md (pointer) and next/INSTALL.md What's known | ledger-7 has the same row |  |

### `packages/blueprint/records/decisions/DEC-2026-10-08-pager-numbers.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-08-pager-numbers | dropped | history; git holds it at tag blueprint-old-format. v2 replaced one number per phone with one per pager (DEC-2026-10-30-v2-promises); "Numbers only" is pinned in PRODUCT, and DEC-2026-10-29-v2-design says why. The first conversion step kept it; simplification 4 lets git hold it |  |
| DEC-2026-10-08-pager-numbers, Sam's two quotes | M1-app.md Sam's answers | cross-ref, as above |  |

### `packages/blueprint/records/decisions/DEC-2026-10-08-storybook-is-the-design.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-08-storybook-is-the-design | dropped | history; git holds it at tag blueprint-old-format. Superseded by DEC-2026-10-30-screens-from-the-app. Its rule that blue text in dark mode keeps 4.5:1 contrast is held nowhere now | ⚑ |

### `packages/blueprint/records/decisions/DEC-2026-10-09-alerts-in-mapp.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-09-alerts-in-mapp | dropped | history; git holds it at tag blueprint-old-format. Its answer and facts move (rows below). The first conversion step kept it; its one binding sense is M1's. Universal Links, which it left with MSHIP, are off the roadmap since 31 Oct |  |
| DEC-2026-10-09-alerts-in-mapp, "C17::get-paged moves from MSHIP to MAPP" and Sam's words "Whats the reason we don't include push notifications in the dogfooded version btw? I feel like that's a kinda important feature but it's pushed to the next milestone - what would be required to pull it into the current dogfooding version" | milestones/M1-app.md | M1's answer: alerts came into M1, with the reason "A pager that only works while its app is open does not test what AgentPager is for" |  |
| DEC-2026-10-09-alerts-in-mapp, facts: the signing team X3M532E87A is on the paid Apple Developer Program; the APNs key is in the vault item `AgentPager APN.p8 key` and works on sandbox and production; a deployed Worker reaches Apple's push service over HTTP/2, local workerd does not, so only the deployed service sends alerts | AGENTS.md › Deploying and secrets (Sam signs; the push key in 1Password) and › Gotchas (alerts need the deployed service). The team id and the key's vault item are in `scripts/build.mjs` and `packages/app/README.md` › Alerts | Apple and deploy facts; area 4's Relies on names Apple's push service |  |
| DEC-2026-10-09-alerts-in-mapp, Sam's quote and answers | M1-app.md Sam's answers and Log (PR #8) | a milestone answer, so it lives in M1, not DECISIONS; its push-key and paid-team facts are AGENTS.md's |  |

### `packages/blueprint/records/decisions/DEC-2026-10-27-briefs-are-the-card.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-27-briefs-are-the-card | DECISIONS.md DEC-2026-10-27-briefs-are-the-card | shortened to what stands: the brief is the card, letters A to D, the brief's limits, folding keeps approval exact; marked → v2-promises in part |  |
| DEC-2026-10-27-briefs-are-the-card, "Which milestone ships briefs?": A, add briefs to MAPP | milestones/M1-app.md | M1's answer: briefs are in M1, since they already ran in production from the dogfood app |  |
| DEC-2026-10-27-briefs-are-the-card, the rest: old emoji cards readable until their pager ends, pairing keeps three emoji, the read-only copy after a pager ends, the emoji-card screen kept, the Hero Features and Guarantees renames | dropped | history; git holds it at tag blueprint-old-format. Retired by v2; the renamed sections folded into PRODUCT (DEC-2026-10-31-method) |  |
| DEC-2026-10-27-briefs-are-the-card basis: Sam's quote and the answers on briefs in MAPP and on emoji cards | M1-app.md Sam's answers | cross-ref; "briefs are the card" itself binds later and stays the DECISIONS drafter's |  |

### `packages/blueprint/records/decisions/DEC-2026-10-27-pr1-sign-off.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-27-pr1-sign-off | dropped | history; git holds it at tag blueprint-old-format. The first conversion step kept it; its one live answer moves (row below) |  |
| DEC-2026-10-27-pr1-sign-off, answer 3b: the demo agent is a link, not a public demo on agentpager.me; it is for App Review, and the link goes to owners Sam invites too | next/INSTALL | INSTALL's answer, quoted; B19 |  |
| DEC-2026-10-27-pr1-sign-off, answers 1a and 2b, the strategy draft and heading renames | dropped | history; git holds it at tag blueprint-old-format. Retired by DEC-2026-10-30-v2-promises |  |
| DEC-2026-10-27-pr1-sign-off, "Questions 5 and 6 (how MAPP gets built, and the old copy in the blueprint repo) change nothing here and stay open." | dropped | question 5 is moot, since M1 shipped. Question 6, the old copy of AgentPager in exocognito/blueprint, has no home now; Sam to say whether it is still open (OPEN may be its place) | ⚑ |
| DEC-2026-10-27-pr1-sign-off answer 3b (the demo agent is a link) | next/INSTALL.md What's known; next/SITE.md Out of scope 2 | ledger-7 has the same row |  |

### `packages/blueprint/records/decisions/DEC-2026-10-27-swift-app-is-the-brief-design.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-27-swift-app-is-the-brief-design | dropped | history; git holds it at tag blueprint-old-format. DEC-2026-10-30-screens-from-the-app extended it to the whole app and names it as its origin. The first conversion step kept it |  |

### `packages/blueprint/records/decisions/DEC-2026-10-30-screens-from-the-app.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-30-screens-from-the-app | DECISIONS.md DEC-2026-10-30-screens-from-the-app | shortened; paths updated (the catalogue to generated/screens); `docs/v2/mocks/` as a sketch place and the "recorded exception" to the Blueprint law dropped, since docs/v2 goes and METHOD.md replaces the law |  |

### `packages/blueprint/records/decisions/DEC-2026-10-30-v2-promises.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-30-v2-promises | DECISIONS.md DEC-2026-10-30-v2-promises | shortened to what stands; marked → DEC-2026-10-31-method in part ("tag the stages") |  |
| DEC-2026-10-30-v2-promises, "Which bigger architecture change should start first?": A, contract first | milestones/M3-command.md | M3's answer: the contract changed first (PR #33, 30 Oct). Assumed: PRs #28 to #34 shipped in M3's release, 1ee6c27 |  |
| DEC-2026-10-30-v2-promises, its lists of deleted, rewritten and new C and I ids, the follow-up note on journeys and dependencies, and its Supersedes list | dropped | history; git holds it at tag blueprint-old-format. The follow-up was done (PRs #35, #36); the supersessions are history |  |

### `packages/blueprint/records/decisions/DEC-2026-10-31-method.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-31-method | DECISIONS.md DEC-2026-10-31-method | shortened; marked → DEC-2026-11-05-blueprint-destination in part |  |

### `packages/blueprint/records/decisions/DEC-2026-10-31-next-roadmap.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| DEC-2026-10-31-next-roadmap | DECISIONS.md DEC-2026-10-31-next-roadmap | shortened; marked → DEC-2026-11-05-blueprint-destination in part (parallel → one at a time; CLIENTS) |  |
| DEC-2026-10-31-next-roadmap, each new milestone's scope | next/INSTALL, SITE, OPEN, FRIENDS | the milestones drafter writes them, from roadmap/milestones |  |

### `packages/blueprint/records/lessons/L1-stdin-and-streaming-for-cold-clients.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| L1, whole | AGENTS.md › Gotchas | lessons retire (DEC-2026-11-05-blueprint-destination), and their id is never reused: limits start at L9. Kept: run an agent app without a terminal with stdin closed, a time limit and its output streamed |  |

### `packages/blueprint/records/lessons/L2-codex-drops-a-server-that-answers-a-notification-with-a-body.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| L2, whole | AGENTS.md › Gotchas | lessons retire (DEC-2026-11-05-blueprint-destination), and their id is never reused: limits start at L9. Kept: an MCP client may drop a server silently over a detail another tolerates; prove a way in with more than one real app |  |

### `packages/blueprint/records/lessons/L3-codex-resume-needs-its-own-flags.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| L3, whole | AGENTS.md › Gotchas | lessons retire (DEC-2026-11-05-blueprint-destination), and their id is never reused: limits start at L9. Kept: an agent app's resume flags differ from its start flags; the exact flags were the retired cleanroom runs' |  |

### `packages/blueprint/records/lessons/L4-a-chat-question-ends-the-turn.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| L4, whole | AGENTS.md › Gotchas; B33 is its product side | lessons retire (DEC-2026-11-05-blueprint-destination), and their id is never reused: limits start at L9. Kept: an agent app run without a terminal ends its turn when it asks in chat, and nothing resumes it |  |

### `packages/blueprint/records/lessons/L5-playwright-is-the-owner-browser.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| L5, whole | dropped | lessons retire (DEC-2026-11-05-blueprint-destination), and their id is never reused: limits start at L9. Playwright as the owner's browser: the web owner side is retired. git keeps it at tag `blueprint-old-format` |  |

### `packages/blueprint/records/lessons/L6-test-helpers-that-start-wrangler.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| L6, whole | AGENTS.md › Gotchas | lessons retire (DEC-2026-11-05-blueprint-destination), and their id is never reused: limits start at L9. Kept: one wrangler per test file on its own ports and storage; a run reporting zero tests isn't green; port 4317 is taken on Sam's Mac |  |

### `packages/blueprint/records/lessons/L7-a-local-proof-maps-the-link-to-its-own-origin.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| L7, whole | dropped | lessons retire (DEC-2026-11-05-blueprint-destination), and their id is never reused: limits start at L9. Pairing links are retired. git keeps it at tag `blueprint-old-format` |  |

### `packages/blueprint/records/lessons/L8-the-start-lines-cold-agents-missed.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| L8, whole | dropped | lessons retire (DEC-2026-11-05-blueprint-destination), and their id is never reused: limits start at L9. The v1 /start conduct lines; B18 holds what /start says now. git keeps it at tag `blueprint-old-format` |  |

### `docs/v2/01-decisions.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| docs/v2/01-decisions.md and docs/v2/HANDOFF.md's defaults, the parts that still bind | DECISIONS.md DEC-2026-10-29-v2-design | added under the first conversion step's A11 ★, since docs/v2 goes in PR 4 and area files quote its phrases ("History on disk, never in context"). Only what still binds is here; stage-only defaults (fresh install, the session → agent rename, mocks canonical until screenshots, local builds) and the "Open" list are for the area and milestones drafters |  |
| docs/v2/01-decisions, "Decision screen" and "Decision, pager off" | B5.1, B5.7, B5.8, B5.15 | already in C5; images as full-screen covers is B5.6 |  |
| docs/v2/01-decisions, "Answered decision" | B7.3, B7.4 | the badge, grey box and "no chat bubbles" are design, held in code (`DecisionView.swift`, `ClosedBar`) and the screens |  |
| docs/v2/01-decisions, "Notes are answers, not guidance" | B6.4; B32.5 (area 2) | "not encrypted from the phone to each agent" is ENCRYPT's (area 6) |  |
| — (docs/v2/01-decisions, Goal and Multi-user) | next/FRIENDS.md What's known: the goal "make it easy for ~10 friends and colleagues to install, use and give feedback" and the history-file feedback idea | quoted as recorded |  |
| docs/v2/01-decisions "App structure (canvas … Chosen screens)" | M2-pagers.md Sam's answers (the canvas choice only) | the screens themselves are the record now |  |
| docs/v2/01-decisions "Quality is reviewed by judgement…" and Sam's reasoning | M3-command.md Sam's answers | B27's background |  |
| the file | PR 4 deletes it | history, outside packages/blueprint: the rest of the file; three code comments cite it. git keeps it |  |

### `docs/v2/02-writing-rules.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| docs/v2/02 §6.1, "defer" and "leave as is" are real options | `rules.ts` (CONTRACT point 4, REVIEW point 2) | decided 29 Oct (docs/v2/HANDOFF.md) and built in the contract's text, which is its one home; no Blueprint line |  |
| docs/v2/02 §6.2, small decisions: should reviewers grade missing optional keys good to fix at most? | dropped | open question never settled. The template already says small decisions leave out optional keys; the review list says nothing of small cards | ⚑ |
| docs/v2/02 §6.3, "tune after the first week" | dropped | the numbers stay as built (B27.8); no tuning was recorded | ⚑ |
| docs/v2/02 §6.4, back the padded-option point with a check if reviews miss it | L16 · Nothing makes an agent review its card | becomes the limit's fix and revisit |  |
| the file | PR 4 deletes it | history, outside packages/blueprint: the rest of the file: the card contract's one home is `packages/cli/src/rules.ts`. git keeps it |  |

### `docs/v2/03-binary-surface.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| docs/v2/03 §2 `agentpager agents` | B25.12 | new clause: built, held by `cli.test.ts › the binary…` and `decode.test.ts › an agent file…` | ⚑ |
| docs/v2/03 §2 `agentpager finish`; TERMS "Agent"; Sam's 29 Oct default to keep `finish` | B25.13 | new clause: built, held by `pagers.test.ts › pagers and agents…` (finished, asks nothing more, still acknowledges, finishing twice is harmless) | ⚑ |
| docs/v2/03 §2–§3, §6 (wait holds up to 50 s; `seconds` up to 50) | B32.2 | new clause; specifics as in the D2 long-wait row | ⚑ |
| docs/v2/03 §4 wait, pending | B32.3 | new clause; exact words left to `cli.test.ts › the binary…` | ⚑ |
| docs/v2/03 §4 wait, option chosen | B32.4 | new clause; exact words left to `cli.test.ts › the binary…` | ⚑ |
| docs/v2/03 §6 "the answer never expires on the server while the agent exists" | B32.6 | with D2's "must not lose the answer"; `cli.test.ts › the binary…` collects an answer sent before the wait |  |
| docs/v2/03 §2, §4 `--forever` (50 s rounds, retry every 10 s through an unreachable service; a reply not understood ends it) | B32.7 | new clause; "50 s rounds" and "every 10 seconds" held by `commands.ts` (WAIT_SECONDS, RETRY_MS); outcome held by `wait.test.ts › waiting words…` (outlasts a restart) and `decode.test.ts › a 200 that isn't…`, `› sent, no reply…` | ⚑ |
| docs/v2/03 §2–§4 ack (next steps, green tick, only the first counts, refused before the answer) | B32.8 | new clause. "Green tick" left to B7 and `cli.test.ts › the binary…`; only-the-first held by the same test. "Refused before the answer" is held by `commands.ts › ack` and `contract.ts` NotAnswered, but no test | ⚑ |
| docs/v2/03 §2 `agentpager status` | B32.9 | new clause: held by `cli.test.ts › the binary…` and `pagers.test.ts › off: nothing gets through…` | ⚑ |
| docs/v2/03 §4 unreachable, no reply, reply not understood | B32.10 | new clause; exact words left to `decode.test.ts › a 200 that isn't…` and `› sent, no reply…` | ⚑ |
| docs/v2/03 §4 "ask, pager off (also on wait and ack)" | B32 note | I17 holds it |  |
| docs/v2/03 §6, positive identification (`claude-code`, `local-agent-mode-<server>`, `CLAUDECODE=1` with no other marker) | B33.1 | the names and marker cut; held by `detect.ts › harness` and `wait.test.ts › harness…` | ⚑ |
| docs/v2/03 §6, Claude Code's words | B33.2 | exact words left to `wait.test.ts › waiting words…` | ⚑ |
| docs/v2/03 §6, Claude Desktop's words (seconds 1 between steps, 50 s holds, `sleep 10` up to 10 times, stop after 2 hours) | B33.3 | "two hours" kept: Sam chose the 2-hour Desktop limit on 30 Oct (memory `agent-wake-research`). The rest is left to `wait.test.ts › waiting words…`, which asserts every line | ⚑ |
| docs/v2/03 §6, the 2-hour stop | L12 · A Desktop chat stops waiting after two hours | new limit: people meet it and it waits for a fix | ⚑ |
| docs/v2/03 §1 (files on the machine, `config.json`, `AGENTPAGER_SERVER`, nothing in the project) | code `store.ts` | its comment holds the layout and "never in the project"; it was never a Blueprint line |  |
| docs/v2/03 §2 exit codes | code `commands.ts` Result, `main.ts` help | held by `cli.test.ts` (2, 4, 5, 6) and `decode.test.ts` (5); never a Blueprint line |  |
| docs/v2/03 §3 MCP tools and their descriptions | code `mcp.ts` TOOLS | `cli.test.ts › the binary…` asserts the nine tool names; B29.7 says the tools give the same replies (area 7) |  |
| docs/v2/03 §5 history | B31 |  |  |
| docs/v2/03 §7 Q1 shared ids | L14 · An agent id works on one machine only |  |  |
| docs/v2/03 §7 Q2 `finish`, Q3 history cap | B25.13, B31.4 | answered by Sam on 29 Oct (HANDOFF) |  |
| docs/v2/03 §7 Q4 app markers | code `detect.ts` comment |  |  |
| docs/v2/03 §4, the fingerprint-mismatch reply | next/ENCRYPT | not built: today a mismatch is refused as "not in use" (B25.8), and the command doesn't check the key itself. Goes with I19's command-side check (area 6). Text: "When the command's own key check fails, the agent is told the number's key doesn't match the service's, to check the number, and, if it is right, to stop and tell its owner." |  |
| docs/v2/03 §2 `agentpager update` | next/INSTALL | area 7's row carries it |  |
| docs/v2/03 §4 "arriving without the binary": "No API documentation for hand-rolled calls." | B18 note | kept as a note, not a clause (no current promise held it); `start.test.ts` checks the page has no `/api/`, `agentKey`, `curl`, `session` or `pairing` |  |
| docs/v2/03 §4 "arriving without the binary": "/mcp and /start both answer with one paragraph: install with the curl line, then `agentpager connect <number>`" | B18.1, B18.4; next/INSTALL | built part in B18; the curl line is INSTALL's (C29.1 row) |  |
| docs/v2/03 §2: "`agentpager update`: self-update from agentpager.me" (today it replies that self-update isn't available, with how to rebuild) | next/INSTALL | shared with area 2, whose sample carries it. Not built. Text for INSTALL: "`agentpager update` updates the command from where it was installed; an installed command learns when it is out of date." |  |
| the file | PR 4 deletes it | history, outside packages/blueprint: the rest of the file: code comments cite it. git keeps it |  |

### `docs/v2/04-encryption.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| 04 header: the service carries bytes it can't read, the number binds the key, alerts still show the question; X25519, HKDF-SHA256 and AES-256-GCM, which CryptoKit and Node/Bun both have, so no new library | next/ENCRYPT (its design) | Summary of the goal and the primitives |  |
| 04 draft-2 note: the owner's notes travel as answers | next/ENCRYPT | Nothing is encrypted from the phone to agents except answers. Matches "Notes are answers to one decision" (STRATEGY) |  |
| 04 §1 Keys | I19.1 and I23 (built); next/ENCRYPT | Built: the pager key pair on the phone (a CryptoKit Curve25519 key-agreement key, that is X25519), and the phone and agent keys as digests. For ENCRYPT: the pager key moves into a Keychain the alert extension can read (an App Group; today's entitlements have none), not the Secure Enclave, which can't hold this kind of key. Each agent gets its own key pair, made on its machine at connect and kept in its private file. The service gets only public keys and never a private key |  |
| 04 §2 the number's format | I19.2 (built) | Specifics in code (see the I19 body row) |  |
| 04 §2 the version prefix: the command refuses versions it doesn't know, with a clear message | next/ENCRYPT (note) | Built only in part: any other prefix is refused as a number not in use (`store.ts › pagerOf`, B25). A version-specific reply matters only if ENCRYPT changes the format |  |
| 04 §2 at connect, the command fetches the pager's public key and refuses a mismatch | next/ENCRYPT (I19 clause) | See the I19 command-side row; it needs a route that gives a pager's public key |  |
| 04 §2 why 64 bits is enough | I19 note 1 |  |  |
| 04 §2 "the server rate-limits connects per pager" | next/ENCRYPT | Not built: nothing in `packages/app/src` limits the rate of connects (5 Nov). It is part of why a number may carry the pager id in the clear | ⚑ |
| 04 §2 the number is an address; it lives in AGENTS.md; `AGENTPAGER_PAGER` keeps it out of transcripts | B25 (area 2), TERMS (Pager number) | Built |  |
| 04 §2 "Today's number is 32 random characters with no structure …" | dropped | History: v2 built the new number |  |
| 04 §3 what is encrypted, and to whom | next/ENCRYPT (B30, I20) | To the pager's key: the card (title, detail, card, attachment names), each attachment's bytes, the agent's identity at connect (app, project, name, machine), and the acknowledgement. To the agent's key: the answer. In the clear: pager, agent, decision and answer ids, timestamps, sizes, attachment count, on/off and auto-off, the device token. Nothing else |  |
| 04 §4 the envelope | next/ENCRYPT (its design) | One format for every blob, both ways: a fresh ephemeral key per blob, a derived key, authenticated encryption. Each blob's purpose is bound into its key and its authenticated data, with the pager id and decision id, so a blob can't be replayed as another kind or moved to another pager or decision. Leaking an agent key exposes only the answers sent to it. The small overhead keeps a 1 MB image under the limit. Attachments are numbered blobs, so the service never sees their names |  |
| 04 §5 alerts | next/ENCRYPT (B30; B17's clause, area 4) | An alert carries a small encrypted preview (title, detail, app), not the card. An extension on the phone decrypts it with the pager key, offline, and shows the real question; if it can't, the alert says only "New decision". Acknowledgements work the same way. The not-picked-up alert becomes generic, and the phone names the agent from the identity it already decrypted. Apple sees only that an alert happened, and its size. Area 4's ledger points at §5 too; one home in ENCRYPT |  |
| 04 §6 server changes | built in part (B26, I17); next/ENCRYPT | Built: the pagers table with no name, the off check on every agent call, links, QR and pairing gone. For ENCRYPT: the plain title and detail go, and so does the question text in alerts; agents gain a public key and an encrypted identity; the card, attachments (by number), answers and acknowledgements are stored as blobs; a route gives a pager's public key |  |
| 04 §7 phone changes | built in part (I19.1–.2, B26); next/ENCRYPT | Built: the key pair, the id, the fingerprint and the number, all made on the phone. For ENCRYPT: the App Group Keychain; the phone encrypts answers and decrypts cards, attachments, identities and acknowledgements on read, and the brief reader is unchanged; an alert extension target |  |
| 04 §8 what this doesn't protect against | next/ENCRYPT (limits once built; SITE's "what we store" note, B18) | The service still knows who pages whom, when, how much and how often. A compromised agent machine exposes that agent's cards, the answers to it and the pager's history file there. A compromised phone exposes everything on it, with no second device and no recovery. Apple sees that an alert happened, and its size |  |
| 04 §9 Q1 fingerprint length; Q2 attachment names | next/ENCRYPT (settled) | Sam confirmed both on 29 Oct (docs/v2/HANDOFF, "Fingerprint 8 bytes, 36-character number; attachment names encrypted"), so they aren't open questions |  |
| 04 §9 Q3 self-hosters need nothing extra | next/ENCRYPT (note) | Keys are per pager and never leave the phone or the agent's machine |  |
| Code comments citing docs/v2/04 §2: `worker.ts:23`, `test/support.ts:35`, `Keychain.swift:23`, `packages/contract/exchange.ts` (was schemas/exchange.ts:27) | re-point to I19 (PR 4) |  |  |
| docs/v2/04-encryption.md, as a whole | next/ENCRYPT.md What's known › The design (short form) | the one home for 04's short form. ledger-6 has the section rows; see the note below |  |
| docs/v2/04 specifics: the number's byte layout (§2), the envelope's byte layout and info string (§4), the push payload, its 4 KB limit, the 1 KB preview and the extension's 30-second budget (§5), table columns and the key route's path (§6) | cut from the tree; `docs/v2/04-encryption.md` stays in git, and next/ENCRYPT.md names it | the number's layout is built and held by `Keychain.swift` and `worker.ts › parseNumber`; the rest is unbuilt design, held by no test | ⚑ |
| docs/v2/04 §8, what encryption doesn't protect against | next/ENCRYPT.md What's known; next/SITE.md What's known points to it | also in ledger-6 |  |
| docs/v2/04 §9 Q1–Q2 (fingerprint length, attachment names) | next/ENCRYPT.md What's known "Sam's answers on 29 Oct" | settled per docs/v2/HANDOFF |  |
| docs/v2/04 §9 Q3 (self-hosters need nothing extra) | next/OPEN.md What's known |  |  |
| the file | PR 4 deletes it | history, outside packages/blueprint: the rest of the file: next/ENCRYPT names it, and code comments cite it. git keeps it |  |

### `docs/v2/05-readiness-review-and-stages.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the file | PR 4 deletes it | history, outside packages/blueprint: M2 and M3 no longer cite it; its items to watch are ENCRYPT's hardening items and the limits. git keeps it |  |

### `docs/v2/06-blueprint-update-plan.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the file | PR 4 deletes it | history, outside packages/blueprint: superseded by this conversion; `MarketingScreen.tsx` cites it. git keeps it |  |

### `docs/v2/HANDOFF.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| docs/v2/HANDOFF "Decisions already made": fresh install, rename session → agent | M2-pagers.md Sam's answers | quoted as recorded |  |
| docs/v2/HANDOFF defaults: real "defer" options, no cross-machine ids, keep finish, history cap and reminder, local build, number in AGENTS.md | M3-command.md Sam's answers | quoted as recorded; the specifics also sit in area clauses (areas 2 and 3) |  |
| the file | PR 4 deletes it | history, outside packages/blueprint: the rest: its confirmed defaults are in DEC-2026-10-29-v2-design and M2's and M3's answers. git keeps it |  |

### `docs/v2/card-example.yaml`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the file | PR 4 deletes it | history, outside packages/blueprint: `rules.ts` and `Previews.swift` cite it, so PR 4 moves it beside the command's tests or re-points them. git keeps it |  |

### `docs/v2/mocks`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the folder | PR 4 deletes it | history, outside packages/blueprint: superseded by `generated/screens/`. git keeps it |  |

### `docs/v2/pages`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the folder | PR 4 deletes it | history, outside packages/blueprint: explainers. git keeps it |  |

### `docs/v2/regression`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the folder | PR 4 deletes it | history, outside packages/blueprint: `regression-cards.mjs` and the command's README cite it, so PR 4 moves it beside the command's tests. git keeps it |  |

### `workshop/2026-09-29-milestone-roadmap`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| whole | PR 4 deletes it | history: a v1 milestone aid. git keeps it |  |

### `recipe.json`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| whole | PR 4 deletes it | history: the retired cleanroom recipe; the root README says not to run it. git keeps it |  |

### `packages/blueprint/records/workshop`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| every file | deleted in this pull request | the OwnerPager v1 workshop: its notes, statecharts, routes, boards and seeds describe a retired product. Nothing in it is still true. git keeps it at tag `blueprint-old-format` |  |

### `packages/blueprint/records/workshop/v1`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| every file | deleted in this pull request | the OwnerPager v1 workshop: its notes, statecharts, routes, boards and seeds describe a retired product. Nothing in it is still true. git keeps it at tag `blueprint-old-format` |  |

### `packages/blueprint/roadmap/parked`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| parked/MCARDS.md | tag only | the web milestone; its deliverables were deleted with v2. Sam agreed (simplification 3) |  |
| parked/README.md | tag only |  |  |
| the folder | deleted in this pull request | see the two rows above. git keeps it at tag `blueprint-old-format` |  |

### `.agents/plans/2026-10-30-design-catalogue.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| whole | PR 4 deletes it | history: done in PRs #38 and #39. git keeps it |  |

### `.agents/plans/2026-10-31-method.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| whole | PR 4 deletes it | history: its provenance is DEC-2026-10-31-method's context. git keeps it |  |

### `.agents/plans/2026-10-31-next-roadmap-orchestration.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| whole | PR 4 deletes it | history: its shared-file owners retire with one milestone at a time; the one-Simulator rule is in AGENTS.md. git keeps it |  |

### `.agents/plans/2026-10-31-root-handoff.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| whole | PR 4 deletes it | history: superseded by the M4 plan. git keeps it |  |

### `.agents/plans/2026-10-31-method-sample`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| whole | PR 4 deletes it | history: superseded by `blueprint/`. git keeps it |  |

### `packages/blueprint/design/screens`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the code | blueprint/generated/screens/ | moved by PR #42 (b95fc62), before this pull request |  |

### `packages/blueprint/design/schemas`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the code | packages/contract/ | moved by PR #42 (b95fc62), before this pull request |  |

### `packages/blueprint/design/ui/components/cards/brief`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the code | packages/contract/brief.ts | moved by PR #42 (b95fc62), before this pull request |  |

### `packages/blueprint/design/ui/screens`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the code | packages/app/src/site/ | moved by PR #42 (b95fc62), before this pull request |  |

### `packages/blueprint/design/ui/components`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the code | packages/app/src/site/ | moved by PR #42 (b95fc62), before this pull request |  |

### `packages/blueprint/package.json`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| the code | packages/contract/package.json | moved by PR #42 (b95fc62), before this pull request |  |

### `AGENTS.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| AGENTS.md: "One part still shows v1: the front page's copy." | L21 · The front page still describes the first version | the rewritten AGENTS.md drops the line; L21 holds it |  |
| "Its product contract is the Blueprint in `packages/blueprint/`" | AGENTS.md first paragraph | now `blueprint/`, with METHOD.md as how it is built |  |
| the ladder (strategy, design promises, design code and catalogue) and the roadmap line | AGENTS.md ladder | now blueprint/README.md, PRODUCT, the areas, JOURNEYS and `generated/screens` |  |
| "Current state (31 Oct 2026)" | dropped | history now lives in M1–M3's docs. "Not built yet" lines wait in `milestones/next/`; docs/v2's decisions are DEC-2026-10-29-v2-design; the front page's v1 copy is L21; "don't build to what v2 retired" stays as one line in AGENTS.md › Working rules |  |
| "M4 HOUSE (from 5 Nov 2026)", the interim note | dropped | METHOD.md is in force; M4-house.md is the milestone's doc |  |
| the exocognito/blueprint process links (law, files) | dropped | METHOD.md replaced them (DEC-2026-10-31-method) |  |
| the working rules | AGENTS.md › Working rules | kept. "The owner merges" became the rule Sam approved for M4: the root merges merge-ready pull requests inside an approved milestone, and Sam reviews after the merge |  |
| step-0 facts for the new AGENTS.md: where the Blueprint lives; deploy order; the Worker, its classes and tags; the deploy's vault item, build header and clocks; asking Sam for scoped access; Apple signing and the push key; the Simulator; building the command; one wrangler per test file | AGENTS.md | folded in, as the D1, D2, D6, D7, D8 and C17 rows above say. The stages table comes with M4's dev-stage pull request |  |
| step-0 facts: owners of shared files per milestone; layers and views | dropped | one milestone at a time leaves no shared-file owners, and simplification 5 has no per-layer views |  |
| step-0 facts: how to page Sam; iPhone tests named by id | AGENTS.md › Working rules (paging); METHOD.md › Tests (naming) |  |  |

### `packages/app/README.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| (new) `packages/app/README.md` › Limits: "Off is not atomic with a write (accepted 30 Oct for dogfooding, to fix later)" | L10 "Turning a pager off can let one call through" + I17 note | not in the old Blueprint; I17 said "nothing gets through" without it. I17.2 now says "Once a pager is off", and the limit states the window. Fix named in the README ("one writer per pager"), which is an ENCRYPT hardening item | ⚑ |

### `agent memory (agent-wake-research and others)`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| memory `agent-wake-research` (30 Oct lab and the deployed run) | B33 notes, L11 · Only Claude agents wake by themselves | B33's first note is what was verified. The new limit says Codex, Cursor and pi don't get answers on their own; "When to revisit: CLIENTS" follows the roadmap line "MCLIENTS … settles which agent apps AgentPager supports" | ⚑ |
| memory `agent-wake-research`, untested leads | next/CLIENTS | Text: "Revisit area 2's limits: only Claude agents wake by themselves; a Desktop chat stops waiting after two hours; cloud sessions are untested. Leads from the 30 Oct wake lab, none tried with the command: an MCP task, which woke the Claude Code CLI 7 seconds after the answer with no model turns while waiting (not the Desktop app or VS Code); a hosted signal that tells a Desktop chat its answer is ready while the command still reads the answer itself; and, for Codex, a command that queues a prompt into a thread, seen in another tool's source." |  |
| memory agent-wake-research and report Ph2BtiR64UBSde6fbXW5LT | next/CLIENTS.md What's known | summary of what woke which Claude app, and the untested leads for Codex, pi and OpenCode |  |
| memory pager-must-deliver-unprompted (Sam, 29 Oct: "there is NO point in a pager…") and agent-wake-research (Sam's 30 Oct wake choices) | M3-command.md Sam's answers | Sam's words and choices that exist only in agent memory, not in any repo file. Sam to confirm they may be quoted in the repo | ⚑ |

### `.agents/plans/2026-11-05-m4-house.md`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| — (agent memory: engineering-principles-review, next-roadmap; plan 2026-11-05 "ENCRYPT hardening items") | next/ENCRYPT.md What's known › Five hardening items 1–5 | new, as Sam agreed in the 5 Nov plan; each item says what the code does today (agent.ts answers `request_id`; client.ts sends no version; registry.ts and agent.ts split a pager's state; finish only stops asks; AppModel `pollSeconds` 3 and agent.ts 100 ms wait loop) |  |
| hardening item 3 "one writer per pager" and item 5 "a smaller poll" | next/ENCRYPT.md items 3 and 5 | no record says what either covers; the doc names the candidates from the code and leaves the choice to Plan | ⚑ |
| hardening item 4 "what finish does to open decisions" | next/ENCRYPT.md Still open 3 | new question, with the two options the earlier MENCRYPT sample proposed |  |
| plan: "Leave alone: 'a release never loses data' (amendment 5 waits for ENCRYPT)" | next/ENCRYPT.md What's known | tied to question 1 (assumed: the plan doesn't say which question) |  |

### `GitHub pull requests`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| GitHub PR list (#8, #11–#17, #22–#37) and their bodies | M1–M3 Log lines and test counts | read with `gh`, 5 Nov |  |

### `code with no old line`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| code `commands.ts › connect` (`--server`, 8a64d0e) | B25.11 | new clause: built, and held by `cli.test.ts › review rounds…` ("--server names another server, and the agent keeps it"). No old line held it except C26.2 in passing | ⚑ |
| (none; from the code) | I22.4 | new clause: a recommendation, tradeoffs cell or next step naming a letter that isn't an option, a row with no cell for an option, or a cell with no rating. Built in `card.ts › compile` and listed under R1 in docs/v2/02 §2; held by `cli.test.ts › the binary: …` ("tradeoffs[0] has no cell for B.", "recommendation.option is C but there are two options.") | ⚑ |
| (none; from `start.ts`) an agent finds agentpager.me through its owner's text | B18, first note | new note, true in the code: the pager's text names its server (B25.1), and `start.ts` serves /start there |  |
| (none; from `start.ts`) /start tells the agent to run setup | B18, second note | new note, true in the code: /start ends its install steps with setup (`start.ts`) |  |
| (PR #44, `start.ts`) a server other than agentpager.me says it is dev, at / and /start | B18.5 · @M4: | new line: the dev mark the dev-stage pull request built and tested (`start.test.ts › A server other than agentpager.me says it is dev, at / and /start`), so the Blueprint on main describes dev | ⚑ |

### `new in M4`

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| (none) | DECISIONS.md DEC-2026-11-05-blueprint-destination, first entry | from the M4 plan's "What Sam decided" and M4-house.md › Decided; quotes "OK this looks much better" and "I agree with all of these, thank you". M4-only answers (the dev stage built in M4, the ENCRYPT hardening items, M4's merge approval) stay in M4-house.md |  |
| (none) | README.md | from the sample: legend, milestone table (M1 to M3 ✅, M4 🔨, six ⏳ in order), area table with ids (no D ids; B19, B30, I20 and K1 left out as not built; the integrator added I23 and each area's limit ids), links |  |
| (new) | B17, second note | a note pointing the area's "how soon a new decision shows" at K1 while it waits in FRIENDS. Not a promise |  |
| (none) | B5, second note | new note linking B32, per the areas.md pick "B32 notes it" |  |
| (none): an answer still sending when the app is closed goes again on the next launch | B5.16 · @M3: | root's call: added as a clause, since it is built (7ee31be, 30 Oct, in M3's release), tested (`FlowTests.testAnswerSurvivesRelaunch`; `InboxCache.swift`, `SendCache`) and something the owner can see. No old line held it, so it is a new line for Sam | ⚑ |
| (new) I23 · @M1 · Keys stay secret | I23 | A new invariant id, which Sam starred in A4 ("A new invariant, I23 · Keys and transport"). The brief named only B32 and B33 as new ids; the root confirmed I23. Retitled from "Keys and transport" because HTTPS only isn't built, and widened to the service's own secrets (root's call). Born @M1, as A4 said | ⚑ |
| (new) I23 Why: "Only agents I give a number reach my phone" | I23 Why | A new Why line, quoted exactly from SI2's heading (A7: Sam approves Why lines). The other candidate is DEC-2026-10-08-native-ios, "HTTPS only, keys stored as digests", but that is a record's summary of Sam's write-up, and HTTPS only isn't true yet | ⚑ |
| Limits INSTALL retires | next/INSTALL | Text for INSTALL's Retires: L22 "The command installs only from source", L23 "Moving the command breaks its setup", L24 "The app installs only from Xcode" |  |
| Limits SITE retires | next/SITE | Text for SITE's Retires: L21 "The front page still describes the first version" |  |
| — (new milestone) | next/CLIENTS.md | new: Sam's 5 Nov words, quoted exactly; the wake lab report linked; order after ENCRYPT, anchoring INSTALL and SITE | ⚑ |
| (new id) B32 · @M3 · Wait for the answer, then acknowledge it | B32 (2 Agents) | a new id Sam agreed (DEC-2026-11-05-blueprint-destination) for promises M3 built and no old id held alone: C27.4's how to wait, C6.2's note word for word, D2's long wait, and docs/v2/03's wait, acknowledge and status. The rows above map each clause |  |
| (new id) B33 · @M3 · Each agent app is told how it wakes | B33 (2 Agents) | a new id Sam agreed for D2's per-app wake rules and the 30 Oct wake lab's words (memory `agent-wake-research`, docs/v2/03 §6). The rows above map each clause |  |

## PR 4: the history cleanup

PR 4 deleted `docs/v2/`, the root `workshop/`, `recipe.json` and four superseded plans, after the archive tag `history-archive` (64512bd), and moved the 30 Oct wake lab to `docs/research/`. Four fresh read-only checks, one per group of files, read each file whole against `blueprint/`, AGENTS.md, the package READMEs and the code. These rows home what the rows above missed, and correct three of them.

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| docs/v2/01, Rules and feedback, "Principle: feedback rides on calls the agent already makes and taps the owner already does …" | next/FRIENDS.md What's known | quoted; it bears on FRIENDS' question 2. DEC-2026-10-29-v2-design lists the rejected ideas but not this principle |  |
| docs/v2/01, Multi-user (parked, must be handled): "Rules belong to each owner … in layers …"; Notes: "A correction that recurs becomes a check in the next binary" (also `pages/agent-journey-v2.html`) | next/FRIENDS.md What's known | quoted. The row above for "Goal and Multi-user" homed only the history-file idea |  |
| docs/v2/01, Scope: Claude mobile-only users (the setup script, the number in the repository's AGENTS.md, whether a stdio MCP server from `.mcp.json` runs there) | next/CLIENTS.md What's known | L13 kept only network reach and pausing; the rest joins CLIENTS, untested |  |
| docs/v2/01, App structure: "No install instructions in the app" | B26, second note | the meaning kept: the app gives none, and an agent finds them at /start (B18) |  |
| docs/v2/01, Rejected as ceremony: "a pre-sorted must/nice list" | dropped | DECISIONS.md is append only; B27.3 holds it in effect | ⚑ |
| docs/v2/01, App structure: "Minimal helper text. Keep only lines that clearly help." | dropped | design; the screens record the app's words | ⚑ |
| docs/v2/03 §5, what history is for | dropped | context, not a promise; B31 holds what it does | ⚑ |
| docs/v2/03 §6, "The chat also has a cloud shell where the binary isn't installed, so the words name the tool" | docs/research/2026-10-30-agent-wake-lab.md, Findings | the reason behind B33.3's words; `wait.test.ts` checks the words, not the reason |  |
| docs/v2/03, the files citing it: `commands.ts`, `detect.ts`, `main.ts`, `mcp.ts`, `wait.test.ts`, `packages/app/src/start.ts`, `packages/cli/README.md` | B25, B27, B32, B33, B18 and the research doc | re-pointed in PR 4. The rows above had no row for them |  |
| docs/v2/04 §1 "not the Secure Enclave, which can't hold this kind of key"; §4 "a leaked agent key exposes the answers sent to it", "45 bytes plus base64, so a 1 MB image stays under the server's limit"; §5 the acknowledgement's encrypted preview | next/ENCRYPT.md What's known › The design; its B17 clause names B17.5 | the rows above sent these to ENCRYPT, but ENCRYPT.md didn't hold them |  |
| docs/v2/04, row 78 and "the file": "next/ENCRYPT.md names it" | next/ENCRYPT.md What's known › The design | now says how to read it: `git show history-archive:docs/v2/04-encryption.md` |  |
| docs/v2/04, code comments citing §2: `worker.ts`, `test/support.ts` | I19 | re-pointed. `Keychain.swift` and `packages/contract/exchange.ts` are drawn from by `pnpm designs`, so they wait for the follow-up ([M4-house.md](../M4-house.md#left-for-the-follow-up-pr)) |  |
| docs/v2/05, "worth a per-number cap on open agents" | next/ENCRYPT.md From the design | beside the connect rate limit; a rate isn't a cap |  |
| docs/v2/06, "the file": "`MarketingScreen.tsx` cites it" | the root README; the follow-up | the root README cited it too, and its recipe paragraph is gone. `MarketingScreen.tsx` waits for the follow-up |  |
| docs/v2/01, the files citing it: `worker.ts`'s retired-MCP comment | B18.4 | re-pointed. `AppModel.swift` and `exchange.ts` wait for the follow-up |  |
| docs/v2/02, the files citing it: `rules.ts`, `card.ts`, `packages/cli/README.md` | B27 (and I22 for `card.ts`) | re-pointed |  |
| docs/v2/card-example.yaml | deleted, not moved | `rules.ts` `EXAMPLE` holds it line for line, with its detail quoted, and `cli.test.ts` imports that. The comment in `rules.ts` is re-pointed; `Previews.swift` waits for the follow-up |  |
| docs/v2/regression | `packages/cli/test/regression/` | moved, as the row above said, since `scripts/regression-cards.mjs` and the command's README use it. Its README now states the expected grades itself, instead of citing 02 §4 and §5 |  |
| docs/v2/mocks, docs/v2/pages | deleted | superseded by `generated/screens/`. `Previews.swift`'s mention of the mocks waits for the follow-up |  |
| recipe.json | deleted | nothing reads it: no code, test, script or package.json names it. The root README and `packages/app/README.md` no longer cite it; AGENTS.md still names it among what v2 retired |  |
| the root `workshop/`; plans `2026-10-30-design-catalogue.md`, `2026-10-31-method.md`, `2026-10-31-method-sample/`, `2026-10-31-next-roadmap-orchestration.md` | deleted | checked again: nothing in them is still true without a home |  |
| `.agents/plans/2026-10-31-root-handoff.md` | `.agents/plans/2026-11-05-root-handoff.md` | the row above said PR 4 deletes it. It was kept until M4's wrap-up (PR #51), which deletes it and writes the new handoff, without its links to the deleted plans |  |
| memory `agent-wake-research` and the report Ph2BtiR64UBSde6fbXW5LT | docs/research/2026-10-30-agent-wake-lab.md | the lasting record of what wakes which app and how it was tested; B33's note and CLIENTS cite it |  |
| DECISIONS.md's citations of `docs/v2/` | kept as written | DECISIONS.md is append only, and "which git keeps" stays true: the tag is `history-archive` |  |

## PR 5b: the dev marks and HTTPS only

PR 5b (#49) built the two "dev" marks M4's plan gave PR 5 that need the screens made again: the front page and the phone. Both count a server as dev when its address starts with `dev.`, so the catalogue, drawn from a local server, shows neither. Sam then answered M4's question 2, "Yes fix plain http", so it also builds HTTPS only and retires L20.

| Old | New | Change | ⚑ |
| --- | --- | --- | --- |
| (none; M4's plan, PR 5): a "dev" mark on the site | B18.6 · @M4: (7 Getting started) | new line: the front page on dev.agentpager.me says it is a dev server, and agentpager.me's doesn't (`MarketingScreen.test.ts › B18.6`), so the Blueprint on main describes dev | ⚑ |
| (none; M4's plan, PR 5, and M4's slice, Phone): a "dev" mark on the phone | B23.11 · @M4: (1 Pagers) | new line: a pager made on dev.agentpager.me is marked dev on its row in Pagers and on its own screen, and one made on agentpager.me isn't (`DesignTests.test_B23_11_aPagerMadeOnADevServerShowsTheDevMark`) | ⚑ |
| L20 · @M1 · The service still answers plain HTTP (6 Privacy), from row 37 | retired; I23.4 holds what fixes it | deleted from 6 Privacy and quoted under M4's Retires. The id L20 is never reused. next/ENCRYPT no longer waits for it |  |
| row 37's text when built: "The service answers only over HTTPS: a plain HTTP request is sent to HTTPS, and every response tells browsers to keep to HTTPS." | I23.4 · @M4: (6 Privacy) | new clause: GET and HEAD over plain HTTP move to the same address on HTTPS (308), any other method is refused unread (403), and every HTTPS reply carries Strict-Transport-Security for a year, without subdomains. A local server keeps plain HTTP (a note). Held by `https.test.ts › I23.4` and the smoke run's step on dev | ⚑ |
