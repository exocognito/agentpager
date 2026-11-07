import CryptoKit
import Foundation

// The phone's side of the one format for every encrypted part, version 1. packages/contract/envelope.ts states it in
// full; both must pass packages/contract/vectors/envelope.json.
//
//   shared   = X25519(ephemeral private, recipient public)      refused when all zero (a low-order key)
//   key      = HKDF-SHA256(shared, salt = nonce, info = "agentpager/v1/part" ‖ kind ‖ ephemeral public ‖ recipient public)
//   aad      = 0x01 ‖ kind ‖ pager id (16 bytes) ‖ decision id (32 ASCII; not for identity) ‖ index (1; attachment only)
//   envelope = base64url, no padding, of 0x01 ‖ ephemeral public (32) ‖ nonce (12) ‖ ciphertext ‖ tag (16)
//
// Only the recipient's private key opens a part, and only under the kind and context it was sealed with. Anyone with
// a public key can seal to it, so the phone seals an answer only to the key inside the card it answers.

public enum PartKind: String, CaseIterable, Sendable {
    case card, attachment, identity, acknowledgement, answer, decisionPreview, acknowledgementPreview

    var code: UInt8 {
        switch self {
        case .card: 1
        case .attachment: 2
        case .identity: 3
        case .acknowledgement: 4
        case .answer: 5
        case .decisionPreview: 6
        case .acknowledgementPreview: 7
        }
    }
    // Every kind but identity, which is sealed at connect, belongs to a decision; an attachment also has a slot.
    var hasDecision: Bool { self != .identity }
    var hasIndex: Bool { self == .attachment }
}

// What a part is bound to besides its kind: its pager (32 lowercase hex), its decision (a 32-character token) and an
// attachment's slot, its place in its card's list. It must have exactly the fields its kind takes.
public struct PartContext: Sendable, Hashable {
    public var pagerId: String
    public var decisionId: String?
    public var index: Int?
    public init(pagerId: String, decisionId: String? = nil, index: Int? = nil) {
        self.pagerId = pagerId
        self.decisionId = decisionId
        self.index = index
    }
}

// Every refusal to seal or open is this one error, whatever the cause.
public struct EnvelopeError: Error, Hashable, Sendable {
    public init() {}
}

public enum Envelope {
    public static let version: UInt8 = 1
    public static let overheadBytes = 1 + 32 + 12 + 16
    // An attachment's slot is below brief.ts's ATTACHMENTS_MAX.
    static let attachmentsMax = 8
    static let infoLabel = Data("agentpager/v1/part".utf8)

    // Seals plaintext for the holder of the recipient's private key, bound to its kind and context, with a fresh
    // one-time key and nonce.
    public static func seal(to recipient: Curve25519.KeyAgreement.PublicKey, kind: PartKind, context: PartContext, plaintext: Data) throws(EnvelopeError) -> String {
        try seal(to: recipient, kind: kind, context: context, plaintext: plaintext, ephemeral: Curve25519.KeyAgreement.PrivateKey(), nonce: Data(AES.GCM.Nonce()))
    }

    // For packages/contract/vectors/envelope.json only: a chosen one-time key and nonce seal the same bytes twice.
    // Internal, so only the package's tests reach it, with `@testable import`.
    static func seal(to recipient: Curve25519.KeyAgreement.PublicKey, kind: PartKind, context: PartContext, plaintext: Data, ephemeral: Curve25519.KeyAgreement.PrivateKey, nonce: Data) throws(EnvelopeError) -> String {
        let aad = try binding(kind, context)
        guard nonce.count == 12 else { throw EnvelopeError() }
        let ephemeralPublic = ephemeral.publicKey.rawRepresentation
        let key = try derive(agree(ephemeral, recipient), nonce: nonce, kind: kind, ephemeral: ephemeralPublic, recipient: recipient.rawRepresentation)
        do {
            let box = try AES.GCM.seal(plaintext, using: key, nonce: AES.GCM.Nonce(data: nonce), authenticating: aad)
            return base64url(Data([version]) + ephemeralPublic + nonce + box.ciphertext + box.tag)
        } catch { throw EnvelopeError() }
    }

