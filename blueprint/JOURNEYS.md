# Journeys

End-to-end walks across the areas. Each numbered step is a promise, tested by its id, such as J3.2; bullets are notes. Ids in brackets point to the line a step walks.

### J3 · @M3 · Happy pager: one agent asks and hears back

2. The owner gives the text to an agent. The agent connects with the number through the agentpager command, gets its agent id, and reads the card contract as the reply prompts (B25).
3. The agent writes its `card.yaml`, has it reviewed once by a subagent, fixes what must be fixed, and asks. The reply says the card was sent, with its decision id (B27).

- Areas: 2 Agents (step 2), 3 Cards (3).
- The phone's side, making the pager, answering and the green tick, runs in `FlowTests.testPagerJourney`, with the agent played over HTTP rather than through the command.
- Where: on the local product with its real storage, with one install of the app and the agentpager command built from this checkout.
- One agent on one pager; nothing here proves two agents at once (J4).
- The agent's reviewer judges the card. The journey shows that the review ran, not that it judged well (B27).

### J4 · @M3 · Longest pager: one pager from making to deleting

8. One pager runs from making to deleting with two agents on one project, and every promise its life touches holds along the way: answers in any order (I18), off and on with nothing queued (I17), auto-off (B22), a restart (I24), the closed record (B7) and delete (I17.5).

- Areas: 1 Pagers, 2 Agents, 3 Cards, 5 Answering.
- No test runs it whole. The iPhone UI tests run its parts, with the agent played over HTTP: `FlowTests.testOffAndOn`, `testDeletePager` and `testAnswerSurvivesRelaunch`.
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
