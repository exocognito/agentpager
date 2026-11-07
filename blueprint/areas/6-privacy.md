# 6 Privacy

> **Definition:** What the service is and what it can see: where it runs, the keys and the number's fingerprint that tie a pager to its phone, and how keys and the service's own secrets are kept. Making a pager is 1 Pagers (B26), connecting with a number is 2 Agents (B25), and what an alert carries is 4 Getting paged (B17).
> **Serves:** [Stack](../PRODUCT.md#stack) · [Only agents I give a number reach my phone](../PRODUCT.md#only-agents-i-give-a-number-reach-my-phone)
> **Relies on:** Cloudflare, where the whole service runs: one Worker per stage, prod's at agentpager.me and dev's at dev.agentpager.me, each with its own data (AGENTS.md › Stages), behind Cloudflare's HTTPS, with its storage in Durable Objects, one for the pagers and one per agent · the iPhone's Keychain, which keeps each pager's private key and phone key on that phone · the cryptography built into iOS, into Node and Bun on the agent's machine, and into the Worker, which makes the key pairs, the fingerprint, the digests and the encrypted parts
> **Code:** `packages/contract/envelope.ts` and `parts.ts` (the encrypted parts), `exchange.ts` (what the service checks of them); `packages/cli/src/seal.ts`, `commands.ts` (the key check), `store.ts`; `packages/app/src/worker.ts` (the number and its fingerprint), `https.ts` (HTTPS only), `registry.ts`, `agent.ts`, `shared.ts` (digests); `packages/app/scripts/build.mjs`, `deploy.mjs`; `packages/ios/AgentPagerCrypto`; `packages/ios/AgentPager/Model/Keychain.swift`, `Sealed.swift`
> **Screens:** none
> **Walked by:** no journey.

## Behaviors

### B30 · @M5 · Decisions are encrypted end to end

1. Each decision, its attachments, who asked with the project and the computer, the owner's answer and the agent's acknowledgement are encrypted on the agent's machine or the phone, and only the other end can read them.
2. The service can't move an encrypted part to another pager or decision, or pass it off as another kind: the end that reads it refuses it.

## Invariants

### I19 · @M2 · The number names the pager's key

Why: [Only agents I give a number reach my phone](../PRODUCT.md#only-agents-i-give-a-number-reach-my-phone). The command's own check of the key (I19.6) is what keeps the service from swapping it.

1. Each pager's key pair is made on the phone (B26), and its private key stays there. The service gets only the public key.
2. A pager's number names the pager and carries a fingerprint of the pager's public key.
3. The service makes no pager whose number doesn't name the public key it is given.
4. The service connects no agent with a number whose fingerprint doesn't match its pager's key. It refuses the number as not in use (B25).
6. @M5: Before it encrypts anything to a pager, the command checks the pager's key against the number's fingerprint, so a service that swaps the key is caught on the agent's machine.
7. @M5: When that check fails, nothing is sent, and the agent is told that the number's key doesn't match the service's, to check the number, and, if it is right, to stop and tell its owner.

- The fingerprint is 8 bytes. That it is enough holds by construction, not by an attack.
- The service's checks (I19.3, I19.4) catch a mistyped or altered number. The command's (I19.6) catches a service that swaps the key: the command checks it at connect, and encrypts only to the key it checked.

### I20 · @M5 · The service holds nothing readable

Why: [Only agents I give a number reach my phone](../PRODUCT.md#only-agents-i-give-a-number-reach-my-phone) · [Pinned design decisions](../PRODUCT.md#pinned-design-decisions)

1. The service never stores, logs or sends to Apple a readable decision, attachment, answer, acknowledgement, or who asked with the project and the computer. It keeps only what it needs to route them: which pager and agent, when, and how big.

### I23 · @M1 · Keys stay secret

Why: [Only agents I give a number reach my phone](../PRODUCT.md#only-agents-i-give-a-number-reach-my-phone)

1. The service's storage holds each phone key and each agent key only as a digest, never the key itself. Whoever reads that storage can't act as the phone or as an agent.
2. How long the service takes to refuse a key tells nothing about the digest it stores.
3. The service's own secrets, Apple's push key and the Cloudflare credential, never appear in the app, a build, a worktree, a log or a transcript.
4. @M4: The service answers only over HTTPS. A plain HTTP request to read a page is sent to the same address on HTTPS, and any other is refused unread. Every HTTPS reply tells browsers to keep to HTTPS.

- The phone makes its phone key with each pager (B26). The service makes each agent key at connect and sends it only in that reply, and the command keeps it in the agent's file (B25).
- Keys travel in request headers, over HTTPS (I23.4).
- A local server, reached by an IP address, `localhost` or a `.local` name, still answers plain HTTP, for the suites, the screens and the LAN dogfood server. Browsers keep to HTTPS on agentpager.me and dev.agentpager.me only, not on other names in the zone.
