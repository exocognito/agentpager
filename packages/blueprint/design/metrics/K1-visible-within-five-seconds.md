---
id: K1::visible-within-five-seconds
serves:
  - SG1
statement: With the app open, a new card reaches the phone within five seconds, and a sent answer reaches a waiting agent within one second, on the recorded target.
caveats:
  - This measures relay latency, not completed work, prevented stops or tokens unblocked; SG1’s outcome remains unmeasured.
  - The result applies only to its recorded target, network and load; five exchanges are a smoke measurement, not a service level.
  - The agent side is the probe's own caller holding an answer read open (the answer wait); an agent that is not waiting sees the answer when it next reads.
  - The answer interval excludes the Undo window: the owner's tap on Send comes up to the Undo window's five seconds ([undoSeconds](../../../ios/AgentPager/Model/AppModel.swift#undoSeconds)) earlier.
  - The app is open and refreshing. Alerts to a closed app are C17's and are not timed here.
staleAfterDays: 7
method: probe
bar: Over 5 sequential exchanges on the recorded target, every card-to-phone interval is at most 5000 ms and every answer-to-agent interval is at most 1000 ms; any error fails.
---

## Probe

For each of 5 exchanges: record the instant the agent's ask response arrives, then the instant the phone's pager screen shows the new decision (the phone polls every 3 seconds, [pollSeconds](../../../ios/AgentPager/Model/AppModel.swift#pollSeconds)); record the instant the service accepts the phone's answer, after the Undo window ([undoSeconds](../../../ios/AgentPager/Model/AppModel.swift#undoSeconds)), then the instant the agent's held answer read returns the answer. Every card-to-phone interval must be at most 5000 ms and every answer-to-agent interval at most 1000 ms. Record the commit, target URL, network, all ten intervals, the phone poll interval and the answer wait used. Run the probe locally, then deployed; only the deployed result decides K1. The phone is the real app in the Simulator, refreshing while open, and the agent a real held-read caller; a timed test service is not a passing result.
