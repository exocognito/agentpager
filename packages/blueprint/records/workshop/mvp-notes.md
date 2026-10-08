# Roger MVP Workshop

Verbatim brief from before:

> 3. **Roger: Simple agent-user question-answer loop.** A simple shadcn style mobile web app that lets my agent send me messages. In my terminal/coding agent window, I tell my agent to set up at useroger.app. It pings that URL and gets the skills it needs. Then it generates a QR code and shows it to me, I scan it with my phone and it opens a mobile web app at an unguessable session URL, with no account or passkey. Anyone with that URL has access to the session. I just see an empty inbox for that session - that just has one CTA - "let your agent know you're in" and then a set of 5 randomized emojis, and when I click one, that's going to send that message to the agent, and the agent is going to confirm by writing that emoji back in my chat where it gave me the qr code. Each session has one agent connection and at most one unanswered question. A supported helper stays running while waiting for the answer and returns it to the waiting agent; it doesn't restart or resume a terminated agent. There is no personal inbox across agent sessions. And now the agent is able to send me messages to my session inbox and I can reply only by pressing emoji buttons. It's totally up to the agent and the user how they use this tool, the agent can send any message (markdown only, no html), any number of buttons with any emoji or icon, and the user can reply by pressing one or more buttons, and then confirm. No other options.

> [!INFO] `roger` was a temporary name. For MVP, we'll use the product name `OwnerPager` and I own `ownerpager.com`, so let's use those going forward.

---

## Round 1 tldraw questions

Q1 · What is the smallest useful success bar?

> The happy path and then being able to walk away from my computer while an agent does work, and them messaging me for input on my phone and getting unblocked to complete their work. The win: instead of me discovering a question and a paused agent when i return to computer, I answered questions from my phone, and the agent is successfully completed their work when I return to my computer.

Q2 · Does the emoji prove only round-trip delivery, or should the phone wait for an explicit agent acknowledgement?

> Because I just scanned the QR code in the agent session, I should see the emoji get echo'd in the session as confirmation, and should not need another message to my phone. However, this handshake question should follow the same patterns as a normal decision flow so an agent confirmation message is the final step for that reason.

Q3 · After Confirm, keep the answered card as a receipt or return to an empty inbox? How long does a session last?

> Inbox should show lists of unanswered messages and lists of answered messages, so I can revisit the history of prior ones, but the emphasis is generally on new/unread messages to action. So once confirmed, return to Inbox and show empty unanswered, and +1 message in history, which can be revisited by the user to see the decision and response again (but it cannot be edited).

Q4 · Is one supported terminal helper + an open phone tab enough for the MVP? Which agent/host first?

> Yes one agent for now and one phone for now.

Q5 · Fix Cloudflare + a durable session owner, or leave hosting to the builder?

> Fix infra requirements, I want to be sure what we're using.

Q6 · Emoji-only first, or a named icon set too? What practical payload/button limits are acceptable?

> Keeping the exchange constrained is useful, but allowing a lot of variation within that is also important. So I would suggest something like:
  - the user can respond by selecting only one option, not multiple.
  - the users options are always just an emoji icon on a button
  - there is always an "Other" option where the owner can enter freeform text to respond to the agent if they really want to be specific, but this is consider a fallback scenario.
  - the agent sending the message decides what options to present, what emojis to use. Options are also numbered by the system, so the user can reply in their freeform text "do 1 and then 2" instead of "do lemon and then book thingy".
  - There can be five options max, minimum two.
  - The decision and options content must be written with ELI10 clear language for the owner so it's not a cryptic/difficult to answer.
  - Since responding is a destructive action, it cannot be one-tap and must be two. The owner selects/prepares their response, and must tap Send to send the repsonse to the agent. But it should always be possible to answer in 2 taps, unless the owner uses Other to add more context.
- The question should be limited to ~100 chars.
- Each answer should be limited to ~100 chars.
- Both the question and the answer can have an ℹ️ on the right, which toggles an area with more detail (up to ~200 chars in small text), if the owner needs more context or precise details to help them decide. This should not be required in most cases and the titles of the question and answers should be information and understandable in most cases.
- When the response is sent to the agent, the agent should respond to the device to confirm it received and summarize its next steps for the owners awareness.


---

## Round 2 tldraw questions

Q1 · Which agent / helper host do we support first?

>  "Q1⠈· Which⠈agent /⡀helper host do we support first?"⠄What are examples of satisfactory answers? I can't tell if you're asking which agent session to use, or whether its running on⠠my mac or a vm, or its about whether its a claude code session or a codex desktop session etc. In general I would expect we make a list of environments/agents that we⡀would need to support⠁to achieve the strategy, and you could recommend the first⠂one for the MVP⢀from⠁that?

