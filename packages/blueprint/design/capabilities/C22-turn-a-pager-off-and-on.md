---
id: C22::turn-a-pager-off-and-on
serves:
  - SI2
  - SI5
  - SP1
  - SP6
statement: Turn a pager off and nothing from its agents gets through; turn it on and its open decisions are answerable again. Choose when it turns off by itself, or delete it.
caveats:
  - No real 24-hour, 7-day or 30-day wait is observed. Auto-off is proved with local clocks (I17).
  - Turning a pager off stops its agents reaching the owner, not the agents themselves.
---

## Behaviors

1. A pager's detail opens from the gear on its screen (C23). Its switch, name and auto-off apply as soon as they change. The name lives only on the phone.
2. While a pager is off, every agent call that sends or collects something, and every connect with its number, is refused with "This pager is turned off. Your message was not delivered." Nothing is queued, so nothing arrives when it is turned on again. The agentpager command tells the agent to ask again once the owner turns it on, or to ask for another number.
3. While a pager is off, the phone keeps everything. Its dot is grey and its row reads "Off since 9:40 AM" or "Off since yesterday", its decisions stay readable, and an open decision's bar reads "[name] pager is off" with Turn on (C5). The owner can't answer until it is on.
4. Turning a pager on makes its open decisions answerable again and starts its auto-off again.
5. Auto-off is Never, After 24 hours, After 7 days or After 30 days. It counts from when the pager was last turned on, or from the change if the owner changes it while the pager is on; a choice made while it is off waits for it to be turned on. The row reads "Active · Stays on" or "Active · Turns off in 18h". Auto-off lands in the same off state as the switch, off since the time it was due.
6. Delete pager asks to confirm, saying that its decisions are deleted from this phone and the service, and that agents with its number can't reach the owner. Confirming removes the pager from the phone, and the service deletes its agents with their decisions, attachments, answers and acknowledgements. An agent's next call finds it forgotten, and the number connects nothing.
7. The phone shows the state and the turn-off time the service reports. It never turns a pager off by its own clock.

## Never

1. A pager that is off delivers a decision, an answer or an acknowledgement, or holds one to deliver later.
