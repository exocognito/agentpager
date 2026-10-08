---
id: I2::expired-sessions-refuse-and-forget
serves:
  - SI5
statement: A session nobody pairs expires 15 minutes after its creation; correct pairing starts a fixed 24-hour session deadline; later activity never extends it, and after expiry every operation is refused and the session's cards are gone from active storage.
caveats:
  - No real 24-hour wait is observed. Expiry is proved in real time on a local instance with local lifetimes; the deployed build runs the same code with the production lifetime, and the deployed proof shows only that it does not use the local ones.
  - Backup retention below the product's storage is not proved.
  - The deadline is checked live 5 seconds before it and refused from 2 seconds after it; the exact boundary second is not proved.
---

Claiming the link does not move the deadline, and neither does repeating the pairing answer. After the deadline, every call is refused, the phone shows the expired screen, and storage holds no cards, answers or acknowledgements, even after the service restarts. Breaking this looks like any activity keeping a session alive past its first deadline.
