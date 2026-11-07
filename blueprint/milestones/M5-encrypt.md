# M5 · Decisions the service can't read

> **Status:** planning · **Started:** 6 Nov 2026 · **Order:** after M4; [TIDY](next/TIDY.md) follows · **Word:** ENCRYPT

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
2. **Scope** (also the ledger's ⚑82). ENCRYPT keeps encryption and the two small hardening items, the ask request id and the client-version header: both change the wire contract the switch changes anyway, and the header is how question 4's refusal works from now on. The other three items become their own milestone, right after ENCRYPT and before CLIENTS: [TIDY](next/TIDY.md), with DEC-2026-11-06-store-after-encrypt and, for its word, question 7.
3. **Decisions stored before the switch** are deleted at the switch. This is the release's exception to METHOD's rule that a release never loses data (below). The history on each agent's machine keeps its own copies (B31).
4. **Clients from before the switch.** An agentpager command from before the switch is refused, and told how to update. An agent connected before the switch connects again, which gives it its key pair: agent keys are made at connect.
5. **What finish does to open decisions:** they close and can't be answered. This goes to TIDY, with the agent's lifecycle, not to M5.

Sam answered questions 6 to 9 on Sam's pager on 6 Nov 2026, between 14:37 and 14:39, by choosing an option on each card. The choices:

6. **The lines** (below, trimmed by the line test): approved as written. Each reaches its area file with the code that makes it true: B25.14 and B27.9 with the hardening pull request (#59); B30, I20, I19.6, I19.7, B17.11 and I4.9, and the changes to I4.1, I4.7, I22 and TERMS › Keys, with the encryption switch, which retires L17 and L19.
7. **The word for the milestone after ENCRYPT:** TIDY · Tidy state, chosen over the proposed STORE: one store per pager, lighter polls and the agent's lifecycle. Its doc is [next/TIDY.md](next/TIDY.md), with DEC-2026-11-06-tidy.
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
| Phone app | reads the encrypted decisions, attachments, who asked and acknowledgements, and encrypts each answer to its agent; moves each pager's keys where the alert extension can read them, keeping every pager |
| Alert extension | new on the phone: decrypts each alert to show the real question, and shows a plain alert when it can't |
| Tests | test vectors for the format, which the TypeScript and Swift sides both pass; tests named by the ids M5 adds and touches |
| Dev stage | the upgrade baseline recorded from `m4` before M5's code reaches dev; the upgrade check in `pnpm smoke:dev` |

The pull requests, in order, are in [.agents/plans/2026-11-06-m5-encrypt.md](../../.agents/plans/2026-11-06-m5-encrypt.md).

## Out of scope

- One store per pager, the smaller polls and the agent's lifecycle, with what finish does to open decisions: [TIDY](next/TIDY.md).
- Hiding which pager and which agent, when, and how big each part is.
- Moving a pager's keys to a new phone, or recovering them (L9).
- Protecting a phone or an agent's machine that someone else controls.

## What's known

- **Built since M2:** the phone makes each pager's key pair, which is already X25519, and the pager's number carries a fingerprint of its public key, which the service checks when the pager is made and at every connect (I19). The command doesn't check the key itself yet.
- **The design,** agreed on 29 Oct. The full draft, with the byte layouts, payload sizes and routes this short form leaves out, is `docs/v2/04-encryption.md`, which M4 removed from the tree: read it with `git show history-archive:docs/v2/04-encryption.md`.
  - Keys: a key pair per pager, made on the phone and kept in the Keychain where the app and its alert extension can both read it (not the Secure Enclave, which can't hold this kind of key); a key pair per agent, made at connect and kept in the agent's file. The service holds only public keys and the digests of the phone and agent keys.
  - Encrypted to the pager's key: each card, each attachment, who asked with the project and the computer, and each acknowledgement. Encrypted to the agent's key: the answer. The service keeps only ids, timestamps, sizes, how many attachments, whether each pager is on and when it turns off, and the phone's device token.
  - One format for every encrypted part, in both directions: X25519 with a fresh key for each part, HKDF-SHA256 and AES-256-GCM, which CryptoKit and Node's crypto both have. Each part is bound to its kind, its pager and its decision, so it can't be replayed as another kind or moved to another decision. A leaked agent key exposes only the answers sent to that agent.
  - Before it encrypts anything, the command fetches the pager's public key from the service and checks it against the number.
  - An alert carries a small encrypted preview, which a notification service extension on the phone decrypts with the pager's key to show the question; when it can't, the alert is plain. An acknowledgement's alert works the same way, and so does the warning that no agent picked up an answer.
  - Sam's answers on 29 Oct: the fingerprint stays 8 bytes, so the number keeps its length, and attachment names are encrypted.
- **The two hardening items,** from the 30 Oct engineering review:
  - An ask request id. The phone's answer already has one, so sending it twice stores it once. An ask has none: if its reply is lost and the agent asks again, the owner gets a second decision.
  - A client-version header. The command doesn't say which version it is, so the service can't tell an old one to update, as METHOD's release rule needs. Replies already name the service's build.
- **What encryption doesn't hide,** for the site's note on what the service stores (SITE): who pages whom, when, how much and how often; and, to Apple, that an alert happened and its size. A compromised agent machine exposes that agent's cards, the answers to it and its history. A compromised phone exposes everything on it.
  - The service can show decisions of its own, as a new agent or in place of an existing agent's who-asked, and read the answers to those; it can't read real agents' decisions, attachments or acknowledgements, or the answers to them.
- **Apple signing.** The alert extension is a new target with its own bundle id, so the development profile changes. Only Sam can do that step: one build in Xcode on pro, with automatic signing. The service and command don't wait for it; the dev phone's build does.
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
- B30's clauses on which part is encrypted to which key, and on giving the service the agent's public key at connect: mechanism the code shows. What's known keeps them as the design.
- B17's clauses on the alert extension, and on who asked and the project coming from the phone: mechanism. B17.2, B17.5 and B17.8 still promise what the owner sees.
- J5's step that the alert travels encrypted and an extension decrypts it: J5.3 already walks what the owner sees, and I20 holds the guarantee.
- A number of an unknown version refused with a reply that says so: no other version exists yet, so there is nothing to choose.

## Adds · Changes · Retires

- **Adds:** B30 and I20, whole; I19.6 and I19.7; B17.11; B25.14; B27.9; I4.9; each as Sam approved it (question 6). L25, a leaked number can connect any number of agents (1 Pagers), as Sam chose (question 9). The alert extension on the phone. The upgrade baseline from `m4` and the upgrade check on dev.
- **Changes:** I4.1, I4.7 and I22's notes, since the service can't read a card; I19's Why and notes, since the command's check is built; TERMS › Keys; METHOD.md › Writing lines, which takes Sam's line test and look rule, and › Stages and releases, which allows an exception the owner approves; L10, whose fix and revisit move to TIDY.
- **Retires:** L19, the service can read every decision (6 Privacy), which B30 and I20 fix, and L17, alerts pass through Apple as plain text (4 Getting paged), which B17.11 fixes. Their ids are never reused. M4's ledger leaves the tree, at tag `m4-house-ledger`.

## Log

- 31 Oct · queued, unchanged in scope, in the next roadmap.
- 5 Nov · Sam set it first after M4, one milestone at a time. Its hardening items were added here.
- 6 Nov · planning: Sam answered questions 1 to 5. The first pull request starts this doc, moves the line test and look rule into METHOD, adds METHOD's release exception, deletes M4's ledger after the tag `m4-house-ledger`, and queues STORE. Questions 6 to 9 wait for Sam.
- 6 Nov · Sam answered questions 6 to 9 on the pager: the lines approved as written, the next milestone's word TIDY, the old app's missing update message accepted as part of the exception, and the connect limit written down. STORE renamed TIDY, with DEC-2026-11-06-tidy; L25 added to 1 Pagers.
