import CryptoKit
import Foundation
import XCTest
@testable import AgentPagerCrypto

// packages/contract/vectors/envelope.json, read where it is: the same file the command's tests read, never a copy.
let vectorsURL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appending(path: "contract/vectors/envelope.json")

struct Vectors: Decodable {
    struct Format: Decodable { var version: Int; var overheadBytes: Int; var infoLabel: String; var kinds: [String: Int] }
    struct Sealed: Decodable {
        var name: String, kind: String, context: Context, part: Bool
        var recipientPrivateKey: String, recipientPublicKey: String, ephemeralPrivateKey: String, ephemeralPublicKey: String
        var nonce: String, plaintext: String, envelope: String
    }
    struct SealRefused: Decodable { var name: String, kind: String, context: Context, recipientPublicKey: String, plaintext: String, refusal: String }
    struct OpenRefused: Decodable { var name: String, kind: String, context: Context, recipientPrivateKey: String, envelope: String, refusal: String }
    struct PartCase: Decodable { var name: String, kind: String, plaintext: String }
    struct PartCases: Decodable { var valid: [PartCase]; var invalid: [PartCase] }
    var format: Format
    var seal: [Sealed]
    var sealRefused: [SealRefused]
    var openRefused: [OpenRefused]
    var parts: PartCases
}

// A vector's context as given, or nil when it isn't one at all (an extra field, an index of 1.5): Swift's types
// refuse those before the format sees them.
struct Context: Decodable {
    var value: PartContext?
    init(from decoder: Decoder) throws {
        struct Strict: Decodable {
            var value: PartContext
            init(from decoder: Decoder) throws {
                let c = try decoder.container(keyedBy: Key.self)
                guard c.allKeys.allSatisfy({ ["pagerId", "decisionId", "index"].contains($0.stringValue) }) else { throw EnvelopeError() }
                value = PartContext(pagerId: try c.decode(String.self, forKey: Key("pagerId")), decisionId: try c.decodeIfPresent(String.self, forKey: Key("decisionId")), index: try c.decodeIfPresent(Int.self, forKey: Key("index")))
            }
        }
        value = (try? Strict(from: decoder))?.value
    }
}

let vectors: Vectors = {
    do { return try JSONDecoder().decode(Vectors.self, from: Data(contentsOf: vectorsURL)) } catch { fatalError("can't read \(vectorsURL.path): \(error)") }
}()
func bytes(_ text: String) -> Data {
    guard let data = Envelope.fromBase64url(text) else { fatalError("not canonical base64url in the vectors: \(text.prefix(20))") }
    return data
}
func privateKey(_ text: String) throws -> Curve25519.KeyAgreement.PrivateKey { try .init(rawRepresentation: bytes(text)) }

// Whether a call was refused with the one error, or how else it ended.
func outcome(_ run: () throws -> Any) -> String {
    do { _ = try run(); return "accepted" } catch is EnvelopeError { return "EnvelopeError" } catch { return "\(error)" }
}

final class EnvelopeTests: XCTestCase {
    func test_formatIsTheVectorsFormat() {
        XCTAssertEqual(vectors.format.version, Int(Envelope.version))
        XCTAssertEqual(vectors.format.overheadBytes, Envelope.overheadBytes)
        XCTAssertEqual(vectors.format.infoLabel, String(decoding: Envelope.infoLabel, as: UTF8.self))
        XCTAssertEqual(vectors.format.kinds, Dictionary(uniqueKeysWithValues: PartKind.allCases.map { ($0.rawValue, Int($0.code)) }))
    }

    func test_sealsEveryVectorToItsBytes() throws {
        XCTAssertFalse(vectors.seal.isEmpty)
        for s in vectors.seal {
            let kind = try XCTUnwrap(PartKind(rawValue: s.kind), s.name), context = try XCTUnwrap(s.context.value, s.name)
            let recipient = try privateKey(s.recipientPrivateKey), ephemeral = try privateKey(s.ephemeralPrivateKey)
            XCTAssertEqual(Envelope.base64url(recipient.publicKey.rawRepresentation), s.recipientPublicKey, s.name)
            XCTAssertEqual(Envelope.base64url(ephemeral.publicKey.rawRepresentation), s.ephemeralPublicKey, s.name)
            let sealed = try Envelope.seal(to: recipient.publicKey, kind: kind, context: context, plaintext: bytes(s.plaintext), ephemeral: ephemeral, nonce: bytes(s.nonce))
            XCTAssertEqual(sealed, s.envelope, s.name)
        }
    }

    func test_opensEveryVector() throws {
        for s in vectors.seal {
            let kind = try XCTUnwrap(PartKind(rawValue: s.kind), s.name), context = try XCTUnwrap(s.context.value, s.name)
            XCTAssertEqual(try Envelope.open(s.envelope, with: privateKey(s.recipientPrivateKey), kind: kind, context: context), bytes(s.plaintext), s.name)
        }
    }

    // A refusal Swift's types can't even express (an unknown kind, an extra field, a key of the wrong length) is
    // refused before the format; every other one must be refused by the format itself.
    func test_refusesToSealEveryRefusal() {
        var typed: [String] = []
        for s in vectors.sealRefused {
            XCTAssertEqual(outcome {
                guard let kind = PartKind(rawValue: s.kind), let context = s.context.value,
                      let recipient = try? Curve25519.KeyAgreement.PublicKey(rawRepresentation: bytes(s.recipientPublicKey)) else { typed.append(s.name); throw EnvelopeError() }
                return try Envelope.seal(to: recipient, kind: kind, context: context, plaintext: bytes(s.plaintext))
            }, s.refusal, s.name)
        }
        XCTAssertEqual(typed, ["recipient key of 31 bytes", "recipient key of 33 bytes", "attachment index 1.5", "context with an extra field", "unknown kind"])
        XCTAssertEqual(vectors.sealRefused.count - typed.count, 24)
    }

