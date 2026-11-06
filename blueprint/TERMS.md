# Terms

The words that mean something specific in this product. They name things; the promises and schemas say how the things behave. The app and the agentpager command use these words, and the verb for a pager is always "turn off", never "disable".

| Term | Meaning |
| --- | --- |
| Owner | The person an agent works for, answering on their phone. |
| Pager | What the owner makes on their phone, as many as they like: for example one for AGENTS.md, one for a throwaway VM, one per shared project. It has a number, and a name that only the phone knows. It is either active or off. |
| Pager number | A pager's address, `ap1_` and 32 more characters, made on the phone from the pager's id and a fingerprint of its public key. Whoever has it can connect agents to the pager while it is on, and can read nothing. |
| Off | A pager the owner switched off, or that turned off by itself. Nothing from its agents gets through and nothing is queued; the phone keeps everything, and turning it on makes open decisions answerable again. |
| Auto-off | When a pager turns off by itself: never, or 24 hours, 7 days or 30 days, counted from when it was last turned on or, if the owner changes it while it is on, from the change. It lands in the same off state as the switch. |
| agentpager | The command agents use, which is both a command line and a local MCP server. It connects to a pager, checks and sends cards, waits for answers and acknowledges them, and keeps each agent's key and history on its machine. |
| Agent | Whatever connected to a pager with its number. Every connect makes a new one. It is shown by who asked, and its decisions are grouped by its project. Once it finishes it asks nothing more. It lasts until its pager is deleted, and is forgotten after 30 days with no activity. |
| Agent id | The short id the command gives an agent when it connects, such as `ap-7f3k`. It is not a secret: helpers on the same machine pass it to ask as that agent. |
| Who asked | The app an agent runs in, such as Claude Code or Codex. The command detects it; an app it doesn't recognise can name itself. |
| Project | What an agent's decisions are grouped under on the phone: the git repository's name, else the working folder's, unless the agent names one. |
| Decision | One question from an agent, with the owner's answer and the agent's acknowledgement. The app calls it a decision. |
| Card | How a decision looks, and what the agent writes: `card.yaml`. Each of its keys lands in one place on the phone: title, detail, context, options with their stories, tradeoffs, recommendation, next steps and attachments. |
| Card contract | The command's rules for writing a card the owner can answer on a phone, with the `card.yaml` template and an example. `agentpager rules` prints it. |
| Detail | A card's one line on what the decision is about, in plain words. The phone's alert shows it under the question. |
| Brief | What the command compiles a card to and sends: the title, the detail, the lettered options and Markdown sections that the phone draws as one headed template. |
| Review | One read of a card before it is sent. `agentpager review` prints the card after a list of what a good card looks like, and a reviewer, usually a subagent, grades each point ok, good to fix or must fix. |
| Option | One way to get the job done that the agent offers, lettered A to D. |
| Recommended | The option the agent marks as its suggestion, shown with ✶. Nothing is chosen for the owner. |
| Feedback | The owner's own words sent in place of an option, from Ask for changes. It is that decision's answer, also called a note. |
| Draft | A choice or note the owner has prepared but not sent. |
| Undo window | The five seconds after Send in which the owner can take an answer back. |
| Answer | What the owner sent for one decision: an option or feedback. |
| Receipt | The service saying it stored an answer. Not an acknowledgement. |
| Not picked up | An answer no agent has read 3 minutes after Send. The owner is told once. |
| Acknowledgement | The agent saying it read an answer, with its next steps. |
| Keys | Each pager has a key pair made on the phone, whose public key the number's fingerprint names, and a phone key the phone acts with. Each agent has an agent key, kept in a private file on its machine, so the agent passes only its id. The service stores phone and agent keys only as digests. |
| History | The command's record, on the agent's machine, of every decision asked from it on a pager, with its answer and acknowledgement. |
| Pagers, Pager, Pager detail, New pager | The app's screens: the list of this phone's pagers; one pager's decisions, grouped by project; one pager's switch, name, auto-off, the text to give agents, and Delete; and the sheet that names a new pager, shows its text and creates it. |
