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
    var sessionId = ""
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

    struct Started { var code: String; var url: String; var emojis: [String]; var names: [String]; var text: String; var qrText: String }

    func start(name: String, lifetime: String = "24h") throws -> Started {
        let r = try tool("start_session", ["name": name, "lifetime": lifetime])
        let session = r["session"] as! [String: Any]
        sessionId = session["sessionId"] as! String
        agentKey = r["agentKey"] as! String
        let link = r["link"] as! [String: Any]
        let code = r["pairingCode"] as! [String: Any]
        return Started(code: link["code"] as! String, url: link["url"] as! String, emojis: code["emojis"] as! [String], names: code["names"] as! [String], text: code["text"] as! String, qrText: link["qrText"] as! String)
    }

    func join(code: String, name: String) throws -> (emojis: [String], names: [String], text: String) {
        let r = try tool("join_session", ["code": code, "name": name])
        sessionId = (r["session"] as! [String: Any])["sessionId"] as! String
        agentKey = r["agentKey"] as! String
        let c = r["pairingCode"] as! [String: Any]
        return (c["emojis"] as! [String], c["names"] as! [String], c["text"] as! String)
    }

    // Opens a pager with the owner's pager number: paired already, nothing to show.
    func page(number: String, name: String) throws {
        let r = try tool("page_owner", ["number": number, "name": name])
        sessionId = (r["session"] as! [String: Any])["sessionId"] as! String
        agentKey = r["agentKey"] as! String
    }

    var creds: [String: Any] { ["sessionId": sessionId, "agentKey": agentKey] }

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
        return try tool("ask_card", args)["decisionId"] as! String
    }

    // Returns the answer object, or nil while pending.
    func waitForAnswer(_ decisionId: String, seconds: Int = 20) throws -> [String: Any]? {
        var args = creds
        args["decisionId"] = decisionId
        args["waitSeconds"] = seconds
        let r = try tool("wait_for_card_answer", args)
        return r["status"] as? String == "answered" ? r["answer"] as? [String: Any] : nil
    }

    func acknowledge(_ decisionId: String, answerId: String, nextSteps: String) throws {
        var args = creds
        args["decisionId"] = decisionId
        args["acknowledgement"] = ["answerId": answerId, "nextSteps": nextSteps]
        try tool("acknowledge_card", args)
    }

    func finish() throws { try tool("finish_session", creds) }

    // HTTPS agent status route.
    func status() throws -> [String: Any] {
        let (code, data) = try http("GET", "api/sessions/\(sessionId)", headers: ["authorization": "Bearer \(agentKey)"])
        let value = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        if code != 200 { throw ToolError(body: value) }
        return value["session"] as! [String: Any]
    }

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
