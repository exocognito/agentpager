# AgentPager for iPhone (dogfood)

SwiftUI app, iOS 26.0+, bundle id `me.agentpager.app.dev`. The Xcode project is generated from `project.yml`
(`xcodegen generate`); the generated `AgentPager.xcodeproj` is committed so it opens without xcodegen.

## Run on your iPhone

1. Start the server on your Mac (see `../app`): `pnpm --filter @agentpager/app dogfood` from `toy-examples/agentpager`.
2. `open AgentPager.xcodeproj`
3. Select the **AgentPager** target, then **Signing & Capabilities**, and check **Team** is your Apple developer team
   (X3M532E87A). The first build registers push and time-sensitive alerts for `me.agentpager.app.dev`.
4. Pick your iPhone as the run destination and press **Run**.
5. The first time, trust the developer on the phone: **Settings → General → VPN & Device Management**, then Run again.
6. Allow **Local Network** when the app asks.

## Server address

The default is the build setting `AGENTPAGER_SERVER_URL` in `project.yml` (the Mac's LAN address). To change it
without rebuilding, tap the gear at the top right of Agents, then Server. Pagers and the pager number are kept per
server address.

## Pager number

Settings (the gear) shows this phone's pager number. **Copy for Your Agents** copies a line for your AGENTS.md; any
agent that reads it opens its own pager on this phone, already paired, with MCP `page_owner` or
`POST /api/numbers/<number>/pagers`. **Change Pager Number** retires the old number at once; pagers already open keep
working. Anyone who has the number and can reach the server can put cards on this phone (C25).

## Alerts

When an agent asks, the phone alerts with the agent's name and the question, even with the app closed; tapping the
alert opens that decision (C17). The app asks to send alerts once the first pager is paired, and gives its device token
to each pager and to its pager number. Only the deployed server (`https://agentpager.me`) sends alerts: a server on
the Mac cannot reach Apple's push service. Builds from Xcode use Apple's sandbox service.

In the Simulator, deliver an alert by hand with a payload like the server's (`aps`, plus `kind`, `sessionId` and
`decisionId`):

```sh
xcrun simctl push booted me.agentpager.app.dev alert.apns
```

## Tests

`AgentPagerUITests` drive the app in the Simulator against a running server, playing the agent over MCP:

```sh
TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 TEST_RUNNER_SCREENSHOT_DIR=/tmp/agentpager-shots \
  xcodebuild test -project AgentPager.xcodeproj -scheme AgentPager \
  -destination 'platform=iOS Simulator,name=iPhone 17e'
```

`-failSends N` (launch argument) makes the next N answer attempts fail, to show the "Answer Not Confirmed" alert.

## Decision briefs

A brief card (`card.type: "brief"`) draws as the canvas's headed template, laid out inset-grouped: "Decision: " and
the question, then each section's heading above its own card. Context; Decision Options (the Tradeoffs table, with
the picked option's column outlined, and a row to the Options screen); Recommendation; Next steps and Small print,
folded at first. The Options screen shows one option at a time, switched by swiping or the segmented control at
the bottom; it never chooses one. Each option reads what it changes, why to choose it, why to pass on it and what
it assumes, then what it looks like. Below the brief are the tinted answer buttons and "Ask for changes" / "Send
option X". Attachments load from
`/api/sessions/<id>/cards/<decisionId>/files/<name>` with the phone key; Markdown pages open in the sheet, images one
after another show as a strip of thumbnails that opens full screen and swipes, Mermaid flowcharts are drawn on the phone
(anything else shows its source).

`BriefTests` plays the owner for the canvas's four examples and keeps every screenshot in the test result. A real
agent asks them first, over MCP, from `../app`:

```sh
# 1. This phone's pager number on the server (printed as AGENTPAGER_NUMBER=…)
TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 xcodebuild test -project AgentPager.xcodeproj -scheme AgentPager \
  -destination '<destination>' -allowProvisioningUpdates -only-testing:AgentPagerUITests/BriefTests/testPagerNumber
# 2. The agent: page_owner, ask_card ×4, then wait and acknowledge each answer
node --experimental-strip-types ../app/scripts/briefs.ts http://<mac-ip>:8787 <pager number>
# 3. The owner: open, view, pick, send; D4 asks for changes
TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 xcodebuild test -project AgentPager.xcodeproj -scheme AgentPager \
  -destination '<destination>' -allowProvisioningUpdates -resultBundlePath /tmp/briefs.xcresult \
  -only-testing:AgentPagerUITests/BriefTests/testBriefs
xcrun xcresulttool export attachments --path /tmp/briefs.xcresult --output-path /tmp/brief-shots
```

On a phone the screen must stay unlocked while the test runs (Xcode can't mount its developer image on a locked
phone). In the Simulator, `TEST_RUNNER_AGENTPAGER_BRIEF_RESET=1` on step 1 starts with no pagers; never use it on a
phone in use, since it forgets every pager key on it.

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
node drive.mjs tap id=connect-button     # or label=..., contains=...; app=safari to act on Safari
node drive.mjs keys "text=Hello"         # type into the focused field
node drive.mjs shot name=connect         # screenshot into the drive folder
node drive.mjs quit
```

Add `TEST_RUNNER_AGENTPAGER_DRIVE_RESET=1` to start with no pagers. Open AgentPager links as a phone would with
`xcrun simctl openurl booted <link>`. The command channel is a folder on the Mac, so this runs in the Simulator only.
