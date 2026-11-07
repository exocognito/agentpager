import XCTest

// Plays the coding agent against the real local server over its HTTP API, as the agentpager command does (the
// hosted MCP server is retired). Nothing is mocked.
struct ToolError: Error, @unchecked Sendable, CustomStringConvertible {
    var body: [String: Any]
    var tag: String { body["error"] as? String ?? "?" }
    var description: String { "ToolError(\(body))" }
}

final class AgentHarness {
    // The agentpager command's client header, as this harness plays it. It mirrors CLIENT_HEADER and PROTOCOL in
    // packages/contract/exchange.ts, which packages/contract/mirror.test.ts checks.
    static let clientHeader = "x-agentpager-client"
    static let clientVersion = "uitests/1 harness"

    let base: URL
    var agentId = ""
    var agentKey = ""

    init(base: URL) { self.base = base }

    static var server: URL {
        let env = ProcessInfo.processInfo.environment
        return URL(string: env["AGENTPAGER_SERVER_URL"] ?? "http://192.168.4.99:8787")!
    }

    private func http(_ method: String, _ path: String, headers: [String: String] = [:], body: Data? = nil, timeout: TimeInterval = 70) throws -> (Int, Data) {
        var r = URLRequest(url: URL(string: path, relativeTo: base)!.absoluteURL)
        r.httpMethod = method
        r.timeoutInterval = timeout
        for (k, v) in headers { r.setValue(v, forHTTPHeaderField: k) }
        r.httpBody = body
        let done = DispatchSemaphore(value: 0)
        nonisolated(unsafe) var result: (Int, Data)?
        nonisolated(unsafe) var failure: Error?
        URLSession.shared.dataTask(with: r) { data, response, error in
            if let error { failure = error } else { result = ((response as? HTTPURLResponse)?.statusCode ?? 0, data ?? Data()) }
            done.signal()
        }.resume()
        done.wait()
        if let failure { throw failure }
        return result!
    }

    // One API call; a refusal throws its {error, message, ...} body.
    @discardableResult
    func call(_ method: String, _ path: String, _ body: [String: Any]? = nil, timeout: TimeInterval = 70) throws -> [String: Any] {
        var headers = ["content-type": "application/json", Self.clientHeader: Self.clientVersion]
        if !agentKey.isEmpty { headers["authorization"] = "Bearer \(agentKey)" }
        let (status, data) = try http(method, path, headers: headers, body: try body.map { try JSONSerialization.data(withJSONObject: $0) }, timeout: timeout)
        let value = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? ["error": "BadReply", "raw": String(decoding: data, as: UTF8.self)]
        if !(200..<300).contains(status) { throw ToolError(body: value) }
        return value
    }

    // Connects with the owner's pager number: a new agent on that pager, on the computer named, if any.
    func connect(number: String, app: String = "Codex", project: String = "flow", machine: String? = nil) throws {
        agentKey = ""
        var input = ["number": number, "app": app, "project": project]
        if let machine { input["machine"] = machine }
        let r = try call("POST", "api/agents", input)
        agentId = (r["agent"] as! [String: Any])["agentId"] as! String
        agentKey = r["agentKey"] as! String
    }

    // Every card is a brief: here its short form, each option's title on its answer button.
    func ask(_ title: String, detail: String? = nil, options: [String], recommended: Int? = nil) throws -> String {
        var markdown = "## Options\n"
        if let recommended { markdown += "\n## Recommendation: \(String(UnicodeScalar(UInt8(64 + recommended))))\n" }
        var card: [String: Any] = ["type": "brief", "markdown": markdown, "options": options.enumerated().map { i, o -> [String: Any] in
            ["number": i + 1, "title": o, "prioritizes": o]
        }]
        if let recommended { card["recommended"] = recommended }
        // The command chooses each ask's request id.
        var question: [String: Any] = ["requestId": Self.token(), "title": title, "card": card]
        if let detail { question["detail"] = detail }
        return try call("POST", "api/agents/\(agentId)/cards", question)["decisionId"] as! String
    }

    // 32 URL-safe characters, as the command's ids are.
    static func token() -> String {
        let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
        return String((0..<32).map { _ in alphabet.randomElement()! })
    }

    // Returns the answer object, or nil while pending.
    func waitForAnswer(_ decisionId: String, seconds: Int = 20) throws -> [String: Any]? {
        let r = try call("GET", "api/agents/\(agentId)/cards/\(decisionId)/answer?wait=\(seconds)")
        return r["status"] as? String == "answered" ? r["answer"] as? [String: Any] : nil
    }

