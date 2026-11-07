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
// can open the answer itself. Kept in the Keychain with its pager (Keychain.swift › Kept), so it outlives the app
// being deleted and installed again, and goes with the pager (B7.4, blueprint/areas/5-answering.md). Each pager's are
// read from the Keychain the first time they are asked for and kept in memory from then on; a read the Keychain
// refuses is tried again the next time.
nonisolated final class KeptAnswers: @unchecked Sendable {
    private let lock = NSLock()
    // Each pager's answers known this run, by request id, and the pagers whose Keychain records are among them.
    private var known: [String: [String: SentAnswer]] = [:]
    private var read: Set<String> = []

    func of(_ pagerId: String) -> [String: SentAnswer] {
        lock.withLock {
            if !read.contains(pagerId), let records = Keychain.records(.answers, pagerId: pagerId) {
                for (requestId, data) in records {
                    // The service names the pager, so a record names its own; one that doesn't is no answer of this pager's.
                    guard let a = try? JSONDecoder().decode(SentAnswer.self, from: data), a.pagerId == pagerId else { continue }
                    if known[pagerId]?[requestId] == nil { known[pagerId, default: [:]][requestId] = a }
                }
                read.insert(pagerId)
            }
            return known[pagerId] ?? [:]
        }
    }

    // Kept before the answer is first sent (AppModel.commit), and never replaced: the first record of a request id is
    // the one the phone sealed. Still shown this run if the Keychain refuses it.
    func keep(_ a: SentAnswer, requestId: String) {
        lock.withLock {
            guard known[a.pagerId]?[requestId] == nil else { return }
            known[a.pagerId, default: [:]][requestId] = a
            if let data = try? JSONEncoder().encode(a) { _ = Keychain.add(.answers, pagerId: a.pagerId, account: requestId, data: data) }
        }
    }

    // The pager is gone: Keychain.delete took its records.
    func forget(_ pagerId: String) {
        lock.withLock { known[pagerId] = nil; read.remove(pagerId) }
    }

    // Before the Keychain kept them, this build's predecessors kept these records in answers.json in Application
    // Support, which goes when the app is deleted. Its answers move into the Keychain once, at launch, so none is lost;
    // they show this run from memory, and the file goes only once every one of them reads back from the Keychain as it
    // was. A file that doesn't decode stays as it is, and nothing of it shows.
    static var file: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appending(path: "answers.json")
    }

    func move(from file: URL) {
        guard let data = try? Data(contentsOf: file), let old = try? JSONDecoder().decode([String: SentAnswer].self, from: data) else { return }
        for (requestId, a) in old { keep(a, requestId: requestId) }
        let moved = old.allSatisfy { requestId, a in
            Keychain.record(.answers, pagerId: a.pagerId, account: requestId).flatMap { try? JSONDecoder().decode(SentAnswer.self, from: $0) } == a
        }
        if moved { try? FileManager.default.removeItem(at: file) }
    }
}
