---
id: J4::longest-pager
for:
  - C2::agent-starts-from-one-url
  - C20::connect-with-an-agentpager-link
  - C21::pair-by-entering-the-agents-code
  - C22::change-or-end-a-pager
  - C5::review-and-answer-cards
  - C6::send-feedback
  - C7::revisit-decisions
  - C23::agents-list
  - I18::independent-cards
  - I6::send-and-acknowledgement
  - I16::one-agent-one-phone
  - I17::ended-pagers-refuse-and-forget
statement: One phone lives through a pager its own link made, a restart, an end-time change and every way a pager ends, keeping its state throughout.
caveats:
  - Runs locally with local lifetimes; the deployed lifetimes are D1's to show.
---

## Steps

On the local product, in real time, with one app install. Keep all state throughout.

1. **Pair from the phone's link.**
   - The phone makes a link and an agent joins it. A second agent's join is refused.
   - The owner enters a wrong code twice, then the right one.
2. **Answer out of order.**
   - The agent asks three cards.
   - The owner answers the third, then the second by asking for changes. The owner undoes one send, then sends again.
   - The agent acknowledges the second card, then the third.
   - The owner reopens the second card and reads the conversation.
   - The owner returns to the Agents list and reopens the agent.
3. **Survive a restart.**
   - The owner closes and reopens the app.
   - The service is stopped, its exit recorded, and restarted on unchanged storage.
   - The pager and its history are still there.
4. **Time out.**
   - The owner changes the pager's end.
   - The pager crosses its end, and the agent's next call is refused as timed out.
   - The ended row shows why.
5. **Every other ending.**
   - From an agent's link, three wrong codes end a second pager as pairing failed.
   - A third pager pairs, then its agent finishes, and the ended row says so.
   - A fourth pager pairs, and the owner ends it. The agent's next call is refused with that reason, and the ended row says so.
6. **Forget.** The ended-record lifetime passes, and the ended rows disappear.
