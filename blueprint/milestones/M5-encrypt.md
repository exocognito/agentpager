# M5 · Decisions the service can't read

> **Status:** released, without its walk on dev, at Sam's word; Sam dogfoods it on prod at [M6 · TIDY](M6-tidy.md) · **Started:** 6 Nov 2026 · **On dev:** 6 Nov 2026, at 6df2016 · **Released:** 7 Nov 2026 · **Tag:** `m5`, on 464d559 · **Order:** after M4; [M6 · TIDY](M6-tidy.md) follows · **Word:** ENCRYPT

## Objective

The guarantee Sam approved in the old strategy on 30 Oct, waiting here until it is true, with the scope Sam chose on 6 Nov (question 2):
- The owner's decisions, their attachments, the owner's answers and the agents' acknowledgements are encrypted between the agent's machine and the phone. The service carries only what it can't read, and the little it needs to route it: which pager, which agent, when and how big.
- The agentpager command checks the pager's key against its number before it encrypts anything to it, so the service can't swap the key.
- Alerts still show the owner the real question.
- Every earlier promise still passes.
- Two hardening items that change the same wire contract come with it: an ask carries a request id, so a lost reply asked again makes one decision, not two; and the command says which version it is, so the service can tell an old one to update.

## Owner decides first

### Answered on 6 Nov

Sam chose the recommended option of each of five numbered questions the previous root asked in its Claude Code session on 6 Nov 2026, answering: "Agree with all your recs, though for starting M5 I would like you to give to a herdr pane with fresh Opus 5.5 xhigh thinking bypass perms, and ask them to orchestrate subagents to see it through to green on dev and I'll test there". The choices:

