---
id: C31::history-on-the-agents-machine
serves:
  - SC1
  - SG2
statement: The agentpager command keeps a history of the decisions asked from its machine on each pager, with their answers, and shows it only when an agent asks for it.
caveats:
  - The history holds only what this machine asked. Agents on other machines, on the same pager, keep their own.
  - An answer is recorded when an agent on this machine receives it; one never collected here is not in the history.
  - Deleting a pager leaves its history file on the machine.
---

## Behaviors

1. The command appends every decision it asks, each answer its wait receives and each acknowledgement it sends to `~/.agentpager/history/<pager>.jsonl`, one file per pager, readable only by the machine's user. `AGENTPAGER_HOME` moves it.
2. `agentpager history --agent <id>`, or the history tool, prints the decisions this machine asked on that agent's pager, newest first: when, who asked, the project, the question, the options and what was chosen, and the next steps. It shows 20 unless asked for more.
3. Nothing from the history is printed unasked or sent to the service.
4. Each file keeps its latest 1,000 lines; older ones are dropped.
