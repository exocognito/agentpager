---
id: D5::research-feedback-delivery
statement: The research survey stands on a defined collector that makes consented feedback available to the cofounder under explicit access and retention rules.
providedBy: owner
provided: Not selected. Before activation, choose collector/destination, cofounder access, receipt meaning, retention/deletion policy and any scoped access location. The draft introduces no subscription or email-delivery provider.
caveats:
  - The Storybook callback does not supply it.
---

Must supply: a real ResearchFeedbackApi implementation, a verifiable receipt and a way for the cofounder to access the exact consented submission; a declared retention/deletion policy and abuse controls appropriate to the selected collector.

Must never do: collect decision payloads or session credentials, claim receipt before acceptance, forward without consent, make feedback publicly readable, or treat Buy as a payment.

Proof runs on: the selected real collector, including the cofounder's access path, a person with no access who is refused, and the collector's retention and deletion behaviour.
