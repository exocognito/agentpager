---
id: C17::get-paged
serves:
  - SC2
statement: When your agent asks, your phone alerts you with the agent's name and its question, even with AgentPager closed, and opening the alert takes you to that decision.
caveats:
  - Apple delivers the alert. The proof shows that the service handed it to Apple and that the phone showed it, not how long delivery takes.
  - A Focus mode lets the alert through only while the owner allows AgentPager's time-sensitive alerts.
  - The question text passes through Apple's push service, and so do the agent's app, project and computer name in the warning of behavior 6.
---

## Behaviors

1. When the owner first pairs, the app asks permission to send alerts.
2. Each new decision alerts the phone as time sensitive. The title is the agent's name and the body is the question. Expanding the alert shows the detail and the recommended option.
3. Opening the alert opens that decision in the app. The owner answers there; the alert has no answer buttons.
4. When the app is in the background, the agent's acknowledgement of an answer also arrives as an alert, carrying the agent's words.
5. The app icon shows how many decisions are waiting.
6. If no agent has read an answer 3 minutes after Send, one more alert says so, naming the agent, its computer and the question, and opening it opens that decision (C5). There is one such alert per answer, and none while the pager is off.