    func acknowledge(_ decisionId: String, answerId: String, nextSteps: String) throws {
        try call("POST", "api/agents/\(agentId)/cards/\(decisionId)/acknowledge", ["answerId": answerId, "nextSteps": nextSteps])
    }

    func finish() throws { try call("POST", "api/agents/\(agentId)/finish") }

    // Whether the agent's pager is on, from the status route.
    func pagerOn() throws -> Bool { ((try call("GET", "api/agents/\(agentId)"))["pager"] as! [String: Any])["on"] as! Bool }

    static func date(_ text: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: text) ?? ISO8601DateFormatter().date(from: text)!
    }
}

@MainActor
extension XCTestCase {
    // A frame of this test's journey: the screenshot, and the action that led to it. Kept in the test result and,
    // with SCREENSHOT_DIR set, saved as <dir>/<test>/<name>.png with a line "<name>\t<action>" in frames.tsv, so
    // the journey reads frame, action, frame (blueprint/generated/screens/journeys).
    func shot(_ name: String, after action: String) {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        let attachment = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        guard let dir = ProcessInfo.processInfo.environment["SCREENSHOT_DIR"] else { return }
        // "-[FlowTests testPagerJourney]" -> "testPagerJourney"
        let test = String(self.name.split(separator: " ").last?.dropLast() ?? "test")
        let folder = URL(fileURLWithPath: dir).appendingPathComponent(test)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try? png.write(to: folder.appendingPathComponent("\(name).png"))
        let line = Data("\(name)\t\(action)\n".utf8), log = folder.appendingPathComponent("frames.tsv")
        if let file = try? FileHandle(forWritingTo: log) {
            file.seekToEndOfFile()
            file.write(line)
            file.closeFile()
        } else {
            try? line.write(to: log)
        }
    }

    func wait(_ element: XCUIElement, _ seconds: TimeInterval = 10, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: seconds), "missing \(element)", file: file, line: line)
    }

    func waitUntil(_ seconds: TimeInterval = 10, _ what: String, file: StaticString = #filePath, line: UInt = #line, _ condition: () -> Bool) {
        let stop = Date().addingTimeInterval(seconds)
        while Date() < stop {
            if condition() { return }
            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }
        XCTFail("timed out: \(what)", file: file, line: line)
    }
}

@MainActor
extension XCUIApplication {
    // What is on screen as text: one line per element worth naming, indented by depth, as type #identifier "label"
    // value="…" [x,y wxh] in points, then disabled or selected. The keyboard is summarised.
    func tree() -> [String] {
        guard let snap = try? snapshot() else { return ["(no snapshot)"] }
        var lines: [String] = []
        func walk(_ s: XCUIElementSnapshot, _ depth: Int) {
            if s.elementType == .keyboard { lines.append(String(repeating: " ", count: depth) + "keyboard"); return }
            let value = (s.value as? String).map { $0.isEmpty ? "" : " value=\"\($0)\"" } ?? ""
            let named = !s.identifier.isEmpty || !s.label.isEmpty || !value.isEmpty
            var next = depth
            if named || s.elementType != .other {
                let f = s.frame
                var line = String(repeating: " ", count: depth) + (Self.names[s.elementType] ?? "e\(s.elementType.rawValue)")
                if !s.identifier.isEmpty { line += " #\(s.identifier)" }
                if !s.label.isEmpty { line += " \"\(s.label)\"" }
                line += value
                line += " [\(Int(f.minX)),\(Int(f.minY)) \(Int(f.width))x\(Int(f.height))]"
                if !s.isEnabled { line += " disabled" }
                if s.isSelected { line += " selected" }
                lines.append(line)
                next = depth + 1
            }
            for child in s.children { walk(child, next) }
        }
        walk(snap, 0)
        return lines
    }

    private static let names: [XCUIElement.ElementType: String] = [
        .application: "app", .window: "window", .alert: "alert", .sheet: "sheet", .button: "button",
        .navigationBar: "navbar", .staticText: "text", .textField: "textField", .textView: "textView",
        .cell: "cell", .switch: "switch", .toggle: "toggle", .image: "image", .icon: "icon", .link: "link",
        .scrollView: "scroll", .collectionView: "collection", .table: "table", .menu: "menu", .menuItem: "menuItem",
        .toolbar: "toolbar", .statusBar: "statusBar", .group: "group", .other: "other", .searchField: "search",
        .segmentedControl: "segmented", .picker: "picker", .activityIndicator: "spinner",
        .progressIndicator: "progress", .tabBar: "tabBar", .menuButton: "menuButton", .popover: "popover",
    ]
}
