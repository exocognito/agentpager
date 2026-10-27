---
id: C22::change-or-end-a-pager
serves:
  - SC1
  - SI5
statement: See when a pager ends, move its end to 24 hours, 7 days or 30 days from now, or end it at once; your agent keeps running but can no longer page you.
caveats:
  - No real 24-hour, 7-day or 30-day wait is observed. Ends are proved with local lifetimes (I17).
---

## Behaviors

1. An agent's screen shows the pager's status and when it ends, worded as on its Agents list row (C23). Its menu shows the exact end time. The phone shows the end time the service reports, and shows the pager as ended only when the service says so; it has no countdown or deadline logic of its own.
2. Ends lets the owner choose 24 hours, 7 days or 30 days, counted from now. The new end time shows at once.
3. End Pager asks the owner to confirm. The confirmation says the agent keeps running but can no longer page the owner, and that its decisions stay on the phone, read only, for 24 hours. Confirming ends the pager as you ended it.
4. A pager also ends as agent finished when the agent finishes its work, and as timed out when it reaches its end time.
5. An ended pager's screen says the pager has ended and why. Dogfooding, subject to change: it also shows the phone's own read-only copy of the pager's decisions, unanswered ones included but not answerable, and when that copy is removed (DEC-2026-10-08-ended-pagers-readable).
6. After a pager ends, the agent's next call is refused with the reason, so the agent carries on without the owner or stops, rather than retrying.
