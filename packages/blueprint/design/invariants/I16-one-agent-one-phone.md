---
id: I16::one-agent-one-phone
serves:
  - SI2
statement: A pager has one agent and one phone. The first agent to join a phone's link holds it, and a phone gets in only by entering the agent's code within the pairing window and three tries. Once paired, no other agent or phone gets in, and neither paired side is let go.
caveats:
  - A phone is an app install holding a phone key. Nothing identifies a person or a handset.
  - Recovery for a lost phone key is not built, and nothing here proves a recovery path.
  - Keys and link codes carry the Token schema's 192 random bits. Resistance to guessing holds by construction, not by an attack.
---

Reading a link joins and pairs nothing.

A second join of a phone's link is refused, and the first agent carries on. A phone that has not entered the right code can read nothing of the pager except its palette and the agent's name. Each wrong code counts one try on the service, and the third ends the pager.

After pairing, any further pairing attempt or join is refused, as is a call made with another pager's key, and the paired agent and phone carry on.

The service stores keys and link codes only as digests and never sends the code to the phone.

Breaking this looks like:
- a second join or pairing that works;
- a refusal that also logs out the paired side;
- a phone that learns the code.
