import XCTest

// The design catalogue's phone screens (blueprint/generated/screens/phone): one test per `-demo` state in
// Sample.demo (Preview/Previews.swift), on the mocks' sample data with no network. Each keeps its screenshots in the
// test result and, with DESIGN_DIR set, saves <state>.png and <state>.txt there: a line on what the screen shows, then
// its accessibility tree. Light only: on the iOS 26.5 Simulator, setting dark appearance (XCUIDevice or simctl) left
// the screenshots light (tried 30 Oct 2026). `pnpm designs` runs it; by hand:
//   TEST_RUNNER_DESIGN_DIR=<dir> xcodebuild test ... -only-testing:AgentPagerUITests/DesignTests
final class DesignTests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    func testPagers() { capture("pagers", "Pagers, the root: Work, VM scratch and Acme project, each with its status and open count; Acme is off.", until: "pager-Work") }
    func testEmpty() { capture("empty", "Pagers before there are any: the empty state and the + button.", until: "No pagers") }
    func testPager() { capture("pager", "The Work pager: open decisions grouped by project, oldest first, with who asked; answered ones fold into \"N answered\".", until: "pager-settings") }
    func testDetail() { capture("detail", "Work's detail: the on switch, the name, Turn off, the text to give agents with its number, and Delete pager.", until: "connect-line") }
    func testNew() { capture("new", "The New pager sheet: the name, Turn off after 24 hours, and the text to give agents, before Create.", until: "create-pager") }
    func testDecision() { capture("decision", "An open brief (the M11 decision) at its top: who asked, the question, Context, and the answer bar with nothing picked.", until: "brief-header") }
    func testSelected() { capture("selected", "The same decision with A picked: the tile filled with a tick, and Send option A in the bar.", until: "send-option") }
    func testOptions() { capture("options", "The Options sheet: one option at a time, switched by the segmented control at its top; it never chooses one.", until: "option-picker") }
    func testPage() { capture("page", "A background page in a sheet: Markdown titled by its first heading, with a Mermaid flowchart drawn on the phone.", until: "How the mix-up happens") }
    func testChanges() { capture("changes", "Ask for changes: the note sheet with a draft note and the keyboard up.", until: "feedback-text") }
    func testOff() { capture("off", "A decision on the Acme pager while it is off: \"Acme project pager is off · Turn on\" instead of the answer bar.", until: "pager-off-bar") }
    func testAnswered() { capture("answered", "An answered decision: the closed record, the choice, then the agent's confirmation and next steps.", until: "agent-confirmation") }
    func testUndo() { capture("undo", "The Undo window after Send: \"Sending in …s\" with Undo, over the Work pager.", until: "undo-button") }
    func testNotConfirmed() { capture("notconfirmed", "The \"Answer Not Confirmed\" alert once every retry of an answer failed: Cancel or Retry.", until: "Answer Not Confirmed") }
    func testNotPickedUp() { capture("notpickedup", "An answer no agent read 3 minutes after Send: the warning naming the agent, its computer and its project (I6).", until: "agent-confirmation") }

    private func capture(_ state: String, _ about: String, until marker: String) {
        let app = XCUIApplication()
        app.launchArguments += ["-demo", state]
        app.launch()
        wait(app.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@ OR label == %@", marker, marker)).firstMatch, 15)
        let tree = settle(app)
        let png = XCUIScreen.main.screenshot().pngRepresentation
        let text = "-demo \(state): \(about)\n\n" + tree.joined(separator: "\n") + "\n"
        for (name, data, type) in [("\(state).png", png, "public.png"), ("\(state).txt", Data(text.utf8), "public.plain-text")] {
            let attachment = XCTAttachment(data: data, uniformTypeIdentifier: type)
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
            if let dir = ProcessInfo.processInfo.environment["DESIGN_DIR"] {
                try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
                XCTAssertNoThrow(try data.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name)))
            }
        }
    }

    // Waits until two snapshots 0.5 s apart match (sheets and the keyboard have finished moving), for at most 8 s:
    // the Undo countdown never stops.
    private func settle(_ app: XCUIApplication) -> [String] {
        var last = app.tree()
        let stop = Date().addingTimeInterval(8)
        while Date() < stop {
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
            let now = app.tree()
            if now == last { return now }
            last = now
        }
        return last
    }
}
