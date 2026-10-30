import XCTest

// End-to-end flows: the app in the Simulator, the real local server, and this test playing the agent.
// Run with: TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 TEST_RUNNER_SCREENSHOT_DIR=<dir> xcodebuild test ...
final class FlowTests: XCTestCase {
    var app: XCUIApplication!
    var agent: AgentHarness!

    override func setUpWithError() throws {
        continueAfterFailure = false
        agent = AgentHarness(base: AgentHarness.server)
        app = XCUIApplication()
        app.launchArguments += ["-resetKeys", "-AgentPagerServerURL", AgentHarness.server.absoluteString]
        // Alerts ask once per install, once there is a pager; the prompt can come up while the test runs.
        addUIInterruptionMonitor(withDescription: "system alert") { alert in
            for label in ["Allow", "OK"] where alert.buttons[label].exists { alert.buttons[label].tap(); return true }
            return false
        }
    }

    private func launch(extra: [String] = []) {
        app.launchArguments += extra
        app.launch()
        wait(app.navigationBars["Pagers"])
    }

    // Makes a pager on the phone and lands on its screen. Returns its number, read from the detail screen.
    @discardableResult
    private func makePager(_ name: String, shots: String? = nil) -> String {
        app.buttons["new-pager"].tap()
        let field = app.textFields["new-pager-name"]
        wait(field)
        field.typeText(name)
        let line = app.staticTexts["connect-line"]
        wait(line)
        if let shots { shot("\(shots)-new-pager") }
        app.buttons["create-pager"].tap()
        wait(app.navigationBars[name], 10)
        app.tap() // lets the interruption monitor see the alerts prompt
        app.buttons["pager-settings"].tap()
        let detail = app.staticTexts["connect-line"]
        wait(detail)
        if let shots { shot("\(shots)-detail") }
        let number = String(detail.label.split(separator: " ").first { $0.hasPrefix("ap1_") } ?? "")
        XCTAssertTrue(number.hasPrefix("ap1_") && number.count == 36, number)
        back()
        return number
    }

    private func back() {
        app.navigationBars.buttons.element(boundBy: 0).tap()
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
    }

    private func open(_ title: String) {
        let row = app.buttons["open-\(title)"]
        wait(row, 10)
        row.tap()
        wait(app.buttons["tile-A"])
    }

    // The pager screen's "N answered" row for a project, then the decision's row in it.
    private func answeredRow(_ project: String, _ title: String) -> XCUIElement {
        let group = app.buttons["answered-\(project)"]
        wait(group, 10)
        group.tap()
        let row = app.buttons["answered-\(title)"]
        wait(row, 10)
        return row
    }

