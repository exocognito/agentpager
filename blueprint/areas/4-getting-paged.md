# 4 Getting paged

> **Definition:** How a decision gets the owner's attention: alerts while AgentPager is closed, opening an alert to its decision, the app icon's badge, the one alert when no agent picks up an answer, and how the app shows a new decision while it is open. Reading and answering the decision belongs to 5 Answering.
> **Serves:** "It is an app on my phone that pages me when an agent needs me, the way a pager would." · "When my agent asks, my phone alerts me with who asked, the project and the question, even when AgentPager is closed and, if I let its alerts through, a Focus mode is on." · "Opening the alert takes me to that decision." · "If no agent picks up my answer within 3 minutes, I'm told once, by an alert and on the decision." · "I can walk away while my agent works and come back to finished work, not a question I never saw."
> **Relies on:** Apple's push service (APNs), through Sam's paid Apple Developer Program team and its push key · the iPhone's own notification settings, where the owner allows AgentPager's alerts and its time-sensitive alerts
> **Code:** `packages/app/src/push.ts`, `agent.ts`, `registry.ts`; `packages/ios/AgentPager/Model/Alerts.swift`, `AppModel.swift`
> **Screens:** none
> **Walked by:** J5

## Behaviors

### B17 · @M1 · Get paged

1. Once the phone has a pager (B26), the app asks once whether it may send alerts. Each pager on the phone then alerts it, even with AgentPager closed.
2. Each new decision alerts the phone. The alert's title names who asked and the project, and its body is the question. Expanding the alert shows the detail and the recommended option.
3. A decision's alert is time sensitive, so it gets through a Focus mode while the owner allows AgentPager's time-sensitive alerts.
4. Opening the alert opens that decision (B5). The owner answers there; the alert has no answer buttons.
5. An acknowledgement alerts too, with the agent's words.
6. With the app open, the screens update by themselves. Only a new decision on a pager that isn't on screen shows a banner.
7. The app icon's badge shows how many decisions are waiting.
8. @M3: If no agent has picked up an answer 3 minutes after Send, one more alert says so. It names who asked, its computer, its project and the question, and opening it opens that decision, which says so too (B5). There is one such alert per answer, and none if the pager is off at that moment. With the app open, it shows as a banner unless its pager is on screen.
9. @M2: While a pager is off, nothing on it alerts, since its agents can send nothing (I17), and its waiting decisions leave the badge.
10. @M2: An alert that Apple can't deliver within 24 hours is dropped.

- Apple delivers each alert. How long that takes is Apple's, and nothing here measures it.
- How soon a new decision shows while the app is open is K1, which FRIENDS measures.

## Limits

### L17 · @M1 · Alerts pass through Apple as plain text

- What people meet: Apple's push service carries every alert's words as text. That is who asked and the project in the title, and in the body the question, its detail and the recommended option, the agent's acknowledgement, or the not-picked-up alert with the computer's name.
- Why it waits: encryption is its own milestone, ENCRYPT, and "Encryption comes before the friends rollout."
- What would fix it: alerts that travel encrypted, which the phone decrypts to show the real question.
- When to revisit: ENCRYPT, which runs right after M4.
