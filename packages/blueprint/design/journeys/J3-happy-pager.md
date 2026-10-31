---
id: J3::happy-pager
for:
  - C26::make-a-pager-on-the-phone
  - C25::connect-with-a-pager-number
  - C27::review-a-card-before-sending
  - C23::pagers-and-the-pager-screen
  - C5::review-and-answer-cards
  - C7::revisit-decisions
  - I6::send-and-acknowledgement
statement: The owner makes a pager and gives an agent its text; the agent connects, has its card reviewed and asks, and the owner's answer reaches it and is acknowledged.
caveats:
  - One agent on one pager; nothing here proves two agents at once (J4).
  - The agent's reviewer judges the card. The journey shows that the review ran, not that it judged well (C27).
---

## Steps

On the local product with its real persistent storage, with one app install and the agentpager command built from this checkout:

1. The owner taps + on Pagers, names the pager, copies Give agents this and taps Create. The pager opens, active and with no decisions.
2. The owner gives the text to an agent. The agent runs `agentpager connect` with the number, gets its agent id, and reads `agentpager rules` as the reply prompts.
3. The agent writes `card.yaml`, runs `agentpager review` on it and gives the output to a subagent. It fixes what must be fixed and asks with `agentpager ask`. The reply is "Sent." with a decision id.
4. The decision shows on the pager under the agent's project, with who asked. The owner opens it, picks an option and presses Send, and the Undo window passes.
5. The agent's `agentpager wait` returns that option, and the agent acknowledges with its next steps. In the project's answered decisions, the row waits for the agent, then shows the green tick.
