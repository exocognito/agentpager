import Foundation

// The plaintext of each kind of encrypted part, mirroring packages/contract/parts.ts: JSON as UTF-8, decoded strictly
// (a field the shape doesn't have, or null for one it may leave out, is refused) and held to the contract's limits.
// An attachment's plaintext is the file's bytes and has no shape here. What this doesn't check, the command checks
// before sealing: the brief's Markdown rules and that its links name its attachments. Anyone with the pager's public
// key can seal a card, so the app keeps drawing a brief's Markdown as untrusted: only an https link leaves it.

public struct PartError: Error, Hashable, Sendable {
    public let problem: String
    init(_ problem: String) { self.problem = problem }
}

// The limits, as values.ts, exchange.ts, brief.ts and parts.ts set them.
enum Limits {
    static let title = 100, text = 280, body = 1000, label = 60, optionLabel = 20, brief = 20_000
    static let options = 2...4, attachments = 8, previewBytes = 2048
}

public protocol Part: Decodable, Sendable {
    // A preview must fit Apple's alert payload once sealed.
    static var maxBytes: Int? { get }
}
extension Part { public static var maxBytes: Int? { nil } }

public enum Parts {
    // UTF-8 only, as the contract decodes it: Foundation would also read UTF-16 or UTF-32, which a NUL byte or a
    // byte-order mark gives away, and JSON as UTF-8 has neither. Where a field is repeated, Foundation keeps the
    // first and JavaScript the last; no sealer writes one, and whoever can seal a part can write any content anyway.
    public static func decode<P: Part>(_ type: P.Type, from data: Data) throws(PartError) -> P {
        if let max = P.maxBytes, data.count > max { throw PartError("a preview may not exceed \(max) bytes") }
        guard !data.starts(with: [0xEF, 0xBB, 0xBF]), !data.contains(0), String(validating: data, as: UTF8.self) != nil else { throw PartError("not JSON as UTF-8") }
        do { return try JSONDecoder().decode(P.self, from: data) } catch let error as PartError { throw error } catch { throw PartError("not its shape: \(error)") }
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
public struct IdentityPart: Part, Hashable {
    public var app: String
    public var project: String
    public var machine: String?
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

// Decoding.

struct Key: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init(_ name: String) { stringValue = name }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { nil }
}
typealias Object = KeyedDecodingContainer<Key>
extension Decoder {
    // An object with no field but these.
    func object(_ fields: Set<String>) throws -> Object {
        let c = try container(keyedBy: Key.self)
        if let extra = c.allKeys.first(where: { !fields.contains($0.stringValue) }) { throw PartError("\(extra.stringValue): not a field") }
        return c
    }
}
extension Object {
    func required<T: Decodable>(_ name: String) throws -> T { try decode(T.self, forKey: Key(name)) }
    // Absent, or present and not null.
    func optional<T: Decodable>(_ name: String) throws -> T? { contains(Key(name)) ? try decode(T.self, forKey: Key(name)) : nil }
}

// Text as values.ts checks it: no HTML opener, not blank as JavaScript's trim() reads blank, and at most `max`
// visible characters, which Swift counts as grapheme clusters, as Intl.Segmenter does (the two can differ on a rare
// sequence that their Unicode versions segment differently). Swift strings are always well-formed Unicode: JSON with
// a lone surrogate doesn't decode.
let jsWhitespace = Set<UInt32>([0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF] + Array(0x2000...0x200A))
func prose(_ text: String, max: Int, _ field: String) throws -> String {
    let scalars = Array(text.unicodeScalars)
    if scalars.allSatisfy({ jsWhitespace.contains($0.value) }) { throw PartError("\(field): text may not be blank") }
    for (i, s) in scalars.enumerated() where s == "<" && i + 1 < scalars.count {
        let next = scalars[i + 1]
        if next.isASCII && (next.properties.isAlphabetic || "/!?".unicodeScalars.contains(next)) { throw PartError("\(field): text may not contain HTML") }
    }
    if text.count > max { throw PartError("\(field): text may not exceed \(max) characters") }
    return text
}

extension BriefOptionPart: Decodable {
    public init(from decoder: Decoder) throws {
        let c = try decoder.object(["number", "title", "label", "prioritizes"])
        number = try c.required("number")
        title = try prose(c.required("title"), max: Limits.text, "title")
        label = try c.optional("label").map { try prose($0, max: Limits.optionLabel, "label") }
        prioritizes = try prose(c.required("prioritizes"), max: Limits.text, "prioritizes")
    }
}
extension BriefPart: Decodable {
    public init(from decoder: Decoder) throws {
        let c = try decoder.object(["type", "options", "recommended", "markdown"])
        guard try c.required("type") as String == "brief" else { throw PartError("type: a card is a brief") }
        options = try c.required("options")
        guard Limits.options.contains(options.count) else { throw PartError("options: a brief offers 2 to 4") }
        guard options.enumerated().allSatisfy({ $0.element.number == $0.offset + 1 }) else { throw PartError("options are numbered 1..n in order") }
        recommended = try c.optional("recommended")
        if let r = recommended, !options.contains(where: { $0.number == r }) { throw PartError("recommended must name an offered option") }
        markdown = try c.required("markdown")
        if markdown.unicodeScalars.allSatisfy({ jsWhitespace.contains($0.value) }) { throw PartError("markdown: text may not be blank") }
        if markdown.count > Limits.brief { throw PartError("markdown: a brief may not exceed \(Limits.brief) characters") }
    }
}
let extensions = ["text/markdown": [".md"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"]]
extension AttachmentEntryPart: Decodable {
    public init(from decoder: Decoder) throws {
        let c = try decoder.object(["name", "type"])
        name = try c.required("name")
        type = try c.required("type")
        let n = Array(name.utf8), allowed = Envelope.alphabet.filter { $0 != UInt8(ascii: "-") && $0 != UInt8(ascii: "_") }
        guard (1...64).contains(n.count), allowed.contains(n[0]), n.allSatisfy({ allowed.contains($0) || $0 == UInt8(ascii: ".") || $0 == UInt8(ascii: "_") || $0 == UInt8(ascii: "-") }) else { throw PartError("name: an attachment name is 1 to 64 letters, digits, dots, dashes or underscores") }
        guard let ends = extensions[type] else { throw PartError("type: not an attachment type") }
        guard ends.contains(where: { name.lowercased().hasSuffix($0) }) else { throw PartError("name: must end in \(ends.joined(separator: " or ")) for \(type)") }
    }
}
extension CardPart {
    public init(from decoder: Decoder) throws {
        let c = try decoder.object(["title", "detail", "card", "attachments", "answerKey"])
        title = try prose(c.required("title"), max: Limits.title, "title")
        detail = try c.optional("detail").map { try prose($0, max: Limits.text, "detail") }
        card = try c.required("card")
        attachments = try c.optional("attachments")
        if let a = attachments {
            guard a.count <= Limits.attachments else { throw PartError("attachments: at most \(Limits.attachments)") }
            guard Set(a.map(\.name)).count == a.count else { throw PartError("attachment names must be unique") }
        }
        answerKey = try c.required("answerKey")
        guard answerKey.utf8.count == 43, Envelope.fromBase64url(answerKey)?.count == 32 else { throw PartError("answerKey: a public key is 32 bytes as canonical base64url") }
    }
}
extension IdentityPart {
    public init(from decoder: Decoder) throws {
        let c = try decoder.object(["app", "project", "machine"])
        app = try prose(c.required("app"), max: Limits.label, "app")
        project = try prose(c.required("project"), max: Limits.label, "project")
        machine = try c.optional("machine").map { try prose($0, max: Limits.label, "machine") }
    }
}
extension ChoicePart: Codable {
    public init(from decoder: Decoder) throws {
        let kind: String = try decoder.object(["kind", "number", "text"]).required("kind")
        switch kind {
        case "option":
            let number: Int = try decoder.object(["kind", "number"]).required("number")
            guard (1...Limits.options.upperBound).contains(number) else { throw PartError("number: an option is 1 to 4") }
            self = .option(number)
        case "feedback":
            self = .feedback(try prose(decoder.object(["kind", "text"]).required("text"), max: Limits.body, "text"))
        default: throw PartError("kind: an answer is an option or feedback")
        }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Key.self)
        switch self {
        case .option(let n): try c.encode("option", forKey: Key("kind")); try c.encode(n, forKey: Key("number"))
        case .feedback(let t): try c.encode("feedback", forKey: Key("kind")); try c.encode(t, forKey: Key("text"))
        }
    }
}
extension AnswerPart: Encodable {
    public init(from decoder: Decoder) throws { choice = try decoder.object(["choice"]).required("choice") }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Key.self)
        try c.encode(choice, forKey: Key("choice"))
    }
}
extension AcknowledgementPart {
    public init(from decoder: Decoder) throws { nextSteps = try prose(decoder.object(["nextSteps"]).required("nextSteps"), max: Limits.text, "nextSteps") }
}
extension RecommendedPart: Decodable {
    public init(from decoder: Decoder) throws {
        let c = try decoder.object(["letter", "title"])
        letter = try c.required("letter")
        guard ["A", "B", "C", "D"].contains(letter) else { throw PartError("letter: an option is A to D") }
        title = try prose(c.required("title"), max: Limits.text, "title")
    }
}
extension DecisionPreviewPart {
    public init(from decoder: Decoder) throws {
        let c = try decoder.object(["title", "detail", "recommended", "app", "project", "machine"])
        title = try prose(c.required("title"), max: Limits.title, "title")
        detail = try c.optional("detail").map { try prose($0, max: Limits.text, "detail") }
        recommended = try c.optional("recommended")
        app = try prose(c.required("app"), max: Limits.label, "app")
        project = try prose(c.required("project"), max: Limits.label, "project")
        machine = try c.optional("machine").map { try prose($0, max: Limits.label, "machine") }
    }
}
extension AcknowledgementPreviewPart {
    public init(from decoder: Decoder) throws {
        let c = try decoder.object(["nextSteps", "app", "project", "title"])
        nextSteps = try prose(c.required("nextSteps"), max: Limits.text, "nextSteps")
        app = try prose(c.required("app"), max: Limits.label, "app")
        project = try prose(c.required("project"), max: Limits.label, "project")
        title = try prose(c.required("title"), max: Limits.title, "title")
    }
}
