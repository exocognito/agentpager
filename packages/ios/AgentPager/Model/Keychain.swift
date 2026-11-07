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
    // A pager made on a dev server, such as dev.agentpager.me, carries a dev mark (B23.11, blueprint/areas/1-pagers.md).
    // Only a host that starts with `dev.` counts: a local server, as the UI tests and the catalogue use, isn't marked.
    var onDevServer: Bool { URL(string: server)?.host()?.lowercased().hasPrefix("dev.") ?? false }

    var publicKey: String {
        (try? Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey)).map { base64url($0.publicKey.rawRepresentation) } ?? ""
    }

    // The number is `ap1_` and base64url of the pager id (16 bytes) and the first 8 bytes of the SHA-256 of its public
    // key (I19, blueprint/areas/6-privacy.md), so a server can't swap the key.
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

nonisolated func randomToken() -> String {
    var bytes = [UInt8](repeating: 0, count: 24)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    return Data(bytes).base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
}

// Each pager is one generic password: account = pager id, data = LocalPager as JSON. This file is compiled into the
// app and into its alert extension (AgentPagerNotifications), and both read the same items. What the app keeps with
// each pager, its pins and its answers, is in services of their own (Kept, below).
// Where the items live: an item added without an access group goes to the app's first keychain access group, which is
// its own App ID, TEAMID.me.agentpager.app.dev. Every build before M5 had no keychain-access-groups entitlement, so
// every pager made so far is already there; the app's entitlements name that group first, so new pagers go there too.
// The extension's entitlements name the same group, which is how it reads them: nothing is moved or copied, so no
// build can lose a pager to a move. Queries here name no access group, so they search every group the caller has.
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

    // One pager by its id, as the alert extension finds the key for an alert's pagerId. Nil when this phone doesn't
    // hold that pager, or its item doesn't decode as the pager asked for.
    static func pager(_ pagerId: String) -> LocalPager? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: pagerId,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data,
              let pager = try? JSONDecoder().decode(LocalPager.self, from: data), pager.pagerId == pagerId else { return nil }
        return pager
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

    // The pager, then what is kept with it. In that order, so an app stopped between the two never leaves a pager
    // without its pins and answers; it can only leave records of a pager that is gone, which nothing reads.
    static func delete(_ pagerId: String) {
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: pagerId,
        ]
        SecItemDelete(match as CFDictionary)
        for kind in Kept.allCases { SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: kind.service(pagerId)] as CFDictionary) }
    }

    static func deleteRetired() {
        for s in retired { SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: s] as CFDictionary) }
    }

    static func deleteAll() {
        for s in retired + [service] + keptServices() { SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: s] as CFDictionary) }
    }

    // MARK: What is kept with each pager

    // Besides each pager, the phone keeps two kinds of record with it, here in the Keychain rather than in the app's
    // files, so that, like the pager, they stay when the app is deleted and installed again:
    // - pins: the key each agent first named (B30.3, blueprint/areas/6-privacy.md; Sealed.swift Pins), one item per
    //   agent, account = agent id, data = the key;
    // - answers: the phone's record of each answer it sent (B7.4, blueprint/areas/5-answering.md; InboxCache.swift
    //   KeptAnswers), one item per answer, account = request id, data = SentAnswer as JSON.
    // Layout: each kind is a service of its own per pager, `<kind>/<pager id>`, apart from the pager's item, which the
    // alert extension reads and which stays as it is. So a record is read and deleted with its pager by exact match on
    // the service, never by searching, and one pager's records can't be read as another's. One item per record, so
    // keeping one is a single add that never rewrites another; and since a record is only ever added, never updated,
    // the Keychain itself refuses a second pin for the same agent. They have the pager's accessibility and group.
    nonisolated enum Kept: String, CaseIterable, Sendable {
        case pins = "me.agentpager.app.pins"
        case answers = "me.agentpager.app.answers"
        func service(_ pagerId: String) -> String { rawValue + "/" + pagerId }
    }

    // Adds a record; never replaces one. errSecDuplicateItem when the account already has one, which stays as it was.
    static func add(_ kind: Kept, pagerId: String, account: String, data: Data) -> OSStatus {
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: kind.service(pagerId),
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        return SecItemAdd(add as CFDictionary, nil)
    }

    // One record. Nil when there is none, or the Keychain can't be read.
    static func record(_ kind: Kept, pagerId: String, account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: kind.service(pagerId),
            kSecAttrAccount as String: account,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    // Every record of one kind kept with a pager, by account: empty when there are none, nil when the Keychain can't
    // be read, so a caller can tell the two apart.
    static func records(_ kind: Kept, pagerId: String) -> [String: Data]? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: kind.service(pagerId),
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: true,
        ]
        var result: CFTypeRef?
        switch SecItemCopyMatching(query as CFDictionary, &result) {
        case errSecItemNotFound: return [:]
        case errSecSuccess:
            var records: [String: Data] = [:]
            for item in (result as? [[String: Any]]) ?? [] {
                if let account = item[kSecAttrAccount as String] as? String, let data = item[kSecValueData as String] as? Data { records[account] = data }
            }
            return records
        default: return nil
        }
    }

    // The services of every kind kept with any pager, for deleteAll.
    private static func keptServices() -> [String] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnAttributes as String: true,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return [] }
        let services = ((result as? [[String: Any]]) ?? []).compactMap { $0[kSecAttrService as String] as? String }
        return Set(services.filter { s in Kept.allCases.contains { s.hasPrefix($0.rawValue + "/") } }).sorted()
    }
}
