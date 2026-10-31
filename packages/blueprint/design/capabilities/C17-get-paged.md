---
id: C17::get-paged
serves:
  - SC2
statement: When your agent asks, your phone alerts you with who asked, the project and the question, even with AgentPager closed, and opening the alert takes you to that decision.
caveats:
  - Apple delivers the alert. The proof shows that the service handed it to Apple and that the phone showed it, not how long delivery takes.
  - A Focus mode lets the alert through only while the owner allows AgentPager's time-sensitive alerts.
  - Until the encryption work, the question, its detail and the recommended option pass through Apple's push service as text, and so do who asked, the project and the computer's name in the warning of behaviour 6.
  - Alerts need the deployed service. A local server keeps the phone's device token, but its alerts fail.
---

## Behaviors

1. Once the phone holds a pager, the app asks once for permission to send alerts, and gives its device token to each of its pagers.
2. Each new decision alerts the phone as time sensitive. The title is who asked and the project, such as "Codex · atomic-pages", and the body is the question. Expanding the alert shows the detail and the recommended option.
3. Opening the alert opens that decision (C5). The owner answers there; the alert has no answer buttons.
4. An acknowledgement also alerts, carrying the agent's words. With the app open, only a decision or a warning on a pager that is not on screen shows a banner; the screens update by themselves.
5. The app icon shows how many decisions are waiting on pagers that are on.
6. If no agent has picked up an answer 3 minutes after Send, one more alert says so, naming who asked, its computer, its project and the question, and opening it opens that decision. The decision says so too (C5). There is one such alert per answer, and none if the pager is off at that moment.
7. Nothing alerts while a pager is off: its agents can send nothing.
8. An alert that Apple can't deliver within 24 hours is dropped.
9. *Not built yet: comes with the encryption work.* The alert travels encrypted, and an extension on the phone decrypts it to show the real question (C30).
