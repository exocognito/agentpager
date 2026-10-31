# Invariants

Each clause is one checkable statement with one test named by its id, such as `I17.2`. Terms are as in TERMS.md.

## I17 · An off pager delivers nothing

Since MPAGERS.

1. A pager turns off only when its owner turns it off or its auto-off comes due, and turns on only when its owner turns it on. No activity puts off its auto-off.
2. While a pager is off, every call from its agents that sends or collects something (asking, waiting for an answer, acknowledging, finishing), every connect with its number and every answer from its phone is refused with "This pager is turned off. Your message was not delivered."
3. Nothing refused while a pager is off arrives once it is turned on again.
4. While a pager is off, an agent can still ask whether its pager is on, and its phone still reads the pager and every decision with its attachments.
5. When a pager is deleted, the service deletes the pager, its agents, and their decisions, attachments, answers, acknowledgements and key digests. Its number connects nothing, and its agents' keys are refused as unknown.
6. An agent with no activity for 30 days is forgotten the same way, and its pager stops listing it. Activity is asking, the owner's answer, acknowledging and finishing; waiting for an answer is not.

Why: a pager number is an address I give out, so turning a pager off or deleting it has to close it for real.
