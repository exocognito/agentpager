# 4 Getting paged

> **Definition:** How a decision gets the owner's attention: alerts while AgentPager is closed, opening an alert to its decision, the app icon's badge, the one alert when no agent picks up an answer, and how the app shows a new decision while it is open. Reading and answering the decision belongs to 5 Answering.
> **Serves:** [What it's for](../PRODUCT.md#what-its-for) · [Get paged when my agent needs me](../PRODUCT.md#get-paged-when-my-agent-needs-me) · [Return to completed work, not an unseen question](../PRODUCT.md#return-to-completed-work-not-an-unseen-question)
> **Relies on:** Apple's push service (APNs), through Sam's paid Apple Developer Program team and its push key · the iPhone's own notification settings, where the owner allows AgentPager's alerts and its time-sensitive alerts
> **Code:** `packages/contract/alerts.ts` (what an alert carries and the words it shows); `packages/app/src/push.ts`, `agent.ts`, `registry.ts`; `packages/ios/AgentPagerNotifications/NotificationService.swift` (the alert extension), `packages/ios/AgentPagerCrypto` (`Alerts.swift`); `packages/ios/AgentPager/Model/Alerts.swift`, `AppModel.swift`
> **Screens:** none
> **Walked by:** J5

## Behaviors

### B17 · @M1 · Get paged

1. Once the phone has a pager (B26), the app asks once whether it may send alerts. Each pager on the phone then alerts it, even with AgentPager closed.
2. Each new decision alerts the phone. The alert's title names who asked and the project, and its body is the question. Expanding the alert shows the detail and the recommended option.
3. A decision's alert is time sensitive, so it gets through a Focus mode while the owner allows AgentPager's time-sensitive alerts.
4. Opening the alert opens that decision (B5). The owner answers there; the alert has no answer buttons.
5. An acknowledgement alerts too, with the agent's words.
<!-- B17.6 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
7. The app icon's badge shows how many decisions are waiting.
8. @M3: If no agent has picked up an answer 3 minutes after Send, one more alert says so. It names who asked, its computer, its project and the question, and opening it opens that decision, which says so too (B5). There is one such alert per answer, and none if the pager is off at that moment. With the app open, it shows as a banner unless its pager is on screen.
11. @M5: No alert's words reach Apple's push service as text. When the phone can't read an alert, it still arrives, saying only that there is a new decision, an acknowledgement or an answer not picked up.

- Apple delivers each alert. How long that takes is Apple's, and nothing here measures it.
- How soon a new decision shows while the app is open is K1, which FRIENDS measures.
