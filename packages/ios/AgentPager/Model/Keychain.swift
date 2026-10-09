import Foundation
import Security

// One phone key per pager. The app keeps no list of its own: the Agents list is whatever the server reports
// for the keys held here, and a key the server no longer knows is dropped.
nonisolated struct PagerKey: Codable, Hashable, Sendable, Identifiable {
    var sessionId: String
    var phoneKey: String
    var server: String
    var madeByPhone: Bool
    var linkCode: String?
    var linkURL: String?
    var createdAt: Date
    var id: String { sessionId }
}

// The phone's pager number on one server. Every pager an agent opens with it shares this phone key; `seen` lists the
// pagers already taken from the server's listing, so one the server later forgets is not added again.
nonisolated struct PagerNumber: Codable, Hashable, Sendable {
    var server: String
    var phoneKey: String
    var number: String
    var seen: [String]
}

nonisolated enum Keychain {
    static let service = "me.agentpager.app.pagers"
    static let numberService = "me.agentpager.app.number"

    static func all() -> [PagerKey] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnData as String: true,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let items = result as? [Data] else { return [] }
        return items.compactMap { try? JSONDecoder().decode(PagerKey.self, from: $0) }.sorted { $0.createdAt > $1.createdAt }
    }

    static func save(_ key: PagerKey) { write(key, service: service, account: key.sessionId) }

    static func number(server: String) -> PagerNumber? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: numberService,
            kSecAttrAccount as String: server,
            kSecReturnData as String: true,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(PagerNumber.self, from: data)
    }

    static func save(_ number: PagerNumber) { write(number, service: numberService, account: number.server) }

    private static func write(_ value: some Encodable, service: String, account: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let update: [String: Any] = [kSecValueData as String: data]
        if SecItemUpdate(match as CFDictionary, update as CFDictionary) == errSecItemNotFound {
            var add = match
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    static func delete(_ sessionId: String) {
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: sessionId,
        ]
        SecItemDelete(match as CFDictionary)
    }

    static func deleteAll() {
        for s in [service, numberService] {
            SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: s] as CFDictionary)
        }
    }
}
