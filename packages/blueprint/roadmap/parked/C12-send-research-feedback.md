---
id: C12::send-research-feedback
serves:
  - SG3
  - SI9
statement: With explicit consent, send the proposed long-session use case, needed duration and willingness to pay to the cofounder, optionally including a contact email.
caveats:
  - Delivery destination, access, retention and abuse controls must be defined before activation; the current story only supplies a fixture receipt.
  - A click or survey answer is not payment, retention or proof of market fit.
---

## Behaviors

After expressing interest, write what longer sessions would let you do, choose the needed duration and willingness to pay, and optionally give an email for follow-up. Consent says it will send the feedback to the cofounder. Only Send feedback sends the decoded ResearchFeedback object; no session content, agent key or phone key joins it. A receipt confirms storage/receipt by the chosen collector, never a promised personal reply. The collector stores exactly what the form sent, and the receipt matches what the collector holds. A collector refusal or failure preserves the draft and says it was not confirmed. An invalid or unconsented payload posted straight to the feedback route is refused and the collector stores nothing. D5::research-feedback-delivery supplies the collector and privacy rules.
