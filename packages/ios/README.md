# AgentPager for iPhone (dogfood)

SwiftUI app, iOS 26.0+, bundle id `me.agentpager.app.dev`. The Xcode project is generated from `project.yml`
(`xcodegen generate`); the generated `AgentPager.xcodeproj` is committed so it opens without xcodegen.

## Run on your iPhone

1. Start the server on your Mac (see `../app`): `pnpm --filter @agentpager/app dogfood` from `toy-examples/agentpager`.
2. `open AgentPager.xcodeproj`
3. Select the **AgentPager** target, then **Signing & Capabilities**, and set **Team** to your Personal Team.
4. Pick your iPhone as the run destination and press **Run**.
5. The first time, trust the developer on the phone: **Settings → General → VPN & Device Management**, then Run again.
6. Allow **Local Network** when the app asks.

## Server address

The default is the build setting `AGENTPAGER_SERVER_URL` in `project.yml` (the Mac's LAN address). To change it
without rebuilding, tap the server button at the top left of Agents. Pagers are kept per server address.

## Tests

`AgentPagerUITests` drive the app in the Simulator against a running server, playing the agent over MCP:

```sh
TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 TEST_RUNNER_SCREENSHOT_DIR=/tmp/agentpager-shots \
  xcodebuild test -project AgentPager.xcodeproj -scheme AgentPager \
  -destination 'platform=iOS Simulator,name=iPhone 17e'
```

`-failSends N` (launch argument) makes the next N answer attempts fail, to show the "Answer Not Confirmed" alert.
