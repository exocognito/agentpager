import XCTest

// The decision-brief dogfood on a real phone or the Simulator: the owner's side of the canvas's four examples
// (D1–D4), with every screenshot kept in the test result. A real agent asks them first, from the Mac:
//   node --experimental-strip-types packages/app/scripts/briefs.ts http://<mac-ip>:8787 <pager number>
// testPagerNumber prints this phone's number for that line (AGENTPAGER_NUMBER=…).
final class BriefTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments += ["-AgentPagerServerURL", AgentHarness.server.absoluteString]
        // Local Network and alerts ask once per install; either can come up while the test runs.
        addUIInterruptionMonitor(withDescription: "system alert") { alert in
            for label in ["Allow", "OK"] where alert.buttons[label].exists { alert.buttons[label].tap(); return true }
            return false
        }
    }

    // AGENTPAGER_BRIEF_RESET=1 starts with no pagers (and a new number): for the Simulator, never a phone in use.
    func testPagerNumber() {
        if ProcessInfo.processInfo.environment["AGENTPAGER_BRIEF_RESET"] == "1" { app.launchArguments.append("-resetKeys") }
        launch()
        app.buttons["settings-button"].firstMatch.tap()
        let number = app.staticTexts["pager-number"]
        wait(number, 30)
        waitUntil(30, "a pager number") { number.label.count == 32 }
        print("AGENTPAGER_NUMBER=\(number.label)")
    }

    func testBriefs() {
        launch()
        let agent = app.buttons["agent-Claude Code · shop"].firstMatch
        wait(agent, 60)
        agent.tap()
        wait(app.buttons["open-Which pricing page layout should I build?"], 30)
        shot("00-inbox")

        // D1, a visual choice: view B, pick B, read the background, send B.
        open("Which pricing page layout should I build?")
        shot("D1-1-top")
        tap("option-row-B")
        reveal(any("option-preview-B"))
        shot("D1-2-viewing-B")
        reveal(app.buttons["fold-Tradeoffs"])
        shot("D1-3-tradeoffs")
        tap("fold-smallprint")
        tap("tile-B")
        shot("D1-4-B-picked")
        tap("link-background.md")
        wait(app.navigationBars["Background"], 20)
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        shot("D1-5-background")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        sendPicked("Which pricing page layout should I build?", "D1")

        // D2, a technical choice: view B (the diagram and diff), pick C, open the small print, send C.
        open("How should checkout handle a payment timeout?")
        tap("option-row-B")
        reveal(any("option-preview-B"))
        shot("D2-1-viewing-B")
        tap("link-design.md")
        wait(app.navigationBars["Notes"], 20)
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        shot("D2-2-design-notes")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        tap("fold-smallprint")
        tap("tile-C")
        shot("D2-3-C-picked")
        sendPicked("How should checkout handle a payment timeout?", "D2")

        // D3, a content choice: view C (the chat sample and rules diff), pick B, send B.
        open("How should the support bot handle refunds?")
        tap("option-row-C")
        reveal(any("option-preview-C"))
        shot("D3-1-viewing-C")
        tap("tile-B")
        shot("D3-2-B-picked")
        sendPicked("How should the support bot handle refunds?", "D3")

        // D4, a small decision: ask for changes instead of an option.
        open("Delete 14 merged preview branches?")
        shot("D4-1-top")
        app.buttons["ask-for-changes"].tap()
        let field = app.textViews["feedback-text"]
        wait(field, 10)
        app.typeText("Keep the two newest; delete the other 12.")
        shot("D4-2-ask-for-changes")
        app.buttons["send-feedback"].tap()
        confirmed("Delete 14 merged preview branches?", "D4")

        app.buttons["answered-Which pricing page layout should I build?"].tap()
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        shot("D1-7-answered")
    }

    private func any(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id].firstMatch }

    private func launch() {
        app.launch()
        app.tap() // lets the interruption monitor see an alert that is already up
        wait(app.navigationBars["Agents"], 30)
    }

    private func open(_ title: String) {
        let row = app.buttons["open-\(title)"]
        wait(row, 30)
        row.tap()
        wait(any("brief-header"), 15)
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
    }

    // Scroll the brief until the element sits between the top bar and the answer bar, then let it settle.
    private func reveal(_ element: XCUIElement) {
        wait(element, 10)
        let scroll = app.scrollViews["brief-scroll"].firstMatch
        let bar = app.buttons["tile-A"].exists ? app.buttons["tile-A"].frame.minY - 12 : scroll.frame.maxY
        for _ in 0..<12 {
            let f = element.frame
            if f.minY >= scroll.frame.minY + 80 && f.maxY <= bar { break }
            let start = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            let up = f.maxY > bar
            let distance = min(260, max(60, up ? f.maxY - bar + 40 : scroll.frame.minY + 120 - f.minY))
            start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: up ? -distance : distance)), withVelocity: .slow, thenHoldForDuration: 0.3)
        }
        RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    }

    private func tap(_ id: String) {
        let element = app.buttons[id].firstMatch
        if !id.hasPrefix("tile-") { reveal(element) }
        element.tap()
        RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    }

    private func sendPicked(_ title: String, _ name: String) {
        tap("send-option")
        shot("\(name)-undo")
        confirmed(title, name)
    }

    // Sent once Undo closes; confirmed when the agent's acknowledgement arrives.
    private func confirmed(_ title: String, _ name: String) {
        let row = app.buttons["answered-\(title)"]
        wait(row, 30)
        waitUntil(40, "\(name) confirmed by the agent") { row.label.contains("Agent confirmed") }
        shot("\(name)-confirmed")
    }
}
