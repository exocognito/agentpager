# Journeys

End-to-end walks across the areas. Each numbered step is a promise, tested by its id, such as J4.3; bullets are notes. Ids in brackets point to the line a step walks.

### J3 · @M3 · Happy pager: one agent asks and hears back

1. The owner makes a pager from Pagers, names it and copies the text to give agents. The pager opens, active and with no decisions (B26).
2. The owner gives the text to an agent. The agent connects with the number through the agentpager command, gets its agent id, and reads the card contract as the reply prompts (B25).
3. The agent writes its `card.yaml`, has it reviewed once by a subagent, fixes what must be fixed, and asks. The reply says the card was sent, with its decision id (B27).
4. The decision shows on the pager under the agent's project, with who asked (B23). The owner opens it, picks an option and presses Send, and the Undo window passes (B5).
5. The agent's wait returns that option, and the agent acknowledges with its next steps (B32). In the project's answered decisions, the row waits for the agent, then shows the green tick (I6).

- Areas: 1 Pagers (steps 1, 4), 2 Agents (2, 5), 3 Cards (3), 5 Answering (4, 5).
- Where: on the local product with its real storage, with one install of the app and the agentpager command built from this checkout.
- One agent on one pager; nothing here proves two agents at once (J4).
- The agent's reviewer judges the card. The journey shows that the review ran, not that it judged well (B27).

### J4 · @M3 · Longest pager: one pager from making to deleting

1. **Two agents on one project.** The owner makes a pager that never turns off by itself, and gives its text to two agents working in the same repository. Each connects and gets its own agent id (I21). Each asks a card, and the pager shows both under the one project, oldest first, each with who asked (B23).
2. **Answer out of order, with a note.** The owner answers the second agent's card first, with Ask for changes and a note, undoes the send, then sends it again (B6, I6). That agent's wait returns the note word for word, and it acknowledges with what it will do. The first agent's card is still open and unchanged (I18).
3. **Turn off and on.** The owner turns the pager off in its detail (B22). The first agent's wait is refused as off. The second agent asks a new card, which is refused as off and not sent (I17). The first agent's decision stays readable, and in place of the answer bar it says its pager is off, with Turn on. The owner turns it on: the decision is answerable again, and the refused card never arrives. The owner answers it, and the first agent acknowledges.
4. **Survive a restart.** The owner closes and reopens the app. The service is stopped and restarted on unchanged storage. The pager, its decisions and both agents are still there, and each agent's next call works with the same id.
5. **Auto-off.** The owner sets the pager to turn off after 24 hours, counted from that change. When it comes due, its row says it has been off since the time it was due, and an agent's next call is refused as off (B22). The owner turns it on again, and its auto-off counts from then.
6. **Revisit.** The owner opens the project's answered decisions and reopens the note's decision. It shows the closed record: the owner's note, then the agent's next steps (B7, I5).
7. **Delete.** The owner deletes the pager from its detail and confirms, and it leaves Pagers. Each agent's next call is refused as from an unknown agent (I17.5), and a connect with the number is refused as not in use (I17, B25).

- Areas: 1 Pagers (steps 1, 3, 5, 7), 2 Agents (1, 2, 3, 4, 7), 3 Cards (3), 5 Answering (2, 3, 6), 6 Privacy (4).
- Where: on the local product, in real time, with one install of the app and the agentpager command built from this checkout. All state is kept throughout.
- A short local clock stands in for 24 hours. No real 24-hour, 7-day or 30-day wait is observed (I17).
- Both agents run on one machine. Nothing here carries an agent to another machine (I21).

### J5 · @M3 · Paged while away, answer and hear back

1. The owner makes a pager. The app asks once to send alerts, and the owner allows them (B26, B17).
2. The owner gives the pager's text to an agent that has the agentpager command, and the agent connects (B25).
3. The owner leaves the app. The agent asks a decision, and an alert arrives titled with who asked and the project, with the question as its body (B17).
4. Expanding the alert shows the decision's detail and the recommended option.
5. Opening the alert opens that decision. The owner answers and sends (B5).
6. The agent's wait returns the owner's answer (B32).
7. The owner leaves the app again. The agent acknowledges, and the acknowledgement arrives as an alert with the agent's words (B17).
8. The app icon's badge clears.

- Areas: 1 Pagers (step 1), 2 Agents (2, 6, 7), 3 Cards (3), 4 Getting paged (1, 3, 4, 5, 7, 8), 5 Answering (5).
- Where: on the deployed product, with the app on a real iPhone, installed from Xcode (L24).
- A new owner needn't open AgentPager first: the alert takes them straight to the decision.
- Alerts need the deployed service and Apple's push service. Delivery time is Apple's and is not measured.
