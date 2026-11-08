# The desk: answering decisions from the Mac (a proposal, 8 Nov 2026)

A design proposal for Sam. Nothing in it is on the roadmap. [PRODUCT.md › Roadmap](../../blueprint/PRODUCT.md#roadmap) says a feature joins the roadmap when owners, Sam included, show they need it. This is a need from Sam's own use, and the one question for Sam now is whether to add it. If Sam adds it, it becomes a roadmap line and later a milestone with its own doc, and the questions at the end are asked then, not now ([METHOD.md › Don't](../../METHOD.md#dont)).

Claims are marked [V] verified on 8 Nov 2026 against `origin/main` at 0fecc85, or [A] assumed.

Words: **desk** is a proposed term. It means a Mac the owner links to a pager from the phone, which reads that pager's decisions and answers them. It would get a [TERMS.md](../../blueprint/TERMS.md) entry before any line uses it. Every other word is used as TERMS.md defines it.

## Why

- [V] The cockpit in `exocognito/cos` (PR #1) shows every agent session Sam runs. Its AgentPager adapter (`src/adapters/agentpager.ts`) reads `~/.agentpager/history/<pager>.jsonl`. That file holds only what one machine asked ([B31](../../blueprint/areas/2-agents.md), its first note). So the cockpit sees one machine at a time, never cloud VMs, and can't answer.
- [V] The cockpit's live tests on 8 Nov (`cos/docs/verified-matrix.md`): a message from another session never counts as Sam's consent. A throwaway session that got an "approved" message only queued it. So an answer with Sam's authority comes from the session's own UI, or from AgentPager, where the agent asked and Sam answered.
- [V] The service gives an agent only its own decisions' answers. Its routes (`packages/app/src/worker.ts › sideOf`) let an agent key reach only `/agents/<its id>/…`. Only the phone key reads a whole pager.
- [V] The phone key and the pager's private key live only in the Keychain of the phone that made the pager, marked this-device-only (`packages/ios/AgentPager/Model/Keychain.swift`; [L9](../../blueprint/areas/1-pagers.md#l9--m2--a-pager-lives-only-on-the-phone-that-made-it)). So only the phone can see every open decision and answer it.

## What it would be

- On a Mac, Sam sees every open decision on each pager Sam links there, and answers each one the way the phone does: choose, then Send, then the Undo window ([Sending a decision requires confirmation](../../blueprint/PRODUCT.md#sending-a-decision-requires-confirmation)). The phone works as it does today, and stays the pager that alerts.
- The cockpit lists those decisions and opens one in the desk. Sam's Send in the desk is the answer. The cockpit never holds a key and never sends an answer.
- Agents and the agentpager command don't change. An agent can't tell whether the phone or a desk answered.

## An owner's keys, compared with an agent's

"Owner-level" needs two things: a credential that reaches the whole pager on the service, and a key that opens what comes back. Today the phone has both, and nothing else does. The desk would get both too, with less power than the phone.

| | Agent key | Phone key | Pager's private key | Desk key (proposed) |
| --- | --- | --- | --- | --- |
| Made | [V] by the service at connect, sent only in that reply | [V] on the phone with each pager | [V] on the phone with each pager (X25519) | on the Mac, when it is linked |
| Kept | [V] the agent's file | [V] the phone's Keychain, this device only | [V] the same | the Mac's Keychain, readable only by the signed desk app |
| The service holds | [V] its digest | [V] its digest | [V] its public key | its digest |
| Reaches | [V] its own agent: ask, read its answers, receive, acknowledge, finish, status | [V] the whole pager: every agent's decisions and attachments, answer, turn off and on, auto-off, the alert target, delete | opens nothing on the service: it opens the encrypted parts the routes return | the whole pager: every agent's decisions and attachments, and answer |
| Opens | [V] the answers sealed to its own key (with its own key pair) | nothing alone: what it reads is encrypted | [V] every card, attachment, who asked, acknowledgement and alert preview on the pager | nothing alone: it travels with a sealed copy of the pager's private key |
| Can't | [V] read another agent, or answer | — | — | turn the pager off or on, change auto-off, set the alert target, delete the pager, link another desk |

- **No accounts.** [V] [PRODUCT.md › Stack](../../blueprint/PRODUCT.md#stack) says no accounts. So there is no owner key across pagers on the service. The desk links each pager on its own, and puts them together on the Mac, as the phone's Pagers screen does.
- **Why the desk can't change a pager.** Turning a pager off is how the owner stops a leaked number ([I17](../../blueprint/areas/1-pagers.md#i17--m2--off-pagers-deliver-nothing)). Keeping that on the phone means a desk that leaks can read and answer, but can't silence the phone or delete what Sam keeps.

## How it fits ENCRYPT

ENCRYPT has shipped: [V] it is [M5](../../blueprint/milestones/M5-encrypt.md), released on 7 Nov. The service already holds only encrypted parts ([I20](../../blueprint/areas/6-privacy.md#i20--m5--the-service-holds-nothing-readable)). The desk keeps that: it fetches the same encrypted parts the phone does and opens them on the Mac.

- **One pager key, copied once.** The command encrypts each card to the one key the pager's number names, and checks that key first ([I19.6](../../blueprint/areas/6-privacy.md#i19--m2--the-number-names-the-pagers-key)). The desk gets a sealed copy of that same private key from the phone, at Sam's say. So nothing changes for agents, and I19.6 still catches a service that swaps the key.
- **Rejected: encrypting each card to every owner device.** The command would need a list of the owner's device keys. Only the service could hand it that list, and X25519 keys can't sign one. A service that added its own key to the list would read everything: the same swap I19.6 exists to stop.
- **A gap ENCRYPT left: answers.** [V] An answer is sealed only to the agent's key (`packages/contract/parts.ts › PART_KINDS`). The phone remembers its own answers in its Keychain ([B7.4](../../blueprint/areas/5-answering.md#b7--m1--reopen-an-answered-decision)), so it never reads one back from the service. A desk couldn't show what the phone answered, and the phone couldn't show what the desk answered. The fix: each answer also carries a copy sealed to the pager's key. The service still can't read it, so I20 holds.
- **The agents' pinned keys.** [V] The phone keeps the key each agent first names ([B30.3](../../blueprint/areas/6-privacy.md#b30--m5--decisions-are-encrypted-end-to-end)). At linking, the desk gets the phone's pins with the pager's key, so it trusts the same agents. Agents that connect after the link are pinned by each device for itself. A service that showed the phone and the desk different keys for a new agent could put its own decisions on one of them. That is the exposure B30 already accepts for an agent the phone hasn't read yet, now on two devices.
- **What a desk exposes if the Mac is taken.** The same as a lost phone, for its linked pagers: the pager's private key opens every encrypted part on them. Unlinking the desk from the phone makes the service refuse its key at once, but doesn't take the private key back. A Mac that may be compromised means a new pager, as L9 already says of a lost phone.
- **Lines it would change,** for Sam to approve when it starts:
  - I19.1: the pager's private key "stays there", on the phone. It would stay on the phone and the desks the owner links from it.
  - B30.1: each part is read by "only the other end". The owner's end would be the phone and its desks.
  - B7.4 and its note: an answered decision shows its answer on every device of the owner's that holds the pager.
  - I17.5: deleting a pager forgets its desks too.
  - L9 narrows. Linking moves a pager's keys to another device, which is half of moving a pager to a new phone.
  - PRODUCT.md, which only Sam changes: [Stack](../../blueprint/PRODUCT.md#stack) says the owner's side is a native iPhone app, and the principles speak of the phone. The phone stays the pager that alerts, and the desk would be a second place to answer.

## How the desk authenticates: linking

The outcome: only a Mac that Sam links from the phone, with both in front of Sam, gets a pager's keys, and the service can't put itself in between.

1. **Sam starts it on the phone.** In the pager's detail, Sam chooses to link a Mac. The phone shows a one-time link code: the pager's id and a one-time secret, good for a few minutes. Sam types it or pastes it into the desk. It isn't a QR code: [V] PRODUCT's pinned design decisions rule out QR codes.
2. **The desk asks to link.** It makes a link key pair and its desk key, and sends the service, under the link code, its link public key and the digest of its desk key.
3. **Sam compares two codes.** The phone fetches the request. The phone and the desk each show a short comparison code, made from the pager's public key, the desk's link public key and the link code. Sam confirms on the phone that the two codes match. A service that swapped the desk's key would make the codes differ.
4. **One code, one request.** A second request under the same link code voids it, and the phone says so. Another process on the Mac that reads the code from the clipboard can't race the desk unnoticed.
5. **The phone hands over the keys.** It seals the pager's private key, its agents' pinned keys and its answer records to the desk's link key. It registers the desk key's digest with the service, using its phone key.
6. **The desk keeps them** in the Mac's Keychain, readable only by the signed desk app. From then on it calls the service with its desk key, in a header of its own.
7. **Unlinking.** The pager's detail on the phone lists its desks. Removing one makes the service refuse that desk's key at once.

**Send needs Touch ID on the desk.** Sam's agents run on the Mac as Sam's own user, and some of them can click (computer use). Without a check, an agent could open a decision in the desk and press Send. With Touch ID on each Send, an agent can open a decision but can't answer it, so Sam's yes stays a physical act, as a tap on the phone in Sam's hand is today. [A] LocalAuthentication's Touch ID works for an iOS app running on a Mac.

**What the service adds,** to show the size of the work, not to fix the design: a desk-key header, accepted on reading a pager, reading its attachments and answering, and refused on settings, the alert target and delete; the link calls (start, request, read the request, register, unlink); and the answer's copy for the pager.

## What form the desk takes

- **Recommended: the iPhone app itself, running on Sam's Mac.** [A] Apple silicon Macs run iPhone apps unchanged, when the developer allows it, and Sam's paid team signs the app. It brings the same screens, the same `AgentPagerCrypto` package and the same tests, so there is no second app to design. A linked pager would show its decisions and Send, without its switch, auto-off or Delete. [V] pro is an Apple silicon Mac (M5 Max). [V] The Xcode project doesn’t set `SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD`; [A] Xcode’s default allows a Mac build.
- **Alternative: a native macOS app** sharing `AgentPagerCrypto`. It would feel more like a Mac app, and it is a second app to build and design.
- **Not the agentpager command.** Agents run that command, so an owner key the command can reach is a key agents can reach.

## What the cockpit would call

The cockpit never holds a key and never sends an answer. It does two things:

1. **Read a summary.** While it runs, the desk keeps a summary of the open and recently answered decisions on its linked pagers, where the cockpit can read it: for each decision, the pager, who asked, the computer, the project, the question, when it was asked, where its answer is (open, sending, waiting for the agent, not picked up, acknowledged, closed) and the link that opens it. The summary holds only what an alert already shows ([B17](../../blueprint/areas/4-getting-paged.md)), never the brief, because any process of Sam's user can read it, the agents included. [A] A file in the desk's own container, which an unsandboxed process can read, is enough.
2. **Open a decision.** A link such as `agentpager://decision/<pager>/<decision>` brings the desk forward on that decision. Sam reads it there and answers with Touch ID.

So cos's adapter would read one summary covering every machine and cloud VM on the linked pagers, in place of one history file per machine. Its line "Answer on your phone" would become an Open in AgentPager button.

- **Rejected: an answer call for the cockpit.** Any process on the Mac could make that call, the agents waiting for the answer among them. An answer sent that way would carry no more of Sam's consent than a message does, which is exactly what the cos tests found doesn't count.

## If Sam queues it: its likely shape

- **One new kind of complexity:** a second owner device on a pager.
- **Slice:** Blueprint (the lines above, TERMS › Desk and link code); service (the desk key, linking, the answer's copy for the pager); phone (link a Mac, the pager's desks, the answer's copy); desk (the app on the Mac, linking, Send with Touch ID, the summary, the open link); command (nothing); cos (its adapter, in its own repository).
- **Out of scope:** alerts on the Mac; changing a pager from the Mac; moving a pager to a new phone (L9), though linking is half of it; accounts or an owner across pagers on the service; Windows, Linux or a web desk.

## Questions

**Now, for the roadmap (sent to Sam's pager):**

1. Add the desk to the roadmap?
   - a ★ Yes, queued right after CLIENTS, before INSTALL. Sam uses the cockpit now. It changes the encryption lines and the wire contract, which are better settled before OPEN publishes the code and FRIENDS rely on it.
   - b Yes, queued last, after FRIENDS. Friends and the cleanup stay first, as Sam chose for D2 on 8 Nov ([M7-clients.md](../../blueprint/milestones/M7-clients.md)).
   - c Not now. The cockpit keeps reading each machine's history and sends Sam to the phone.

**When it starts** (listed so Sam can see them; asked then, with only the ones Sam might not take on their recommendation, per DEC-2026-11-07-material-questions):

2. Its form: a ★ the iPhone app on the Mac; b a native macOS app.
3. Linking: a ★ a link code typed or pasted, with comparison codes; b a QR code for linking only, which narrows the pinned decision against QR codes.
4. What the cockpit reads: a ★ what an alert shows; b the whole brief; c nothing, only the open link.
5. An answer's copy for the pager: a ★ yes, so every device shows the answer; b no, and each device shows only that the other answered.
6. Touch ID on the desk's Send: a ★ always; b only the phone's two steps.
