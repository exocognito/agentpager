# Pagers

## C26 · Make a pager on the phone

Since MPAGERS. Make a pager on your phone with a name and when it turns off, and copy the text that gives its number to your agents.

1. The + on Pagers opens New pager, a sheet with Cancel and Create and no grab handle. It asks for a name, which only this phone sees, and when the pager turns off: Never, After 24 hours, After 7 days or After 30 days. Never is the default.
2. The phone makes the pager's id, key pair and number as the sheet opens, so the sheet already shows "Give agents this": the text to give agents, with a copy icon that copies it as one block.
3. On a server other than agentpager.me, the text's command adds `--server` and the server's address.
4. Create registers the pager's number, public key and auto-off with the service. The new pager opens, active and with no decisions.
5. The service refuses a number whose fingerprint does not name the key it is given [I19].
6. If the service refuses the pager, the sheet says why; if it can't be reached, the sheet says so. Either way, nothing is made.
7. The same text is in the pager's detail at any time [C22]. The number shows only there and in New pager, never on the Pagers rows.
8. A phone holds as many pagers as the owner makes, each with its own number, keys and switch.
9. The text works for an agent only once the agentpager command is installed where it runs [C29].

## C22 · Turn a pager off and on

Since MPAGERS. Turn a pager off and nothing from its agents gets through; turn it on and its open decisions are answerable again. Choose when it turns off by itself, or delete it.

1. A pager's detail opens from the gear on its screen [C23]. Its switch, name and auto-off apply as soon as they change. The name lives only on the phone.
2. While a pager is off, every agent call that sends or collects something, and every connect with its number, is refused with "This pager is turned off. Your message was not delivered." [I17]
3. On that refusal, the agentpager command tells the agent to ask again once the owner turns the pager on, or to ask for another number.
4. While a pager is off, its dot is grey, its row reads "Off since 9:40 AM" or "Off since yesterday", and its decisions stay readable.
5. While a pager is off, an open decision's bar reads "[name] pager is off" with Turn on, in place of Send [C5].
6. Turning a pager on makes its open decisions answerable again and starts its auto-off again.
7. Auto-off is Never, After 24 hours, After 7 days or After 30 days. It counts from when the pager was last turned on, or from the change if the owner changes it while the pager is on. A choice made while it is off waits for it to be turned on.
8. An active pager's row reads "Active · Stays on" or "Active · Turns off in 18h".
9. Auto-off lands in the same off state as the switch, off since the time it was due.
10. Delete pager asks to confirm, saying that its decisions are deleted from this phone and the service, and that agents with its number can't reach the owner.
11. Confirming removes the pager from the phone, and the service deletes its agents with their decisions, attachments, answers and acknowledgements [I17]. An agent's next call finds it forgotten, and the number connects nothing.
12. The phone shows the state and turn-off time the service reports. It never turns a pager off by its own clock.
13. Turning a pager off stops its agents reaching the owner, not the agents themselves.

## C23 · Pagers and the pager screen

Since MPAGERS. Open AgentPager to see your pagers, which are on and how many decisions wait on each; open one to see its decisions grouped by project, with who asked.

1. Pagers, the app's first screen, lists this phone's pagers. Each row gives the pager's name, a green dot when it is active or grey when it is off, its status worded as in C22 and, while active, a blue badge with how many decisions are open on it. Rows show no number.
2. With no pagers, Pagers says to make one and give its number to agents. The + button makes a pager [C26].
3. Tapping a pager opens its screen, titled with its name. Its gear opens the pager's detail [C22].
4. A pager's decisions are grouped by project. Projects with open decisions come first, the one waiting longest on top. In each project, open decisions come oldest first, each with its question, who asked and how long ago.
5. Each project folds its answered decisions into an "N answered" row that opens them [C7]. With nothing open in that project, the row also names who asked, such as "5 answered · Codex, pi".
6. While the app is open, its screens refresh about every 3 seconds, and pulling down on a pager refreshes it. A closed app learns nothing until it is opened, except through alerts [C17].
7. The phone lists the pagers whose keys it holds, as the service reports them. The service knows no pager's name. A pager the service says no longer exists is dropped.
8. While the service can't be reached, the phone shows its last read, and Pagers says "Can't Reach Server" with when it last updated.
9. Pagers belong to the server they were made on. With another server set in iOS Settings, the phone shows only the pagers made there.
10. A pager made on another phone never shows on this one.
