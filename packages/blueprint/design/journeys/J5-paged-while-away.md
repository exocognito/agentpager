---
id: J5::paged-while-away
for:
  - C19::try-a-demo-agent
  - C24::camera-opens-the-app
  - C21::pair-by-entering-the-agents-code
  - C17::get-paged
  - C5::review-and-answer-cards
statement: A new owner tries the demo agent, pairs by scanning its QR code with the Camera, leaves the app, and is paged, answers and hears back without opening AgentPager first.
caveats:
  - The alerts run on a TestFlight build with production APNs (D7). Delivery time is Apple's and is not measured.
---

## Steps

On the deployed product, with a TestFlight install on a real iPhone:

1. The owner starts the demo agent and scans its QR code with the Camera. The app opens at pairing, the owner enters the code, and the pager is paired.
2. The owner leaves the app. The demo agent asks its sample decision, and an alert arrives with the agent's name and the question.
3. The owner opens the alert, which opens that decision, then answers and sends.
4. The owner leaves the app again. The acknowledgement arrives as an alert with the agent's words, and the badge clears.