    func test_refusesToOpenEveryRefusal() {
        var typed: [String] = []
        for o in vectors.openRefused {
            XCTAssertEqual(outcome {
                guard let kind = PartKind(rawValue: o.kind), let context = o.context.value,
                      let recipient = try? privateKey(o.recipientPrivateKey) else { typed.append(o.name); throw EnvelopeError() }
                return try Envelope.open(o.envelope, with: recipient, kind: kind, context: context)
            }, o.refusal, o.name)
        }
        XCTAssertEqual(typed, ["unknown kind", "private key of 31 bytes"])
        XCTAssertEqual(vectors.openRefused.count - typed.count, 46)
    }

    func test_eachSealHasAFreshOneTimeKeyAndNonce() throws {
        let pager = Curve25519.KeyAgreement.PrivateKey(), context = PartContext(pagerId: String(repeating: "0", count: 32), decisionId: String(repeating: "D", count: 32))
        let sealed = try (0..<200).map { _ in try bytes(Envelope.seal(to: pager.publicKey, kind: .card, context: context, plaintext: Data(count: 8))) }
        XCTAssertEqual(Set(sealed.map { $0.subdata(in: 1..<33) }).count, 200)
        XCTAssertEqual(Set(sealed.map { $0.subdata(in: 33..<45) }).count, 200)
    }

    func test_opensWhatItSealsForEveryKind() throws {
        let recipient = Curve25519.KeyAgreement.PrivateKey(), pagerId = String(repeating: "a", count: 32), decisionId = String(repeating: "D", count: 32)
        for kind in PartKind.allCases {
            let context = PartContext(pagerId: pagerId, decisionId: kind.hasDecision ? decisionId : nil, index: kind.hasIndex ? 7 : nil)
            let plaintext = Data("a \(kind.rawValue), ☕️".utf8)
            let sealed = try Envelope.seal(to: recipient.publicKey, kind: kind, context: context, plaintext: plaintext)
            // base64url without padding: 4 characters for every 3 bytes, rounded up.
            XCTAssertEqual(sealed.utf8.count, (4 * (plaintext.count + Envelope.overheadBytes) + 2) / 3)
            XCTAssertEqual(try Envelope.open(sealed, with: recipient, kind: kind, context: context), plaintext)
        }
    }
}

final class PartsTests: XCTestCase {
    func decode(_ kind: String, _ data: Data) throws -> any Part {
        switch kind {
        case "card": try Parts.decode(CardPart.self, from: data)
        case "identity": try Parts.decode(IdentityPart.self, from: data)
        case "answer": try Parts.decode(AnswerPart.self, from: data)
        case "acknowledgement": try Parts.decode(AcknowledgementPart.self, from: data)
        case "decisionPreview": try Parts.decode(DecisionPreviewPart.self, from: data)
        case "acknowledgementPreview": try Parts.decode(AcknowledgementPreviewPart.self, from: data)
        default: throw PartError("no shape for \(kind)")
        }
    }

    // The part vectors, and every sealed vector whose plaintext is a part.
    func test_decodesEveryPartTheContractDecodes() {
        let cases = vectors.parts.valid + vectors.seal.filter(\.part).map { Vectors.PartCase(name: $0.name, kind: $0.kind, plaintext: $0.plaintext) }
        XCTAssertEqual(Set(cases.map(\.kind)), ["card", "identity", "answer", "acknowledgement", "decisionPreview", "acknowledgementPreview"])
        for p in cases {
            XCTAssertNoThrow(try decode(p.kind, bytes(p.plaintext)), p.name)
        }
    }

    func test_refusesEveryPartTheContractRefuses() {
        XCTAssertFalse(vectors.parts.invalid.isEmpty)
        for p in vectors.parts.invalid {
            XCTAssertThrowsError(try decode(p.kind, bytes(p.plaintext)), p.name) { XCTAssertTrue($0 is PartError, "\(p.name): \($0)") }
        }
    }

    func test_readsTheCardAndPreviewAsTheContractWroteThem() throws {
        let card = try Parts.decode(CardPart.self, from: bytes(vectors.seal[0].plaintext))
        XCTAssertEqual(card.title, "Ship the 二つの計画 rollout? 🚀")
        XCTAssertEqual(card.card.recommended, 2)
        XCTAssertEqual(card.attachments?.map(\.name), ["diagram.png", "background.md"])
        let preview = try Parts.decode(DecisionPreviewPart.self, from: bytes(try XCTUnwrap(vectors.seal.first { $0.kind == "decisionPreview" }).plaintext))
        XCTAssertEqual(preview.title, card.title)
        XCTAssertEqual(preview.recommended, RecommendedPart(letter: "B", title: "Ship tomorrow after the dry run"))
        XCTAssertEqual([preview.app, preview.project, preview.machine], ["Claude Code", "agentpager", "pro"])
    }

    // The phone's answer is the bytes the vectors seal, so the command decodes exactly what the phone sends.
    func test_encodesAnswersAsTheVectorsDo() throws {
        // The part vectors hold every sealed answer's plaintext too; those filed under "JSON:" are spelled as no
        // encoder spells them, to test reading.
        let answers = vectors.parts.valid.filter { $0.kind == "answer" && !$0.name.hasPrefix("JSON:") }
        XCTAssertEqual(answers.count, 3)
        for a in answers {
            XCTAssertEqual(try Parts.decode(AnswerPart.self, from: bytes(a.plaintext)).encoded(), bytes(a.plaintext), a.name)
        }
    }
}