Q2 · Session expiry and history retention are still unspecified.

> give me some practical options

Q3 · Proposed: 2–5 agent choices PLUS Other. Does Other count toward five?

> No, Other is beyond this number

Q4 · Notes say ~100-character titles / ~200-character detail. Exact bounds and counting rule? Other text and acknowledgement limits?

> Suggest simplest rules to get started? I don't think we should get strict about exact limits here, I think these are guides to the agent writing the decision and options text, and not hard requirements. Put a simple hard requirement at 420 chars for any agent input field, don't allow html, only plaintext with markdown formatting and good utf-8 encoding to support emojis and glyphs etc.

Q5 · Approve the concrete infrastructure below, including transport?

MVP baseline from Q4: one agent, one phone, open tab. Background/lock-screen notifications are outside this draft.
---

## Round 2 review — agent response

**Q1 clarification:** I combined three different choices in one vague question: the agent application (Claude Code, Codex CLI, a desktop app), its location (your Mac or a Linux VM), and how a live helper returns your answer to that agent. I was not asking which individual chat/session to use. A satisfactory answer could be “Claude Code in a macOS terminal, with the helper running on the same Mac.” A support list and recommendation should come first.

**Settled from your answers:** Other is additional to the two–five agent options. The 100-character question/option and 200-character detail lengths are writing guidance, not validation failures. Every agent-supplied text field has a hard 420-character maximum. Content uses valid UTF-8 text with Markdown; no HTML. The acknowledgement’s next-steps text is also agent input and gets the same cap. No answer to Q5 was recorded, so infrastructure remains proposed.

**Proposed support list:** these are combinations to qualify, not claims that OwnerPager already works with them.

| Order | Agent application | Where it runs | Why / proof still needed |
| --- | --- | --- | --- |
| First MVP target (recommended) | Claude Code CLI | macOS terminal | Directly exercises your terminal-to-phone brief on your Mac. Prove a live wait, phone answer, continued work and acknowledgement without returning to the keyboard. |
| Next: cloud coverage | Claude Code CLI | Linux VM reached over SSH | Exercises the cloud-VM part of the vision. Helper lives on the VM; prove the flow while the SSH viewer is disconnected and the agent process remains alive. |
| Next: second agent | Codex CLI | macOS, then Linux VM | Tests whether the same helper contract works across agents rather than baking in one agent’s behavior. |
| Separate qualification | Codex desktop / Claude Code desktop | Mac | Desktop sessions need their own proof of tool permissions and waiting/continuation behavior; CLI success does not establish desktop support. |

