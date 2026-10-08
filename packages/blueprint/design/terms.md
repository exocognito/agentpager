# Terms

The words that mean something specific in this product. They name things; the promises and schemas say how the things behave. The app never says "session"; the contract may still use it for a pager.

| Term | Meaning |
| --- | --- |
| Owner | The person an agent works for, answering on their phone. |
| Agent | The AI program that asks. It reaches the service over HTTPS or MCP. |
| Pager | One agent and one phone, paired, exchanging cards until it ends. The contract calls it a session. |
| Agent name | What the agent calls itself and its work, such as "Claude Code · blueprint", so the owner can tell pagers apart. |
| Start page | The page at `/start` that tells an agent everything it needs. |
| AgentPager link | A link of the form `agentpager.me/start/<code>`, also shown as a QR code. Either the agent or the phone makes one for the other to use. Reading it never uses it up. |
| Pairing code | The three emoji, in order, that the agent shows and the owner taps to pair. The phone is never told it. |
| Palette | The 25 emoji the phone offers for entering the pairing code, drawn for each pager. It always holds the code's emoji. |
| Pairing window | A pager's first 15 minutes, in which its link works and it can be paired. |
| End time | When a paired pager ends unless the owner moves it: 24 hours, 7 days or 30 days, counted from pairing or from the owner's last change. |
| End reason | Why a pager ended: timed out, you ended it, agent finished, or pairing failed. |
| Agents list | The app's home: the pagers this phone holds, active apart from ended. |
| Agent screen | One pager's open and answered cards, with its menu for Ends and End Pager. |
| Card | One question from the agent, with the options the agent wrote. The app calls it a decision. |
| Option | One action the agent offers on a card. |
| Recommended | The option the agent marks as its suggestion. Nothing is chosen for the owner. |
| Feedback | The owner's own words sent in place of an option. The app calls it Ask for Changes. It closes the card. |
| Draft | A choice or feedback the owner has prepared but not sent. |
| Undo window | The few seconds after Send in which the owner can take an answer back. |
| Answer | What the owner sent for one card: an option or feedback. |
| Receipt | The service saying it stored an answer. Not an acknowledgement. |
| Acknowledgement | The agent saying it read an answer, with its next steps. |
| Agent key, phone key | The secret each side holds to act in its pager. |
