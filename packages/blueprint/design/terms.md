# Terms

The words that mean something specific in this product. They name things; the promises and schemas say how the things behave.

| Term | Meaning |
| --- | --- |
| Owner | The person an agent works for, answering on their phone. |
| Agent | The AI program that asks. It reaches the service over HTTPS or MCP. |
| Start page | The one page at `/start` that tells an agent everything it needs. |
| Session | One agent and one phone, paired, exchanging cards until it ends or expires. |
| Finished | The agent is done with a session: it can ask nothing more, and the owner can still read everything until they end the session or it expires. |
| Session name | What the agent calls the session, so the owner can tell sessions apart. |
| Pairing link | The one-use link, also shown as a QR code, that the agent gives the owner to open the session on a phone. |
| Pairing card | The first card of every session: choose the emoji the agent named. |
| Target emoji | The one emoji on the pairing card that pairs the phone. Only the agent is told it. |
| Card | One question from the agent, with the options the agent wrote. |
| Option | One action the agent offers on a card. |
| Brief | A card the agent writes as Markdown sections (Context, Options, Tradeoffs, Recommendation, Next steps, Small print), with lettered options; the phone draws every brief as the same headed template. |
| Feedback | The owner's own words sent in place of an option. It closes the card. |
| Draft | A choice or feedback the owner has prepared but not sent. |
| Undo window | The short time after Send in which the owner can take an answer back. |
| Answer | What the owner sent for one card: an option or feedback. |
| Receipt | The service saying it stored an answer. Not an acknowledgement. |
| Acknowledgement | The agent saying it read an answer, with its next steps. |
| Queue | The open cards of a session. |
| History | The answered cards of a session, read-only. |
| Home screen | The owner's list of the sessions this browser holds, at `/app`. |
| Connect link | A link the owner copies from the phone to an agent, so the agent joins that phone directly. |
| Agent key, phone key | The secret each side holds to act in its session. |
