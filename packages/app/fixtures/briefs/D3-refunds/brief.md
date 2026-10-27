## Context: refunds wait 9 hours
The support bot hands every refund request to a person. 120 a week wait about 9 hours, and refund complaints doubled this month.

[Read more background](background.md)

## Options

::::option A
### What a customer sees with A
:::chat
customer: My mug arrived broken. Can I get a refund?
Shop support bot: Sorry about that! I’ve passed this to our team. You’ll hear back within an hour.
:::
### What A changes
```diff support/refunds.md
  ## Refunds
  - Never promise a refund.
- - Hand every refund to a person.
- - Say we reply within a day.
+ - Page on-call for every refund.
+ - Say we reply within an hour.
```
### Why choose A
- No wrong refunds: a person still approves every one.
### Why pass on A
- It costs the team 10 hours a week, and customers still wait about an hour.
### Assumptions A makes
- On-call can answer every refund within the hour.
::::

::::option B
### What a customer sees with B
:::chat
customer: My mug arrived broken. Can I get a refund?
Shop support bot: Sorry about that! I’ve refunded $18 to your card. It should show up in 3–5 days.
:::
### What B changes
```diff support/refunds.md
  ## Refunds
- - Never promise a refund.
+ - Refund orders under $50 at once
+   if they arrived broken or late.
- - Hand every refund to a person.
+ - Hand the rest to a person.
  - Say we reply within a day.
```
### Why choose B
- Customers get small refunds in seconds, and the team saves 8 hours a week.
### Why pass on B
- About $300 a month goes out in wrong refunds.
### Assumptions B makes
- Under 5% of small requests are abuse (2% last quarter).
::::

::::option C
### What a customer sees with C
:::chat
customer: My mug arrived broken. Can I get a refund?
Shop support bot: Sorry about that! I can add $19.80 in store credit right now, or ask our team about a refund. Which would you like?
:::
### What C changes
```diff support/refunds.md
  ## Refunds
  - Never promise a refund.
+ - First offer store credit worth
+   110% of the order.
- - Hand every refund to a person.
+ - If they say no, hand it to a person.
  - Say we reply within a day.
```
### Why choose C
- It keeps revenue, and customers who take credit are done in seconds.
### Why pass on C
- Customers who say no still wait about 9 hours.
### Assumptions C makes
- Most customers will take credit worth 110% instead of a refund.
::::

## Tradeoffs
|                | A Person              | B Bot                   | C Credit                 |
|----------------|-----------------------|-------------------------|--------------------------|
| Customer waits | :yellow[~1 h]         | :green[Seconds]         | :yellow[Seconds, or 9 h] |
| Wrong refunds  | :green[None]          | :yellow[~$300 a month]  | :green[None]             |
| Team time      | :red[10 h a week]     | :green[2 h a week]      | :yellow[6 h a week]      |

## Recommendation: B
**Why:** Most requests are small and genuine, and the wait is what customers complain about.
**Assumes:** Under 5% of small requests are abuse (2% last quarter). If abuse rises, pick C.

## Next steps: ship the new rules
**After this decision:** I update refunds.md and report refunds and complaints daily for a week.
**If no decision:** Every refund keeps waiting about 9 hours for a person.

:::smallprint
- Refunds over $50 still go to a person in every option.
- Ruled out: refunding everything automatically. Too easy to abuse.
:::