    // Make a pager -> an agent connects with its number -> ask -> answer -> wait -> acknowledge -> the closed record.
    func testPagerJourney() throws {
        launch()
        shot("01-pagers-empty")
        let number = makePager("Work", shots: "02")
        shot("03-pager-empty")

        try agent.connect(number: number, app: "Codex", project: "atomic-pages")
        _ = try agent.ask("What should we aim for first?", detail: "Maya’s team can start this week.", options: ["Ship to Maya’s team", "Reliability first"], recommended: 1)
        let maya = try agent.ask("Send Maya the update?", detail: "Maya asked for an update once the phone flow was ready.",
                                 options: ["Send now", "Send at 9:00 tomorrow", "Don’t send it"], recommended: 1)
        let other = AgentHarness(base: AgentHarness.server)
        try other.connect(number: number, app: "Claude Code", project: "agentpager")
        try AgentHarness(base: AgentHarness.server).connect(number: number, app: "pi", project: "quiet")
        _ = try other.ask("Option detail: bottom sheet or full screen?", options: ["Bottom sheet", "Full screen"])
        wait(app.buttons["open-Send Maya the update?"], 8)
        wait(app.buttons["open-Option detail: bottom sheet or full screen?"], 8)
        XCTAssertTrue(app.staticTexts["ATOMIC-PAGES"].exists || app.staticTexts["atomic-pages"].exists, "grouped by project")
        XCTAssertFalse(app.staticTexts["QUIET"].exists || app.staticTexts["quiet"].exists, "an agent that hasn't asked anything adds no project")
        shot("04-pager-open")
        back()
        waitUntil(5, "the badge counts both agents' open decisions") { app.buttons["pager-Work"].label.contains("3 open") }
        shot("05-pagers-badge")
        app.buttons["pager-Work"].tap()

        open("Send Maya the update?")
        XCTAssertEqual(app.staticTexts["who-asked"].label, "Codex")
        XCTAssertFalse(app.buttons["send-option"].exists, "nothing to send until an option is picked")
        shot("06-decision")
        app.buttons["tile-B"].tap()
        shot("07-decision-picked")
        let sentAt = Date()
        app.buttons["send-option"].tap()
        wait(app.buttons["undo-button"], 3)
        shot("08-undo-window")

        guard let answer = try agent.waitForAnswer(maya, seconds: 20) else { return XCTFail("no answer") }
        XCTAssertGreaterThan(Date().timeIntervalSince(sentAt), 4.5, "the answer waited out the Undo window")
        let choice = answer["choice"] as! [String: Any]
        XCTAssertEqual(choice["kind"] as? String, "option")
        XCTAssertEqual(choice["number"] as? Int, 2)
        let row = answeredRow("atomic-pages", "Send Maya the update?")
        waitUntil(6, "waiting row") { row.label.contains("Waiting for Codex") }
        try agent.acknowledge(maya, answerId: answer["answerId"] as! String, nextSteps: "Sending it at 9:00 tomorrow.")
        waitUntil(8, "green tick") { row.label.contains("Agent confirmed") }
        shot("09-answered-list")

        row.tap()
        let record = app.descendants(matching: .any)["agent-confirmation"]
        wait(record)
        XCTAssertTrue(record.label.contains("Sending it at 9:00 tomorrow."), record.label)
        XCTAssertTrue(app.descendants(matching: .any)["closed-choice"].label.contains("You chose B"))
        XCTAssertFalse(app.buttons["tile-A"].exists, "a closed decision can't be answered again")
        shot("10-answered-decision")

        // Finishing shows on the decision; the agent asks nothing more.
        try agent.finish()
        waitUntil(8, "finished") { app.staticTexts["who-asked"].label == "Codex · finished" }
        XCTAssertThrowsError(try agent.ask("Again?", options: ["One", "Two"])) { e in XCTAssertEqual((e as? ToolError)?.tag, "AgentFinished") }
    }

    // Off: the agent is refused and nothing is queued; the phone keeps the decision and offers Turn on.
    func testOffAndOn() throws {
        launch()
        let number = makePager("Acme project")
        try agent.connect(number: number)
        let first = try agent.ask("Before off?", options: ["One", "Two"])
        wait(app.buttons["open-Before off?"], 8)
        app.buttons["pager-settings"].tap()
        let toggle = app.switches["pager-on"]
        wait(toggle)
        toggle.switches.firstMatch.tap()
        waitUntil(6, "pager off") { (try? self.agent.pagerOn()) == false }
        shot("20-detail-off")
        XCTAssertThrowsError(try agent.ask("While off?", options: ["One", "Two"])) { e in XCTAssertEqual((e as? ToolError)?.tag, "PagerOff") }
        back()
        back()
        waitUntil(5, "off on the Pagers screen") { app.buttons["pager-Acme project"].label.contains("Off since") }
        shot("21-pagers-off")
        app.buttons["pager-Acme project"].tap()
        open("Before off?")
        let bar = app.descendants(matching: .any)["pager-off-bar"]
        wait(bar)
        XCTAssertFalse(app.buttons["tile-A"].isEnabled, "nothing can be sent while off")
        shot("22-decision-off")
        app.buttons["turn-on"].tap()
        waitUntil(6, "pager on") { (try? self.agent.pagerOn()) == true }
        wait(app.buttons["ask-for-changes"], 5)
        app.buttons["tile-A"].tap()
        app.buttons["send-option"].tap()
        let answer = try XCTUnwrap(try agent.waitForAnswer(first, seconds: 15))
        XCTAssertEqual((answer["choice"] as! [String: Any])["number"] as? Int, 1)
        XCTAssertNoThrow(try agent.ask("After on?", options: ["One", "Two"]))
    }

