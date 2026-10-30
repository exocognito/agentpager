# AgentPager for iPhone (dogfood)

SwiftUI app, iOS 26.0+, bundle id `me.agentpager.app.dev`. The Xcode project is generated from `project.yml`
(`xcodegen generate`); the generated `AgentPager.xcodeproj` is committed so it opens without xcodegen.

## Run on your iPhone

1. `open AgentPager.xcodeproj`
2. Select the **AgentPager** target, then **Signing & Capabilities**, and check **Team** is your Apple developer team
   (X3M532E87A). The first build registers push and time-sensitive alerts for `me.agentpager.app.dev`.
3. Pick your iPhone as the run destination and press **Run**.
4. The first time, trust the developer on the phone: **Settings → General → VPN & Device Management**, then Run again.

v2 is a fresh install: at launch the app deletes v1's pager keys, number and cached sessions.

## Server address

The default is the build setting `AGENTPAGER_SERVER_URL` in `project.yml` (`https://agentpager.me`). Self-hosters set
their own in the Settings app: **AgentPager → Server** (empty means the build's default). There is no Settings screen
in the app. Pagers are kept per server address; the app reads the setting each time it comes to the foreground.

## Pagers (v2)

**Pagers** (the root) lists this phone's pagers: name, status ("Active · Stays on", "Active · Turns off in 18h",
"Off since yesterday") and how many decisions wait. **+** opens **New pager**: a name (only on this phone), when it
turns off by itself, and the text to give agents, with its number. The phone makes the pager's Curve25519 key pair,
its 16-byte id and the number `ap1_…` that carries the key's fingerprint; **Create** registers it with the server.

A **pager** shows its decisions grouped by project, oldest first, with who asked; answered ones fold into "N answered".
The gear opens its **detail**: the on/off switch, the name, Turn off (Never, after 24 hours, 7 days, 30 days), Give
agents this (copy icon), and Delete pager. While a pager is off its agents are refused and nothing is queued; its
decisions stay readable, and an open one shows "[name] pager is off · Turn on" instead of the answer bar.

A **decision** is pushed full screen. Options, background pages and Ask for changes open as bottom sheets with a grab
handle; images open full screen. Once answered, the bar is the closed record: the choice, then the agent's
confirmation and next steps.

## Alerts

When an agent asks, the phone alerts with who asked and the question, even with the app closed; tapping the alert
opens that decision (C17). The app asks to send alerts once there is a pager, and gives its device token to each
pager. Only the deployed server (`https://agentpager.me`) sends alerts: a server on the Mac cannot reach Apple's push
service. Builds from Xcode use Apple's sandbox service.

In the Simulator, deliver an alert by hand with a payload like the server's (`aps`, plus `kind`, `pagerId`,
`agentId` and `decisionId`):

```sh
xcrun simctl push booted me.agentpager.app.dev alert.apns
```

## Tests

`AgentPagerUITests` drive the app in the Simulator against a running server (`pnpm start:app`), playing the agent
over its HTTP API, as the `agentpager` command does. `FlowTests` covers making a pager, two agents on it,
answering, the Undo window, Ask for changes, Answer Not Confirmed, off and on, finish and delete:

```sh
TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 TEST_RUNNER_SCREENSHOT_DIR=/tmp/agentpager-shots \
  xcodebuild test -project AgentPager.xcodeproj -scheme AgentPager \
  -destination 'platform=iOS Simulator,name=iPhone 17e'
```

`-failSends N` (launch argument) makes the next N answer attempts fail, to show the "Answer Not Confirmed" alert.
`-demo <state>` launches on the mocks' sample data with no network, for screenshots to compare with `docs/v2/mocks/`:
`pagers` (default), `pager`, `detail`, `new`, `decision`, `selected`, `options`, `page`, `changes`, `off`, `answered`,
`undo`, `notconfirmed`, `empty`.

## Decision briefs

A brief card (`card.type: "brief"`) draws as the canvas's headed template: "Decision: " and the question, then each
section's heading above its own card. Context; Options (the Tradeoffs table, with the picked option's column outlined,
and a row to the Options sheet); Recommendation; Next steps and Small print, folded at first. The Options sheet shows
one option at a time, switched by swiping or the segmented control at its top; it never chooses one. Attachments
load from `/api/agents/<id>/cards/<decisionId>/files/<name>` with the pager's phone key; Markdown pages open in a sheet
titled by their first heading, images one after another show as a strip of thumbnails that opens full screen and
swipes, Mermaid flowcharts are drawn on the phone (anything else shows its source).

`BriefTests` plays the owner for the canvas's four examples and keeps every screenshot in the test result. A real
agent asks them first, over the HTTP API, from `../app`:

```sh
# 1. Makes the "Shop" pager if there is none, and prints its number (AGENTPAGER_NUMBER=…)
TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 xcodebuild test -project AgentPager.xcodeproj -scheme AgentPager \
  -destination '<destination>' -allowProvisioningUpdates -only-testing:AgentPagerUITests/BriefTests/testPagerNumber
# 2. The agent: connect, ask ×4, then wait and acknowledge each answer
node --experimental-strip-types ../app/scripts/briefs.ts http://<mac-ip>:8787 <pager number>
# 3. The owner: open, view, pick, send; D4 asks for changes
TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 xcodebuild test -project AgentPager.xcodeproj -scheme AgentPager \
  -destination '<destination>' -allowProvisioningUpdates -resultBundlePath /tmp/briefs.xcresult \
  -only-testing:AgentPagerUITests/BriefTests/testBriefs
xcrun xcresulttool export attachments --path /tmp/briefs.xcresult --output-path /tmp/brief-shots
```

On a phone the screen must stay unlocked while the test runs (Xcode can't mount its developer image on a locked
phone). In the Simulator, `TEST_RUNNER_AGENTPAGER_BRIEF_RESET=1` on step 1 starts with no pagers; never use it on a
phone in use, since it forgets every pager on it.

To install a Debug build on a phone without running tests:

```sh
xcodebuild -project AgentPager.xcodeproj -scheme AgentPager -configuration Debug -allowProvisioningUpdates \
  -destination 'platform=iOS,id=<devicectl id>' -derivedDataPath /tmp/agentpager-dd build
xcrun devicectl device install app --device <devicectl id> /tmp/agentpager-dd/Build/Products/Debug-iphoneos/AgentPager.app
xcrun devicectl device process launch --device <devicectl id> me.agentpager.app.dev
```

## Driving the app by hand (agents playing the owner)

`DriverTests/testDrive` launches the app and waits for commands, so an agent can dogfood interactively against
real agents. Start it in the background, then send one command at a time:

```sh
export AGENTPAGER_DRIVE_DIR=/tmp/agentpager-drive   # any folder; mkdir it first
TEST_RUNNER_AGENTPAGER_DRIVE_DIR=$AGENTPAGER_DRIVE_DIR TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 \
  xcodebuild test -project AgentPager.xcodeproj -scheme AgentPager -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:AgentPagerUITests/DriverTests/testDrive &
node drive.mjs tree                      # what is on screen, with accessibility ids
node drive.mjs tap id=new-pager         # or label=..., contains=...; app=safari to act on Safari
node drive.mjs keys "text=Hello"         # type into the focused field
node drive.mjs shot name=connect         # screenshot into the drive folder
node drive.mjs quit
```

Add `TEST_RUNNER_AGENTPAGER_DRIVE_RESET=1` to start with no pagers. The command channel is a folder on the Mac, so
this runs in the Simulator only.
