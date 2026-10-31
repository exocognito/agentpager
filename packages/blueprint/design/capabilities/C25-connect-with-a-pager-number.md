---
id: C25::connect-with-a-pager-number
serves:
  - SC1
  - SI2
  - SP5
statement: Give an agent a pager's number, and it connects with the agentpager command as a new agent on that pager, with nothing for you to tap.
caveats:
  - A number carries the pager's 128-bit random id. Resistance to guessing holds by construction, not by an attack.
  - Who asked is read from the agent's environment or the program that started the command. An agent the command doesn't recognise can name itself with --app, and nothing checks the name.
---

## Behaviors

1. The owner copies a pager's text from the app (C26) and gives it to an agent, for example in AGENTS.md. It names agentpager.me, so an agent without the command can find how to install it (C18).
2. The agent runs `agentpager connect <number>`, or calls the connect tool of the command's MCP server. The number can also come from `AGENTPAGER_PAGER`, so it need not be written where transcripts show it.
3. The command sends the number with who asked, the project and the computer's short name. Who asked is the agent's app. Claude Code and Claude Desktop, once recognised, are named as themselves; any other app is detected unless the agent passes --app. The project is the git repository's name, else the working folder's, unless the agent passes --project.
4. Each connect makes a new agent on the pager, even with the same app and project; nothing matches agents by name. The phone shows its decisions under its project with who asked (C23), and the owner taps nothing to let it in.
5. The reply gives the agent a short id, such as `ap-7f3k`. It says the agent is new on the owner's phone, to use that id for every question in this piece of work, and that connecting again adds another agent. It ends with "Before your first card: agentpager rules" (C27).
6. The agent's key stays in a private file on its machine, under `~/.agentpager/agents/`, and later commands pass only `--agent <id>`.
7. A number whose pager does not exist, or whose fingerprint does not match that pager's key (I19), is refused as not in use. A pager that is off refuses the connect, and the agent is told to ask its owner to turn it on or for another number (C22).
8. Once connected, the agent acts with its own key, and the number plays no further part.

## Never

1. A pager number reads, answers, turns off or deletes anything.
2. A connect to a pager that is off makes an agent.
