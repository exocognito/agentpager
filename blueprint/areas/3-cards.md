# 3 Cards

> **Definition:** What an agent writes and sends: the card in `card.yaml`, the card contract it is written by, the one review before sending, the checks that refuse a broken card, and the limits every decision and answer must meet. Connecting, waiting and acknowledging belong to 2 Agents, and how the phone shows and answers a decision to 5 Answering.
> **Serves:** [Unblock my agent from my phone](../PRODUCT.md#unblock-my-agent-from-my-phone) · [A decision is reviewed before it's sent](../PRODUCT.md#a-decision-is-reviewed-before-its-sent) · [UTF-8 with Markdown is allowed; invalid or over-limit text is refused, never truncated](../PRODUCT.md#utf-8-with-markdown-is-allowed-invalid-or-over-limit-text-is-refused-never-truncated) · [Pinned design decisions](../PRODUCT.md#pinned-design-decisions)
> **Relies on:** the agent's own app, which starts the reviewer as a subagent; an agent whose app can't start one reviews its card itself
> **Code:** `packages/cli/src/rules.ts` (the card contract, the review list, the template and the example); `packages/cli/src/card.ts` (the checks and the compile); `packages/cli/src/commands.ts`, `packages/cli/src/mcp.ts` (rules, review and ask); `packages/contract/` (`values.ts`, `brief.ts`, `exchange.ts`: what the service, the command and the phone accept); `packages/app/src/shared.ts`, `packages/app/src/agent.ts` (the service's checks)
> **Screens:** [journeys/briefs](../generated/screens/journeys/briefs/README.md)
> **Walked by:** J3, J4, J5

## Behaviors

### B27 · @M3 · Review a card before sending

1. The agentpager command is the one home of the card contract: how to write a decision the owner can answer on a phone in two minutes. `agentpager rules` prints it with the `card.yaml` template and a complete example. Connecting prompts the agent to read it before its first card (B25).
2. An agent that uses the command's MCP server has the card contract in the ask tool's description.
3. `agentpager review`, or the review tool, prints what a good card looks like and then the card, for a reviewer to grade each point ok, good to fix or must fix for this card, quoting the text to change. When a point falls short only because a small card leaves out an optional key, it is good to fix at most. The command grades nothing itself.
4. The card contract tells the writing agent to give that to a subagent, or to review the card itself if it can't start one, then to fix the must-fixes, use its judgement on the rest and send. There is one round.
<!-- B27.5 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
6. A card that passes is compiled to the brief and sent. The reply says it was sent, shows the question and detail as the owner sees them first, and says how to wait for the answer (B32).
7. The service refuses a new card from an agent that already has too many unanswered decisions, and the agent is told to wait for answers before asking more.
8. When the agent last saw the card contract more than 2 hours ago, or this is its fifth card since, the ask reply ends with the contract's short version. The command keeps that count on the agent's machine, not in the agent's memory.
9. @M5: When an ask's reply is lost and the agent asks again, the owner gets one decision, not two.

- Over MCP, a card is the same structure as `card.yaml`, as an object, with its attachments inline.
- While the pager is off, every card is refused and nothing is queued (I17).
- Connecting, reading the rules as that agent, and each reminder start the reminder's count again.

## Invariants

### I4 · @M1 · What doesn't fit is refused whole, never cut

Why: [UTF-8 with Markdown is allowed; invalid or over-limit text is refused, never truncated](../PRODUCT.md#utf-8-with-markdown-is-allowed-invalid-or-over-limit-text-is-refused-never-truncated)

1. The service checks what it can still read of every request, from an agent or the phone: ids, sizes, counts and its own fields. It refuses whole what doesn't fit, and a refused request stores nothing.
2. A refusal says what to fix: what is wrong, and the field when there is one.
3. Limits count visible characters, spaces and Markdown punctuation included, so a combined emoji counts as one.
4. Every text an agent or the phone sends has a limit. A question's title holds at most 100 visible characters, its detail and an acknowledgement at most 280, and a note at most 1,000. Each option's label, title and what it prioritizes, the brief and each page have their own. A decision's attachments are PNG or JPEG images and Markdown pages, with limits on how many and how big.
5. Text may use `<` and `>` as plain characters: what is refused is HTML. In a brief or its pages, HTML inside code is allowed, and it shows as text and is never rendered.
6. A request with a wrong key is refused as unauthorized, even when its input is also invalid.
7. The service stores exactly what it accepts.
8. @M3: Compiling `card.yaml`, the command trims the spaces around each value and joins a prose paragraph's wrapped lines so the phone can reflow them. It changes nothing else, and holds the result to these same checks before it leaves the machine (I22).
9. @M5: Text the service can't read is checked by the command before it leaves the agent's machine (I22), and by the phone when it reads it. A decision that fails the phone's check shows as one it can't read, never in part.

- A list row or an alert may shorten a long question to fit. Opening the decision shows all of it.
- The size of every other limit is in the schemas, `packages/contract/`, which the service and the command share.

### I22 · @M3 · A broken card is never sent

Why: [A decision is reviewed before it's sent](../PRODUCT.md#a-decision-is-reviewed-before-its-sent)

1. The agentpager command refuses a broken card before anything leaves the agent's machine, with one line per problem, and sends nothing.
2. Broken covers only what can be checked without judging the writing. A card is broken when it doesn't parse, misses a required key or has an unknown one, or doesn't have two to four options.
3. A card is broken when a field holds what would become structure on the phone: a line break in a one-line field, or a heading, table or HTML in its prose.
<!-- I22.4 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
5. A card is broken when an image or page it names isn't attached, or anything is over its limit (I4).
6. The command also holds the brief it compiles to the service's own checks (I4), so nothing the service would refuse leaves the machine.
7. A card is never refused or held for how it is written, and never cut or changed to fit a limit.

- The service refuses whole whatever breaks its own checks (I4), but it doesn't check that one-line fields are on one line.
- An agent that calls the service directly skips the command's checks, and then only the phone's check stands between it and the owner (I4.9).

## Limits

### L16 · @M3 · Nothing makes an agent review its card

- What people meet: an agent can ask without running the review, or send a card its reviewer marked must fix. The owner then gets a card that is hard to answer, such as one whose options include "revise" or "discuss", and can only ask for changes (B6).
- Why it waits: on 29 Oct Sam chose judgement over checks on prose. Such checks are too hard to get right, and a loop of refusals would make the command slow and wasteful, so the writing is judged by a reviewer the agent starts, never by the command (B27).
- What would fix it: a check in the command for the failure that matters most, a padded option, built once real reviews show they miss it.
- When to revisit: when reviews are seen to miss padded options in practice.
