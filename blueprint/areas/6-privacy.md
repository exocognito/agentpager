# 6 Privacy

> **Definition:** What the service is and what it can see: where it runs, the keys and the number's fingerprint that tie a pager to its phone, and how keys and the service's own secrets are kept. Making a pager is 1 Pagers (B26), connecting with a number is 2 Agents (B25), and what an alert carries is 4 Getting paged (B17).
> **Serves:** "It runs on a Cloudflare Worker at agentpager.me, with one Durable Object for the pagers and one per agent." · "The pager number binds my phone's key" · "Only agents I give a number reach my phone"
> **Relies on:** Cloudflare, where the whole service runs: one Worker per stage, prod's at agentpager.me and dev's at dev.agentpager.me, each with its own data (AGENTS.md › Stages), behind Cloudflare's HTTPS, with its storage in Durable Objects, one for the pagers and one per agent · the iPhone's Keychain, which keeps each pager's private key and phone key on that phone · the cryptography built into iOS and into the Worker, which makes the key pair, the fingerprint and the digests
> **Code:** `packages/app/src/worker.ts` (the number and its fingerprint), `https.ts` (HTTPS only), `registry.ts`, `agent.ts`, `shared.ts` (digests); `packages/app/scripts/build.mjs`, `deploy.mjs`; `packages/contract/exchange.ts`; `packages/ios/AgentPager/Model/Keychain.swift`
> **Screens:** none
> **Walked by:** J4

## Invariants

### I19 · @M2 · The number names the pager's key

Why: "The pager number binds my phone's key". The rest of Sam's sentence, "so the service can't swap it", holds only once ENCRYPT builds the command's own check.

1. Each pager's key pair is made on the phone (B26), and its private key stays there. The service gets only the public key.
2. A pager's number names the pager and carries a fingerprint of the pager's public key.
3. The service makes no pager whose number doesn't name the public key it is given.
4. The service connects no agent with a number whose fingerprint doesn't match its pager's key. It refuses the number as not in use (B25).
5. A number for a pager that doesn't exist, or with any character changed, connects nothing.

- The fingerprint is 8 bytes. That it is enough holds by construction, not by an attack.
- These checks catch a mistyped or altered number. They don't catch a service that swaps the key, because the command doesn't check the key itself until ENCRYPT.

### I23 · @M1 · Keys stay secret

Why: "Only agents I give a number reach my phone"

1. The service's storage holds each phone key and each agent key only as a digest, never the key itself. Whoever reads that storage can't act as the phone or as an agent.
2. How long the service takes to refuse a key tells nothing about the digest it stores.
3. The service's own secrets, Apple's push key and the Cloudflare credential, never appear in the app, a build, a worktree, a log or a transcript.
4. @M4: The service answers only over HTTPS. A plain HTTP request to read a page is sent to the same address on HTTPS, and any other is refused unread. Every HTTPS reply tells browsers to keep to HTTPS.

- The phone makes its phone key with each pager (B26). The service makes each agent key at connect and sends it only in that reply, and the command keeps it in the agent's file (B25).
- Keys travel in request headers, over HTTPS (I23.4).
- A local server, reached by an IP address, `localhost` or a `.local` name, still answers plain HTTP, for the suites, the screens and the LAN dogfood server. Browsers keep to HTTPS on agentpager.me and dev.agentpager.me only, not on other names in the zone.

## Limits

### L19 · @M1 · The service can read every decision

- What people meet: the service stores each decision, its attachments, the answer and the acknowledgement as readable text, with who asked, the project and the computer. Whoever runs the service, or gets into its storage, can read them. What alerts carry through Apple is L17, in 4 Getting paged.
- Why it waits: encryption is its own milestone, ENCRYPT, so that pagers and the command could ship first. "Encryption comes before the friends rollout."
- What would fix it: ENCRYPT. Decisions, attachments, answers and acknowledgements are encrypted between the agent's machine and the phone, and the command checks each pager's key against its number (I19).
- When to revisit: ENCRYPT, which runs right after M4, and in any case before FRIENDS.
