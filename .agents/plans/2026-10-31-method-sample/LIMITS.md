# Limits

Problems people using AgentPager meet that the owner chose not to fix yet: each says why, what would fix it, and when to look again. When a milestone fixes one, its line is deleted and quoted under Retires in that milestone's doc. Limits start at L9: L1 to L8 were the lessons, retired into DECISIONS.md.

L9 · Since MPAGERS · A pager's keys stay in one phone's Keychain, so a lost or replaced phone loses its pagers, and the owner makes new ones. why: keys that never leave the phone are what end-to-end encryption needs. fix: move or recover a pager's keys. revisit: when an owner changes phone.
L10 · Since MPAGERS · An owner's pagers live on one phone; nothing joins them across devices. why: one phone holds each pager's keys (L9). fix: share pagers between an owner's devices. revisit: when an owner asks for a second device.
L11 · Since MAPP · The service can read every decision, answer and acknowledgement, and an alert's question, detail and recommended option pass through Apple's push service as text. why: encryption is its own milestone. fix: MENCRYPT. revisit: MENCRYPT.
L12 · Since MCOMMAND · After a pager is deleted, its history file stays on each agent's machine until someone removes it [C31]. why: nobody has needed it gone yet. fix: the command deletes a pager's history once it finds the pager forgotten. revisit: if an owner asks.
