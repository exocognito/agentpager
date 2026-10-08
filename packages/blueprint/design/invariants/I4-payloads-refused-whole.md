---
id: I4::payloads-refused-whole
serves:
  - SI6
  - SI8
statement: Every request decodes through its imported schema; invalid text and cross-card answers are refused whole, and nothing is truncated or stored.
caveats:
  - HTML detection is the ValidProse schema's rule, an opening tag or a comment; Markdown that merely contains `<` or `>` as text passes.
---

Limits count visible characters, so a combined emoji counts as one. An unknown field, invalid UTF-8, HTML, blank or over-limit text, or an answer that does not fit its card is refused with a reason that says what to fix, and writes nothing. No screen trims or cleans text, except that titles, option labels, session names and list rows show each run of spaces and line breaks as one space. A wrong key is refused as unauthorized even when the input is also invalid. Breaking this looks like a title stored cut to fit, or a `<script>` that reaches the phone.
