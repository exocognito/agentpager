import Foundation

// The last inbox the phone saw for each pager. The server deletes a pager's decisions when it ends; this copy lets
// the owner read them, unchanged, for 24 hours after the end, and is then removed with the pager's key.
nonisolated enum InboxCache {
    static let keepEnded: TimeInterval = 24 * 3600

    private static var url: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "inboxes.json")
    }

    static func load() -> [String: Inbox] {
        guard let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: Inbox].self, from: data)) ?? [:]
    }

    static func save(_ inboxes: [String: Inbox]) {
        guard let data = try? JSONEncoder().encode(inboxes) else { return }
        try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func deleteAll() { try? FileManager.default.removeItem(at: url) }
}
