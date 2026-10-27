---
id: I17::ended-pagers-refuse-and-forget
serves:
  - SI5
statement: A pager nobody pairs ends 15 minutes after it was made. A paired pager ends at its end time, which only the owner moves, or when the owner ends it or the agent finishes. After it ends, every call is refused with the reason, except that its own phone and agent can still read its agent name, end reason, end time and the agent's last acknowledgement for 7 days, though the phone drops its copy 24 hours after the end (dogfooding). Its cards and link are gone from storage; only those facts and the digests of its keys remain.
caveats:
  - No real 24-hour, 7-day or 30-day wait is observed. Ends are proved in real time on a local instance with local lifetimes. The deployed build runs the same code with the production lifetimes, and the deployed proof shows only that it does not use the local ones.
  - Retention in storage backups is not proved, including Cloudflare's point-in-time recovery.
  - The end is checked live 5 seconds before it and refused from 2 seconds after it; the exact boundary second is not proved.
  - Not built yet: the service does not keep the last acknowledgement after the end (DEC-2026-10-27-pr1-sign-off).
---

**When the clock starts.** Pairing starts the end time: 24 hours, unless the link set 7 or 30 days. Choosing Ends sets it again, counted from now. Nothing else moves it, and no activity extends it.

**Every way a pager ends.** A pager ends when it times out, when the owner ends it, when the agent finishes, or when pairing fails. In each case:
- every call by either side is refused with that reason, except reading the agent name, end reason, end time and last acknowledgement with the pager's own key;
- storage holds no cards, answers or link, and no acknowledgement but the last, even after the service restarts;
- the link registry forgets the link, and the pager clears its copy; both also happen when the pairing window closes, whether or not the pager paired.

**After 7 days.** The service forgets the pager entirely. Dogfooding, subject to change: the phone drops the row, and its own read-only copy of the decisions, 24 hours after the end (DEC-2026-10-08-ended-pagers-readable).

**Breaking this looks like:**
- activity keeping a pager alive;
- an ended pager that still accepts calls;
- a card the service can still serve after its pager ended.
