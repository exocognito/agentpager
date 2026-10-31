---
id: C5::review-and-answer-cards
serves:
  - SC1
  - SI1
  - SI8
  - SP1
  - SP6
  - SP7
  - SP8
statement: Open a decision, read it as one headed page with the detail one tap away, choose an option and press Send, and the agent receives exactly that answer.
caveats:
  - The proof shows the agent received the exact answer and acknowledged it, not that it carried out the chosen action.
  - The phone draws the brief the agentpager command compiled from the agent's card.yaml; it never reads card.yaml itself.
---

## Behaviors

1. A decision opens full screen from its pager (C23) or its alert (C17). The back button names the pager, and the top names who asked, adding "finished" once that agent has finished. The page leads with "Decision:" and the question, and when it was asked.
2. Below come the brief's sections, each under a heading that folds it: Context, Options, Recommendation, Next steps and Small print. Next steps and Small print start folded. Options holds the tradeoffs table, each rated cell tinted from best to worst, and a last row, Read more on options. The recommended option is marked ✶ (SP7).
3. Read more on options opens the Options sheet, one option at a time, chosen with the letters at its top or by swiping. Each option shows its title, what it prioritizes, what it changes, why to choose or pass on it, what it assumes and what it looks like. Seeing an option never chooses it.
4. Images show as thumbnails and open full screen, where they swipe from one to the next. A page the brief links to, such as the context's background page, opens as a sheet, and a page linked from it opens in the same sheet. Only an https link leaves the app. Every sheet has a grab handle, and swiping it down returns to the decision.
5. The answer bar has a tile per option, with its letter and short label. Tapping a tile picks it, and tapping it again unpicks it. With an option picked, the bar offers "Send option A"; with none, it offers Ask for changes (C6). Picking alone never sends (SI1).
6. Send returns to the pager and shows "Sending in 5s" with Undo (I6). Undo reopens the decision with the choice kept. Leaving the app during the Undo window sends the answer at once.
7. The decision moves to its project's answered decisions (C7). Until the agent acknowledges, its row says "Sending…", then "Waiting for Codex…" with the agent's app. If no agent has picked up the answer 3 minutes after Send while the pager is on, the row instead names the agent, its computer and its project and says it may be asleep, closed or disconnected (C17 alerts once). Once an agent picks the answer up, the row goes back to waiting.
8. If the service has not confirmed that it stored the answer after four tries, the phone says Answer Not Confirmed and offers Retry, which sends the same answer, or Cancel, which keeps the choice as a draft. A refusal is never retried: the phone shows what the service holds.
9. While the pager is off, the tiles are greyed and the bar reads "[name] pager is off" with Turn on, in place of Send (C22).
