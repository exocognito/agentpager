import XCTest
import CryptoKit
import AgentPagerCrypto

// End-to-end flows: the app in the Simulator, the real local server, and this test playing the agent.
// Run with: TEST_RUNNER_AGENTPAGER_SERVER_URL=http://<mac-ip>:8787 TEST_RUNNER_SCREENSHOT_DIR=<dir> xcodebuild test ...
@MainActor
final class FlowTests: XCTestCase {
    var app: XCUIApplication!
    var agent: AgentHarness!

    override func setUp() async throws {
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
    private func makePager(_ name: String, shots: Bool = false) -> String {
        app.buttons["new-pager"].tap()
        let field = app.textFields["new-pager-name"]
        wait(field)
        field.typeText(name)
        let line = app.staticTexts["connect-line"]
        wait(line)
        if shots { shot("new-pager", after: "Tap +, type the name \"\(name)\"") }
        app.buttons["create-pager"].tap()
        wait(app.navigationBars[name], 10)
        app.tap() // lets the interruption monitor see the alerts prompt
        app.buttons["pager-settings"].tap()
        let detail = app.staticTexts["connect-line"]
        wait(detail)
        if shots { shot("pager-detail", after: "Tap Create, allow alerts, then tap the gear") }
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

    // I6: an answer no agent picks up in time gets a warning naming the agent and its computer; reading it later goes
    // back to waiting, and only the acknowledgement confirms. The warning takes 3 min against a production clock, so
    // this needs a server started with a short one (AGENTPAGER_PICKUP_MS=5000 pnpm start:app) and
    // TEST_RUNNER_AGENTPAGER_PICKUP_SECONDS=5; otherwise it is skipped.
    func testAnswerNotPickedUp() throws {
        guard let pickup = ProcessInfo.processInfo.environment["AGENTPAGER_PICKUP_SECONDS"].flatMap(Double.init) else {
            throw XCTSkip("needs a server with a short pickup clock")
        }
        launch()
        let number = makePager("Late")
        try agent.connect(number: number, app: "Claude Desktop", project: "wake-lab", machine: "air")
        let late = try agent.ask("Ship the fix tonight?", options: ["Ship tonight", "Wait for review"])
        open("Ship the fix tonight?")
        app.buttons["tile-A"].tap()
        app.buttons["send-option"].tap()
        wait(app.buttons["undo-button"], 3)
        let row = answeredRow("wake-lab", "Ship the fix tonight?")
        waitUntil(5 + pickup + 15, "the warning") { row.label.contains("Claude Desktop on air (wake-lab) hasn’t picked up your answer") }
        shot("not-picked-up", after: "Tap A, Send; no agent reads the answer within the pickup time")
        row.tap()
        let bar = app.descendants(matching: .any)["agent-confirmation"]
        wait(bar)
        shot("not-picked-up-decision", after: "Tap the answered decision")
        back()

        guard let answer = try agent.waitForAnswer(late, seconds: 5) else { return XCTFail("no answer") }
        let again = app.buttons["answered-Ship the fix tonight?"] // back on the project's answered list
        waitUntil(8, "back to waiting once the agent read it") { again.label.contains("Waiting for Claude Desktop") }
        try agent.acknowledge(late, answerId: answer["answerId"] as! String, nextSteps: "Shipping it at 22:00.")
        waitUntil(8, "green tick") { again.label.contains("Agent confirmed") }
    }

    // Make a pager -> an agent connects with its number -> ask -> answer -> wait -> acknowledge -> the closed record.
    func testPagerJourney() throws {
        launch()
        shot("pagers-empty", after: "Open the app with no pagers")
        let number = makePager("Work", shots: true)
        shot("pager-empty", after: "Go back to the new pager")

        try agent.connect(number: number, app: "Codex", project: "atomic-pages")
        _ = try agent.ask("What should we aim for first?", detail: "Maya’s team can start this week.", options: ["Ship to Maya’s team", "Reliability first"], recommended: 1)
        let maya = try agent.ask("Send Maya the update?", detail: "Maya asked for an update once the phone flow was ready.",
                                 options: ["Send now", "Send at 9:00 tomorrow", "Don’t send it"], recommended: 1)
        let other = AgentHarness(base: AgentHarness.server)
        try other.connect(number: number, app: "Claude Code", project: "agentpager")
        _ = try other.ask("Option detail: bottom sheet or full screen?", options: ["Bottom sheet", "Full screen"])
        wait(app.buttons["open-Send Maya the update?"], 8)
        wait(app.buttons["open-Option detail: bottom sheet or full screen?"], 8)
        XCTAssertTrue(app.staticTexts["ATOMIC-PAGES"].exists || app.staticTexts["atomic-pages"].exists, "grouped by project")
        shot("pager-open", after: "Codex (atomic-pages) connects with the number and asks two decisions; Claude Code (agentpager) connects and asks one")
        back()
        waitUntil(5, "the badge counts both agents' open decisions") { app.buttons["pager-Work"].label.contains("3 open") }
        shot("pagers-badge", after: "Go back to Pagers")
        app.buttons["pager-Work"].tap()

        open("Send Maya the update?")
        XCTAssertEqual(app.staticTexts["who-asked"].label, "Codex")
        XCTAssertFalse(app.buttons["send-option"].exists, "nothing to send until an option is picked")
        shot("decision", after: "Open Work, then \"Send Maya the update?\"")
        app.buttons["tile-B"].tap()
        shot("decision-picked", after: "Tap B")
        let sentAt = Date()
        app.buttons["send-option"].tap()
        wait(app.buttons["undo-button"], 3)
        shot("undo-window", after: "Tap Send option B: back on the pager, the Undo window counts down")

        guard let answer = try agent.waitForAnswer(maya, seconds: 20) else { return XCTFail("no answer") }
        XCTAssertGreaterThan(Date().timeIntervalSince(sentAt), 4.5, "the answer waited out the Undo window")
        let choice = answer["choice"] as! [String: Any]
        XCTAssertEqual(choice["kind"] as? String, "option")
        XCTAssertEqual(choice["number"] as? Int, 2)
        let row = answeredRow("atomic-pages", "Send Maya the update?")
        waitUntil(6, "waiting row") { row.label.contains("Waiting for Codex") }
        try agent.acknowledge(maya, answerId: answer["answerId"] as! String, nextSteps: "Sending it at 9:00 tomorrow.")
        waitUntil(8, "green tick") { row.label.contains("Agent confirmed") }
        shot("answered-list", after: "The answer goes once Undo closes; Codex reads it and confirms. Tap atomic-pages' \"answered\" row")

        row.tap()
        let record = app.descendants(matching: .any)["agent-confirmation"]
        wait(record)
        XCTAssertTrue(record.label.contains("Sending it at 9:00 tomorrow."), record.label)
        XCTAssertTrue(app.descendants(matching: .any)["closed-choice"].label.contains("You chose B"))
        XCTAssertFalse(app.buttons["tile-A"].exists, "a closed decision can't be answered again")
        shot("answered-decision", after: "Tap the decision: the closed record")

        // Finishing shows on the decision; the agent asks nothing more.
        try agent.finish()
        waitUntil(8, "finished") { app.staticTexts["who-asked"].label == "Codex · finished" }
        XCTAssertThrowsError(try agent.ask("Again?", options: ["One", "Two"])) { e in XCTAssertEqual((e as? ToolError)?.tag, "AgentFinished") }
    }

    // I4.9 and B30.2: a card moved to another decision, as a service could hand one back, and a card that opens but isn't
    // one the contract takes, as an agent calling the service directly could send. Each shows as a decision the phone
    // can't read, with nothing of it and nothing to answer, and the app carries on: the readable one still answers.
    func test_I4_9_B30_2_aDecisionThePhoneCantReadShowsAsOneItCantReadNeverInPart() throws {
        launch()
        let number = makePager("Unreadable")
        try agent.connect(number: number, app: "Codex", project: "unreadable")
        _ = try agent.ask("Moved to another decision?", options: ["Keep", "Drop"], sealCard: { card, at in
            try self.agent.seal(.card, card, PartContext(pagerId: at.pagerId, decisionId: AgentHarness.token()))
        })
        _ = try agent.ask("Broken around the command?", options: ["Keep", "Drop"], sealCard: { card, at in
            var c = card, brief = card["card"] as! [String: Any]
            brief["markdown"] = "## Options\n<img src=x onerror=alert(1)>\n"
            c["card"] = brief
            return try self.agent.seal(.card, c, at)
        })
        let readable = try agent.ask("Still readable?", options: ["Keep", "Drop"])
        let unreadable = app.buttons.matching(identifier: "open-A decision this phone can’t read")
        waitUntil(15, "two unreadable rows") { unreadable.count == 2 }
        wait(app.buttons["open-Still readable?"])
        XCTAssertFalse(app.staticTexts["Moved to another decision?"].exists || app.staticTexts["Broken around the command?"].exists, "nothing of them shows")
        shot("unreadable-rows", after: "An agent sends a card moved to another decision and one the contract refuses")
        unreadable.element(boundBy: 0).tap()
        wait(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "didn’t open with this pager’s key")).firstMatch)
        XCTAssertFalse(app.buttons["tile-A"].exists || app.buttons["ask-for-changes"].exists || app.buttons["send-option"].exists, "nothing to answer")
        shot("unreadable-decision", after: "Open one")
        back()
        open("Still readable?")
        app.buttons["tile-A"].tap()
        app.buttons["send-option"].tap()
        XCTAssertEqual(((try XCTUnwrap(try agent.waitForAnswer(readable, seconds: 20)))["choice"] as! [String: Any])["number"] as? Int, 1)
    }

