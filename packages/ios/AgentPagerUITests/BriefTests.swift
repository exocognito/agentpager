import XCTest

// The decision-brief dogfood on a real phone or the Simulator: the owner's side of the canvas's four examples
// (D1–D4), with every screenshot kept in the test result. A real agent asks them first, from the Mac:
//   node --experimental-strip-types packages/app/scripts/briefs.ts http://<mac-ip>:8787 <pager number>
// testPagerNumber makes the "Shop" pager if there is none and prints its number for that line (AGENTPAGER_NUMBER=…).
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

    // AGENTPAGER_BRIEF_RESET=1 starts with no pagers: for the Simulator, never a phone in use.
    func testPagerNumber() {
        if ProcessInfo.processInfo.environment["AGENTPAGER_BRIEF_RESET"] == "1" { app.launchArguments.append("-resetKeys") }
        launch()
        if !app.buttons["pager-Shop"].exists {
            app.buttons["new-pager"].tap()
            let field = app.textFields["new-pager-name"]
            wait(field)
            field.typeText("Shop")
            app.buttons["create-pager"].tap()
            wait(app.navigationBars["Shop"], 30)
        } else {
            app.buttons["pager-Shop"].tap()
        }
        app.buttons["pager-settings"].tap()
        let line = app.staticTexts["connect-line"]
        wait(line, 30)
        print("AGENTPAGER_NUMBER=\(line.label.split(separator: " ").first { $0.hasPrefix("ap1_") } ?? "")")
    }

    func testBriefs() {
        launch()
        let pager = app.buttons["pager-Shop"].firstMatch
        wait(pager, 60)
        pager.tap()
        wait(app.buttons["open-Which pricing page layout should I build?"], 30)
        shot("inbox", after: "Claude Code (shop) asks the four example briefs; open the Shop pager")

        // D1, a visual choice: see B on the Options sheet (what it changes and why first, then its images, which
        // open full screen and swipe), pick B (its column outlined), read the background, send B.
        open("Which pricing page layout should I build?")
        shot("D1-top", after: "Open \"Which pricing page layout should I build?\"")
        reveal(app.buttons["open-options"])
        shot("D1-options-row", after: "Scroll to the Options row")
        tap("open-options")
        showOption("B")
        shot("D1-option-B", after: "Tap the Options row, then B at the top of the sheet")
        let page = app.scrollViews["option-page-B"]
        let changes = page.staticTexts["What B changes"], why = page.staticTexts["Why choose B"]
        wait(changes, 10)
        XCTAssertTrue(why.exists && page.staticTexts["Why pass on B"].exists && page.staticTexts["Assumptions B makes"].exists)
        let thumb = page.buttons["image-b-table.png"]
        for _ in 0..<6 where !thumb.isHittable { page.swipeUp() }
        XCTAssertLessThan(why.frame.maxY, thumb.frame.minY, "what B changes and why come before its images")
        XCTAssertTrue(page.buttons["image-b-table-phone.png"].exists)
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        shot("D1-option-B-images", after: "Scroll B down to its images")
        thumb.tap()
        wait(app.navigationBars["1 of 2"], 10)
        RunLoop.current.run(until: Date().addingTimeInterval(1))
        shot("D1-image-1-of-2", after: "Tap the first image")
        app.swipeLeft()
        wait(app.navigationBars["2 of 2"], 10)
        RunLoop.current.run(until: Date().addingTimeInterval(1))
        shot("D1-image-2-of-2", after: "Swipe left")
        app.navigationBars["2 of 2"].buttons.firstMatch.tap()
        waitUntil(10, "the viewer closed") { !app.navigationBars["2 of 2"].exists && changes.exists }
        closeSheet()
        tap("fold-smallprint")
        tap("tile-B")
        reveal(app.buttons["open-options"])
        shot("D1-B-picked", after: "Close the viewer and the sheet, open Small print, tap B")
        tap("link-background.md")
        wait(app.navigationBars["Why the pricing page matters"], 20)
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        shot("D1-background", after: "Tap the link to the background page")
        closeSheet()
        sendPicked("Which pricing page layout should I build?", "D1", "Close the page, tap Send option B")

        // D2, a technical choice: see B (the diagram and diff), swipe to C, open the design notes, pick C, send C.
        open("How should checkout handle a payment timeout?")
        tap("open-options")
        showOption("B")
        shot("D2-option-B", after: "Go back; open \"How should checkout handle a payment timeout?\", tap the Options row, then B")
        app.swipeLeft()
        waitUntil(10, "swiping to show C") { segment("C").isSelected && any("option-header-C").isHittable }
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        shot("D2-swiped-to-C", after: "Swipe left to C")
        let notes = app.scrollViews["option-page-C"].buttons["link-design.md"]
        for _ in 0..<6 where !notes.isHittable { app.scrollViews["option-page-C"].swipeUp() }
        notes.tap()
        wait(app.navigationBars["Three ways to handle a timeout"], 20)
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        shot("D2-design-notes", after: "Scroll C to its design notes link and tap it")
        back()
        closeSheet()
        tap("fold-smallprint")
        tap("tile-C")
        shot("D2-C-picked", after: "Go back, close the sheet, open Small print, tap C")
        sendPicked("How should checkout handle a payment timeout?", "D2", "Tap Send option C")

        // D3, a content choice: see C (the chat sample and rules diff), pick B, send B.
        open("How should the support bot handle refunds?")
        tap("open-options")
        showOption("C")
        shot("D3-option-C", after: "Go back; open \"How should the support bot handle refunds?\", tap the Options row, then C")
        closeSheet()
        tap("tile-B")
        shot("D3-B-picked", after: "Close the sheet, tap B")
        sendPicked("How should the support bot handle refunds?", "D3", "Tap Send option B")

        // D4, a small decision: its options have no blocks; ask for changes instead of an option.
        open("Delete 14 merged preview branches?")
        shot("D4-top", after: "Go back; open \"Delete 14 merged preview branches?\"")
        tap("open-options")
        shot("D4-options", after: "Tap the Options row: a small decision's options have no blocks")
        closeSheet()
        app.buttons["ask-for-changes"].tap()
        let field = app.textViews["feedback-text"]
        wait(field, 10)
        app.typeText("Keep the two newest; delete the other 12.")
        shot("D4-ask-for-changes", after: "Close the sheet, tap Ask for changes, type a note")
        app.buttons["send-feedback"].tap()
        confirmed("Delete 14 merged preview branches?", "D4", "Send the note; Undo closes, it goes and the agent confirms. Tap shop's answered row")

        // Answered, the brief stays readable, and its Options sheet opens on the option sent.
        app.buttons["answered-shop"].tap()
        app.buttons["answered-Which pricing page layout should I build?"].tap()
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        shot("D1-answered", after: "Go back; open shop's answered list, then the pricing decision: it stays readable")
        tap("open-options")
        waitUntil(10, "the Options sheet opening on B") { segment("B").isSelected }
        shot("D1-answered-options", after: "Tap the Options row: it opens on B, the option sent")
    }

    // The Options sheet's segmented control shows another option; it never chooses one.
    private func segment(_ letter: String) -> XCUIElement {
        app.segmentedControls.firstMatch.buttons.element(boundBy: Int(letter.unicodeScalars.first!.value) - 65)
    }

    private func showOption(_ letter: String) {
        wait(app.segmentedControls.firstMatch, 10)
        segment(letter).tap()
        waitUntil(10, "option \(letter) shown") { any("option-header-\(letter)").isHittable }
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
    }

    private func back() {
        app.navigationBars.buttons.element(boundBy: 0).tap()
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
    }

    // Swipes a bottom sheet down by its grab handle, back to the decision.
    private func closeSheet() {
        let top = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.1))
        top.press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95)))
        RunLoop.current.run(until: Date().addingTimeInterval(1))
    }

    private func any(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id].firstMatch }

    private func launch() {
        app.launch()
        app.tap() // lets the interruption monitor see an alert that is already up
        wait(app.navigationBars["Pagers"], 30)
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

    private func sendPicked(_ title: String, _ name: String, _ action: String) {
        tap("send-option")
        shot("\(name)-undo", after: action + ": back on the pager, the Undo window counts down")
        confirmed(title, name)
    }

    // Sent once Undo closes; confirmed when the agent's acknowledgement arrives. The decision is then in the
    // project's "N answered" list.
    private func confirmed(_ title: String, _ name: String, _ action: String = "Undo closes, the answer goes and the agent confirms. Tap shop's answered row") {
        let group = app.buttons["answered-shop"]
        wait(group, 30)
        group.tap()
        let row = app.buttons["answered-\(title)"]
        wait(row, 30)
        waitUntil(40, "\(name) confirmed by the agent") { row.label.contains("Agent confirmed") }
        shot("\(name)-confirmed", after: action)
        back()
    }
}
