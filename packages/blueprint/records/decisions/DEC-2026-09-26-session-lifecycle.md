---
id: DEC-2026-09-26-session-lifecycle
date: 2026-09-26
decidedBy: Sam
basis:
  - SI2
  - SI5
  - C7
losers:
  - a seven-day session (too long for a disposable session whose agent key may sit in a chat transcript)
  - a session that ends when the phone's tab closes (the owner loses the session by closing a tab while away)
  - sessions that only expire (neither side could end one early)
cost: MSTART grows by an end route, an MCP tool, two phone screens and one check. An owner who clears their browser loses the session, as before.
---

On 2026-09-26, after the agent-reach decision, Sam changed three earlier choices:

- Sessions expire 25 hours after the last accepted question, answer or acknowledgement, not seven days. A day's work fits, and a leaked agent key dies within a day of going quiet.
- Closing the tab does not end the session. The same browser resumes it from the front page, the pairing link or the session page. This reverses the direction in the homepage proposals of PR #34, where a web session ended with its tab.
- Either side can end a session at once: the owner with an End session button that asks for confirmation, and the agent with `POST /api/sessions/:sessionId/end` or the `end_session` MCP tool. Ending refuses everything afterwards, says who ended it, and removes the content, as expiry does.

Later on 2026-09-26, Sam decided the case found in run 03: an agent acknowledged and ended the session at once, and ending deleted the history before the phone's next 3-second poll, so the owner never saw the acknowledgement. The ended record keeps the text of the latest acknowledgement, and the phone's ended screen shows it as the agent's last message until 25 hours after the last accepted exchange. The loser was making ending wait until the phone had seen the acknowledgement, which leaves a session half-ended while the owner is away. This replaces the overnight assumed reading, which only told agents in /start not to end straight after acknowledging.

Later: [DEC-2026-09-29-m1-owner-feedback](DEC-2026-09-29-m1-owner-feedback.md) replaced the rolling 25-hour lifetime with a fixed 24 hours from correct pairing; C7 and I6 hold the current lifecycle.
