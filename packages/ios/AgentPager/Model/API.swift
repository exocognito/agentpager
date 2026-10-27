import Foundation

// Wire types for the AgentPager server. The server owns every clock; the phone only shows its times.

nonisolated enum Lifetime: String, Codable, CaseIterable, Identifiable, Sendable {
    case day = "24h", week = "7d", month = "30d"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .day: "24 Hours"
        case .week: "7 Days"
        case .month: "30 Days"
        }
    }
    var note: String {
        switch self {
        case .day: "The pager ends 24 hours after your agent connects, unless you or your agent end it sooner."
        case .week: "The pager ends 7 days after your agent connects, unless you or your agent end it sooner."
        case .month: "The pager ends 30 days after your agent connects, unless you or your agent end it sooner."
        }
    }
}

nonisolated enum PagerStatus: String, Codable, Sendable { case waiting, unpaired, active, ended }

nonisolated enum EndReason: String, Codable, Sendable {
    case timedOut, ownerEnded, agentFinished, pairingFailed
    var sentence: String {
        switch self {
        case .timedOut: "It reached its end time."
        case .ownerEnded: "You ended it."
        case .agentFinished: "Your agent finished and ended it."
        case .pairingFailed: "Pairing failed after 3 wrong codes."
        }
    }
}

nonisolated struct PagerSummary: Codable, Hashable, Sendable {
    var sessionId: String
    var name: String?
    var status: PagerStatus
    var lifetime: Lifetime?
    var createdAt: Date?
    var pairedAt: Date?
    var endsAt: Date?
    var triesLeft: Int?
    var openCount: Int?
    var lastActivityAt: Date?
    var endedAt: Date?
    var endReason: EndReason?
}

// A generic card's option has an emoji and maybe detail; a brief's option has a letter (number 1 is A), a label
// for its answer button and what it prioritizes.
nonisolated struct Option: Codable, Hashable, Sendable {
    var number: Int
    var emoji: String?
    var title: String
    var detail: String?
    var label: String?
    var prioritizes: String?

    var letter: String { String(UnicodeScalar(UInt8(64 + min(max(number, 1), 26)))) }
    // What tells options apart: the emoji, or the brief's letter.
    var mark: String { emoji ?? letter }
}

nonisolated struct Card: Codable, Hashable, Sendable {
    var type: String
    var options: [Option]
    var recommended: Int?
    var markdown: String?

    var isBrief: Bool { type == "brief" }
}

// An attachment the agent sent with a brief: the decision names it; the bytes come from its own route.
nonisolated struct AttachmentInfo: Codable, Hashable, Sendable {
    var name: String
    var type: String
    var bytes: Int
}

nonisolated enum Choice: Codable, Hashable, Sendable {
    case option(Int)
    case feedback(String)

    private enum Keys: String, CodingKey { case kind, number, text }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "option": self = .option(try c.decode(Int.self, forKey: .number))
        default: self = .feedback(try c.decode(String.self, forKey: .text))
        }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        switch self {
        case .option(let n): try c.encode("option", forKey: .kind); try c.encode(n, forKey: .number)
        case .feedback(let t): try c.encode("feedback", forKey: .kind); try c.encode(t, forKey: .text)
        }
    }
}

nonisolated struct Answer: Codable, Hashable, Sendable {
    var answerId: String
    var decisionId: String
    var choice: Choice
    var sentAt: Date
}

nonisolated struct Acknowledgement: Codable, Hashable, Sendable {
    var decisionId: String
    var answerId: String
    var nextSteps: String
    var acknowledgedAt: Date
}

nonisolated enum DecisionStatus: String, Codable, Sendable { case open, answered, feedback, acknowledged }

nonisolated struct Decision: Codable, Hashable, Identifiable, Sendable {
    var decisionId: String
    var status: DecisionStatus
    var title: String
    var detail: String?
    var card: Card
    var attachments: [AttachmentInfo]?
    var askedAt: Date
    var answer: Answer?
    var acknowledgement: Acknowledgement?
    var id: String { decisionId }

    func option(_ number: Int) -> Option? { card.options.first { $0.number == number } }
    // An answer in words: "📨 Send now", or a brief's "B. Table".
    func choiceText(_ choice: Choice) -> String {
        switch choice {
        case .option(let n): option(n).map { card.isBrief ? "\($0.letter). \($0.title)" : "\($0.mark) \($0.title)" } ?? "Option \(n)"
        case .feedback(let text): text
        }
    }
}

nonisolated struct Inbox: Codable, Hashable, Sendable {
    var session: PagerSummary
    var open: [Decision]
    var answered: [Decision]
}

nonisolated struct Receipt: Codable, Sendable { var decisionId: String; var answerId: String; var sentAt: Date }
nonisolated struct PaletteEntry: Codable, Hashable, Sendable { var emoji: String; var name: String }
nonisolated struct StartInfo: Codable, Sendable {
    var status: PagerStatus
    var name: String?
    var palette: [PaletteEntry]
    var triesLeft: Int
    var endsAt: Date
    var lifetime: Lifetime?
}
nonisolated struct LinkInfo: Codable, Hashable, Sendable { var code: String; var url: String }
nonisolated struct CreatedPager: Codable, Sendable { var session: PagerSummary; var link: LinkInfo }
nonisolated struct SessionEnvelope: Codable, Sendable { var session: PagerSummary }
nonisolated struct NumberMade: Codable, Sendable { var number: String }
nonisolated struct NumberPagers: Codable, Sendable { var sessionIds: [String] }
nonisolated struct Done: Codable, Sendable { var ok: Bool }

