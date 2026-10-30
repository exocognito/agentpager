import XCTest

// Plays the coding agent against the real local server: MCP tools over JSON-RPC at /mcp (stateless streamable
// HTTP), plus the agent's HTTPS status route. Nothing is mocked.
struct ToolError: Error, CustomStringConvertible {
    var body: [String: Any]
    var tag: String { body["error"] as? String ?? "?" }
    var description: String { "ToolError(\(body))" }
}

final class AgentHarness {
    let base: URL
    private var nextId = 1
    var agentId = ""
    var agentKey = ""

    init(base: URL) { self.base = base }

    static var server: URL {
        let env = ProcessInfo.processInfo.environment
        return URL(string: env["AGENTPAGER_SERVER_URL"] ?? "http://192.168.4.99:8787")!
    }

    private func http(_ method: String, _ path: String, headers: [String: String] = [:], body: Data? = nil, timeout: TimeInterval = 70) throws -> (Int, Data) {
        var r = URLRequest(url: base.appendingPathComponent(path))
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

    @discardableResult
    func tool(_ name: String, _ arguments: [String: Any]) throws -> [String: Any] {
        nextId += 1
        let payload: [String: Any] = ["jsonrpc": "2.0", "id": nextId, "method": "tools/call", "params": ["name": name, "arguments": arguments]]
        let (status, data) = try http("POST", "mcp", headers: ["content-type": "application/json", "accept": "application/json, text/event-stream"], body: try JSONSerialization.data(withJSONObject: payload))
        guard status == 200, let envelope = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let result = envelope["result"] as? [String: Any],
              let content = result["content"] as? [[String: Any]], let text = content.first?["text"] as? String else {
            throw ToolError(body: ["error": "BadMCPReply", "status": status, "raw": String(decoding: data, as: UTF8.self)])
        }
        let value = (try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any]) ?? ["text": text]
        if result["isError"] as? Bool == true { throw ToolError(body: value) }
        return value
    }

    // Connects with the owner's pager number: a new agent on that pager.
    func connect(number: String, app: String = "Codex", project: String = "flow") throws {
        let r = try tool("connect", ["number": number, "app": app, "project": project])
        agentId = (r["agent"] as! [String: Any])["agentId"] as! String
        agentKey = r["agentKey"] as! String
    }

    var creds: [String: Any] { ["agentId": agentId, "agentKey": agentKey] }

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
        var args = creds
        args["question"] = question
        return try tool("ask", args)["decisionId"] as! String
    }

    // Returns the answer object, or nil while pending.
    func waitForAnswer(_ decisionId: String, seconds: Int = 20) throws -> [String: Any]? {
        var args = creds
        args["decisionId"] = decisionId
        args["waitSeconds"] = seconds
        let r = try tool("wait", args)
        return r["status"] as? String == "answered" ? r["answer"] as? [String: Any] : nil
    }

    func acknowledge(_ decisionId: String, answerId: String, nextSteps: String) throws {
        var args = creds
        args["decisionId"] = decisionId
        args["acknowledgement"] = ["answerId": answerId, "nextSteps": nextSteps]
        try tool("ack", args)
    }

    func finish() throws { try tool("finish", creds) }

    // Whether the agent's pager is on, from the status tool.
    func pagerOn() throws -> Bool { ((try tool("status", creds))["pager"] as! [String: Any])["on"] as! Bool }

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
