import SwiftUI
import Observation
import UIKit

enum Route: Hashable { case agent(String) }

// A pairing sheet is opened either for an agent-made link (deep link: no key yet) or for the phone's own link
// once an agent has joined it (the phone already holds the key).
struct PairingTarget: Hashable {
    var code: String
    var sessionId: String?
}

enum ActiveSheet: Identifiable, Hashable {
    case connect
    case pairing(PairingTarget)
    case decision(sessionId: String, decisionId: String)
    case thread(sessionId: String, decisionId: String)
    case server

    var id: String {
        switch self {
        case .connect: "connect"
        case .pairing(let t): "pairing-\(t.code)"
        case .decision(_, let d): "decision-\(d)"
        case .thread(_, let d): "thread-\(d)"
        case .server: "server"
        }
    }
}

// An answer the owner pressed Send on. It waits out the Undo window, then is sent with the same requestId
// on every retry so the server can recognise a replay.
struct PreparedAnswer: Identifiable, Hashable {
    var sessionId: String
    var decisionId: String
    var requestId: String
    var choice: Choice
    var deadline: Date
    var id: String { requestId }
}

enum RowState: Hashable { case sending, waiting, confirmed }

struct AnsweredRow: Identifiable, Hashable {
    var decision: Decision
    var choice: Choice
    var state: RowState
    var id: String { decision.decisionId }
}

@Observable
final class AppModel {
    static let undoSeconds: Double = 5
    static let pollSeconds: Double = 3
    static let retryDelays: [Double] = [0, 1.5, 3, 6]

    var server: URL
    var keys: [PagerKey] = []
    var inboxes: [String: Inbox] = [:]
    var now = Date()
    var lastSuccess: Date?
    var lastFailure: String?
    var path: [Route] = []
    var sheet: ActiveSheet?
    var undo: PreparedAnswer?
    var inFlight: [String: PreparedAnswer] = [:]
    var notConfirmed: PreparedAnswer?
    var drafts: [String: Choice] = [:]
    var connectError: String?
    var connectBusy = false
    private var autoPaired: Set<String> = []
    var demoFlow: PairingFlow?
    let live: Bool
    // Debug only: `-failSends N` makes the next N answer attempts fail as if the network dropped,
    // so the "Answer Not Confirmed" alert can be exercised in the Simulator.
    private var failSends = UserDefaults.standard.integer(forKey: "failSends")

    init(live: Bool = true) {
        self.live = live
        self.server = Self.configuredServer()
        if live { keys = Keychain.all() }
    }

    static func configuredServer() -> URL {
        let override = UserDefaults.standard.string(forKey: "AgentPagerServerURL")
        let built = Bundle.main.object(forInfoDictionaryKey: "AgentPagerServerURL") as? String
        for text in [override, built, "http://localhost:8787"] {
            if let text, let url = URL(string: text.trimmingCharacters(in: .whitespaces)), url.scheme != nil, url.host() != nil { return url }
        }
        return URL(string: "http://localhost:8787")!
    }