    // The Undo window, leaving the app during Undo, Ask for changes, and the "Answer Not Confirmed" alert.
    func testUndoChangesAndNotConfirmed() throws {
        launch(extra: ["-failSends", "4"])
        let number = makePager("Trips")
        try agent.connect(number: number, app: "Claude", project: "trip planner")

        // The first send fails all its retries (debug flag) -> "Answer Not Confirmed" -> Retry sends the same answer.
        let flaky = try agent.ask("Book the 7:40 train?", options: ["Book it", "Wait for the 9:10"])
        open("Book the 7:40 train?")
        app.buttons["tile-A"].tap()
        app.buttons["send-option"].tap()
        let alert = app.alerts["Answer Not Confirmed"]
        wait(alert, 25)
        shot("30-answer-not-confirmed")
        XCTAssertNil(try agent.waitForAnswer(flaky, seconds: 1))
        alert.buttons["Retry"].tap()
        let flakyAnswer = try XCTUnwrap(try agent.waitForAnswer(flaky, seconds: 10))
        XCTAssertEqual((flakyAnswer["choice"] as! [String: Any])["number"] as? Int, 1)

        // Undo inside the window reopens the decision with the choice still picked.
        let hotel = try agent.ask("Which hotel?", options: ["Central", "Seafront"], recommended: 1)
        open("Which hotel?")
        app.buttons["tile-B"].tap()
        app.buttons["send-option"].tap()
        wait(app.buttons["undo-button"], 3)
        app.buttons["undo-button"].tap()
        wait(app.buttons["send-option"], 5)
        XCTAssertTrue(app.buttons["tile-B"].isSelected)
        shot("31-undo-reopened")
        back()
        XCTAssertNil(try agent.waitForAnswer(hotel, seconds: 7), "an undone answer is never sent")

        // Leaving the app during the Undo window sends at once.
        open("Which hotel?")
        XCTAssertTrue(app.buttons["tile-B"].isSelected)
        app.buttons["send-option"].tap()
        wait(app.buttons["undo-button"], 3)
        let left = Date()
        XCUIDevice.shared.press(.home)
        let hotelAnswer = try XCTUnwrap(try agent.waitForAnswer(hotel, seconds: 10))
        XCTAssertLessThan(Date().timeIntervalSince(left), 4, "sent on leaving, before the 5 s window ran out")
        XCTAssertEqual((hotelAnswer["choice"] as! [String: Any])["number"] as? Int, 2)
        app.activate()

        // Ask for changes sends a note instead of an option; the closed record shows the note.
        let dinner = try agent.ask("Dinner on Friday?", options: ["Sushi", "Pasta"])
        open("Dinner on Friday?")
        app.buttons["ask-for-changes"].tap()
        let field = app.textViews["feedback-text"]
        wait(field)
        field.typeText("Please find somewhere vegetarian.")
        shot("32-ask-for-changes")
        app.buttons["send-feedback"].tap()
        let feedback = try XCTUnwrap(try agent.waitForAnswer(dinner, seconds: 15))
        XCTAssertEqual((feedback["choice"] as! [String: Any])["text"] as? String, "Please find somewhere vegetarian.")
        try agent.acknowledge(dinner, answerId: feedback["answerId"] as! String, nextSteps: "Looking for vegetarian places.")
        let row = answeredRow("trip planner", "Dinner on Friday?")
        waitUntil(8, "note confirmed") { row.label.contains("Agent confirmed") }
        row.tap()
        wait(app.descendants(matching: .any)["closed-choice"])
        XCTAssertTrue(app.descendants(matching: .any)["closed-choice"].label.contains("Please find somewhere vegetarian."))
        shot("33-note-answered")
    }

    // Delete: the pager leaves the phone and the service; its agents can't reach the phone again.
    func testDeletePager() throws {
        launch()
        let number = makePager("VM scratch")
        try agent.connect(number: number)
        _ = try agent.ask("Keep the VM's build cache?", options: ["Keep", "Clear"])
        wait(app.buttons["open-Keep the VM's build cache?"], 8)
        app.buttons["pager-settings"].tap()
        app.buttons["delete-pager"].tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label == 'Delete pager' AND identifier != 'delete-pager'")).firstMatch
        wait(confirm, 5)
        shot("40-delete-confirm")
        confirm.tap()
        wait(app.navigationBars["Pagers"], 8)
        XCTAssertFalse(app.buttons["pager-VM scratch"].exists)
        XCTAssertThrowsError(try agent.ask("Still there?", options: ["One", "Two"])) { e in
            XCTAssertEqual((e as? ToolError)?.tag, "UnknownAgent")
        }
        XCTAssertThrowsError(try AgentHarness(base: AgentHarness.server).connect(number: number)) { e in
            XCTAssertEqual((e as? ToolError)?.tag, "NumberInvalid")
        }
    }
}
