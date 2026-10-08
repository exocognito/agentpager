---
id: DEC-2026-10-01-home-screen
date: 2026-10-01
decidedBy: Sam
basis:
  - Sam's review of the MCARDS v1 statechart canvas, asking for the AgentPager home screen from the closed PR #71
---

# A home screen that lists this browser's sessions

MCARDS had no home screen: `/` reopened the one stored session's queue. Sam wants the home screen PR #71 designed, with the AgentPager brand bar and the + button, showing only this browser's sessions until accounts exist. He answered four questions:

1. + opens Connect an agent: the line to give an agent, with Copy, and a field for a pasted pairing link. A claimed session joins the list, so one browser can hold several sessions.
2. The agent names the session when it creates it (`SessionInput.name`); the row and the session page show that name.
3. Ended and expired sessions keep a local label (name, final state, when) under Ended, so the full list works when accounts arrive.
4. `/` shows the home screen once this browser holds a session, and the front page otherwise.

The service gains no route: the phone reads each live session with its own phone key. C12 and E29 are new; C5, C7, E14, entrypoints, SI2 and MCARDS changed to match. Sam then added the reverse way in: from +, the owner makes a private invite link and gives it to one agent (C13, E30). The phone creates the session and holds it; the first agent to claim the link joins with its name; the emoji handshake stays, as a confirmation consistent with the agent-first path. A later claim is refused, and the phone cannot pair before an agent joins.