1. **M4's files.** The commit before the removal is tagged `m4-house-ledger`, M4's ledger is deleted from the tree, and [M4-house.md](M4-house.md) stays as M4's record, like M1 to M3. Sam's line test and look rule, which lived only there, move first to [METHOD.md › Writing lines](../../METHOD.md#writing-lines), with DEC-2026-11-06-line-test. Done in this milestone's first pull request.
2. **Scope** (also the ledger's ⚑82). ENCRYPT keeps encryption and the two small hardening items, the ask request id and the client-version header: both change the wire contract the switch changes anyway, and the header is how question 4's refusal works from now on. The other three items become their own milestone, right after ENCRYPT and before CLIENTS: [TIDY](M6-tidy.md), with DEC-2026-11-06-store-after-encrypt and, for its word, question 7.
3. **Decisions stored before the switch** are deleted at the switch. This is the release's exception to METHOD's rule that a release never loses data (below). The history on each agent's machine keeps its own copies (B31).
4. **Clients from before the switch.** An agentpager command from before the switch is refused, and told how to update. An agent connected before the switch connects again, which gives it its key pair: agent keys are made at connect.
5. **What finish does to open decisions:** they close and can't be answered. This goes to TIDY, with the agent's lifecycle, not to M5.

Sam answered questions 6 to 9 on Sam's pager on 6 Nov 2026, between 14:37 and 14:39, by choosing an option on each card. The choices:

6. **The lines** (below, trimmed by the line test): approved as written. Each reaches its area file with the code that makes it true: B25.14 and B27.9 with the hardening pull request (#59); B30, I20, I19.6, I19.7, B17.11 and I4.9, and the changes to I4.1, I4.7, I22 and TERMS › Keys, with the encryption switch, which retires L17 and L19.
7. **The word for the milestone after ENCRYPT:** TIDY · Tidy state, chosen over the proposed STORE: one store per pager, lighter polls and the agent's lifecycle. Its doc is now [M6-tidy.md](M6-tidy.md), with DEC-2026-11-06-tidy.
8. **The iPhone app from before the switch** can't be told plainly to update. On a refusal it shows only its general line that it can't reach the server, and keeps showing its last read; only a refusal that says the pager is gone drops a pager. Accepted for this release, as part of the release's exception (below): Sam's own phones are the only ones, and each gets the new app right after the service.
9. **A limit on how fast a number can connect agents,** which the 29 Oct design assumed and nothing enforces today: left out of M5, and written down as L25 in [1 Pagers](../areas/1-pagers.md), to revisit at FRIENDS.

## The release's exception (METHOD › Stages and releases)

Sam's answers to questions 3, 4 and 8, as METHOD now allows:
- **What is lost:** every agent, decision, attachment, answer and acknowledgement the service stored before the switch, on dev now and on prod at the release. They were stored readable.
- **What still opens:** every pager, with its key pair, number, switch and auto-off. The history on each agent's machine keeps that machine's decisions.
- **What stops working:** a command from before the switch is refused and told how to update; an agent connected before the switch connects again; the app from before the switch can't read its pagers until it is updated, and isn't told plainly to update: it shows only that it can't reach the server (question 8).
- **What the upgrade check proves instead,** on dev against the baseline recorded from `m4`: the baseline's pager still exists with its key and number, its decisions are gone, a command from `m4` is refused with how to update, and a new command connects with the baseline's number.

## Slice

| Layer | What M5 delivers there |
| --- | --- |
| Blueprint | this doc; METHOD's line test, look rule and release exception; the approved lines in their areas with the code that makes them true; L17 and L19 retired; L25 written down; TIDY queued |
| Service | holds only encrypted parts and what it needs to route them; gives anyone the pager's public key; refuses a command from before the switch with how to update; takes an ask's request id, so asking again stores one decision; deletes the agents and decisions stored before the switch and keeps every pager |
| Command | checks the pager's key against the number before connecting; makes the agent's key pair at connect; encrypts each card, its attachments, who asked and each acknowledgement to the pager, and reads its answers; says its version on every call |
| Phone app | reads the encrypted decisions, attachments, who asked and acknowledgements, and encrypts each answer to its agent; each pager's keys stay where they are, and the alert extension can read them, so every pager is kept |
| Alert extension | new on the phone: decrypts each alert to show its real words, such as the question, and shows the plain alert when it can't |
| Tests | test vectors for the format, which the TypeScript and Swift sides both pass; tests named by the ids M5 adds and touches |
| Dev stage | the upgrade baseline recorded from `m4` before M5's code reaches dev; the upgrade check in `pnpm smoke:dev` |

The pull requests, in order, are in [.agents/plans/2026-11-06-m5-encrypt.md](../../.agents/plans/2026-11-06-m5-encrypt.md).

## Out of scope

- One store per pager, the smaller polls and the agent's lifecycle, with what finish does to open decisions: [TIDY](M6-tidy.md).
- Hiding which pager and which agent, when, and how big each part is.
- Moving a pager's keys to a new phone, or recovering them (L9).
- Protecting a phone or an agent's machine that someone else controls.

## What's known

- **Built since M2:** the phone makes each pager's key pair, which is already X25519, and the pager's number carries a fingerprint of its public key, which the service checks when the pager is made and at every connect (I19). Until M5 the command didn't check the key itself (I19.6).
- **The design,** agreed on 29 Oct. The full draft, with the byte layouts, payload sizes and routes this short form leaves out, is `docs/v2/04-encryption.md`, which M4 removed from the tree: read it with `git show history-archive:docs/v2/04-encryption.md`.
  - Keys: a key pair per pager, made on the phone and kept in the Keychain where the app and its alert extension can both read it (not the Secure Enclave, which can't hold this kind of key); a key pair per agent, made at connect and kept in the agent's file. As built, the service holds the pager's public key and the digests of the phone and agent keys, and never an agent's public key: that travels only inside who asked and each card, both encrypted to the pager. The 29 Oct draft had the command give it to the service at connect; the root chose otherwise on #61, so the service can't seal an answer the agent would open.
  - Encrypted to the pager's key: each card, each attachment, who asked with the project and the computer, and each acknowledgement. Encrypted to the agent's key: the answer. The service keeps only ids, timestamps, sizes, how many attachments, whether each pager is on and when it turns off, and the phone's device token.
  - One format for every encrypted part, in both directions: X25519 with a fresh key for each part, HKDF-SHA256 and AES-256-GCM, which CryptoKit and Node's crypto both have. Each part is bound to its kind, its pager and its decision, so it can't be replayed as another kind or moved to another decision. A leaked agent key exposes only the answers sent to that agent.
  - Before it encrypts anything, the command fetches the pager's public key from the service and checks it against the number.
  - An alert carries a small encrypted preview, which a notification service extension on the phone decrypts with the pager's key to show the question; when it can't, the alert is plain. An acknowledgement's alert works the same way, and so does the warning that no agent picked up an answer.
  - Sam's answers on 29 Oct: the fingerprint stays 8 bytes, so the number keeps its length, and attachment names are encrypted.
- **The two hardening items,** from the 30 Oct engineering review:
  - An ask request id. The phone's answer already has one, so sending it twice stores it once. An ask has none: if its reply is lost and the agent asks again, the owner gets a second decision.
  - A client-version header. The command doesn't say which version it is, so the service can't tell an old one to update, as METHOD's release rule needs. Replies already name the service's build.
- **What encryption doesn't hide,** for the site's note on what the service stores (SITE): who pages whom, when, how much and how often; and, to Apple, that an alert happened and its size. A compromised agent machine exposes that agent's cards, the answers to it and its history. A compromised phone exposes everything on it.
  - The service can show decisions of its own only as an agent the phone hasn't yet read, such as a new one, and read the answers to those. It can't show them in place of an agent the phone has read, since the phone keeps the key each agent first names (B30.3). It can't read real agents' decisions, attachments or acknowledgements, or the answers to them.
  - An alert can still show the service's own words, naming any agent: an alert's preview carries no key, so the alert extension can't check it against the agent's. The decision the alert opens is held to B30.3.
- **Apple signing.** The alert extension is a new target with its own bundle id, so the development profile changes, and only Sam can do that step. Sam's Xcode session on pro registered the extension on 6 Nov, after its time-sensitive entitlement was removed, since Apple allows that only on apps; a device build now signs the extension with the team profile. The service and command didn't wait for it.
- INSTALL comes after ENCRYPT, so at the switch the command is still built from the repository, and only Sam's machines run it.

## Approved lines

Sam approved these as written (question 6). Each reaches its area file with the code that makes it true, and its tests name its id. What is one-time, such as deleting what was stored before the switch and connecting again, is this release's exception (above), proven by the upgrade check, not a line.

**B30 · @M5 · Decisions are encrypted end to end** (6 Privacy)
1. Each decision, its attachments, who asked with the project and the computer, the owner's answer and the agent's acknowledgement are encrypted on the agent's machine or the phone, and only the other end can read them.
2. The service can't move an encrypted part to another pager or decision, or pass it off as another kind: the end that reads it refuses it.

**I20 · @M5 · The service holds nothing readable** (6 Privacy)
Why: [Only agents I give a number reach my phone](../PRODUCT.md#only-agents-i-give-a-number-reach-my-phone) · [Pinned design decisions](../PRODUCT.md#pinned-design-decisions)
1. The service never stores, logs or sends to Apple a readable decision, attachment, answer, acknowledgement, or who asked with the project and the computer. It keeps only what it needs to route them: which pager and agent, when, and how big.

**I19, two clauses added** (6 Privacy), with its Why and notes saying the check is now built
6. @M5: Before it encrypts anything to a pager, the command checks the pager's key against the number's fingerprint, so a service that swaps the key is caught on the agent's machine.
7. @M5: When that check fails, nothing is sent, and the agent is told that the number's key doesn't match the service's, to check the number, and, if it is right, to stop and tell its owner.

**B17, a clause added** (4 Getting paged). B17.2, B17.5 and B17.8 still say what each alert shows; they hold unchanged.
11. @M5: No alert's words reach Apple's push service as text. When the phone can't read an alert, it still arrives, saying only that there is a new decision, an acknowledgement or an answer not picked up.

**B25, a clause added** (2 Agents)
14. @M5: A command too old for the service is refused on every call, stores nothing, and is told plainly how to update.

**B27, a clause added** (3 Cards)
9. @M5: When an ask's reply is lost and the agent asks again, the owner gets one decision, not two.

**I4 and I22, changed** (3 Cards): the service can no longer read a card, so it can't refuse one for its text.
- I4.1 narrows to what the service can still read: ids, sizes, counts and its own fields. I4.7 narrows to: the service stores exactly what it accepts.
- 9. @M5: Text the service can't read is checked by the command before it leaves the agent's machine (I22), and by the phone when it reads it. A decision that fails the phone's check shows as one it can't read, never in part.
- I22's notes: an agent that calls the service directly skips the command's checks, and then only the phone's check stands between it and the owner.

**TERMS › Keys, changed:** each agent also has a key pair, made at connect, whose private key stays in the agent's file.

**Retires,** once built: L19, the service can read every decision (6 Privacy); L17, alerts pass through Apple as plain text (4 Getting paged).

**Dropped from the old draft by the line test:**
- B30's clauses on which part is encrypted to which key, and on giving the service the agent's public key at connect: mechanism the code shows. What's known keeps the first as the design; the second wasn't built, since the agent's public key never reaches the service.
- B17's clauses on the alert extension, and on who asked and the project coming from the phone: mechanism. B17.2, B17.5 and B17.8 still promise what the owner sees.
- J5's step that the alert travels encrypted and an extension decrypts it: J5.3 already walks what the owner sees, and I20 holds the guarantee.
- A number of an unknown version refused with a reply that says so: no other version exists yet, so there is nothing to choose.

## Walk on dev

Not walked: Sam released M5 without it on 7 Nov, and dogfoods it on prod instead (Log).

On HomePhoneLite, which runs `main`'s app with dev as its server, and with the walk command on pro, `~/.agentpager-dev/agentpager`: the command built from `main`, with its own `AGENTPAGER_HOME`. It always talks to dev and never touches `~/.agentpager`, which Sam's real agents use on prod.

1. Open AgentPager on the dev phone. The dev pagers are there with their names and numbers, and their decisions from before the switch are gone (the release's exception, above).
2. Give an agent the walk command, used in place of `agentpager`, and a dev pager's number from its Pager detail. It connects.
3. Close the app, and have the agent ask a card with an attached page. The alert names who asked and the project, with the question; expanded, it shows the detail and the recommended option. With a Focus on that allows AgentPager's time-sensitive alerts, it still comes through (B17.3).
4. Open the alert, read the brief and its page, and answer. The agent's wait gets the answer, and its acknowledgement arrives as an alert with its next steps.
5. Leave an answer uncollected for 3 minutes: one alert names who asked, its computer, its project and the question.
6. Run the `m4` command installed on Sam's machines with a throwaway `AGENTPAGER_HOME` and `--server https://dev.agentpager.me`. It is refused and told how to update.
7. Read this doc, [6 Privacy](../areas/6-privacy.md) (B30, I20, I19.6–7), [4 Getting paged](../areas/4-getting-paged.md) (B17.11) and [generated/untested.md](../generated/untested.md).

## Answered on 7 Nov, before the walk

Five questions found while building, for the walk. Sam answered them in the root's Claude Code session on 7 Nov 2026, after the root showed a page of the system's encryption and each question's options, answering: "1B 2B 3A 4a 5a". On 1 and 2 Sam chose the option the root didn't recommend. The choices:

1. **A service that replaces an agent's who-asked** could show its own decisions in that agent's place and read the answers to those. Sam chose that the phone pins each agent's first-seen key and shows later changes as unreadable, over accepting it. This adds B30.3, below, built in #67.
2. **Answers after a reinstall:** the pagers stayed in the Keychain but the phone's record of its own answers didn't, so every answered decision showed as one the phone can't read. Sam chose to keep each answer's record in the Keychain with its pager, over accepting it as a limit. This adds B7.4, below, built in #67.
3. **The client check came before the key check,** so a client too old for the service that also had a wrong key was told to update, not refused as unauthorized, against [I4.6](../areas/3-cards.md#i4--m1--what-doesnt-fit-is-refused-whole-never-cut). Sam chose to narrow I4.6: a client too old for the service is told to update before its key is checked.
4. **A term for what is encrypted:** [B30.2](../areas/6-privacy.md#b30--m5--decisions-are-encrypted-end-to-end) used the words encrypted part, which had no entry in [TERMS.md](../TERMS.md). Sam chose to add Encrypted part to TERMS.
5. **I5's note on decisions stored before 31 Oct 2026** described code the switch removed, for decisions that are gone. Sam chose to delete it from [I5](../areas/5-answering.md#i5--m1--answers-never-change).

Questions 1 and 2 add these lines, worded by the root from the options Sam chose, for Sam's review after the merge. Both are in their areas, with #67, the phone pull request that makes them true, and their tests name their ids.

**B30, a clause added** (6 Privacy)
3. @M5: The phone keeps the key each agent first names. When that agent's who-asked later names another key, the phone shows the agent and its decisions as ones it can't read, with nothing to answer.

**B7, a clause added** (5 Answering)
4. @M5: An answered decision still shows the owner's answer after the app is deleted and installed again, as long as its pager is still on the phone.

## Adds · Changes · Retires

- **Adds:** B30 and I20, whole; I19.6 and I19.7; B17.11; B25.14; B27.9; I4.9; each as Sam approved it (question 6). L25, a leaked number can connect any number of agents (1 Pagers), as Sam chose (question 9). The alert extension on the phone. The upgrade baseline from `m4` and the upgrade check on dev. B30.3 and B7.4, built in #67, from Sam's answers to questions 1 and 2 of 7 Nov. TERMS › Encrypted part (question 4 of 7 Nov).
- **Changes:** I4.1, I4.7 and I22's notes, since the service can't read a card; I4.6, narrowed so that a client too old for the service is told to update before its key is checked (question 3 of 7 Nov); I5's notes, which lose the one on decisions stored before 31 Oct 2026 (question 5 of 7 Nov); I19's Why and notes, since the command's check is built; TERMS › Keys; METHOD.md › Writing lines, which takes Sam's line test and look rule, and › Stages and releases, which allows an exception the owner approves; L10, whose fix and revisit move to TIDY.
- **Retires:** L19, the service can read every decision (6 Privacy), which B30 and I20 fix, and L17, alerts pass through Apple as plain text (4 Getting paged), which B17.11 fixes. Their ids are never reused. M4's ledger leaves the tree, at tag `m4-house-ledger`.

## Log

- 31 Oct · queued, unchanged in scope, in the next roadmap.
- 5 Nov · Sam set it first after M4, one milestone at a time. Its hardening items were added here.
- 6 Nov · planning: Sam answered questions 1 to 5. PR #57 starts this doc, moves the line test and look rule into METHOD, adds METHOD's release exception, deletes M4's ledger after the tag `m4-house-ledger`, and queues STORE. Questions 6 to 9 wait for Sam. `pnpm check` green, `pnpm test:all` 78 passed (32, 3, 8, 25 and 10).
- 6 Nov · building: PR #58 adds `pnpm baseline:dev`, which records an upgrade baseline, and records `m4`'s on dev before any M5 code reached it: a pager with no alert target, an agent connected by the binary built at `m4`, one decision answered and acknowledged and one left open. `pnpm check` green, `pnpm test:all` 78 passed (32, 3, 8, 25 and 10).
- 6 Nov · Sam answered questions 6 to 9 on the pager: the lines approved as written, the next milestone's word TIDY, the old app's missing update message accepted as part of the exception, and the connect limit written down. PR #60 records them: STORE renamed TIDY, with DEC-2026-11-06-tidy; L25 added to 1 Pagers. `pnpm check` green, `pnpm test:all` 78 passed (32, 3, 8, 25 and 10).
- 6 Nov · building: PR #59, the hardening. Every call names its client and version, and a command too old for the service is refused before anything is read and told how to update (B25.14). An ask carries a request id the command chooses, from which the decision's id is made, so asking again makes one decision (B27.9). `pnpm check` green, `pnpm test:all` 87 passed (37, 3, 8, 28 and 11), FlowTests 7 of 7 in the Simulator. Grok and Codex MERGEABLE in round 4.
- 6 Nov · building: PR #61, the encrypted-part format, in TypeScript and in a Swift package, with each kind's plaintext shape, pinned by shared test vectors both sides pass; nothing used it yet. The root chose that the agent's public key travels only inside cards, never to the service, so only the phone can seal an answer the agent opens, and that the switch holds a Markdown page to 1,000,000 bytes. `pnpm check` green, `pnpm test:all` 587 passed (526, 3, 8, Swift 11, 28 and 11). Grok and Codex MERGEABLE in round 4.
- 6 Nov · building: PR #62, the alert extension. Each pager's keys stay where they were, and the extension can read them there, so no pager moved. It opens an alert's encrypted preview with its pager's key and shows its words, and shows the alert as sent when it can't. Sam's Xcode session on pro registered it, after its time-sensitive entitlement came off, since Apple allows that only on apps. A Simulator push never starts the extension, so its code is tested inside the app. `pnpm check` green, `pnpm test:all` 620 passed (555, 3, 8, Swift 15, 28 and 11), AgentPagerTests 11 of 11 in the Simulator. Grok and Codex MERGEABLE in round 2.
- 6 Nov · building: PR #63, the switch. The service holds only encrypted parts and what it needs to route them. The command checks the pager's key against its number before it encrypts anything, and makes the agent's key pair at connect. The phone opens what it reads, encrypts each answer to its agent, and shows a decision it can't read as one, with nothing to answer. Alerts carry plain words and the encrypted preview. At its first start the service deletes the agents and decisions stored before the switch, and keeps every pager. The approved lines are in their areas, and L17 and L19 are retired. The upgrade check joins `pnpm smoke:dev`; it passed locally against an `m4` baseline. `pnpm check` green (152 clauses, 23 tested), `pnpm test:all` 629 passed (556, 3, 8, Swift 17, 32 and 13), FlowTests 9 of 9 and AgentPagerTests 14 of 14 in the Simulator. Grok and Codex MERGEABLE in round 4.
- 6 Nov · built and on dev, awaiting Sam's walk: after each code merge the root deployed `main` to dev and ran `pnpm smoke:dev`, which passed 8 of 8 at 4e8dbf5, 5061308 and 1ee603d, and 14 of 14 at 6df2016, the switch. Its upgrade check against the `m4` baseline found the pager kept with its key and number, everything stored before the switch gone, the `m4` command refused and told how to update, an `m4` agent's file told to connect again, and the new command connecting to the baseline's number. Dev runs 6df2016, and prod still runs `m4`. HomePhoneLite's app from `main` (`pnpm phone:dev`) is pending. PR #64 marks M5 built, asks Sam's five questions for the walk, and points SITE's note at What encryption doesn't hide.
- 6 Nov · ready for Sam's walk: HomePhoneLite runs `main`'s app at 6e9717a, with dev as its server and the alert extension; dev runs 6e9717a, and `pnpm smoke:dev` passed 14 of 14 there. This pull request adds Walk on dev, above.
- 7 Nov · Sam answered the walk's five questions in the root's Claude Code session, choosing (b) on 1 and 2 and the recommended (a) on 3 to 5. PR #66 records them: the phone pins each agent's first-seen key (B30.3) and keeps each answer's record in the Keychain with its pager (B7.4), both waiting here for the phone pull request that makes them true; I4.6 narrowed, so a client too old for the service is told to update before its key is checked; TERMS adds Encrypted part; I5's note on decisions stored before 31 Oct 2026 deleted. `pnpm check` green, `pnpm test:all` 629 passed (556, 3, 8, Swift 17, 32 and 13).
- 7 Nov · building: PR #67, the two phone changes from Sam's answers of 7 Nov. The phone keeps the key each agent first names, by pager and agent, from the first of its who-asked parts that opens, and shows an agent whose who-asked later names another key as one it can't read, with nothing to answer (B30.3). Its record of each answer it sent is in the Keychain with its pager, so it outlives the app being deleted and installed again and goes with the pager; what `answers.json` held moves in at the first launch (B7.4). In the Simulator, an answer given in `main`'s app showed after this build was installed over it, and again after `xcrun simctl uninstall` and a fresh install, with the pager and its pin. `pnpm check` green (154 clauses, 25 tested), `pnpm test:all` 629 passed (556, 3, 8, Swift 17, 32 and 13), AgentPagerTests 23 of 23 and FlowTests 9 of 9 in the Simulator.
- 7 Nov · released: Sam typed in the root's Claude Code session on 7 Nov: "Deploy to prod and continue forward to complete tidy and I'll dogfood production when I'm ready. We still have no users so it's ok if we discover things I disagree with in prod and fix then. I'll dogfood at Tidy." So the walk on dev was skipped, at Sam's word. The root tagged `m5` on 464d559 and ran `pnpm deploy:prod` from a clean worktree at the tag, which verified 464d559 at agentpager.me; `pnpm smoke:prod` passed 9 of 9, 0 failed. With it, the release's exception (above) reached prod. The binary built at the tag (`agentpager 464d559`) is on pro, mini and air. Sam's iPhone Air has the app built from the tag, with agentpager.me as its server and the alert extension, installed over the old app. The root's agent connected again to Sam's real pager on prod with the new binary, which fetched the pager's key and found it matched the number. The `m5` upgrade baseline is recorded on dev and read back; its agent is forgotten if idle after 8 Dec 2026, so M6's upgrade check runs before then.
