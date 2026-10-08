# OwnerPager strategy

**Status:** Historical Round 3 strategy, promoted with the changes in [the scope decision](../decisions/DEC-2026-09-25-mstart-scope.md). Current contract: [strategy](../../strategy/STRATEGY.md) and [design](../../design/). The body below preserves the workshop wording.

## Vision

Let me leave my computer without leaving my agent blocked. OwnerPager allows my agents working on my computer or in a cloud VM to bring owner decisions to my phone so they can continue to do useful work while I am away from keyboard.

## Heroes

### H1 · Unblock my agent from my phone

Connect my agent to my phone by scanning a QR code. When it needs my input, the agent sends me the multi-choice question, and I can answer by choosing an emoji option, and see its acknowledgement and intended next steps. I can view prior decisions when I want to recall what we previously agreed, but I cannot change the prior decisions.

## Guarantees

### G1 · Sending a decision requires confirmation

Selecting an option or writing a response never sends it. Only pressing Send submits my answer, and the agent receives exactly what I sent.

### G3 · Sent decisions cannot be changed

A sent decision cannot be edited. I can revisit the original question, my answer and the agent’s acknowledgement without changing what was agreed.

### G2 · Access and delivery claims are honest

The first phone to claim an unguessable pairing link gets session access; no account or identity check is implied. Reject later devices without disconnecting the first. The original browser can reconnect using its stored session credential. Rotate an unused pairing link every 420 seconds and invalidate the old link immediately; claiming a link also disables it. High entropy makes guessing impractical.

A service receipt is not an agent acknowledgement. OwnerPager does not claim to restart or resume an agent that has stopped.

A session and its history expire seven days after the last accepted question, answer or acknowledgement. Polling and history reads do not extend that period. Show the expiry, reject late operations explicitly, and remove questions, answers and acknowledgements from active product storage when the session expires.

## Strategic goals

### S1 · Return to completed work, not an unseen question

I can walk away while my agent works, answer its questions from my phone, and return to find it has completed the work rather than spent that time waiting for input I never saw. Future: measure reduction in stops prevented and total time or tokens unblocked as a result.

### S2 · Agents use a helpline instead of bad decisions

When an agent is blocked or unsure whether to take a risky approach, instead of needing to stop or take a big risk, the agent can now easily reach its owner for a quick go/no-go decision. Future: measure a reduction in bad decisions or unnecessary stops.

## Principles

### P1 · Make the usual answer easy and clear

Use plain language I can understand without specialist knowledge. I select one option, then tap Send: an ordinary answer takes two taps. Always offer Other so I can write a freeform response when the choices do not express my intent. Other is the fallback, not the usual path.

### P2 · Keep the first version focused and its foundations explicit

Serve one agent and one phone per session, with at most one unanswered question. Keep past decisions within that session, without a personal inbox spanning agents. Use a Cloudflare Worker at ownerpager.com, one SQLite-backed Durable Object per session, and native Alchemy resource declarations. Use HTTPS commands and polling reads.

### P3 · Agents choose the options; OwnerPager keeps them easy to answer

The agent decides what question to ask, which options to offer and which emoji represents each option. Offer between two and five agent-chosen options, plus Other. Each option has an emoji-only selection button beside a plain-language description. OwnerPager numbers the options so I can refer to them precisely in an Other response, such as “do 1 and then 2.” I choose one option or send Other text; I do not select multiple options.

### P4 · Keep the decision short; make detail optional

Aim for about 100 characters for the question and each option’s description. Either may include an ℹ️ control on the right that toggles about 200 characters of extra detail in smaller text. These are writing guides, not hard limits. Each agent-supplied text field, including detail and acknowledgement text, and my Other response have a hard maximum of 420 Unicode code points. Count spaces and Markdown punctuation; combined emojis may use several code points. Reject invalid encoding and over-limit text without truncation. Use valid UTF-8 text with Markdown formatting; do not allow HTML. The question and option descriptions should usually be enough to decide; opening detail should be optional. These constraints keep the exchange small while leaving the agent free to vary its content.

### P5 · Give the agent everything it needs at one URL

Design ownerpager.com/start to give an agent everything it needs to use OwnerPager:

1. Instructions and API schemas.
2. How to create a session and show me the pairing link.
3. How to submit a question and wait for my answer.
4. How to acknowledge my answer and describe its next steps.

The agent can write its own script or make HTTP requests using its available tools. Using OwnerPager should not depend on a particular agent app or where it runs. We do not need to ship a helper.
