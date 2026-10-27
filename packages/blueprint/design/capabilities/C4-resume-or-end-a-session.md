---
id: C4::resume-or-end-a-session
serves:
  - SC1
  - SI2
  - SI5
statement: Close the tab and come back to the same session later, end it at once from your phone, and keep reading it after your agent finishes.
caveats:
  - Resuming needs the same browser; a cleared or different browser must start a new session, never take over the old one.
  - Nothing is proved about platform backups.
---

Deprecated. Succeeded by C22::change-or-end-a-pager and C23::agents-list: when the agent finishes, its pager ends (SI5), and the owner can move the end time.

## Behaviors

1. The owner closes the tab. Later, in the same browser, the link, the session page or the home screen leads back to the session and its history.
2. The owner ends the session and confirms. From then on both sides are refused, and its cards, answers and acknowledgements are deleted.
3. When the agent finishes, its key is refused. The owner can still read the session but can no longer answer its open cards. An agent that finishes before pairing ends the session instead.
4. The same browser can claim more sessions; each gets its own row on the home screen.
