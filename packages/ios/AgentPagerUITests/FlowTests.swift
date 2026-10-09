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
    }

    private func launch(extra: [String] = []) {
        app.launchArguments += extra
        app.launch()
        wait(app.navigationBars["Agents"])
    }

    // Menus animate in; a tap during the animation is dropped.
    private func tapMenuItem(_ item: XCUIElement) {
        wait(item, 5)
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        item.tap()
        RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    }

    private func enter(_ names: [String], prefix: String? = nil) {
        for (i, name) in names.enumerated() {
            app.buttons["palette-\(name)"].tap()
            if let prefix, i == 1 { shot("\(prefix)-two") }
        }
    }

    private func wrongNames(_ s: AgentHarness.Started) -> [String] {
        // A palette emoji that is not the third code emoji makes the whole code wrong.
        let other = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'palette-' AND NOT (identifier == %@)", "palette-\(s.names[2])")).firstMatch
        let otherName = String(other.identifier.dropFirst("palette-".count))
        return [s.names[0], s.names[1], otherName]
    }

    private func pairAgentLink(_ name: String, shots: String? = nil) throws -> AgentHarness.Started {
        let s = try agent.start(name: name)
        XCTAssertEqual(s.emojis.count, 3)
        XCTAssertTrue(s.text.contains(s.emojis.joined(separator: " ")), s.text)
        app.open(URL(string: "agentpager://start/\(s.code)")!)
        wait(app.buttons["pair-button"])
        wait(app.buttons["palette-\(s.names[0])"])
        if let shots { shot("\(shots)-empty") }
        enter(s.names, prefix: shots)
        if let shots { shot("\(shots)-ready") }
        app.buttons["pair-button"].tap()
        wait(app.staticTexts["Paired"], 8)
        if let shots { shot("\(shots)-paired") }
        wait(app.buttons["agent-menu"], 6) // Paired closes itself and lands on the agent screen.
        return s
    }

    // Agent-made link: start_session -> deep link -> code -> paired -> ask_card -> answer -> wait -> ack -> green tick.
    func testAgentMadeLink() throws {
        launch()
        shot("01-agents-empty")
        _ = try pairAgentLink("Claude Code · blueprint", shots: "02-pairing")
        XCTAssertEqual(try agent.status()["status"] as? String, "active")
        shot("03-agent-no-decisions")

        _ = try agent.ask("What should we aim for first?", detail: "Maya’s team can start this week; reliability work can follow their first real session.",
                          options: [("🚀", "Ship to Maya’s team", nil), ("🛠️", "Reliability first", nil)], recommended: 1)
        let maya = try agent.ask("Send Maya the update?", detail: "Maya asked for an update once the phone flow was ready.",
                                 options: [("📨", "Send now", "As drafted."), ("🌅", "Send at 9:00 tomorrow", "It lands at the top of Maya’s morning."), ("🗑️", "Don’t send it", nil)], recommended: 1)
        wait(app.buttons["open-Send Maya the update?"], 8)
        shot("04-agent-open")

        app.buttons["open-Send Maya the update?"].tap()
        wait(app.buttons["send-button"])
        XCTAssertFalse(app.buttons["send-button"].isEnabled)
        shot("05-decision")
        app.buttons["option-2"].tap()
        shot("06-decision-selected")
        let sentAt = Date()
        app.buttons["send-button"].tap()
        wait(app.buttons["undo-button"], 3)
        shot("07-undo-window")

        guard let answer = try agent.waitForAnswer(maya, seconds: 20) else { return XCTFail("no answer") }
        XCTAssertGreaterThan(Date().timeIntervalSince(sentAt), 4.5, "the answer waited out the Undo window")
        let choice = answer["choice"] as! [String: Any]
        XCTAssertEqual(choice["kind"] as? String, "option")
        XCTAssertEqual(choice["number"] as? Int, 2)
        let row = app.buttons["answered-Send Maya the update?"]
        waitUntil(6, "waiting row") { row.exists && row.label.contains("Waiting for your agent") }
        shot("08-waiting-for-agent")

        try agent.acknowledge(maya, answerId: answer["answerId"] as! String, nextSteps: "Sending it at 9:00 tomorrow.")
        waitUntil(8, "green tick") { row.exists && row.label.contains("Agent confirmed") }
        shot("09-agent-confirmed")

        row.tap()
        wait(app.staticTexts["Sending it at 9:00 tomorrow."])
        shot("10-thread")
        app.buttons["Close"].firstMatch.tap()

        // Finishing ends the pager with "agent finished".
        try agent.finish()
        wait(app.staticTexts["This pager has ended"], 8)
        XCTAssertEqual(app.staticTexts["end-reason"].label, "Your agent finished and ended it.")
        // The server deleted the decisions; the phone keeps its copy, read only, for 24 hours.
        wait(app.buttons["answered-Send Maya the update?"], 5)
        wait(app.descendants(matching: .any).matching(identifier: "unanswered-What should we aim for first?").firstMatch, 5)
        XCTAssertFalse(app.buttons["open-What should we aim for first?"].exists, "an ended pager's cards can't be answered")
        shot("11-ended-agent-finished")
        XCTAssertThrowsError(try agent.ask("Again?", options: [("1️⃣", "One", nil), ("2️⃣", "Two", nil)])) { e in
            XCTAssertEqual((e as? ToolError)?.tag, "PagerEnded")
        }
    }

    // Phone-made link: Connect sheet -> join_session -> pairing opens -> paired. A second join is refused.
    func testPhoneMadeLink() throws {
        launch()
        app.buttons["connect-button"].tap()
        let link = app.staticTexts["connect-link"]
        waitUntil(10, "link") { link.exists && link.label.contains("/start/") }
        shot("20-connect")
        app.buttons["connect-lifetime"].firstMatch.tap()
        wait(app.buttons["7 Days"])
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        shot("21-connect-lifetime-menu")
        tapMenuItem(app.buttons["7 Days"])
        wait(app.staticTexts["The pager ends 7 days after your agent connects, unless you or your agent end it sooner."], 5)

        let code = String(link.label.split(separator: "/").last!)
        let joined = try agent.join(code: code, name: "Codex · agentpager")
        XCTAssertTrue(joined.text.contains("in this order"), joined.text)
        XCTAssertThrowsError(try AgentHarness(base: AgentHarness.server).join(code: code, name: "Second agent")) { e in
            XCTAssertEqual((e as? ToolError)?.tag, "AlreadyJoined")
        }
        // The Connect sheet gives way to the pairing sheet once the agent has joined.
        wait(app.buttons["pair-button"], 10)
        wait(app.buttons["palette-\(joined.names[0])"])
        shot("22-pairing-phone-link")
        enter(joined.names)
        app.buttons["pair-button"].tap()
        wait(app.staticTexts["Paired"], 8)
        wait(app.buttons["agent-menu"], 6)
        let status = try agent.status()
        XCTAssertEqual(status["status"] as? String, "active")
        XCTAssertEqual(status["lifetime"] as? String, "7d")
        let ends = AgentHarness.date(status["endsAt"] as! String)
        XCTAssertEqual(ends.timeIntervalSinceNow, 7 * 86400, accuracy: 120)
        shot("23-agent-7d")
    }

    // Pager number: Settings makes one; an agent opens a pager with it, which is listed already paired and gets
    // cards. Changing the number refuses the old one and leaves the open pager working.
    func testPagerNumber() throws {
        launch()
        app.buttons["settings-button"].tap()
        let number = app.staticTexts["pager-number"]
        waitUntil(10, "number") { number.exists && number.label.count == 32 }
        shot("60-settings")
        let first = number.label
        try agent.page(number: first, name: "Claude Code · numbered")
        app.buttons["Close"].firstMatch.tap()
        let row = app.buttons["agent-Claude Code · numbered"]
        wait(row, 10)
        XCTAssertFalse(app.staticTexts["status-line"].exists, "no status pill while the server is reachable")
        shot("61-agents-numbered")

        let ship = try agent.ask("Ship it?", options: [("🚀", "Ship", nil), ("🛑", "Hold", nil)])
        row.tap()
        wait(app.buttons["open-Ship it?"], 8)
        app.buttons["open-Ship it?"].tap()
        app.buttons["option-1"].tap()
        app.buttons["send-button"].tap()
        let answer = try XCTUnwrap(try agent.waitForAnswer(ship, seconds: 20))
        XCTAssertEqual((answer["choice"] as! [String: Any])["number"] as? Int, 1)
        shot("62-numbered-answered")

        app.navigationBars.buttons.element(boundBy: 0).tap()
        wait(app.navigationBars["Agents"])
        app.buttons["settings-button"].tap()
        waitUntil(10, "same number") { number.exists && number.label == first }
        app.buttons["change-number"].tap()
        let confirm = app.buttons["Change Number"]
        wait(confirm, 5)
        shot("63-change-confirm")
        confirm.tap()
        waitUntil(10, "new number") { number.exists && number.label.count == 32 && number.label != first }
        shot("64-new-number")
        XCTAssertThrowsError(try AgentHarness(base: AgentHarness.server).page(number: first, name: "Pi · old number")) { e in
            XCTAssertEqual((e as? ToolError)?.tag, "NumberInvalid")
        }
        try AgentHarness(base: AgentHarness.server).page(number: number.label, name: "Codex · after change")
        app.buttons["Close"].firstMatch.tap()
        wait(app.buttons["agent-Codex · after change"], 10)
        XCTAssertNoThrow(try agent.ask("Still on?", options: [("✅", "Yes", nil), ("❌", "No", nil)]))
        shot("65-agents-after-change")
    }

    // Three wrong codes end the pager with "pairing failed"; the agent's next call says so.
    func testWrongCodeThreeTimes() throws {
        launch()
        let s = try agent.start(name: "Pi · release notes")
        app.open(URL(string: "agentpager://start/\(s.code)")!)
        wait(app.buttons["palette-\(s.names[0])"])
        let wrong = wrongNames(s)
        enter(wrong)
        app.buttons["pair-button"].tap()
        let status = app.staticTexts["pairing-status"]
        waitUntil(6, "two tries left") { status.label == "Those don’t match. 2 tries left." }
        shot("30-pairing-wrong")
        enter(wrong)
        app.buttons["pair-button"].tap()
        waitUntil(6, "last try") { status.label == "Last try. If it’s wrong, this pager ends." }
        shot("31-pairing-last-try")
        enter(wrong)
        app.buttons["pair-button"].tap()
        wait(app.staticTexts["Pairing Failed"], 6)
        shot("32-pairing-failed")
        XCTAssertThrowsError(try agent.ask("Still there?", options: [("1️⃣", "One", nil), ("2️⃣", "Two", nil)])) { e in
            let body = (e as? ToolError)?.body ?? [:]
            XCTAssertEqual(body["error"] as? String, "PagerEnded")
            XCTAssertEqual(body["endReason"] as? String, "pairingFailed")
        }
        app.buttons["Connect an Agent"].tap()
        wait(app.staticTexts["connect-link"], 6)
    }

    // Ends menu (counted from now), the Undo window, leaving the app during Undo, Ask for Changes,
    // the "Answer Not Confirmed" alert, and End Pager.
    func testEndsUndoAndEndPager() throws {
        launch(extra: ["-failSends", "4"])
        _ = try pairAgentLink("Claude · trip planner")

        // Ends: 30 Days, counted from now.
        app.buttons["agent-menu"].tap()
        let ends = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Ends'")).firstMatch
        wait(ends)
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        shot("40-agent-menu")
        tapMenuItem(ends)
        wait(app.buttons["30 Days"])
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        shot("41-ends-submenu")
        tapMenuItem(app.buttons["30 Days"])
        waitUntil(6, "30d") { (try? self.agent.status()["lifetime"] as? String) == "30d" }
        let endsAt = AgentHarness.date(try agent.status()["endsAt"] as! String)
        XCTAssertEqual(endsAt.timeIntervalSinceNow, 30 * 86400, accuracy: 120)
        XCTAssertTrue(app.staticTexts["Pager active · Ends in 30d"].waitForExistence(timeout: 5))

        // The first send fails all its retries (debug flag) -> "Answer Not Confirmed" -> Retry sends the same answer.
        let flaky = try agent.ask("Book the 7:40 train?", options: [("🚆", "Book it", nil), ("⏳", "Wait for the 9:10", nil)])
        wait(app.buttons["open-Book the 7:40 train?"], 8)
        app.buttons["open-Book the 7:40 train?"].tap()
        app.buttons["option-1"].tap()
        app.buttons["send-button"].tap()
        let alert = app.alerts["Answer Not Confirmed"]
        wait(alert, 25)
        shot("42-answer-not-confirmed")
        XCTAssertNil(try agent.waitForAnswer(flaky, seconds: 1))
        alert.buttons["Retry"].tap()
        let flakyAnswer = try XCTUnwrap(try agent.waitForAnswer(flaky, seconds: 10))
        XCTAssertEqual((flakyAnswer["choice"] as! [String: Any])["number"] as? Int, 1)

        // Undo inside the window keeps the decision open and the choice selected.
        let hotel = try agent.ask("Which hotel?", options: [("🏨", "Central", "Near the station."), ("🌊", "Seafront", nil)], recommended: 1)
        wait(app.buttons["open-Which hotel?"], 8)
        app.buttons["open-Which hotel?"].tap()
        app.buttons["option-2"].tap()
        app.buttons["send-button"].tap()
        wait(app.buttons["undo-button"], 3)
        app.buttons["undo-button"].tap()
        wait(app.buttons["send-button"], 5)
        XCTAssertTrue(app.buttons["option-2"].isSelected)
        shot("43-undo-reopened")
        app.buttons["close-decision"].tap()
        XCTAssertNil(try agent.waitForAnswer(hotel, seconds: 7), "an undone answer is never sent")

        // Leaving the app during the Undo window sends at once.
        app.buttons["open-Which hotel?"].tap()
        app.buttons["option-2"].tap()
        app.buttons["send-button"].tap()
        wait(app.buttons["undo-button"], 3)
        let left = Date()
        XCUIDevice.shared.press(.home)
        let hotelAnswer = try XCTUnwrap(try agent.waitForAnswer(hotel, seconds: 10))
        XCTAssertLessThan(Date().timeIntervalSince(left), 4, "sent on leaving, before the 5 s window ran out")
        XCTAssertEqual((hotelAnswer["choice"] as! [String: Any])["number"] as? Int, 2)
        app.activate()

        // Ask for Changes sends feedback instead of an option.
        let dinner = try agent.ask("Dinner on Friday?", options: [("🍣", "Sushi", nil), ("🍝", "Pasta", nil)])
        wait(app.buttons["open-Dinner on Friday?"], 8)
        app.buttons["open-Dinner on Friday?"].tap()
        app.buttons["ask-for-changes"].tap()
        let field = app.textViews["feedback-text"]
        wait(field)
        field.typeText("Please find somewhere vegetarian.")
        shot("44-ask-for-changes")
        app.buttons["send-feedback"].tap()
        let feedback = try XCTUnwrap(try agent.waitForAnswer(dinner, seconds: 15))
        XCTAssertEqual((feedback["choice"] as! [String: Any])["text"] as? String, "Please find somewhere vegetarian.")
        try agent.acknowledge(dinner, answerId: feedback["answerId"] as! String, nextSteps: "Looking for vegetarian places.")
        let dinnerRow = app.buttons["answered-Dinner on Friday?"]
        waitUntil(8, "feedback confirmed") { dinnerRow.exists && dinnerRow.label.contains("Agent confirmed") }
        shot("45-feedback-confirmed")

        // End Pager, with its confirmation.
        app.buttons["agent-menu"].tap()
        tapMenuItem(app.buttons["End Pager"])
        wait(app.staticTexts["End Claude’s pager?"], 5)
        shot("46-end-confirm")
        app.buttons.matching(identifier: "End Pager").allElementsBoundByIndex.last!.tap()
        wait(app.staticTexts["Ended in the last 24 hours"], 8)
        shot("47-agents-ended")
        XCTAssertThrowsError(try agent.ask("Still there?", options: [("1️⃣", "One", nil), ("2️⃣", "Two", nil)])) { e in
            XCTAssertEqual((e as? ToolError)?.body["endReason"] as? String, "ownerEnded")
        }
        app.buttons["agent-Claude · trip planner"].tap()
        wait(app.staticTexts["This pager has ended"])
        XCTAssertEqual(app.staticTexts["end-reason"].label, "You ended it.")
        wait(app.buttons["answered-Dinner on Friday?"], 5) // the phone keeps its copy when the owner ends it, too
        shot("48-ended-by-you")
    }

    // Needs a second server with short lifetimes, e.g. PORT=8788 AGENTPAGER_SESSION_MS=20000 AGENTPAGER_UNPAIRED_MS=60000.
    func testTimedOut() throws {
        guard let short = ProcessInfo.processInfo.environment["AGENTPAGER_SHORT_SERVER_URL"], let url = URL(string: short) else {
            throw XCTSkip("set TEST_RUNNER_AGENTPAGER_SHORT_SERVER_URL to a short-lifetime server")
        }
        agent = AgentHarness(base: url)
        app.launchArguments = ["-resetKeys", "-AgentPagerServerURL", short]
        launch()
        let s = try agent.start(name: "Research agent")
        app.open(URL(string: "agentpager://start/\(s.code)")!)
        wait(app.buttons["palette-\(s.names[0])"])
        enter(s.names)
        app.buttons["pair-button"].tap()
        wait(app.buttons["agent-menu"], 8)
        let ends = AgentHarness.date(try agent.status()["endsAt"] as! String)
        XCTAssertLessThan(ends.timeIntervalSinceNow, 60)
        wait(app.staticTexts["This pager has ended"], ends.timeIntervalSinceNow + 10)
        XCTAssertEqual(app.staticTexts["end-reason"].label, "It reached its end time.")
        shot("50-ended-timed-out")
        XCTAssertThrowsError(try agent.ask("Still there?", options: [("1️⃣", "One", nil), ("2️⃣", "Two", nil)])) { e in
            XCTAssertEqual((e as? ToolError)?.body["endReason"] as? String, "timedOut")
        }
    }
}