    // B30.1: the phone seals its answer to the key inside the card it answers, never one the service hands it. Here
    // the card names a second key of the agent's: the answer opens with that one and not with the first.
    func test_B30_1_theAnswerIsSealedToTheKeyInsideItsCard() throws {
        launch()
        let number = makePager("Answer key")
        try agent.connect(number: number, app: "Codex", project: "answer key")
        let second = Curve25519.KeyAgreement.PrivateKey()
        let asked = try agent.ask("Sealed to which key?", options: ["This one", "That one"], answerKey: Envelope.base64url(second.publicKey.rawRepresentation))
        open("Sealed to which key?")
        app.buttons["tile-B"].tap()
        app.buttons["send-option"].tap()
        waitUntil(20, "the answer arrives") { ((try? self.agent.call("GET", "api/agents/\(self.agent.agentId)/cards/\(asked)/answer"))?["status"] as? String) == "answered" }
        XCTAssertThrowsError(try agent.waitForAnswer(asked, seconds: 1), "the agent's first key can't open it")
        XCTAssertEqual(((try XCTUnwrap(try agent.waitForAnswer(asked, seconds: 1, key: second)))["choice"] as! [String: Any])["number"] as? Int, 2)
    }

    // I6: two answers that both fail are both reported, by name, and Retry sends both; neither is lost.
    func testTwoAnswersNotConfirmed() throws {
        launch(extra: ["-failSends", "8"])
        let number = makePager("Ferries")
        try agent.connect(number: number, app: "Claude", project: "ferries")
        let early = try agent.ask("Take the early ferry?", options: ["Early", "Late"])
        let cabin = try agent.ask("Book a cabin?", options: ["Cabin", "Seat"])
        open("Take the early ferry?")
        app.buttons["tile-A"].tap()
        app.buttons["send-option"].tap()
        open("Book a cabin?")
        app.buttons["tile-B"].tap()
        app.buttons["send-option"].tap()
        let alert = app.alerts["Answer Not Confirmed"]
        wait(alert, 30)
        let names = { (title: String) in alert.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", title)).count > 0 }
        waitUntil(30, "both answers named") { names("Take the early ferry?") && names("Book a cabin?") }
        shot("two-not-confirmed", after: "Answer both while every send fails")
        alert.buttons["Retry"].tap()
        XCTAssertEqual(((try XCTUnwrap(try agent.waitForAnswer(early, seconds: 15)))["choice"] as! [String: Any])["number"] as? Int, 1)
        XCTAssertEqual(((try XCTUnwrap(try agent.waitForAnswer(cabin, seconds: 15)))["choice"] as! [String: Any])["number"] as? Int, 2)
    }

    // An app killed while its answer is still sending sends it on the next launch.
    func testAnswerSurvivesRelaunch() throws {
        launch(extra: ["-failSends", "100"])
        let number = makePager("Relaunch")
        try agent.connect(number: number, app: "Claude", project: "relaunch")
        let late = try agent.ask("Order the parts?", options: ["Order", "Wait"])
        open("Order the parts?")
        app.buttons["tile-A"].tap()
        app.buttons["send-option"].tap()
        RunLoop.current.run(until: Date().addingTimeInterval(8)) // past Undo, into the failing retries
        app.terminate()
        XCTAssertNil(try agent.waitForAnswer(late, seconds: 1), "not sent while every attempt failed")
        app.launchArguments = ["-AgentPagerServerURL", AgentHarness.server.absoluteString]
        launch()
        let answer = try XCTUnwrap(try agent.waitForAnswer(late, seconds: 20))
        XCTAssertEqual((answer["choice"] as! [String: Any])["number"] as? Int, 1)
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
        shot("detail-off", after: "Codex asks \"Before off?\"; tap the gear, then switch the pager off")
        XCTAssertThrowsError(try agent.ask("While off?", options: ["One", "Two"])) { e in XCTAssertEqual((e as? ToolError)?.tag, "PagerOff") }
        back()
        back()
        waitUntil(5, "off on the Pagers screen") { app.buttons["pager-Acme project"].label.contains("Off since") }
        shot("pagers-off", after: "Codex's next ask is refused PagerOff. Go back to Pagers")
        app.buttons["pager-Acme project"].tap()
        open("Before off?")
        let bar = app.descendants(matching: .any)["pager-off-bar"]
        wait(bar)
        XCTAssertFalse(app.buttons["tile-A"].isEnabled, "nothing can be sent while off")
        shot("decision-off", after: "Open Acme project, then \"Before off?\"")
        app.buttons["turn-on"].tap()
        waitUntil(6, "pager on") { (try? self.agent.pagerOn()) == true }
        wait(app.buttons["ask-for-changes"], 5)
        shot("decision-on", after: "Tap Turn on: the answer bar is back")
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
        shot("answer-not-confirmed", after: "Claude asks \"Book the 7:40 train?\"; open it, tap A, Send; every retry fails")
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
        shot("undo-reopened", after: "Retry sends it. Claude asks \"Which hotel?\"; open it, tap B, Send, then Undo inside the window")
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
        shot("ask-for-changes", after: "Send again and leave the app: it sends at once. Claude asks \"Dinner on Friday?\"; open it, tap Ask for changes, type a note")
        app.buttons["send-feedback"].tap()
        let feedback = try XCTUnwrap(try agent.waitForAnswer(dinner, seconds: 15))
        XCTAssertEqual((feedback["choice"] as! [String: Any])["text"] as? String, "Please find somewhere vegetarian.")
        try agent.acknowledge(dinner, answerId: feedback["answerId"] as! String, nextSteps: "Looking for vegetarian places.")
        let row = answeredRow("trip planner", "Dinner on Friday?")
        waitUntil(8, "note confirmed") { row.label.contains("Agent confirmed") }
        row.tap()
        wait(app.descendants(matching: .any)["closed-choice"])
        XCTAssertTrue(app.descendants(matching: .any)["closed-choice"].label.contains("Please find somewhere vegetarian."))
        shot("note-answered", after: "Send the note; Claude confirms. Open trip planner's answered list, then the decision")
    }

    // Delete: the pager leaves the phone and the service; its agents can't reach the phone again.
    func testDeletePager() throws {
        launch()
        let number = makePager("VM scratch")
        try agent.connect(number: number)
        _ = try agent.ask("Keep the VM's build cache?", options: ["Keep", "Clear"])
        wait(app.buttons["open-Keep the VM's build cache?"], 8)
        app.buttons["pager-settings"].tap()
        wait(app.buttons["delete-pager"])
        shot("detail", after: "Codex asks \"Keep the VM's build cache?\"; tap the gear")
        app.buttons["delete-pager"].tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label == 'Delete pager' AND identifier != 'delete-pager'")).firstMatch
        wait(confirm, 5)
        shot("delete-confirm", after: "Tap Delete pager")
        confirm.tap()
        wait(app.navigationBars["Pagers"], 8)
        XCTAssertFalse(app.buttons["pager-VM scratch"].exists)
        shot("pagers-after", after: "Tap Delete pager again to confirm: back on Pagers, the pager gone")
        XCTAssertThrowsError(try agent.ask("Still there?", options: ["One", "Two"])) { e in
            XCTAssertEqual((e as? ToolError)?.tag, "UnknownAgent")
        }
        XCTAssertThrowsError(try AgentHarness(base: AgentHarness.server).connect(number: number)) { e in
            XCTAssertEqual((e as? ToolError)?.tag, "NumberInvalid")
        }
    }
}
