---
id: I4::payloads-refused-whole
serves:
  - SI6
  - SI8
statement: Every request decodes through the contract's schemas; invalid text, and an answer that does not fit its decision, are refused whole, and nothing is truncated or stored.
caveats:
  - HTML detection is the ValidProse schema's rule, an opening tag or a comment; Markdown that merely contains `<` or `>` as text passes.
  - A brief's Markdown and its Markdown attachments refuse HTML only outside fenced code blocks and code spans. Inside them it is code, shown as text and never rendered.
---

Limits count visible characters, so a combined emoji counts as one. An unknown field, invalid UTF-8, HTML, blank or over-limit text, or an answer that does not fit its decision is refused with a reason that says what to fix, and writes nothing. A wrong key is refused as unauthorized even when the input is also invalid.

The agentpager command holds a card to the same schemas before it leaves the agent's machine (I22). Compiling `card.yaml`, it drops the spaces around each value and joins a prose paragraph's wrapped lines so the phone can reflow them; it changes nothing else.

The service stores exactly the text it accepts. The decision screen shows it whole; a list row or an alert may shorten a long question to fit, and opening the decision shows all of it.

Breaking this looks like a title stored cut to fit, or a `<script>` that reaches the phone.
