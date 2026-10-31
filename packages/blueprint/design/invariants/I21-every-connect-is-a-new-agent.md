---
id: I21::every-connect-is-a-new-agent
serves:
  - SC1
  - SI2
statement: Every connect makes a new agent on its pager, with its own id and key. Nothing matches agents by name, so two with the same app and project stay apart, and only callers that pass the same agent id act as one agent.
caveats:
  - Sharing an id works only on the machine that holds the agent's key file. Nothing carries an agent to another machine.
  - A connect whose reply is lost may leave an agent on the pager that no one can use; the agentpager command says so.
---

The service gives each connect a new agent id and key, and its pager lists the agent with who asked and its project. An agent's key acts only on that agent's own decisions. The agentpager command gives each connect a new short id on its machine. Helpers on the same machine that pass that id, as `agentpager share` tells them to, ask as that agent, and each waits for the answers to its own decisions.

**Breaking this looks like:**
1. a connect that joins an agent already on the pager;
2. two agents treated as one because they share a name or a project;
3. one agent's key reading, answering or acknowledging another agent's decisions.
