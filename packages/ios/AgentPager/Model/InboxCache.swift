import Foundation

// The last read of each pager, so its decisions show while the server can't be reached. Removed with the pager.
nonisolated enum InboxCache {
    private static var dir: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
    private static var url: URL { dir.appending(path: "pagers.json") }

    static func load() -> [String: PagerInbox] {
        // v1's cache of sessions: v2 is a fresh install.
        try? FileManager.default.removeItem(at: dir.appending(path: "inboxes.json"))
        guard let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: PagerInbox].self, from: data)) ?? [:]
    }

    static func save(_ inboxes: [String: PagerInbox]) {
        guard let data = try? JSONEncoder().encode(inboxes) else { return }
        try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func deleteAll() { try? FileManager.default.removeItem(at: url) }
}

// Answers sent but not yet confirmed by the server, so an app killed mid-send sends them again on its next launch.
// Each keeps its requestId, so a resend the server already stored is a replay (I5).
nonisolated enum SendCache {
    private static var url: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "sends.json")
    }

    static func load() -> [String: PreparedAnswer] {
        guard let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: PreparedAnswer].self, from: data)) ?? [:]
    }

    static func save(_ sends: [String: PreparedAnswer]) {
        guard let data = try? JSONEncoder().encode(sends) else { return }
        try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func deleteAll() { try? FileManager.default.removeItem(at: url) }
}
