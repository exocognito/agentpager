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

nonisolated enum Keychain {
    static let service = "me.agentpager.app.pagers"

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

    static func save(_ key: PagerKey) {
        guard let data = try? JSONEncoder().encode(key) else { return }
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.sessionId,
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
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service] as CFDictionary)
    }
}
