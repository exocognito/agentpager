---
id: C27::review-a-card-before-sending
serves:
  - SI11
  - SG2
  - SP1
  - SP8
statement: Before an agent sends a decision, the agentpager command gives it the card and a description of a good card to have reviewed once, and refuses only a card that is broken in structure, with one line per problem.
caveats:
  - The review is judgement, by a reviewer the writing agent starts. The command judges nothing, and nothing proves that the agent ran the review or followed it.
  - An agent that calls the service directly skips the command's checks. The service still refuses what does not fit the contract (I4).
---

## Behaviors

1. The command carries the card contract: twelve points on writing a decision the owner can answer on a phone in two minutes. `agentpager rules` prints it with the `card.yaml` template and an example, and every connect ends by prompting the agent to read it. An agent that uses the command's MCP server has the contract in the ask tool's description.
2. `agentpager review card.yaml`, or the review tool, prints what a good card looks like, as twelve points, then the card. It asks a reviewer to grade each point ok, good to fix or must fix for this card, quoting the text to change. The writing agent gives it to a subagent, or reviews the card itself if it can't start one, fixes the must-fixes, uses its judgement on the rest, and sends. There is one round.
3. `agentpager ask` checks only what is certain, before anything leaves the machine: the card parses; it has its required keys and no unknown ones; it has two to four options; its one-line fields are on one line; its prose has no headings, tables or HTML; every image and page it names is attached; and it is within SI6's limits. The brief it compiles to must also pass the service's own checks. Each problem is one line, and nothing is sent.
4. A card that passes is compiled to the brief and sent. The reply is "Sent.", the question and detail as the owner sees them, the decision's short id, such as `d_2x8w`, and how to wait for the answer in the agent's own app.
5. The service refuses an eleventh open decision from one agent, saying that the owner already has 10 unanswered, and anything while the pager is off (C22).
6. When more than 2 hours or 5 cards have passed since the agent last read the contract, the ask reply ends with its short version.

## Never

1. `ask` refuses or holds a card for how it is written.
