---
id: J4::longest-pager
for:
  - C26::make-a-pager-on-the-phone
  - C25::connect-with-a-pager-number
  - C23::pagers-and-the-pager-screen
  - C5::review-and-answer-cards
  - C6::send-feedback
  - C7::revisit-decisions
  - C22::turn-a-pager-off-and-on
  - I6::send-and-acknowledgement
  - I17::off-pagers-deliver-nothing
  - I18::independent-cards
  - I21::every-connect-is-a-new-agent
statement: One phone lives through a pager from making it to deleting it, with two agents on one project, a note, turning off and on, a restart and an auto-off, keeping its state throughout.
caveats:
  - Runs locally with a short local auto-off clock. No real 24-hour, 7-day or 30-day wait is observed (I17).
  - Both agents run on one machine. Nothing here carries an agent to another machine (I21).
---

## Steps

On the local product, in real time, with one app install and the agentpager command built from this checkout. Keep all state throughout.

1. **Two agents on one project.**
   - The owner makes a pager that never turns off by itself, and gives its text to two agents working in the same repository.
   - Each connects and gets its own agent id.
   - Each asks a card. The pager shows both under the one project, oldest first, each with who asked.
2. **Answer out of order, with a note.**
   - The owner answers the second agent's card first, with Ask for changes and a note. The owner undoes the send, then sends it again.
   - That agent's wait returns the note word for word, and it acknowledges with what it will do.
   - The first agent's card is still open and unchanged.
3. **Turn off and on.**
   - The owner turns the pager off in its detail.
   - The first agent's wait is refused as off. The second agent asks a new card, which is refused as off and not sent.
   - The first agent's decision stays readable, and its bar reads "[name] pager is off" with Turn on.
   - The owner taps Turn on. The decision is answerable again, and the refused card never arrives.
   - The owner answers it, and the first agent acknowledges.
4. **Survive a restart.**
   - The owner closes and reopens the app.
   - The service is stopped, its exit recorded, and restarted on unchanged storage.
   - The pager, its decisions and both agents are still there, and each agent's next call works with the same id.
5. **Auto-off.**
   - The owner sets the pager to turn off After 24 hours, counted from that change.
   - It comes due on the local clock. Its row reads "Off since" the time it was due, and an agent's next call is refused as off.
   - The owner turns it on again, and its auto-off counts from then.
6. **Revisit.** The owner opens the project's answered decisions and reopens the note's decision. It shows the closed record: the owner's note, then the agent's next steps.
7. **Delete.**
   - The owner deletes the pager from its detail and confirms. It leaves Pagers.
   - Each agent's next call is refused because its pager is gone, and a connect with the number is refused as not in use.