    // Opens a part sealed to this private key under the same kind and context. CryptoKit returns the plaintext only
    // once the tag checks, so nothing of a part that fails is returned.
    public static func open(_ envelope: String, with recipient: Curve25519.KeyAgreement.PrivateKey, kind: PartKind, context: PartContext) throws(EnvelopeError) -> Data {
        let aad = try binding(kind, context)
        guard let data = fromBase64url(envelope), data.count >= overheadBytes, data.first == version else { throw EnvelopeError() }
        let bytes = [UInt8](data)
        let ephemeralPublic = Data(bytes[1..<33]), nonce = Data(bytes[33..<45])
        let ciphertext = Data(bytes[45..<(bytes.count - 16)]), tag = Data(bytes[(bytes.count - 16)...])
        let ephemeral: Curve25519.KeyAgreement.PublicKey
        do { ephemeral = try .init(rawRepresentation: ephemeralPublic) } catch { throw EnvelopeError() }
        let key = try derive(agree(recipient, ephemeral), nonce: nonce, kind: kind, ephemeral: ephemeralPublic, recipient: recipient.publicKey.rawRepresentation)
        do {
            let box = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: nonce), ciphertext: ciphertext, tag: tag)
            return try AES.GCM.open(box, using: key, authenticating: aad)
        } catch { throw EnvelopeError() }
    }

    // CryptoKit refuses a low-order key itself; the all-zero check holds whether or not it does.
    static func agree(_ privateKey: Curve25519.KeyAgreement.PrivateKey, _ publicKey: Curve25519.KeyAgreement.PublicKey) throws(EnvelopeError) -> SharedSecret {
        let shared: SharedSecret
        do { shared = try privateKey.sharedSecretFromKeyAgreement(with: publicKey) } catch { throw EnvelopeError() }
        guard shared.withUnsafeBytes({ $0.count == 32 && $0.contains { $0 != 0 } }) else { throw EnvelopeError() }
        return shared
    }

    static func derive(_ shared: SharedSecret, nonce: Data, kind: PartKind, ephemeral: Data, recipient: Data) -> SymmetricKey {
        shared.hkdfDerivedSymmetricKey(using: SHA256.self, salt: nonce, sharedInfo: infoLabel + [kind.code] + ephemeral + recipient, outputByteCount: 32)
    }

    static func binding(_ kind: PartKind, _ context: PartContext) throws(EnvelopeError) -> Data {
        guard let pager = pagerBytes(context.pagerId), (context.decisionId != nil) == kind.hasDecision, (context.index != nil) == kind.hasIndex else { throw EnvelopeError() }
        var aad = Data([version, kind.code]) + pager
        if let decisionId = context.decisionId {
            guard isToken(decisionId) else { throw EnvelopeError() }
            aad += Data(decisionId.utf8)
        }
        if let index = context.index {
            guard (0..<attachmentsMax).contains(index) else { throw EnvelopeError() }
            aad.append(UInt8(index))
        }
        return aad
    }

    static func pagerBytes(_ hex: String) -> Data? {
        let digits = Array(hex.utf8)
        guard digits.count == 32, digits.allSatisfy({ (0x30...0x39).contains($0) || (0x61...0x66).contains($0) }) else { return nil }
        return Data(stride(from: 0, to: 32, by: 2).map { UInt8(String(decoding: digits[$0..<$0 + 2], as: UTF8.self), radix: 16)! })
    }

    static let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".utf8)
    // values.ts's Token: 32 URL-safe characters.
    static func isToken(_ text: String) -> Bool { text.utf8.count == 32 && text.utf8.allSatisfy(alphabet.contains) }

    public static func base64url(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
    // Decoded only when canonical: the alphabet, no padding, and the spare bits zero, as envelope.ts decodes.
    public static func fromBase64url(_ text: String) -> Data? {
        let utf8 = Array(text.utf8)
        guard utf8.allSatisfy(alphabet.contains), utf8.count % 4 != 1 else { return nil }
        let standard = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        guard let data = Data(base64Encoded: standard + String(repeating: "=", count: (4 - utf8.count % 4) % 4)), base64url(data) == text else { return nil }
        return data
    }
}
