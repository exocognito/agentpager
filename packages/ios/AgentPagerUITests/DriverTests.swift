import XCTest

// Lets an agent play the owner interactively: launches the app, then runs one command at a time from
// $AGENTPAGER_DRIVE_DIR/cmd.json and answers in out.json. Drive it with `node drive.mjs <op> key=value ...`.
// Run with: TEST_RUNNER_AGENTPAGER_DRIVE_DIR=<dir> xcodebuild test-without-building ... \
//   -only-testing:AgentPagerUITests/DriverTests/testDrive
final class DriverTests: XCTestCase {
    private var app: XCUIApplication!
    private var dir: URL!

    func testDrive() throws {
        let env = ProcessInfo.processInfo.environment
        guard let path = env["AGENTPAGER_DRIVE_DIR"] else { throw XCTSkip("set TEST_RUNNER_AGENTPAGER_DRIVE_DIR") }
        continueAfterFailure = true
        dir = URL(fileURLWithPath: path)
        app = XCUIApplication()
        app.launchArguments += ["-AgentPagerServerURL", AgentHarness.server.absoluteString]
        if env["AGENTPAGER_DRIVE_RESET"] == "1" { app.launchArguments.append("-resetKeys") }
        app.launch()
        // A command left over from an earlier run is never replayed.
        var last = command()?["seq"] as? Int ?? 0
        reply(["seq": last, "ok": true, "ready": true])

        while true {
            RunLoop.current.run(until: Date().addingTimeInterval(0.15))
            guard let cmd = command(), let seq = cmd["seq"] as? Int, seq > last else { continue }
            last = seq
            var out = run(cmd)
            out["seq"] = seq
            reply(out)
            if cmd["op"] as? String == "quit" { return }
        }
    }

    private func command() -> [String: Any]? {
        guard let data = try? Data(contentsOf: dir.appendingPathComponent("cmd.json")) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private func reply(_ out: [String: Any]) {
        let tmp = dir.appendingPathComponent("out.tmp")
        let data = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
        try! data.write(to: tmp)
        _ = try? FileManager.default.replaceItemAt(dir.appendingPathComponent("out.json"), withItemAt: tmp)
    }

    // app=springboard (Home Screen, alerts), app=safari, or any bundle id; the default is AgentPager.
    private func target(_ cmd: [String: Any]) -> XCUIApplication {
        switch cmd["app"] as? String {
        case nil: app
        case "springboard": XCUIApplication(bundleIdentifier: "com.apple.springboard")
        case "safari": XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        case let id?: XCUIApplication(bundleIdentifier: id)
        }
    }

    // Finds by id (accessibility identifier), label, or contains (label substring); type and index narrow it.
    private func find(_ cmd: [String: Any]) -> XCUIElement? {
        let pred: NSPredicate
        if let id = cmd["id"] as? String { pred = NSPredicate(format: "identifier == %@", id) }
        else if let label = cmd["label"] as? String { pred = NSPredicate(format: "label == %@", label) }
        else if let part = cmd["contains"] as? String { pred = NSPredicate(format: "label CONTAINS %@", part) }
        else { return nil }
        let type = (cmd["type"] as? String).flatMap { Self.types[$0] } ?? .any
        let matches = target(cmd).descendants(matching: type).matching(pred)
        let index = cmd["index"] as? Int ?? 0
        let el = index < 0 ? matches.allElementsBoundByIndex.last : matches.element(boundBy: index)
        return el
    }

    private func run(_ cmd: [String: Any]) -> [String: Any] {
        let op = cmd["op"] as? String ?? ""
        let timeout = (cmd["timeout"] as? Double) ?? 5
        switch op {
        case "tree":
            return ["ok": true, "tree": target(cmd).tree().joined(separator: "\n")]
        case "tap", "type", "wait", "swipe", "get":
            guard let el = find(cmd) else { return ["ok": false, "error": "give id, label or contains"] }
            // Act on a snapshot's frame by coordinate: an element that goes away after the tap (a sheet closing)
            // would otherwise fail XCUITest's post-tap check and end the whole run.
            guard el.waitForExistence(timeout: timeout), let s = try? el.snapshot() else { return ["ok": false, "error": "not found"] }
            let origin = target(cmd).coordinate(withNormalizedOffset: .zero)
            let center = origin.withOffset(CGVector(dx: s.frame.midX, dy: s.frame.midY))
            switch op {
            case "tap":
                center.tap()
            case "type":
                // Tapping a field that already has the keyboard opens Paste/AutoFill, which swallows the text.
                if !app.keyboards.firstMatch.exists {
                    center.tap()
                    RunLoop.current.run(until: Date().addingTimeInterval(0.5))
                }
                app.typeText(cmd["text"] as? String ?? "")
            case "swipe":
                let d = 0.4 * Double(max(s.frame.width, s.frame.height))
                let (dx, dy): (Double, Double) = switch cmd["dir"] as? String ?? "up" {
                case "down": (0, d)
                case "left": (-d, 0)
                case "right": (d, 0)
                default: (0, -d)
                }
                center.press(forDuration: 0.05, thenDragTo: center.withOffset(CGVector(dx: dx, dy: dy)))
            default: break
            }
            // Let the app apply the change, so a tap straight after (Send after choosing) sees it.
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
            return ["ok": true, "label": s.label, "id": s.identifier, "enabled": s.isEnabled]
        case "gone":
            guard let el = find(cmd) else { return ["ok": false, "error": "give id, label or contains"] }
            let end = Date().addingTimeInterval(timeout)
            while el.exists && Date() < end { RunLoop.current.run(until: Date().addingTimeInterval(0.2)) }
            return ["ok": !el.exists]
        case "tapxy":
            let x = cmd["x"] as? Double ?? 0, y = cmd["y"] as? Double ?? 0
            target(cmd).coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y)).tap()
            return ["ok": true]
        case "keys":
            app.typeText(cmd["text"] as? String ?? "")
            return ["ok": true]
        case "shot":
            let name = cmd["name"] as? String ?? "shot"
            let file = dir.appendingPathComponent("\(name).png")
            try? XCUIScreen.main.screenshot().pngRepresentation.write(to: file)
            return ["ok": true, "path": file.path]
        case "open":
            guard let url = URL(string: cmd["url"] as? String ?? "") else { return ["ok": false, "error": "bad url"] }
            app.open(url)
            return ["ok": true]
        case "home":
            XCUIDevice.shared.press(.home)
            return ["ok": true]
        case "activate":
            app.activate()
            return ["ok": true]
        case "relaunch":
            app.terminate()
            app.launchArguments = ["-AgentPagerServerURL", AgentHarness.server.absoluteString]
            if cmd["reset"] as? Bool == true { app.launchArguments.append("-resetKeys") }
            if let extra = cmd["args"] as? String { app.launchArguments += extra.split(separator: " ").map(String.init) }
            app.launch()
            return ["ok": true]
        case "sleep":
            RunLoop.current.run(until: Date().addingTimeInterval(cmd["seconds"] as? Double ?? 1))
            return ["ok": true]
        case "quit":
            return ["ok": true]
        default:
            return ["ok": false, "error": "unknown op \(op)"]
        }
    }

    private static let types: [String: XCUIElement.ElementType] = [
        "button": .button, "staticText": .staticText, "text": .staticText, "cell": .cell, "textField": .textField,
        "textView": .textView, "switch": .switch, "menuItem": .menuItem, "alert": .alert, "sheet": .sheet,
        "navigationBar": .navigationBar, "image": .image, "icon": .icon, "link": .link, "other": .other,
    ]
}