    func setServer(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: trimmed), let scheme = url.scheme, ["http", "https"].contains(scheme), url.host() != nil else { return false }
        UserDefaults.standard.set(trimmed, forKey: "AgentPagerServerURL")
        server = url
        inboxes = [:]
        lastSuccess = nil
        lastFailure = nil
        Task { await refreshAll() }
        return true
    }

    var client: APIClient { APIClient(base: server) }
    var myKeys: [PagerKey] { keys.filter { $0.server == server.absoluteString } }
    func key(_ sessionId: String) -> PagerKey? { myKeys.first { $0.sessionId == sessionId } }

    // MARK: Agents list

    // Every pager the server reports for our keys, except a phone-made link no agent has joined yet:
    // that one lives in the Connect sheet.
    var listed: [PagerSummary] {
        myKeys.compactMap { inboxes[$0.sessionId]?.session }.filter { $0.status != .waiting && $0.name != nil }
    }
    var active: [PagerSummary] { listed.filter { $0.status != .ended } }
    var ended: [PagerSummary] { listed.filter { $0.status == .ended }.sorted { ($0.endedAt ?? .distantPast) > ($1.endedAt ?? .distantPast) } }
    var loadedOnce: Bool { lastSuccess != nil || myKeys.isEmpty || !live }

    var statusLine: String {
        if lastFailure != nil, lastSuccess.map({ now.timeIntervalSince($0) > 10 }) ?? true { return "Can’t Reach Server" }
        guard let last = lastSuccess else { return "Updating…" }
        let age = now.timeIntervalSince(last)
        if age < 60 { return "Updated Just Now" }
        return "Updated " + Wording.ago(last, now: now)
    }

    // MARK: Polling

    func pollLoop() async {
        while !Task.isCancelled {
            await refreshAll()
            try? await Task.sleep(for: .seconds(Self.pollSeconds))
        }
    }

    func refreshAll() async {
        now = Date()
        guard live else { return }
        let stored = Keychain.all()
        if stored != keys { keys = stored }
        let client = self.client
        let mine = myKeys
        let results = await withTaskGroup(of: (PagerKey, Result<Inbox, APIError>).self) { group in
            for key in mine {
                group.addTask {
                    do throws(APIError) { return (key, .success(try await client.inbox(key))) } catch { return (key, .failure(error)) }
                }
            }
            var all: [(PagerKey, Result<Inbox, APIError>)] = []
            for await r in group { all.append(r) }
            return all
        }
        var failed: String?
        for (key, result) in results { if let f = apply(key, result) { failed = f } }
        now = Date()
        if failed == nil { lastSuccess = now; if lastFailure != nil { lastFailure = nil } } else { lastFailure = failed }
    }

    func refresh(_ sessionId: String) async {
        guard live, let key = key(sessionId) else { return }
        do throws(APIError) { _ = apply(key, .success(try await client.inbox(key))) } catch { _ = apply(key, .failure(error)) }
        now = Date()
    }

    // Returns a failure description for transport problems; drops keys the server no longer knows.
    private func apply(_ key: PagerKey, _ result: Result<Inbox, APIError>) -> String? {
        switch result {
        case .success(let inbox):
            // Assign only on change: every assignment re-renders, which would disturb an open menu.
            if inboxes[key.sessionId] != inbox { inboxes[key.sessionId] = inbox }
            for (decisionId, p) in inFlight where p.sessionId == key.sessionId {
                if inbox.answered.contains(where: { $0.decisionId == decisionId }) { inFlight[decisionId] = nil }
            }
            if key.madeByPhone, inbox.session.status == .unpaired, !autoPaired.contains(key.sessionId), let code = key.linkCode {
                autoPaired.insert(key.sessionId)
                sheet = .pairing(PairingTarget(code: code, sessionId: key.sessionId))
            }
            return nil
        case .failure(let error):
            if case .server(let status, _) = error, status == 404 || status == 401 {
                drop(key.sessionId)
                return nil
            }
            if case .transport(let text) = error { return text }
            return error.tag
        }
    }

    func drop(_ sessionId: String) {
        Keychain.delete(sessionId)
        keys.removeAll { $0.sessionId == sessionId }
        inboxes[sessionId] = nil
        path.removeAll { $0 == .agent(sessionId) }
    }

    // MARK: Connect an Agent (phone-made link)

    var connectKey: PagerKey? {
        myKeys.first { k in
            guard k.madeByPhone, k.linkURL != nil else { return false }
            if let s = inboxes[k.sessionId]?.session { return s.status == .waiting }
            return Date().timeIntervalSince(k.createdAt) < 14 * 60
        }
    }
    var connectLifetime: Lifetime {
        connectKey.flatMap { inboxes[$0.sessionId]?.session.lifetime } ?? .day
    }

    func ensureConnectLink() async {
        guard live, connectKey == nil, !connectBusy else { return }
        connectBusy = true
        connectError = nil
        defer { connectBusy = false }
        let phoneKey = randomToken()
        do throws(APIError) {
            let made = try await client.createPager(lifetime: .day, phoneKey: phoneKey)
            let key = PagerKey(sessionId: made.session.sessionId, phoneKey: phoneKey, server: server.absoluteString, madeByPhone: true, linkCode: made.link.code, linkURL: made.link.url, createdAt: Date())
            Keychain.save(key)
            keys = Keychain.all()
            inboxes[key.sessionId] = Inbox(session: made.session, open: [], answered: [])
        } catch {
            connectError = "Can’t reach your AgentPager server at \(server.absoluteString)."
        }
    }

    func setConnectLifetime(_ lifetime: Lifetime) async {
        guard let key = connectKey else { return }
        await setLifetime(key.sessionId, lifetime)
    }

    // MARK: Pairing

    func handle(url: URL) {
        guard url.scheme == "agentpager", url.host() == "start" else { return }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard let code = parts.first, code.count == 32 else { return }
        let mine = myKeys.first { $0.linkCode == code }
        sheet = .pairing(PairingTarget(code: code, sessionId: mine?.sessionId))
    }

    func paired(_ summary: PagerSummary, code: String, phoneKey: String) {
        if key(summary.sessionId) == nil {
            Keychain.save(PagerKey(sessionId: summary.sessionId, phoneKey: phoneKey, server: server.absoluteString, madeByPhone: false, linkCode: code, linkURL: nil, createdAt: Date()))
            keys = Keychain.all()
        }
        autoPaired.insert(summary.sessionId)
        inboxes[summary.sessionId] = Inbox(session: summary, open: inboxes[summary.sessionId]?.open ?? [], answered: inboxes[summary.sessionId]?.answered ?? [])
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            if case .pairing = sheet { sheet = nil }
            path = [.agent(summary.sessionId)]
            await refresh(summary.sessionId)
        }
    }

    func pairingFailed(sessionId: String?) {
        if let sessionId { Task { await refresh(sessionId) } }
    }

    // MARK: Agent screen

    func openDecisions(_ sessionId: String) -> [Decision] {
        (inboxes[sessionId]?.open ?? []).filter { d in undo?.decisionId != d.decisionId && inFlight[d.decisionId] == nil }
    }

    func answeredRows(_ sessionId: String) -> [AnsweredRow] {
        guard let inbox = inboxes[sessionId] else { return [] }
        var rows: [AnsweredRow] = []
        for d in inbox.open {
            if let u = undo, u.decisionId == d.decisionId { rows.append(AnsweredRow(decision: d, choice: u.choice, state: .sending)) }
            else if let p = inFlight[d.decisionId] { rows.append(AnsweredRow(decision: d, choice: p.choice, state: .sending)) }
        }
        for d in inbox.answered {
            guard let a = d.answer else { continue }
            rows.append(AnsweredRow(decision: d, choice: a.choice, state: d.acknowledgement == nil ? .waiting : .confirmed))
        }
        return rows
    }

    func decision(_ sessionId: String, _ decisionId: String) -> Decision? {
        guard let inbox = inboxes[sessionId] else { return nil }
        return (inbox.open + inbox.answered).first { $0.decisionId == decisionId }
    }

    func setLifetime(_ sessionId: String, _ lifetime: Lifetime) async {
        guard live, let key = key(sessionId) else { return }
        do throws(APIError) {
            let env = try await client.setLifetime(key, lifetime)
            if var inbox = inboxes[sessionId] { inbox.session = env.session; inboxes[sessionId] = inbox }
            else { inboxes[sessionId] = Inbox(session: env.session, open: [], answered: []) }
        } catch {
            await refresh(sessionId)
        }
    }

    func endPager(_ sessionId: String) async {
        guard live, let key = key(sessionId) else { return }
        if undo?.sessionId == sessionId { undo = nil }
        do throws(APIError) {
            let env = try await client.end(key)
            inboxes[sessionId] = Inbox(session: env.session, open: [], answered: [])
            path = []
        } catch {
            await refresh(sessionId)
        }
    }

    // MARK: Answering

    func send(sessionId: String, decisionId: String, choice: Choice) {
        if let pending = undo { undo = nil; commit(pending) }
        let p = PreparedAnswer(sessionId: sessionId, decisionId: decisionId, requestId: randomToken(), choice: choice, deadline: Date().addingTimeInterval(Self.undoSeconds))
        drafts[decisionId] = choice
        undo = p
        sheet = nil
        Task {
            try? await Task.sleep(for: .seconds(Self.undoSeconds))
            if undo?.requestId == p.requestId { undo = nil; commit(p) }
        }
    }

    func undoSend() {
        guard let p = undo else { return }
        undo = nil
        sheet = .decision(sessionId: p.sessionId, decisionId: p.decisionId)
    }

    // Leaving the app during the Undo window sends the answer at once.
    func flushUndo() {
        guard let p = undo else { return }
        undo = nil
        commit(p)
    }

    func commit(_ p: PreparedAnswer) {
        inFlight[p.decisionId] = p
        drafts[p.decisionId] = nil
        guard live, let key = key(p.sessionId) else { return }
        let client = self.client
        let background = BackgroundTask.begin("send-answer")
        Task {
            defer { background.end() }
            for delay in Self.retryDelays {
                if delay > 0 { try? await Task.sleep(for: .seconds(delay)) }
                do throws(APIError) {
                    if failSends > 0 { failSends -= 1; throw APIError.transport("simulated failure") }
                    _ = try await client.answer(key, decisionId: p.decisionId, requestId: p.requestId, choice: p.choice)
                    await refresh(p.sessionId)
                    if inFlight[p.decisionId]?.requestId == p.requestId, inboxes[p.sessionId]?.answered.contains(where: { $0.decisionId == p.decisionId }) == true {
                        inFlight[p.decisionId] = nil
                    }
                    return
                } catch {
                    if !error.isTransport {
                        // AlreadyAnswered, an ended pager and the like: the server's state wins.
                        inFlight[p.decisionId] = nil
                        await refresh(p.sessionId)
                        return
                    }
                }
            }
            notConfirmed = p
        }
    }

    func retryNotConfirmed() {
        guard let p = notConfirmed else { return }
        notConfirmed = nil
        commit(p)
    }

    func cancelNotConfirmed() {
        guard let p = notConfirmed else { return }
        notConfirmed = nil
        inFlight[p.decisionId] = nil
        drafts[p.decisionId] = p.choice
    }
}

// Keeps an answer sending for a few seconds after the owner leaves the app.
final class BackgroundTask {
    private var id: UIBackgroundTaskIdentifier = .invalid
    static func begin(_ name: String) -> BackgroundTask {
        let task = BackgroundTask()
        task.id = UIApplication.shared.beginBackgroundTask(withName: name) { task.end() }
        return task
    }
    func end() {
        guard id != .invalid else { return }
        UIApplication.shared.endBackgroundTask(id)
        id = .invalid
    }
}
