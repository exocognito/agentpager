---
id: C14::receive-existing-answers-through-the-helper
status: draft
serves:
  - SG1
  - SP6
---

## Statement

For a supported helper-connected session, an answer to its existing decision reaches the originating agent without requiring the model to keep calling a waiting tool; an idle running session can continue and a busy one receives the answer at its next safe turn boundary.

## Behaviors

1. Posting a decision returns after the service accepts it. The helper, rather than a model polling loop, maintains delivery while the agent performs independent work or becomes idle.
2. A committed owner answer is delivered only to the still-authorized session that posted the exact decision. Options and written feedback retain their existing limits and meaning; feedback closes that decision and is not a new-task channel.
3. A busy agent receives the answer at a safe turn boundary. The owner cannot steer its current turn through AgentPager. An idle running agent receives the answer as a continuation of the same session.
4. The owner can distinguish service receipt, helper receipt, queued delivery, uncertain delivery and the agent's own acknowledgement. Only an explicit agent acknowledgement names its next steps and confirms it read the answer.
5. If the helper or runtime is unreachable, the committed answer remains available within the session's lifetime. Reconnection checks authorization, proposal identity, terminal state and delivery outcome before attempting continuation; ambiguity is shown rather than hidden by a potentially duplicate submit.
6. Closing a runtime does not cause the helper to launch another. Pending input can wait for an explicitly supported resume. Unsupported or one-shot invocations are reported and use an explicit held-read path when they can; they are never advertised as automatic continuation.

## Caveats

1. Continued execution requires a supported runtime on an awake, connected host, valid vendor authentication and its normal permission policy. Receiving an answer does not bypass a pending native approval.
2. Acknowledgement is not proof that the agent performed the chosen action. The helper cannot constrain a model's interpretation of feedback merely by delivering it.
3. The adapter's atomicity and idempotency limits remain visible; this is not an exactly-once guarantee for external business actions.
