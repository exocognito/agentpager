import Foundation

// The plaintext of each kind of encrypted part, mirroring packages/contract/parts.ts: JSON as UTF-8, read as
// JavaScript reads it (PartJSON.swift), decoded strictly (a field the shape doesn't have, or null for one it may
// leave out, is refused) and held to the contract's limits.
// An attachment's plaintext is the file's bytes and has no shape here. A card's brief is held to the contract's
// Markdown rules too (BriefRules.swift). Anyone with the pager's public key can seal a card, so the app keeps
// drawing a brief's Markdown as untrusted all the same: only an https link leaves it.

public struct PartError: Error, Hashable, Sendable {
    public let problem: String
    init(_ problem: String) { self.problem = problem }
}

// The limits, as values.ts, exchange.ts, brief.ts and parts.ts set them.
enum Limits {
    static let title = 100, text = 280, body = 1000, label = 60, optionLabel = 20, brief = 20_000
    static let options = 2...4, attachments = 8, previewBytes = 2048
}

public protocol Part: Sendable {
    // A preview must fit Apple's alert payload once sealed.
    static var maxBytes: Int? { get }
    init(json: PartJSON) throws(PartError)
}
extension Part { public static var maxBytes: Int? { nil } }

public enum Parts {
    // UTF-8 only, then JSON as JavaScript reads it (PartJSON), then the shape.
    public static func decode<P: Part>(_ type: P.Type, from data: Data) throws(PartError) -> P {
        if let max = P.maxBytes, data.count > max { throw PartError("a preview may not exceed \(max) bytes") }
        guard String(validating: data, as: UTF8.self) != nil else { throw PartError("not UTF-8") }
        return try P(json: PartJSON([UInt8](data)))
    }
}

public struct BriefOptionPart: Sendable, Hashable {
    public var number: Int
    public var title: String
    public var label: String?
    public var prioritizes: String
    public var letter: String { String(UnicodeScalar(UInt8(64 + number))) }
}
public struct BriefPart: Sendable, Hashable {
    public var options: [BriefOptionPart]
    public var recommended: Int?
    public var markdown: String
}
public struct AttachmentEntryPart: Sendable, Hashable {
    public var name: String
    public var type: String
}
// A card. Attachment i of `attachments` is the part sealed with index i. The phone seals its answer to answerKey.
public struct CardPart: Part, Hashable {
    public var title: String
    public var detail: String?
    public var card: BriefPart
    public var attachments: [AttachmentEntryPart]?
    public var answerKey: String
}
// Who asked, the project and the computer, with the agent's own key: the phone takes a card as this agent's only when
// the card names the same key.
public struct IdentityPart: Part, Hashable {
    public var app: String
    public var project: String
    public var machine: String?
    public var answerKey: String
}
public enum ChoicePart: Sendable, Hashable {
    case option(Int)
    case feedback(String)
}
public struct AnswerPart: Part, Hashable {
    public var choice: ChoicePart
    public init(choice: ChoicePart) { self.choice = choice }
    // The bytes the phone seals: sorted keys, slashes as they are, as the vectors pin.
    public func encoded() -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return (try? encoder.encode(self)) ?? Data()
    }
}
public struct AcknowledgementPart: Part, Hashable {
    public var nextSteps: String
}
public struct RecommendedPart: Sendable, Hashable {
    public var letter: String
    public var title: String
}
// An alert's preview: the question, its detail, the recommended option, who asked, the project and the machine.
public struct DecisionPreviewPart: Part, Hashable {
    public var title: String
    public var detail: String?
    public var recommended: RecommendedPart?
    public var app: String
    public var project: String
    public var machine: String?
    public static var maxBytes: Int? { Limits.previewBytes }
}
public struct AcknowledgementPreviewPart: Part, Hashable {
    public var nextSteps: String
    public var app: String
    public var project: String
    public var title: String
    public static var maxBytes: Int? { Limits.previewBytes }
}

// Decoding, from PartJSON's values: a field the shape doesn't have is refused, and so is null for one it may leave
// out. Field names are ASCII (PartJSON refuses others), and literals are compared scalar for scalar, never by
// Swift's canonical equivalence.