nonisolated struct ErrorBody: Codable, Sendable {
    var error: String
    var message: String?
    var reason: String?
    var triesLeft: Int?
    var endReason: EndReason?
}

nonisolated enum APIError: Error, Sendable {
    case server(status: Int, body: ErrorBody)
    case transport(String)

    var tag: String? { if case .server(_, let b) = self { b.error } else { nil } }
    var isTransport: Bool {
        switch self {
        case .transport: true
        case .server(let status, _): status >= 500
        }
    }
}

nonisolated struct APIClient: Sendable {
    let base: URL

    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            if let date = parseDate(text) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Bad date \(text)"))
        }
        return d
    }()

    static func parseDate(_ text: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = fractional.date(from: text) { return d }
        return ISO8601DateFormatter().date(from: text)
    }

    func request<T: Decodable & Sendable>(_ method: String, _ path: String, phoneKey: String? = nil, body: (any Encodable & Sendable)? = nil, timeout: TimeInterval = 15) async throws(APIError) -> T {
        let data = try await raw(method, path, phoneKey: phoneKey, body: body, timeout: timeout)
        do { return try Self.decoder.decode(T.self, from: data) } catch { throw .transport("decode \(path): \(error)") }
    }

    func raw(_ method: String, _ path: String, phoneKey: String? = nil, body: (any Encodable & Sendable)? = nil, timeout: TimeInterval = 15) async throws(APIError) -> Data {
        var r = URLRequest(url: base.appending(path: path))
        r.httpMethod = method
        r.timeoutInterval = timeout
        r.cachePolicy = .reloadIgnoringLocalCacheData
        r.setValue("application/json", forHTTPHeaderField: "content-type")
        if let phoneKey { r.setValue(phoneKey, forHTTPHeaderField: "x-phone-key") }
        if let body {
            do { r.httpBody = try JSONEncoder().encode(body) } catch { throw .transport("encode: \(error)") }
        }
        let data: Data, response: URLResponse
        do { (data, response) = try await URLSession.shared.data(for: r) } catch { throw .transport(error.localizedDescription) }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let body = (try? Self.decoder.decode(ErrorBody.self, from: data)) ?? ErrorBody(error: "HTTP\(status)")
            throw .server(status: status, body: body)
        }
        return data
    }

    // Phone routes.
    func createPager(lifetime: Lifetime, phoneKey: String) async throws(APIError) -> CreatedPager {
        try await request("POST", "api/pagers", phoneKey: phoneKey, body: ["lifetime": lifetime.rawValue])
    }
    // A new number retires this phone key's old one at once.
    func makeNumber(phoneKey: String) async throws(APIError) -> NumberMade {
        try await request("POST", "api/numbers", phoneKey: phoneKey)
    }
    func numberPagers(phoneKey: String) async throws(APIError) -> NumberPagers {
        try await request("GET", "api/numbers", phoneKey: phoneKey)
    }
    func inbox(_ key: PagerKey) async throws(APIError) -> Inbox {
        try await request("GET", "api/sessions/\(key.sessionId)/cards", phoneKey: key.phoneKey)
    }
    func answer(_ key: PagerKey, decisionId: String, requestId: String, choice: Choice) async throws(APIError) -> Receipt {
        struct Body: Encodable, Sendable { var requestId: String; var choice: Choice }
        return try await request("POST", "api/sessions/\(key.sessionId)/cards/\(decisionId)/answer", phoneKey: key.phoneKey, body: Body(requestId: requestId, choice: choice))
    }
    // One attachment of a brief, as the agent sent it.
    func file(_ key: PagerKey, decisionId: String, name: String) async throws(APIError) -> Data {
        try await raw("GET", "api/sessions/\(key.sessionId)/cards/\(decisionId)/files/\(name)", phoneKey: key.phoneKey, timeout: 30)
    }
    func end(_ key: PagerKey) async throws(APIError) -> SessionEnvelope {
        try await request("POST", "api/sessions/\(key.sessionId)/end", phoneKey: key.phoneKey)
    }
    func setLifetime(_ key: PagerKey, _ lifetime: Lifetime) async throws(APIError) -> SessionEnvelope {
        try await request("POST", "api/sessions/\(key.sessionId)/lifetime", phoneKey: key.phoneKey, body: ["lifetime": lifetime.rawValue])
    }
    // Where this phone gets alerts: given to each pager it holds, and to its pager number for pagers agents open later.
    func push(_ key: PagerKey, token: String, environment: String) async throws(APIError) {
        let _: Done = try await request("POST", "api/sessions/\(key.sessionId)/push", phoneKey: key.phoneKey, body: ["token": token, "environment": environment])
    }
    func numberPush(phoneKey: String, token: String, environment: String) async throws(APIError) {
        let _: Done = try await request("POST", "api/numbers/push", phoneKey: phoneKey, body: ["token": token, "environment": environment])
    }
    func startInfo(code: String) async throws(APIError) -> StartInfo {
        try await request("GET", "api/start/\(code)")
    }
    func pair(code: String, emojis: [String], phoneKey: String) async throws(APIError) -> SessionEnvelope {
        try await request("POST", "api/start/\(code)/pair", phoneKey: phoneKey, body: ["code": emojis])
    }
}

nonisolated func randomToken() -> String {
    var bytes = [UInt8](repeating: 0, count: 24)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    return Data(bytes).base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
}
