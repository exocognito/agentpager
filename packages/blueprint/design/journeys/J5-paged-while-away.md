---
id: J5::paged-while-away
for:
  - C26::make-a-pager-on-the-phone
  - C19::try-a-demo-agent
  - C25::connect-with-a-pager-number
  - C17::get-paged
  - C30::decisions-are-encrypted-end-to-end
  - C5::review-and-answer-cards
statement: A new owner makes a pager, gives its text to an agent and leaves the app, and is paged, answers and hears back without opening AgentPager first.
caveats:
  - Alerts need the deployed service and Apple's push service (D7). Delivery time is Apple's and is not measured.
  - Today the app is built from Xcode, and its alerts go through Apple's sandbox push service. *Not built yet: comes with the TestFlight build, which uses Apple's production push service (D7).*
---

## Steps

On the deployed product, with the app on a real iPhone:

1. The owner makes a pager. The app asks once to send alerts, and the owner allows them.
2. *Not built yet: comes with the demo agent (C19).* The owner gives the pager's text to the demo agent. Until it exists, any agent with the agentpager command stands in. The agent connects.
3. The owner leaves the app. The agent asks a decision, and an alert arrives titled with who asked and the project, with the question as its body. Expanding it shows the detail and the recommended option.
4. *Not built yet: comes with the encryption work.* The alert travels encrypted, and an extension on the phone decrypts it to show the question (C30).
5. The owner opens the alert, which opens that decision, then answers and sends.
6. The owner leaves the app again. The agent acknowledges, the acknowledgement arrives as an alert with the agent's words, and the app icon's badge clears.