typealias Value = PartJSON.Value
struct Fields {
    let fields: [String: Value]
    init(_ value: Value, _ names: Set<String>) throws(PartError) {
        guard case .object(let fields) = value else { throw PartError("not an object") }
        if let extra = fields.keys.first(where: { !names.contains($0) }) { throw PartError("\(extra): not a field") }
        self.fields = fields
    }
    func required(_ name: String) throws(PartError) -> Value {
        guard let v = fields[name] else { throw PartError("\(name): missing") }
        return v
    }
    func optional(_ name: String) throws(PartError) -> Value? {
        guard let v = fields[name] else { return nil }
        if case .null = v { throw PartError("\(name): may be left out, not null") }
        return v
    }
}
func same(_ a: String, _ b: String) -> Bool { a.unicodeScalars.elementsEqual(b.unicodeScalars) }
func string(_ v: Value, _ field: String) throws(PartError) -> String {
    guard case .string(let s) = v else { throw PartError("\(field): not a string") }
    return s
}
// A whole number, as effect's Schema.int() takes one: finite, integral and safe.
func integer(_ v: Value, _ field: String) throws(PartError) -> Int {
    guard case .number(let d) = v, d.isFinite, d.rounded(.towardZero) == d, abs(d) <= 9_007_199_254_740_991 else { throw PartError("\(field): not a whole number") }
    return Int(d)
}
func prose(_ v: Value, max: Int, _ field: String) throws(PartError) -> String { try prose(string(v, field), max: max, field) }
func array(_ v: Value, _ field: String) throws(PartError) -> [Value] {
    guard case .array(let items) = v else { throw PartError("\(field): not a list") }
    return items
}

// Text as values.ts checks it: no HTML opener, not blank as JavaScript's trim() reads blank, and at most `max`
// visible characters, which Swift counts as grapheme clusters, as Intl.Segmenter does (the two can differ on a rare
// sequence that their Unicode versions segment differently). PartJSON refuses a lone surrogate, so text is
// well-formed.
let jsWhitespace = Set<UInt32>([0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF] + Array(0x2000...0x200A))
func prose(_ text: String, max: Int, _ field: String) throws(PartError) -> String {
    let scalars = Array(text.unicodeScalars)
    if scalars.allSatisfy({ jsWhitespace.contains($0.value) }) { throw PartError("\(field): text may not be blank") }
    for (i, s) in scalars.enumerated() where s == "<" && i + 1 < scalars.count {
        let next = scalars[i + 1]
        if next.isASCII && (next.properties.isAlphabetic || "/!?".unicodeScalars.contains(next)) { throw PartError("\(field): text may not contain HTML") }
    }
    if text.count > max { throw PartError("\(field): text may not exceed \(max) characters") }
    return text
}

// A public key as the contract's AnswerKey takes it: 32 bytes as canonical base64url.
func publicKey(_ v: Value, _ field: String) throws(PartError) -> String {
    let key = try string(v, field)
    guard key.utf8.count == 43, Envelope.fromBase64url(key)?.count == 32 else { throw PartError("\(field): a public key is 32 bytes as canonical base64url") }
    return key
}

extension Parts {
    // An attachment that is a Markdown page, as the command holds one before it seals it (brief.ts PageInput and
    // Attachments): UTF-8, at most a million bytes, not blank, at most 20,000 characters, no HTML outside code, and every
    // image or page it names one of its card's attachments. The service can't read a page, so the phone holds it to this
    // before showing any of it.
    public static let pageMaxBytes = 1_000_000
    public static func page(_ data: Data, attachments: [(name: String, type: String)]) throws(PartError) -> String {
        guard data.count <= pageMaxBytes else { throw PartError("a page may not exceed \(pageMaxBytes) bytes") }
        guard let text = String(validating: data, as: UTF8.self) else { throw PartError("a page is UTF-8 text") }
        if text.unicodeScalars.allSatisfy({ jsWhitespace.contains($0.value) }) { throw PartError("a page may not be blank") }
        if text.count > Limits.brief { throw PartError("a page may not exceed \(Limits.brief) characters") }
        if BriefRules.htmlOutsideCode(text) { throw PartError("HTML is not allowed outside fenced code blocks") }
        if let problem = BriefRules.missingAttachment(text, attachments.map { AttachmentEntryPart(name: $0.name, type: $0.type) }) { throw PartError(problem) }
        return text
    }
}

