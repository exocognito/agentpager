# End-to-end encryption: numbers, keys, envelopes and push (draft 2, 29 Oct 2026)

Design item 3. Goal: the server carries bytes it cannot read, the number binds a pager to the phone's key so the server can't swap keys, and pushes still show the real question. Everything here uses primitives that exist in both CryptoKit (iPhone) and Node/Bun crypto: X25519 for key agreement, HKDF-SHA256, AES-256-GCM. No new library on either side.

Draft 2: the owner's-notes delivery (old §6) is gone. Notes are answers to one decision and travel as answers; nothing is encrypted from the phone to agents other than answers. That removes two routes, a purpose, a phone-side sync loop and an open question.

## 1. Keys

| Key | Where made | Where kept | Lifetime |
|---|---|---|---|
| **Pager key pair** (X25519) | On the phone, when a pager is created | iOS Keychain, in an App Group so the notification extension can use it; not Secure Enclave (X25519 isn't supported there, and we want the extension to read it) | Until the pager is deleted. Off/on doesn't touch it. |
| **Agent key pair** (X25519) | On the agent's machine, at `connect` | `~/.agentpager/agents/<id>.json`, mode 600 | Until the agent file is removed |
| **Agent bearer key** | Server, at `connect` (as today) | Same file | Same |
| **Phone bearer key** per pager | Phone, at pager creation (as today) | Keychain | Same as pager key |

The server stores: the pager's **public** key, each agent's **public** key, and SHA-256 digests of the bearer keys (as today). It never holds a private key.

## 2. The pager number

```
ap1_ + base64url( pagerId[16] ‖ fingerprint[8] )        → 36 characters, e.g. ap1_7Kq2mXv9tRbN4cWz8hL1sP6dF3gJ9wTe
```
- `pagerId`: 16 random bytes, made on the phone; the server's routing key.
- `fingerprint`: the first 8 bytes of SHA-256 of the pager's public key.
- `ap1_`: version. A later format bumps it; the binary refuses versions it doesn't know with a clear message.

At `connect` the binary fetches the pager's public key by `pagerId`, recomputes the fingerprint and refuses on mismatch ("The number's key doesn't match the server's"). 64 bits of fingerprint is enough: an attacker who controls the server would need a key pair whose hash matches 8 given bytes, which is 2^64 work for one pager, and the attacker already has to be the server.

Today's number is 32 random characters with no structure. The new one is 4 characters longer and carries the pager id in the clear, which is fine: the id is only useful with the number anyway, and the server rate-limits connects per pager.

The number is an address, not a credential. It lives in AGENTS.md (decided 29 Oct); whoever has it can page you until you turn that pager off or make a new one, and can read nothing. Developers who want it out of transcripts set `AGENTPAGER_PAGER` instead.

## 3. What is encrypted, and to whom

Agent → phone, encrypted to the **pager** public key:
- the **card**: one JSON blob `{title, detail, card, attachmentNames}`;
- each **attachment**'s bytes, one blob each, so the phone fetches them lazily;
- the **agent's identity** at connect: `{app, project, name}` (so the server doesn't learn what the agent is working on);
- the **acknowledgement**: `{nextSteps}`.

Phone → agent, encrypted to the **agent** public key:
- the **answer**: `{choice}` (option number or note text).

Plaintext the server keeps: pager id, agent id, decision ids, answer ids, timestamps, blob sizes, attachment count, pager on/off state and auto-off time, push token. That is the metadata it needs to route and to page.

Not encrypted: nothing else. The old `title`/`detail` columns go; `questionBody()` for pushes goes (§5).

## 4. The envelope

One format for every blob, both directions. Sender makes a fresh ephemeral X25519 key per blob; recipient's static key is the pager key or the agent key.

```
shared   = X25519(ephemeral_private, recipient_public)
key      = HKDF-SHA256(shared, salt = nonce, info = "agentpager/v1/" + purpose, length = 32)
ct       = AES-256-GCM(key, nonce, plaintext, aad = purpose ‖ pagerId ‖ decisionId?)
envelope = base64url( 0x01 ‖ ephemeral_public[32] ‖ nonce[12] ‖ ct )
```
- `purpose` is one of `card`, `attachment`, `identity`, `ack`, `answer`, `preview`. Binding it into the key and the AAD stops a blob being replayed as a different kind.
- `pagerId` and `decisionId` in the AAD stop a blob being moved between pagers or decisions.
- Ephemeral keys give forward secrecy per blob: a leaked agent key exposes the answers sent to it, not every card ever sent.
- Overhead: 45 bytes plus base64, so a 1 MB image stays under the server's limit.

Attachments: the card blob lists names and types; each attachment is its own envelope at `files/<index>`. The server knows the count and sizes, not the names.

## 5. Push notifications

The push payload is at most 4 KB, so it carries a small **preview** envelope, not the card:

```
{ "aps": { "mutable-content": 1, "alert": { "title": "AgentPager", "body": "New decision" },
           "sound": "default", "thread-id": "<pagerId>", "interruption-level": "time-sensitive" },
  "pagerId": "…", "agentId": "…", "decisionId": "…", "kind": "decision",
  "preview": "<envelope of {title, detail, app}, ≤ 1 KB>" }
```
A **Notification Service Extension** in the app: reads the pager key from the App Group Keychain, decrypts `preview`, sets the title to the question and the subtitle to `detail`, body to the app name. If it fails (no key, corrupt blob, the 30-second budget), iOS shows the generic "New decision", which is still correct. The extension never touches the network, so it works offline.

For acknowledgements the preview is `{nextSteps}` with kind `acknowledgement`, title "Codex confirmed".

Apple sees: "AgentPager · New decision" plus ciphertext.

## 6. Server changes (summary for the build)

- Pagers table: `pagerId`, `publicKey`, `phoneKeyDigest`, `enabled`, `offAt`, `pushToken`, `createdAt`. Replaces `numbers_v1`. No name (the name is only on the phone).
- Agents (today's Session objects): drop `name`, `status`, lifetime, pairing; add `publicKey`, `identity` blob, `pagerId`. `proposals.json` becomes `card` blob plus `attachmentCount`; attachments by index; `answers.json` and `acknowledgements.json` become blobs.
- New route: `GET /pagers/<id>/key`.
- Off check on every agent call via the pager row.
- Pushes carry `preview`; `questionBody()` and the plaintext title go.
- Everything about links, QR, palette, pairing window and tries goes (numbers only).

## 7. Phone changes (summary for the build)

- Key pair per pager in an App Group Keychain; pager id and fingerprint derived; number assembled on the phone and shown once created.
- Encrypt answers; decrypt cards, attachments, identity, acknowledgements on read. The brief parser is unchanged; it just gets plaintext from a decrypt instead of from JSON.
- Notification Service Extension target with the App Group entitlement.

## 8. What this doesn't protect against, stated plainly (for the "what we store" note on the site)

- The server knows who pages whom, when, how much and how often.
- A compromised agent machine exposes that agent's cards and the answers to it, and the pager's local history file.
- A compromised phone exposes everything on it; there is no second device and no recovery (lost phone means new pagers, as today).
- Apple sees that a notification happened and its size.

## 9. Open questions for Sam

1. **Fingerprint length**: 8 bytes keeps the number at 36 characters. 16 bytes would make it 47. I'd keep 8.
2. **Attachment names**: encrypted (server sees `files/0..n`). Costs nothing; confirming you don't want names visible for debugging.
3. **Self-hosters** running their own server need nothing extra: keys are per pager and never leave the phone or the agent machine.
