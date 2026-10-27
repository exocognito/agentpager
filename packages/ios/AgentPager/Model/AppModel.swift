import SwiftUI
import Observation
import UIKit
import UserNotifications

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
    case settings

    var id: String {
        switch self {
        case .connect: "connect"
        case .pairing(let t): "pairing-\(t.code)"
        case .decision(_, let d): "decision-\(d)"
        case .thread(_, let d): "thread-\(d)"
        case .settings: "settings"
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
    var sendsAt: Date? = nil // set while Undo is open
    var id: String { decision.decisionId }
}

@Observable
final class AppModel {
    static let undoSeconds: Double = 5
    static let pollSeconds: Double = 3
    static let retryDelays: [Double] = [0, 1.5, 3, 6]

    var server: URL
    var keys: [PagerKey] = []
    // Saved on every change, so an ended pager's decisions stay readable (see InboxCache).
    var inboxes: [String: Inbox] = [:] { didSet { if live { InboxCache.save(inboxes) } } }
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
    var pagerNumber: PagerNumber?
    var numberError: String?
    var numberBusy = false
    private var autoPaired: Set<String> = []
    // Alerts (Alerts.swift).
    var deviceToken: String? { didSet { if deviceToken != oldValue { Task { await givePushToken() } } } }
    private var pushGiven: Set<String> = []
    private var askedForAlerts = false
    private var badge: Int?
    // The Apple service this build's token belongs to: its signing profile's aps-environment. A TestFlight or App
    // Store build has no embedded profile and uses production; the Simulator uses the sandbox.
    static let pushEnvironment: String = {
        #if targetEnvironment(simulator)
        return "sandbox"
        #else
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex),
              let profile = try? PropertyListSerialization.propertyList(from: data[start.lowerBound..<end.upperBound], format: nil) as? [String: Any],
              let entitlements = profile["Entitlements"] as? [String: Any] else { return "production" }
        return entitlements["aps-environment"] as? String == "production" ? "production" : "sandbox"
        #endif
    }()
    var demoFlow: PairingFlow?
    let live: Bool
    // Debug only: `-failSends N` makes the next N answer attempts fail as if the network dropped,
    // so the "Answer Not Confirmed" alert can be exercised in the Simulator.
    private var failSends = UserDefaults.standard.integer(forKey: "failSends")

    init(live: Bool = true) {
        self.live = live
        self.server = Self.configuredServer()
        if live {
            // Here, not in the App's init: its @State model is built before that init's body runs.
            if ProcessInfo.processInfo.arguments.contains("-resetKeys") { Keychain.deleteAll(); InboxCache.deleteAll() }
            keys = Keychain.all()
            pagerNumber = Keychain.number(server: server.absoluteString)
            inboxes = InboxCache.load()
        }
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
        pagerNumber = Keychain.number(server: url.absoluteString)
        numberError = nil
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

    // True only while polls are failing; the Agents list shows its status pill only then.
    var serverTrouble: Bool { lastFailure != nil && (lastSuccess.map { now.timeIntervalSince($0) > 10 } ?? true) }

    var statusLine: String {
        if serverTrouble { return lastSuccess.map { "Can’t Reach Server · Updated " + Wording.ago($0, now: now) } ?? "Can’t Reach Server" }
        guard let last = lastSuccess else { return "Updating…" }
        let age = now.timeIntervalSince(last)
        if age < 60 { return "Updated Just Now" }
        return "Updated " + Wording.ago(last, now: now)
    }

    // MARK: Polling

    func pollLoop() async {
        // Each return to the foreground gives the device token again, in case the server dropped one.
        pushGiven = []
        while !Task.isCancelled {
            await refreshAll()
            try? await Task.sleep(for: .seconds(Self.pollSeconds))
        }
    }

    func refreshAll() async {
        now = Date()
        guard live else { return }
        let numberFailure = await takeNumberPagers()
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
        var failed = numberFailure
        for (key, result) in results { if let f = apply(key, result) { failed = f } }
        now = Date()
        // An ended pager stays on this phone, read only, for 24 hours after it ended.
        for key in myKeys {
            if let s = inboxes[key.sessionId]?.session, s.status == .ended, let ended = s.endedAt, now.timeIntervalSince(ended) >= InboxCache.keepEnded {
                drop(key.sessionId)
            }
        }
        if failed == nil { lastSuccess = now; if lastFailure != nil { lastFailure = nil } } else { lastFailure = failed }
        await askForAlertsOnce()
        await givePushToken()
        await showWaitingOnIcon()
    }

    // Pagers agents opened with the pager number join the list in the same poll. Returns a failure description.
    private func takeNumberPagers() async -> String? {
        guard let phoneKey = pagerNumber?.phoneKey else { return nil }
        let listed: NumberPagers
        do throws(APIError) { listed = try await client.numberPagers(phoneKey: phoneKey) } catch {
            if case .transport(let text) = error { return text }
            return error.tag
        }
        // Re-read after the request: the number may have changed meanwhile, and that change must not be undone.
        guard var n = pagerNumber, n.phoneKey == phoneKey else { return nil }
        let fresh = listed.sessionIds.filter { !n.seen.contains($0) }
        guard !fresh.isEmpty else { return nil }
        for id in fresh where key(id) == nil {
            Keychain.save(PagerKey(sessionId: id, phoneKey: n.phoneKey, server: n.server, madeByPhone: false, linkCode: nil, linkURL: nil, createdAt: Date()))
        }
        n.seen += fresh
        Keychain.save(n)
        pagerNumber = n
        return nil
    }

    func refresh(_ sessionId: String) async {
        guard live, let key = key(sessionId) else { return }
        do throws(APIError) { _ = apply(key, .success(try await client.inbox(key))) } catch { _ = apply(key, .failure(error)) }
        now = Date()
    }

    // Returns a failure description for transport problems; drops keys the server no longer knows.
    private func apply(_ key: PagerKey, _ result: Result<Inbox, APIError>) -> String? {
        switch result {
        case .success(var inbox):
            // The server deleted an ended pager's decisions; keep the phone's last copy of them, unchanged.
            if inbox.session.status == .ended, inbox.open.isEmpty, inbox.answered.isEmpty, let last = inboxes[key.sessionId] {
                inbox.open = last.open
                inbox.answered = last.answered
            }
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

    // MARK: Alerts

    // Asked once, when the first pager is paired.
    private func askForAlertsOnce() async {
        guard !askedForAlerts, active.contains(where: { $0.status == .active }) else { return }
        askedForAlerts = true
        let center = UNUserNotificationCenter.current()
        guard await center.notificationSettings().authorizationStatus == .notDetermined else { return }
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    // Gives the device token to the pager number and to each pager not yet given it. A request that does not reach
    // the server is tried again on the next refresh; one the server refuses is not.
    func givePushToken() async {
        guard live, let token = deviceToken else { return }
        let client = self.client, environment = Self.pushEnvironment
        if let n = pagerNumber, n.server == server.absoluteString, pushGiven.insert("number \(n.phoneKey) \(token)").inserted {
            do throws(APIError) { try await client.numberPush(phoneKey: n.phoneKey, token: token, environment: environment) } catch {
                if error.isTransport { pushGiven.remove("number \(n.phoneKey) \(token)") }
            }
        }
        for key in myKeys where inboxes[key.sessionId]?.session.status != .ended {
            guard pushGiven.insert("\(key.sessionId) \(token)").inserted else { continue }
            do throws(APIError) { try await client.push(key, token: token, environment: environment) } catch {
                if error.isTransport { pushGiven.remove("\(key.sessionId) \(token)") }
            }
        }
    }

    // The app icon shows how many decisions are waiting on paired pagers.
    private func showWaitingOnIcon() async {
        let waiting = myKeys.compactMap { inboxes[$0.sessionId] }.filter { $0.session.status == .active }.reduce(0) { $0 + $1.open.count }
        guard waiting != badge else { return }
        badge = waiting
        try? await UNUserNotificationCenter.current().setBadgeCount(waiting)
    }

    // Tapping an alert opens its decision: the decision sheet while it is open, its thread once answered.
    func openAlert(sessionId: String, decisionId: String) async {
        await refreshAll()
        guard key(sessionId) != nil else { return }
        path = [.agent(sessionId)]
        guard let d = decision(sessionId, decisionId) else { return }
        sheet = d.answer == nil ? .decision(sessionId: sessionId, decisionId: decisionId) : .thread(sessionId: sessionId, decisionId: decisionId)
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

    // MARK: Pager number

    // What the owner pastes into AGENTS.md.
    var numberInstructions: String? {
        guard let n = pagerNumber else { return nil }
        return "When you need a decision from me, page me on AgentPager: read \(server.appending(path: "start").absoluteString), then open a pager with my pager number \(n.number). Open one pager for your piece of work and keep it for every question."
    }

    func ensureNumber() async {
        guard live, pagerNumber == nil, !numberBusy else { return }
        await makeNumber(replacing: nil)
    }

    // The old number stops working at once. The phone key stays, so pagers already open keep working and the
    // server's listing carries over.
    func rotateNumber() async {
        guard live, let n = pagerNumber, !numberBusy else { return }
        await makeNumber(replacing: n)
    }

    private func makeNumber(replacing old: PagerNumber?) async {
        numberBusy = true
        numberError = nil
        defer { numberBusy = false }
        let phoneKey = old?.phoneKey ?? randomToken(), base = server.absoluteString
        do throws(APIError) {
            let made = try await client.makeNumber(phoneKey: phoneKey)
            // The server has retired the old number, so keep the new one for `base` even if the owner switched
            // servers meanwhile; show it only if `base` is still current.
            let seen = Keychain.number(server: base).flatMap { $0.phoneKey == phoneKey ? $0.seen : nil } ?? []
            let n = PagerNumber(server: base, phoneKey: phoneKey, number: made.number, seen: seen)
            Keychain.save(n)
            if server.absoluteString == base { pagerNumber = n; Task { await givePushToken() } }
        } catch {
            if server.absoluteString == base { numberError = "Can’t reach your AgentPager server at \(base)." }
        }
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
        // Now, not at the next poll: the owner may leave the app straight after pairing.
        Task { await givePushToken() }
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
            if let u = undo, u.decisionId == d.decisionId { rows.append(AnsweredRow(decision: d, choice: u.choice, state: .sending, sendsAt: u.deadline)) }
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

    // A brief's attachments, kept in memory once read: a decision never changes (SI8).
    @ObservationIgnored private var files: [String: Data] = [:]
    func attachment(_ sessionId: String, _ decisionId: String, _ name: String) async throws(APIError) -> Data {
        let id = decisionId + "/" + name
        if let data = files[id] { return data }
        guard live, let key = key(sessionId) else { throw .transport("This phone holds no key for the pager.") }
        let data = try await client.file(key, decisionId: decisionId, name: name)
        files[id] = data
        return data
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
            // The reply carries only the ended session; keep the phone's copy of the decisions (see InboxCache).
            let last = inboxes[sessionId]
            inboxes[sessionId] = Inbox(session: env.session, open: last?.open ?? [], answered: last?.answered ?? [])
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