extension BriefOptionPart {
    init(_ v: Value) throws(PartError) {
        let f = try Fields(v, ["number", "title", "label", "prioritizes"])
        number = try integer(f.required("number"), "number")
        title = try prose(f.required("title"), max: Limits.text, "title")
        label = try f.optional("label").map { v throws(PartError) in try prose(v, max: Limits.optionLabel, "label") }
        prioritizes = try prose(f.required("prioritizes"), max: Limits.text, "prioritizes")
    }
}
extension BriefPart {
    init(_ v: Value) throws(PartError) {
        let f = try Fields(v, ["type", "options", "recommended", "markdown"])
        guard same(try string(f.required("type"), "type"), "brief") else { throw PartError("type: a card is a brief") }
        var options: [BriefOptionPart] = []
        for item in try array(f.required("options"), "options") { options.append(try BriefOptionPart(item)) }
        self.options = options
        guard Limits.options.contains(options.count) else { throw PartError("options: a brief offers 2 to 4") }
        guard options.enumerated().allSatisfy({ $0.element.number == $0.offset + 1 }) else { throw PartError("options are numbered 1..n in order") }
        recommended = try f.optional("recommended").map { v throws(PartError) in try integer(v, "recommended") }
        if let r = recommended, !options.contains(where: { $0.number == r }) { throw PartError("recommended must name an offered option") }
        markdown = try string(f.required("markdown"), "markdown")
        if markdown.unicodeScalars.allSatisfy({ jsWhitespace.contains($0.value) }) { throw PartError("markdown: text may not be blank") }
        if markdown.count > Limits.brief { throw PartError("markdown: a brief may not exceed \(Limits.brief) characters") }
        if BriefRules.htmlOutsideCode(markdown) { throw PartError("markdown: HTML is not allowed outside fenced code blocks") }
        if let problem = BriefRules.briefProblem(markdown, optionCount: options.count, recommended: recommended) { throw PartError("card: \(problem)") }
    }
}
let extensions = ["text/markdown": [".md"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"]]
extension AttachmentEntryPart {
    init(_ v: Value) throws(PartError) {
        let f = try Fields(v, ["name", "type"])
        name = try string(f.required("name"), "name")
        type = try string(f.required("type"), "type")
        let n = Array(name.unicodeScalars)
        func alnum(_ s: Unicode.Scalar) -> Bool { s.isASCII && (s.properties.isAlphabetic || ("0"..."9").contains(s)) }
        guard (1...64).contains(n.count), alnum(n[0]), n.allSatisfy({ alnum($0) || $0 == "." || $0 == "_" || $0 == "-" }) else { throw PartError("name: an attachment name is 1 to 64 letters, digits, dots, dashes or underscores") }
        guard let ends = extensions.first(where: { same($0.key, type) })?.value else { throw PartError("type: not an attachment type") }
        guard ends.contains(where: { name.lowercased().hasSuffix($0) }) else { throw PartError("name: must end in \(ends.joined(separator: " or ")) for \(type)") }
    }
}
extension CardPart {
    public init(json: PartJSON) throws(PartError) {
        let f = try Fields(json.value, ["title", "detail", "card", "attachments", "answerKey"])
        title = try prose(f.required("title"), max: Limits.title, "title")
        detail = try f.optional("detail").map { v throws(PartError) in try prose(v, max: Limits.text, "detail") }
        card = try BriefPart(f.required("card"))
        if let list = try f.optional("attachments") {
            var a: [AttachmentEntryPart] = []
            for item in try array(list, "attachments") { a.append(try AttachmentEntryPart(item)) }
            guard a.count <= Limits.attachments else { throw PartError("attachments: at most \(Limits.attachments)") }
            guard Set(a.map(\.name)).count == a.count else { throw PartError("attachment names must be unique") }
            attachments = a
        } else { attachments = nil }
        if let problem = BriefRules.missingAttachment(card.markdown, attachments ?? []) { throw PartError(problem) }
        answerKey = try publicKey(f.required("answerKey"), "answerKey")
    }
}
extension IdentityPart {
    public init(json: PartJSON) throws(PartError) {
        let f = try Fields(json.value, ["app", "project", "machine", "answerKey"])
        app = try prose(f.required("app"), max: Limits.label, "app")
        project = try prose(f.required("project"), max: Limits.label, "project")
        machine = try f.optional("machine").map { v throws(PartError) in try prose(v, max: Limits.label, "machine") }
        answerKey = try publicKey(f.required("answerKey"), "answerKey")
    }
}
extension ChoicePart {
    init(_ v: Value) throws(PartError) {
        let kind = try string(Fields(v, ["kind", "number", "text"]).required("kind"), "kind")
        if same(kind, "option") {
            let number = try integer(Fields(v, ["kind", "number"]).required("number"), "number")
            guard (1...Limits.options.upperBound).contains(number) else { throw PartError("number: an option is 1 to 4") }
            self = .option(number)
        } else if same(kind, "feedback") {
            self = .feedback(try prose(Fields(v, ["kind", "text"]).required("text"), max: Limits.body, "text"))
        } else { throw PartError("kind: an answer is an option or feedback") }
    }
}
extension ChoicePart: Encodable {
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Key.self)
        switch self {
        case .option(let n): try c.encode("option", forKey: Key("kind")); try c.encode(n, forKey: Key("number"))
        case .feedback(let t): try c.encode("feedback", forKey: Key("kind")); try c.encode(t, forKey: Key("text"))
        }
    }
}
extension AnswerPart: Encodable {
    public init(json: PartJSON) throws(PartError) { choice = try ChoicePart(Fields(json.value, ["choice"]).required("choice")) }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Key.self)
        try c.encode(choice, forKey: Key("choice"))
    }
}
struct Key: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init(_ name: String) { stringValue = name }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { nil }
}
extension AcknowledgementPart {
    public init(json: PartJSON) throws(PartError) { nextSteps = try prose(Fields(json.value, ["nextSteps"]).required("nextSteps"), max: Limits.text, "nextSteps") }
}
extension RecommendedPart {
    init(_ v: Value) throws(PartError) {
        let f = try Fields(v, ["letter", "title"])
        let letter = try string(f.required("letter"), "letter")
        guard ["A", "B", "C", "D"].contains(where: { same($0, letter) }) else { throw PartError("letter: an option is A to D") }
        self.letter = letter
        title = try prose(f.required("title"), max: Limits.text, "title")
    }
}
extension DecisionPreviewPart {
    public init(json: PartJSON) throws(PartError) {
        let f = try Fields(json.value, ["title", "detail", "recommended", "app", "project", "machine"])
        title = try prose(f.required("title"), max: Limits.title, "title")
        detail = try f.optional("detail").map { v throws(PartError) in try prose(v, max: Limits.text, "detail") }
        recommended = try f.optional("recommended").map { v throws(PartError) in try RecommendedPart(v) }
        app = try prose(f.required("app"), max: Limits.label, "app")
        project = try prose(f.required("project"), max: Limits.label, "project")
        machine = try f.optional("machine").map { v throws(PartError) in try prose(v, max: Limits.label, "machine") }
    }
}
extension AcknowledgementPreviewPart {
    public init(json: PartJSON) throws(PartError) {
        let f = try Fields(json.value, ["nextSteps", "app", "project", "title"])
        nextSteps = try prose(f.required("nextSteps"), max: Limits.text, "nextSteps")
        app = try prose(f.required("app"), max: Limits.label, "app")
        project = try prose(f.required("project"), max: Limits.label, "project")
        title = try prose(f.required("title"), max: Limits.title, "title")
    }
}
