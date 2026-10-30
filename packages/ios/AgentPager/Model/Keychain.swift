import Foundation
import Security
import CryptoKit

// A pager this phone made. Its key pair, id and number are made here; the server keeps only the public key and a
// digest of the phone key. The name lives only on this phone. The app keeps no other list: the Pagers screen is the
// pagers held here, and one the server no longer knows is dropped.
nonisolated struct LocalPager: Codable, Hashable, Sendable, Identifiable {
    var pagerId: String
    var number: String
    var phoneKey: String
    var privateKey: Data
    var name: String
    var server: String
    var createdAt: Date
    var id: String { pagerId }

    var publicKey: String {
        (try? Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey)).map { base64url($0.publicKey.rawRepresentation) } ?? ""
    }

    // The number is `ap1_` and base64url of the pager id (16 bytes) and the first 8 bytes of the SHA-256 of its public
    // key (docs/v2/04-encryption.md §2), so a server can't swap the key.
    static func make(name: String, server: String) -> LocalPager {
        let key = Curve25519.KeyAgreement.PrivateKey()
        var id = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, id.count, &id)
        let fingerprint = Array(SHA256.hash(data: key.publicKey.rawRepresentation)).prefix(8)
        return LocalPager(pagerId: id.map { String(format: "%02x", $0) }.joined(), number: "ap1_" + base64url(Data(id + fingerprint)),
                          phoneKey: randomToken(), privateKey: key.rawRepresentation, name: name, server: server, createdAt: Date())
    }
}

nonisolated func base64url(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

nonisolated enum Keychain {
    static let service = "me.agentpager.app.pagers.v2"
    // v1's pager keys and number. v2 is a fresh install: they are deleted at launch.
    static let retired = ["me.agentpager.app.pagers", "me.agentpager.app.number"]

    static func all() -> [LocalPager] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnData as String: true,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let items = result as? [Data] else { return [] }
        return items.compactMap { try? JSONDecoder().decode(LocalPager.self, from: $0) }.sorted { $0.createdAt < $1.createdAt }
    }

    static func save(_ pager: LocalPager) {
        guard let data = try? JSONEncoder().encode(pager) else { return }
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: pager.pagerId,
        ]
        let update: [String: Any] = [kSecValueData as String: data]
        if SecItemUpdate(match as CFDictionary, update as CFDictionary) == errSecItemNotFound {
            var add = match
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    static func delete(_ pagerId: String) {
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: pagerId,
        ]
        SecItemDelete(match as CFDictionary)
    }

    static func deleteRetired() {
        for s in retired { SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: s] as CFDictionary) }
    }

    static func deleteAll() {
        for s in retired + [service] { SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: s] as CFDictionary) }
    }
}
