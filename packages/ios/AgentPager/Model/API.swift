import Foundation

// Wire types for the AgentPager server (v2: pagers and agents). The server owns every clock; the phone only shows its times.

// When a pager turns off by itself: never, or this long after it was turned on.
nonisolated enum AutoOff: String, Codable, CaseIterable, Identifiable, Sendable {
    case never, day = "24h", week = "7d", month = "30d"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .never: "Never"
        case .day: "After 24 hours"
        case .week: "After 7 days"
        case .month: "After 30 days"
        }
    }
}

// What the server knows of a pager: whether it is on, and when it turns off or turned off. The name is the phone's.
nonisolated struct PagerState: Codable, Hashable, Sendable {
    var pagerId: String
    var on: Bool
    var autoOff: AutoOff
    var offAt: Date?
    var offSince: Date?
    var createdAt: Date
}

// Something that connected to a pager: who asked, the project its decisions are grouped under, and the computer it
// runs on when it said.
nonisolated struct AgentInfo: Codable, Hashable, Sendable {
    var agentId: String
    var app: String
    var project: String
    var machine: String?
    var createdAt: Date
    var finishedAt: Date?
    var lastActivityAt: Date
    var openCount: Int
}

nonisolated struct AgentInbox: Codable, Hashable, Sendable {
    var agent: AgentInfo
    var open: [Decision]
    var answered: [Decision]
}

// One read of a pager: its state and every agent on it with its decisions.
nonisolated struct PagerInbox: Codable, Hashable, Sendable {
    var pager: PagerState
    var agents: [AgentInbox]
}

// A brief's option: a letter (number 1 is A), a label for its answer button and what it prioritizes.
nonisolated struct Option: Codable, Hashable, Sendable {
    var number: Int
    var title: String
    var label: String?
    var prioritizes: String?

    var letter: String { String(UnicodeScalar(UInt8(64 + min(max(number, 1), 26)))) }
}

nonisolated struct Card: Codable, Hashable, Sendable {
    var type: String
    var options: [Option]
    var recommended: Int?
    var markdown: String?
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
    // When an agent first read the answer, and when the service warned that none had. Neither means received (I6).
    var collectedAt: Date?
    var warnedAt: Date?
    var acknowledgement: Acknowledgement?
    var id: String { decisionId }

    func option(_ number: Int) -> Option? { card.options.first { $0.number == number } }
    // An answer in words: "B. Table".
    func choiceText(_ choice: Choice) -> String {
        switch choice {
        case .option(let n): option(n).map { "\($0.letter). \($0.title)" } ?? "Option \(n)"
        case .feedback(let text): text
        }
    }
}

nonisolated struct Receipt: Codable, Sendable { var decisionId: String; var answerId: String; var sentAt: Date }
nonisolated struct PagerReply: Codable, Sendable { var pager: PagerState }
nonisolated struct Done: Codable, Sendable { var ok: Bool }

nonisolated struct ErrorBody: Codable, Sendable {
    var error: String
    var message: String?
    var reason: String?
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

// Which client this is, on every request: `ios/<protocol> <build>`. The header and the protocol mirror CLIENT_HEADER
// and PROTOCOL in packages/contract/exchange.ts, which packages/contract/mirror.test.ts checks.
nonisolated enum ClientVersion {
    static let header = "x-agentpager-client"
    static let protocolNumber = 1
    static let value: String = {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "0"
        let build = info?["CFBundleVersion"] as? String ?? "0"
        return "ios/\(protocolNumber) \(version)+\(build)"
    }()
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
        r.setValue(ClientVersion.value, forHTTPHeaderField: ClientVersion.header)
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

    // Phone routes. Each pager has its own phone key.
    func createPager(_ p: LocalPager, autoOff: AutoOff) async throws(APIError) -> PagerReply {
        try await request("POST", "api/pagers", phoneKey: p.phoneKey, body: ["number": p.number, "publicKey": p.publicKey, "autoOff": autoOff.rawValue])
    }
    func pager(_ p: LocalPager) async throws(APIError) -> PagerInbox {
        try await request("GET", "api/pagers/\(p.pagerId)", phoneKey: p.phoneKey)
    }
    func setOn(_ p: LocalPager, _ on: Bool) async throws(APIError) -> PagerReply {
        struct Body: Encodable, Sendable { var on: Bool }
        return try await request("POST", "api/pagers/\(p.pagerId)/settings", phoneKey: p.phoneKey, body: Body(on: on))
    }
    func setAutoOff(_ p: LocalPager, _ autoOff: AutoOff) async throws(APIError) -> PagerReply {
        try await request("POST", "api/pagers/\(p.pagerId)/settings", phoneKey: p.phoneKey, body: ["autoOff": autoOff.rawValue])
    }
    func delete(_ p: LocalPager) async throws(APIError) {
        let _: Done = try await request("POST", "api/pagers/\(p.pagerId)/delete", phoneKey: p.phoneKey)
    }
    // Where this phone gets alerts for the pager's agents.
    func push(_ p: LocalPager, token: String, environment: String) async throws(APIError) {
        let _: Done = try await request("POST", "api/pagers/\(p.pagerId)/push", phoneKey: p.phoneKey, body: ["token": token, "environment": environment])
    }
    func answer(_ p: LocalPager, agentId: String, decisionId: String, requestId: String, choice: Choice) async throws(APIError) -> Receipt {
        struct Body: Encodable, Sendable { var requestId: String; var choice: Choice }
        return try await request("POST", "api/agents/\(agentId)/cards/\(decisionId)/answer", phoneKey: p.phoneKey, body: Body(requestId: requestId, choice: choice))
    }
    // One attachment of a brief, as the agent sent it.
    func file(_ p: LocalPager, agentId: String, decisionId: String, name: String) async throws(APIError) -> Data {
        try await raw("GET", "api/agents/\(agentId)/cards/\(decisionId)/files/\(name)", phoneKey: p.phoneKey, timeout: 30)
    }
}

nonisolated func randomToken() -> String {
    var bytes = [UInt8](repeating: 0, count: 24)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    return Data(bytes).base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
}
