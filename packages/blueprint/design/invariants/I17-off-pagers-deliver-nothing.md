---
id: I17::off-pagers-deliver-nothing
serves:
  - SI2
  - SI5
statement: A pager turns off only when its owner turns it off or its auto-off comes due, and on only when its owner turns it on. While it is off, nothing from its agents gets through and nothing is queued, and its phone still reads everything. The service forgets a deleted pager with its agents, and an agent with no activity for 30 days.
caveats:
  - No real 24-hour, 7-day or 30-day wait is observed. Auto-off and housekeeping are proved in real time on a local instance with short local clocks; the deployed build runs the same code with the production clocks.
  - Retention in storage backups is not proved, including Cloudflare's point-in-time recovery.
  - A deleted pager's agents are told to forget at once. One that can't be reached then is tried again every minute, and forgets itself on its next call.
  - The agentpager command's files on the agent's machine, its history among them (C31), stay after a pager is deleted.
---

**What turns a pager off.** Its owner's switch, or its auto-off: never, or 24 hours, 7 days or 30 days after it was last turned on (C22). Auto-off lands in the same off state as the switch, off since the time it was due. Nothing else turns a pager off or on, and no activity puts off its auto-off.

**While it is off.** Every call from its agents that sends or collects something (asking, waiting for an answer, acknowledging, finishing), every connect with its number and every answer from its phone is refused with "This pager is turned off. Your message was not delivered." Nothing is queued: nothing refused arrives later. An agent can still ask whether its pager is on. The phone still reads the pager and every decision with its attachments, and turning the pager on makes the open ones answerable again.

**When it is deleted.** The service deletes the pager, its agents, and their decisions, attachments, answers, acknowledgements and key digests. Its number connects nothing, and its agents' keys are refused as unknown.

**Housekeeping.** An agent with no activity for 30 days is forgotten in the same way, and its pager stops listing it. Activity is asking, the owner's answer, acknowledging and finishing; waiting for an answer is not.

**Breaking this looks like:**
1. a decision, answer or acknowledgement that gets through while its pager is off, or arrives once it is turned on again;
2. a pager that turns off or on by any means but its owner and its auto-off;
3. anything the service can still serve from a deleted pager.
