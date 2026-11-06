# ENCRYPT · Decisions the service can't read

> **Status:** queued · **Order:** first after M4, once Sam has reviewed it; CLIENTS follows · becomes M5 when it starts

## Objective

Sam, 5 Nov 2026, on starting M4: "I want to get our house in order before we commit to building E2EE and making the product available to others."

Sam's guarantee in the strategy, approved on 30 Oct and waiting here until it is true: "Decisions, attachments, answers and acknowledgements are encrypted on my agent's machine and on my phone. The service carries bytes and the little it needs to route them: which pager, which agent, when. The pager number binds my phone's key, so the service can't swap it."

In Sam's voice, as the old MENCRYPT doc had it:

My decisions, their attachments, my answers and my agents' acknowledgements are encrypted between my agent's machine and my phone, and the service carries only ciphertext and what it needs to route it. The agentpager command checks my pager's key against its number before it encrypts anything to it. Alerts still show me the real question: an extension on my phone decrypts them. Every earlier promise still passes.

## What's known

- **Built since M2:** the phone makes each pager's key pair, and the pager's number carries a fingerprint of its public key, which the service checks when the pager is made and at every connect (I19).
- **The design,** agreed on 29 Oct. The full draft is `docs/v2/04-encryption.md`, which M4 removes from the tree and git keeps.
  - Keys: a key pair per pager, made on the phone and kept where an alert extension can read it; a key pair per agent, made at connect and kept in the agent's file. The service holds only public keys and the digests of the phone and agent keys.
  - Encrypted to the pager's key: each card, each attachment, who asked with the project and the computer, and each acknowledgement. Encrypted to the agent's key: the answer. The service keeps only ids, timestamps, sizes, how many attachments, whether each pager is on and when it turns off, and the phone's device token.
  - One format for every encrypted part, in both directions: X25519 with a fresh key for each part, HKDF-SHA256 and AES-256-GCM, which CryptoKit and Node's crypto both have. Each part is bound to its kind, its pager and its decision, so it can't be replayed as another kind or moved to another decision.
  - Before it encrypts anything, the command fetches the pager's public key from the service and checks it against the number.
  - An alert carries a small encrypted preview. A notification service extension decrypts it with the pager's key and shows the question; if it can't, iOS shows a plain "New decision". The not-picked-up warning becomes plain too, and the phone names the agent.
  - Sam's answers on 29 Oct: the fingerprint stays 8 bytes, so the number keeps its length, and attachment names are encrypted.
- **Five hardening items,** held for this milestone by the 30 Oct engineering review, as Sam agreed:
  1. An ask request id. The phone's answer already has one, so sending it twice stores it once. An ask has none: if its reply is lost and the agent asks again, the owner gets a second decision.
  2. A client-version header. The command doesn't say which version it is, so the service can't tell an old one to update, as METHOD's release rule needs.
  3. One writer per pager. The review didn't write down what it covers. Today a pager's state lives in two places, the pager's row and each agent's own store, and on each machine every agent on a pager appends to one history file. It may also close L10, a call that lands as the pager turns off.
  4. A lifecycle state machine for an agent: connected, finished, idle, forgotten, and deleted with its pager. It includes what finish does to open decisions (question 3). Today finish stops new asks, and open decisions stay answerable, though no agent will pick up the answer.
  5. A smaller poll. While open, the app reads each of its pagers every 3 seconds, and each read asks every agent on that pager; one request per phone for what changed would be smaller. While an agent waits, the service checks for the answer every 100 ms. Plan settles which poll this means.
- **What encryption doesn't hide,** for the site's note on what the service stores (SITE): who pages whom, when, how much and how often; and, to Apple, that an alert happened and its size. A compromised agent machine exposes that agent's cards, the answers to it and its history. A compromised phone exposes everything on it.
- M4 left METHOD's rule "A release never loses data" as it was, for this milestone to settle with question 1.
- INSTALL now comes after ENCRYPT, so at the switch the command is still built from the repository, and only Sam's machines run it.

## Still open

Sam decides these first:
1. Decisions stored before the switch: deleted then, or kept readable until the service forgets them as usual (I17).
2. What an agent sees when its command is from before the switch: refused, with how to update.
3. What finish does to an agent's open decisions: they close and can't be answered, or they stay answerable and the answer is reported as not picked up.

