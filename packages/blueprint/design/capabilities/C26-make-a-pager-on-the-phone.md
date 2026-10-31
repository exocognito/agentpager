---
id: C26::make-a-pager-on-the-phone
serves:
  - SC1
  - SI2
  - SP6
statement: Make a pager on your phone with a name and when it turns off, and copy the text that gives its number to your agents.
caveats:
  - A pager's keys stay in this phone's Keychain, on this device only. Deleting the app, or losing them, loses the pager with no recovery; the owner makes a new one.
  - The copied text works for an agent only once the agentpager command is installed where it runs (C29).
---

## Behaviors

1. The + on Pagers opens New pager, a sheet with Cancel and Create and no grab handle. It asks for a name, which only this phone sees, and when the pager turns off: Never, After 24 hours, After 7 days or After 30 days. Never is the default.
2. The phone makes the pager's id, key pair and number as the sheet opens, so the sheet already shows "Give agents this": the text to give agents, with a copy icon that copies it as one block. A pager on a server other than agentpager.me adds `--server` and its address to the command.

       When I'm away and you need my decision, use agentpager.me MCP or CLI to send me decisions:
       $ agentpager connect ap1_…

3. Create registers the pager with the service: its number, its public key and when it turns off. The service refuses a number whose fingerprint does not name that key (I19). The new pager opens, active and with no decisions yet.
4. If the service refuses the pager, the sheet says why; if the service can't be reached, the sheet says so. Either way, nothing is made.
5. The same text is in the pager's detail at any time (C22). The number shows only there and in New pager, never on the Pagers rows.
6. A phone holds as many pagers as the owner makes, each with its own number, keys and switch.
