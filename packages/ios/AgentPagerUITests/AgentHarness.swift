import XCTest

// Plays the coding agent against the real local server over its HTTP API, as the agentpager command does (the
// hosted MCP server is retired). Nothing is mocked.
struct ToolError: Error, CustomStringConvertible {
    var body: [String: Any]
    var tag: String { body["error"] as? String ?? "?" }
    var description: String { "ToolError(\(body))" }
}

final class AgentHarness {
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
        var result: (Int, Data)?
        var failure: Error?
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
        var headers = ["content-type": "application/json"]
        if !agentKey.isEmpty { headers["authorization"] = "Bearer \(agentKey)" }
        let (status, data) = try http(method, path, headers: headers, body: try body.map { try JSONSerialization.data(withJSONObject: $0) }, timeout: timeout)
        let value = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? ["error": "BadReply", "raw": String(decoding: data, as: UTF8.self)]
        if !(200..<300).contains(status) { throw ToolError(body: value) }
        return value
    }

    // Connects with the owner's pager number: a new agent on that pager.
    func connect(number: String, app: String = "Codex", project: String = "flow") throws {
        agentKey = ""
        let r = try call("POST", "api/agents", ["number": number, "app": app, "project": project])
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
        var question: [String: Any] = ["title": title, "card": card]
        if let detail { question["detail"] = detail }
        return try call("POST", "api/agents/\(agentId)/cards", question)["decisionId"] as! String
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

extension XCTestCase {
    func shot(_ name: String) {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        let attachment = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = ProcessInfo.processInfo.environment["SCREENSHOT_DIR"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
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