## Out of scope

- Hiding which pager and which agent, when, and how big each part is.
- Moving a pager's keys to a new phone, or recovering them.
- Protecting a phone or an agent's machine that someone else controls.

## Adds · Changes · Retires

- **Adds:** B30, whole; I20, whole; I19's check on the agent's machine; B17's encrypted alert, with the App Group and the notification service extension on the phone; J5's encrypted alert step; a limit on how fast a number can connect agents, which the design assumed; I23's HTTPS-only clause, unless M4 fixes it first; and new clauses for the ask request id and for telling an old command to update.
- **Changes:** I4 and I22, since the service can no longer read a card, so the command's checks are the only ones; B5 and B17, for a not-picked-up warning the service can no longer word.
- **Retires:** the limits encryption fixes, quoted here when they go: L19 "The service can read every decision" and, unless M4 fixes it first, L20 "The service still answers plain HTTP" (6 Privacy); L17 "Alerts pass through Apple as plain text" (4 Getting paged); and L10 "Turning a pager off can let one call through" (1 Pagers), if one writer per pager fixes it.

## From the old Blueprint (not built yet)

The lines the old Blueprint held for this milestone, as the [M4 ledger](../M4-house/ledger.md) moved them. Each reaches its area file with the code that makes it true.

**B30 · Decisions are encrypted end to end** (6 Privacy). Its built part, the pager's key pair and the number's fingerprint, has been I19 since M2.
1. The owner's decisions, their attachments, the owner's answers and the agents' acknowledgements are encrypted between the agent's machine and the phone, so the service can't read them.
2. The command encrypts each decision and its attachments, and who asked, the project and the computer, to the pager's key, and gives the service the agent's own public key at connect.
3. The phone encrypts its answer to the agent's key, and the agent encrypts its acknowledgement to the pager's key.
4. The command checks the pager's key against its number before it encrypts anything to it (I19, below), the service holds only ciphertext (I20, below), and the phone decrypts each alert (B17, below).

**I19, a clause added** (6 Privacy)
- Before it encrypts anything to a pager, the command fetches the pager's public key, works out the fingerprint and refuses on a mismatch, so a service that swaps the key is caught on the agent's machine.
- When that check fails, the agent is told that the number's key doesn't match the service's, to check the number, and, if it is right, to stop and tell its owner.

**I20 · The service holds nothing readable** (6 Privacy)
1. The service never holds a readable decision, attachment, answer or acknowledgement, only ciphertext and what it needs to route it, and no alert carries one as text.
- What is encrypted to whom, and what the service keeps, are under What's known. Its tests, once built, look for a decision, answer or acknowledgement readable in storage or logs, and an alert carrying the question, the answer or the agent's words as text. Its Why is Sam's guarantee, quoted under Objective.

**B17, a clause added** (4 Getting paged)
- The alert travels encrypted, and the phone decrypts it to show the real question (B30), with an App Group and a notification service extension in the app.
- Once the service can't read decisions, it can't write who asked, the project or the question into an alert, so B17.2's title and body, and the names in B17.8's alert, come from the phone.

**J5, a step added:** after J5.3, the alert travels encrypted, and an extension on the phone decrypts it to show the question.

**I23, a clause added** (6 Privacy), unless M4 fixes L20 first: the service answers only over HTTPS. A plain HTTP request is sent to HTTPS, and every reply tells browsers to keep to HTTPS.

**I22 and I4, changed** (3 Cards): once cards are encrypted, the service can't read a card to refuse it. The command's check (I22) becomes the only check of a card's text, and I4 then holds on the service only for what it can still read.

**From the design, not built:**
- The service limits how fast a number can connect agents, which the design relies on, since a number carries its pager's id in the clear. Nothing limits it today.
- A number whose version the command doesn't know is refused with a reply that says so. Today any other version is refused as not in use (B25.8).

## Log

- 31 Oct · queued, unchanged in scope, in the next roadmap.
- 5 Nov · Sam set it first after M4, one milestone at a time. Its hardening items were added here.
