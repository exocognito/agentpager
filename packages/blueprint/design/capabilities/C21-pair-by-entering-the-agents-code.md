---
id: C21::pair-by-entering-the-agents-code
serves:
  - SC1
  - SI2
statement: Pair by tapping, in order, the three emoji your agent shows, then Pair; a third wrong try ends the pager.
caveats:
  - That the code and palette are drawn at random is shown by reading the code that draws them, not by watching draws.
  - A blind guess pairs about once in 5,200 pagers (25³ codes, three tries). Nothing stronger is claimed.
  - Anyone holding the link during the pairing window can use up the tries and end the pager. The owner then connects again.
---

## Behaviors

1. The agent shows the code as three emoji in order, with each emoji's name in words, so it reads the same in any terminal or chat. An emoji may repeat.
2. Pairing shows three slots and a palette of 25 distinct emoji drawn for this pager. The palette always holds the code's emoji, and nothing on the phone marks which they are. The palette has no skin-tone, flag or other variants.
3. Tapping an emoji fills the focused slot. Tapping a slot focuses it, and the next emoji replaces what is there. Pair becomes available once all three slots are filled. Nothing is checked until the owner presses Pair.
4. A right code pairs the pager. The phone shows Paired, then opens that agent's screen on its own. The agent learns it is paired on its next call or wait.
5. A wrong code is refused with how many tries are left, and before the last try the phone warns that a wrong code ends the pager. The palette and the code stay the same between tries.
6. The third wrong try ends the pager as pairing failed. The phone says so and offers Connect an Agent, and the agent's next call says that pairing failed.
7. The service counts tries for the pager, not the phone, so reopening the app or using another phone resets nothing.