The first-target recommendation is an engineering choice, not a finding that Claude Code is more capable. Product/platform references: [Claude Code setup](https://code.claude.com/docs/en/setup), [Codex CLI](https://learn.chatgpt.com/docs/codex/cli). These do not prove the OwnerPager integration. No direct paid model API is required by this proposal.

## Round 3 workshop questions

New questions are recorded here before asking for another canvas review. IDs below are round-specific; earlier questions and your answers remain intact.

### R3.Q1 · Start with Claude Code in a terminal on your Mac, then prove the Linux VM path?

**Superseded by the clarification below:** choosing an app/host is not a prerequisite for the product API. The recommendation below is retained as workshop history.

Recommended: yes, using the support list above. If your first real use will be Codex CLI or a desktop app, name that combination instead. The live helper must return an answer to the waiting agent; it must not restart a terminated agent. No compatibility claim until that path is run.

**Sam’s answer:**

### R3.Q2 · How long should a session and its history remain available?

These are product options, not service-provider limits. Expiry disables the session and removes its questions, answers and acknowledgements from active product storage; backup retention is a separate infrastructure detail. Helper polling and simply reopening history do not extend inactivity. Accepted questions, answers and acknowledgements do.

| Choice | Rule | Tradeoff |
| --- | --- | --- |
| A | 24 hours after the last accepted question, answer or acknowledgement | Less retained content; a weekend gap loses history and can expire a waiting question. |
| B — recommended | 7 days after the last accepted question, answer or acknowledgement | Keeps a normal working week of continuity; a question still waiting after seven days expires. |
| C | 30 days after session creation, regardless of activity | Predictable absolute cutoff and longer review window; even an active session ends at day 30. |

All three require a visible expiry and an explicit SessionExpired result rather than pretending a late answer was delivered. Your 420-second rotation for an unclaimed pairing link is a separate rule; it does not define connected-session/history retention.

**Sam’s answer:** B

### R3.Q3 · Use Unicode code points for the 420-character cap, and the same cap for Other text?

Recommended: count Unicode code points in the submitted Markdown text, including spaces and Markdown punctuation; reject invalid UTF-8 and over-limit input without truncating it. A combined emoji can contain several code points. This is a simple consistent rule; the UI should use the same count. The already-decided cap applies to each agent-authored text field, including optional detail and acknowledgement. Applying 420 to owner-authored Other text is a proposal, not implied by your agent-input rule.

**Sam’s answer:** yes, limit both to 420

### R3.Q4 · Approve the proposed infrastructure, or name what should change?

Carried forward from unanswered Round 2 Q5: Cloudflare Worker at ownerpager.com for web assets, skill and API; one SQLite-backed Durable Object per session for questions, answers and acknowledgements; native Alchemy for resource declarations. Proposed transport: HTTPS commands and polling reads. Poll cadence and a delivery-latency target are not yet fixed. No deployment is requested in this round.

**Sam’s answer:** yes

### R3.Q5 · Does the first phone keep access when another phone tries the link?

From your current strategy G2, proposed interpretation: the first phone claims the session; reject later devices without disconnecting it. The original browser can reconnect using its stored session credential. Rotate an unclaimed pairing link after 420 seconds and invalidate the old link immediately. Claiming it also disables that pairing link. This separates a one-use pairing link from the connected phone’s session access. Lost browser state would require a separately agreed re-pair flow; none is assumed here.

**Sam’s answer:** agree

## R3.Q1 follow-up — URL/API first

**Sam’s clarification (chat):** “I was assuming we could give an agent a url (e.g. ownerpager.com/start) and that would tell them what to do, and they just need the url/api endpoints to use and the agent can write its own way to interact with that, or is it that we need to write something for the environment/cli?”

**Agent response:** Yes: that is the intended interface to design. The start URL should provide agent-readable instructions, request/response schemas, access rules and examples for creating a session, presenting the phone pairing link, asking a question, retrieving the answer and acknowledging it. The agent may write its own caller. A shipped helper or app-specific adapter is not a prerequisite.

The earlier support matrix mixed product scope with test coverage. Mac versus VM and CLI versus desktop affect available network/tool permissions, how the pairing link is shown, and whether a waiting operation can return its result to the agent after a delay. They should not change the HTTP contract. Start by proving a complete exchange in one available environment; add an adapter only if evidence shows the generic instructions/API cannot meet the intended path there.

Waiting and continuation remain a real proof obligation: accepting an answer on the server does not itself wake a stopped agent. A live agent/tool must poll or wait, receive the answer, continue and acknowledge it. An agent can implement that using the documented API; OwnerPager need not own the waiting process. Automatic revival of an exited agent is outside this proposed path.

The prior canvas/helper labels and HTML environment recommendation predate this clarification; read them as test scaffolding proposals, not a required product dependency. No new owner choice is needed on R3.Q1 just to proceed with API design.

## Round 3 outcome

Strategy promoted to strategy.md at Sam’s request. The canvas now reflects URL/API-first use with an agent-written caller; seven-day inactivity expiry; 420 Unicode code points for agent fields and Other; the agreed Cloudflare/Alchemy foundation; and first-phone ownership. Earlier proposals above remain workshop history. The old strategy and review copies were moved to Trash.

## Round 4 design follow-ups

These questions remain for the next design pass; none blocks recording the Round 3 decisions.

### R4.Q1 · What delay is acceptable for a new question or answer to appear?

Polling is agreed; polling cadence and a delivery-latency target are still unspecified. We should propose timings and their request-volume tradeoff in the next design pass.

**Sam’s answer (2026-09-25):** the phone polls every 3 seconds, the agent polls every 5 seconds, and a new question or answer is visible within 5 seconds.

### R4.Q2 · What should happen if the paired phone loses its browser credential?

Reconnecting with the stored credential is agreed. Recovery after losing it is not. A fresh session is the smallest option; recovering the old session would need an explicit transfer rule.

**Sam’s answer (2026-09-25):** a fresh session only; the old session expires on its own. No transfer.

### R4.Q3 · May the agent ask again before acknowledging the previous answer?

The canvas currently proposes allowing a new question once the prior answer is stored, with acknowledgements tied to their own decision. Pairing still waits for its acknowledgement. The alternative is to require acknowledgement before every new question. This ordering has not been agreed.

**Sam’s answer (2026-09-25):** no. The agent acknowledges first, then may ask again. A question is open until acknowledged (G7).

## Round 4 outcome

Recorded in `DEC-2026-09-25-mstart-scope` with the milestone scope and strategy edits. The strategy now lives at `packages/blueprint/strategy/STRATEGY.md`; this workshop copy is history.
