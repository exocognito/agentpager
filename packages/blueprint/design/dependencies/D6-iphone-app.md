---
id: D6::iphone-app
statement: The owner's side runs as a native SwiftUI app on an iPhone.
providedBy: owner
provided: Xcode and the iOS Simulator on the owner's Mac, which build and run the app; and, for the walk, the owner's iPhone in Developer Mode over USB, signed with the owner's Apple developer team (D7::apple-developer-program). The owner signs; no role creates or uses an Apple signing credential.
caveats:
  - One simulated iPhone stands for every iPhone. The loop samples no real handset; the owner's iPhone is sampled at the walk.
---

Must supply: a macOS host with Xcode and an iOS Simulator runtime, which tests drive through the app's interface and which a role uses when it plays the owner; and the owner's iPhone for the walk.

Must never do: let a preview or fixture stand in for the app's own screen; create, request or use an Apple signing identity, certificate or account on the owner's behalf.

Proof runs on: the app in an iPhone Simulator running the iOS that Xcode ships, driven through its interface, in light and dark appearance, with the agent screen and the decision sheet also at the largest standard text size. A second phone is a second Simulator. The owner's walk runs on their iPhone.
