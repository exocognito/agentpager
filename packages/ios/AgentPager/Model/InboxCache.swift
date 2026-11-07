import Foundation

// The last read of each pager, as the server sent it, sealed, so its decisions show while the server can't be
// reached. Removed with the pager.
nonisolated enum InboxCache {
    private static var dir: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
    private static var url: URL { dir.appending(path: "pagers-sealed.json") }

    static func load() -> [String: SealedPagerInbox] {
        // v1's cache of sessions, and the readable reads from before the encryption switch, whose decisions the
        // server no longer holds: both go.
        for old in ["inboxes.json", "pagers.json"] { try? FileManager.default.removeItem(at: dir.appending(path: old)) }
        guard let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: SealedPagerInbox].self, from: data)) ?? [:]
    }

    static func save(_ inboxes: [String: SealedPagerInbox]) {
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

// Every answer this phone sent, by request id (Sealed.swift SentAnswer), so it shows its own answers: only the agent
// can open the answer itself. Removed with the pager.
nonisolated enum AnswerCache {
    private static var url: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "answers.json")
    }

    static func load() -> [String: SentAnswer] {
        guard let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: SentAnswer].self, from: data)) ?? [:]
    }

    static func save(_ answers: [String: SentAnswer]) {
        guard let data = try? JSONEncoder().encode(answers) else { return }
        try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func deleteAll() { try? FileManager.default.removeItem(at: url) }
}
