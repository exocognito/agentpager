import SwiftUI
import AgentPagerCrypto
import Observation
import UIKit
import UserNotifications

enum Route: Hashable {
    case pager(String)
    case pagerDetail(String)
    case decision(pagerId: String, agentId: String, decisionId: String)
    case answered(pagerId: String, project: String)
}

enum ActiveSheet: Identifiable, Hashable {
    case newPager
    var id: String { "new-pager" }
}

// An answer the owner pressed Send on. It waits out the Undo window, then is sent with the same requestId and the
// same sealed part on every retry, so the server can recognise a replay (I5). sealed: the answer, sealed at Send to
// the key inside its card (Sealed.swift).
struct PreparedAnswer: Identifiable, Hashable, Codable {
    var pagerId: String
    var agentId: String
    var decisionId: String
    var requestId: String
    var choice: Choice
    var sealed: String
    var deadline: Date
    var id: String { requestId }
}

// notPickedUp: the service warned that no agent had read the answer in time, and none has since (I6).
enum RowState: Hashable { case sending, waiting, notPickedUp, confirmed }

// A decision with who asked it.
struct Asked: Identifiable, Hashable {
    var agent: AgentInfo
    var decision: Decision
    var id: String { decision.decisionId }
}

// One project's decisions on a pager: open ones oldest first, answered ones newest first.
struct ProjectGroup: Identifiable, Hashable {
    var project: String
    var open: [Asked]
    var answered: [Asked]
    var id: String { project }
}

@Observable
final class AppModel {
    static let undoSeconds: Double = 5
    static let pollSeconds: Double = 3
    static let retryDelays: [Double] = [0, 1.5, 3, 6]

    var server: URL
    var pagers: [LocalPager] = []
    // Each pager as the phone opened it (Sealed.swift), from its last read, which is saved sealed on every change, so it
    // shows while the server can't be reached.
    var inboxes: [String: PagerInbox] = [:]
    private var sealedInboxes: [String: SealedPagerInbox] = [:] { didSet { if live { InboxCache.save(sealedInboxes) } } }
    // Every answer this phone sent, by its request id, with the part it sealed: only the agent can open the answer
    // itself, so this is how the phone shows its own answers. Kept until the pager goes.
    private var sentAnswers: [String: SentAnswer] = [:] { didSet { if live { AnswerCache.save(sentAnswers) } } }
    var now = Date()
    var lastSuccess: Date?
    var lastFailure: String?
    var path: [Route] = []
    var sheet: ActiveSheet?
    var undo: PreparedAnswer?
    // Every answer sent and not yet confirmed, by decision. Kept on disk until the server shows it stored.
    var inFlight: [String: PreparedAnswer] = [:] { didSet { if live { SendCache.save(inFlight) } } }
    // The ones whose retries all failed, in order, until the owner retries or cancels them.
    var notConfirmed: [PreparedAnswer] = []
    // Sends running now, so an answer is never sent twice at once, and the alert waits for the last to finish.
    private(set) var sendingNow: Set<String> = []
    var drafts: [String: Choice] = [:]
    // The pager the New pager sheet will create: its number shows before Create.
    var draft: LocalPager?
    var draftAutoOff: AutoOff = .never
    // `-demo` only: a decision sheet to open on launch, for screenshots.
    var demoSheet: DecisionView.Sheet?
    var createError: String?
    var createBusy = false
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
    let live: Bool
    // Debug only: `-failSends N` makes the next N answer attempts fail as if the network dropped,
    // so the "Answer Not Confirmed" alert can be exercised in the Simulator.
    private var failSends = UserDefaults.standard.integer(forKey: "failSends")

    init(live: Bool = true) {
        self.live = live
        self.server = Self.configuredServer()
        if live {
            // Here, not in the App's init: its @State model is built before that init's body runs.
            if ProcessInfo.processInfo.arguments.contains("-resetKeys") { Keychain.deleteAll(); InboxCache.deleteAll(); SendCache.deleteAll(); AnswerCache.deleteAll() }
            Keychain.deleteRetired()
            pagers = Keychain.all()
            sentAnswers = AnswerCache.load()
            sealedInboxes = InboxCache.load()
            for (id, sealed) in sealedInboxes { if let p = pagers.first(where: { $0.pagerId == id }), let inbox = Sealed.inbox(sealed, pager: p, answers: sentAnswers) { inboxes[id] = inbox } }
            inFlight = SendCache.load()
        }
    }

    // The Settings app's Server field (advanced, for self-hosters) if set, else this build's default.
    static func configuredServer() -> URL {
        let override = UserDefaults.standard.string(forKey: "AgentPagerServerURL")
        let built = Bundle.main.object(forInfoDictionaryKey: "AgentPagerServerURL") as? String
        for text in [override, built, "https://agentpager.me"] {
            if let text, let url = URL(string: text.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "/"))), ["http", "https"].contains(url.scheme ?? ""), url.host() != nil { return url }
        }
        return URL(string: "https://agentpager.me")!
    }

    // The owner may change the server in the Settings app while this app is in the background.
    func reloadServer() {
        let configured = Self.configuredServer()
        guard configured != server else { return }
        server = configured
        lastSuccess = nil
        lastFailure = nil
        path = []
    }

    var client: APIClient { APIClient(base: server) }
    // Pagers are kept per server: each number names the server it was made on.
    var myPagers: [LocalPager] { pagers.filter { $0.server == server.absoluteString } }
    func pager(_ pagerId: String) -> LocalPager? { myPagers.first { $0.pagerId == pagerId } }
    func state(_ pagerId: String) -> PagerState? { inboxes[pagerId]?.pager }
    func isOn(_ pagerId: String) -> Bool { state(pagerId)?.on ?? true }
    var loadedOnce: Bool { lastSuccess != nil || myPagers.isEmpty || !live }

    // True only while polls are failing; the Pagers screen says so only then.
    var serverTrouble: Bool { lastFailure != nil && (lastSuccess.map { now.timeIntervalSince($0) > 10 } ?? true) }
    var statusLine: String {
        lastSuccess.map { "Can’t Reach Server · Updated " + Wording.ago($0, now: now) } ?? "Can’t Reach Server"
    }

    // What the owner gives agents, copied as one block (B26.3, blueprint/areas/1-pagers.md).
    // A pager on another server names it in the command (--server, or the MCP connect tool's server), since the
    // agentpager command defaults to agentpager.me.
    func instructions(_ p: LocalPager) -> String {
        let host = URL(string: p.server).map { url in (url.host() ?? p.server) + (url.port.map { ":\($0)" } ?? "") } ?? p.server
        let server = p.server == "https://agentpager.me" ? "" : " --server \(p.server)"
        return "When I'm away and you need my decision, use \(host) MCP or CLI to send me decisions:\n$ agentpager connect \(p.number)\(server)"
    }

    // MARK: Polling

    func pollLoop() async {
        // Each return to the foreground gives the device token again, in case the server dropped one.
        pushGiven = []
        await refreshAll()
        // Answers kept from an earlier launch go again once the server has said which it already stored.
        resumeSends()
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(Self.pollSeconds))
            await refreshAll()
        }
    }

    func refreshAll() async {
        now = Date()
        guard live else { return }
        let stored = Keychain.all()
        if stored != pagers { pagers = stored }
        let client = self.client
        let mine = myPagers
        let results = await withTaskGroup(of: (LocalPager, Result<SealedPagerInbox, APIError>).self) { group in
            for p in mine {
                group.addTask {
                    do throws(APIError) { return (p, .success(try await client.pager(p))) } catch { return (p, .failure(error)) }
                }
            }
            var all: [(LocalPager, Result<SealedPagerInbox, APIError>)] = []
            for await r in group { all.append(r) }
            return all
        }
        var failed: String?
        for (p, result) in results { if let f = apply(p, result) { failed = f } }
        now = Date()
        if failed == nil { lastSuccess = now; if lastFailure != nil { lastFailure = nil } } else { lastFailure = failed }
        await askForAlertsOnce()
        await givePushToken()
        await showWaitingOnIcon()
    }

    func refresh(_ pagerId: String) async {
        guard live, let p = pager(pagerId) else { return }
        do throws(APIError) { _ = apply(p, .success(try await client.pager(p))) } catch { _ = apply(p, .failure(error)) }
        now = Date()
    }

    // Returns a failure description for transport problems; drops pagers the server no longer knows.
    private func apply(_ p: LocalPager, _ result: Result<SealedPagerInbox, APIError>) -> String? {
        switch result {
        case .success(let sealed):
            // A reply that names another pager isn't this pager's read: shown as a failure, and nothing of it kept.
            guard let inbox = Sealed.inbox(sealed, pager: p, answers: sentAnswers) else { return "the server answered for another pager" }
            // Assign only on change: every assignment re-renders, which would disturb an open menu.
            if sealedInboxes[p.pagerId] != sealed { sealedInboxes[p.pagerId] = sealed }
            if inboxes[p.pagerId] != inbox { inboxes[p.pagerId] = inbox }
            let answered = Set(inbox.agents.flatMap { $0.answered.map(\.decisionId) })
            for (decisionId, a) in inFlight where a.pagerId == p.pagerId && answered.contains(decisionId) { inFlight[decisionId] = nil }
            notConfirmed.removeAll { $0.pagerId == p.pagerId && answered.contains($0.decisionId) }
            return nil
        case .failure(let error):
            // Only the server saying the pager is gone drops it: the keys can't be got back, and a 401 or 404 can
            // also come from a proxy or a route that moved.
            if error.tag == "UnknownPager" {
                drop(p.pagerId)
                return nil
            }
            if case .transport(let text) = error { return text }
            return error.tag
        }
    }

    func drop(_ pagerId: String) {
        Keychain.delete(pagerId)
        pagers.removeAll { $0.pagerId == pagerId }
        inFlight = inFlight.filter { $0.value.pagerId != pagerId }
        notConfirmed.removeAll { $0.pagerId == pagerId }
        let agents = Set(inboxes[pagerId]?.agents.map(\.agent.agentId) ?? [])
        inboxes[pagerId] = nil
        sealedInboxes[pagerId] = nil
        sentAnswers = sentAnswers.filter { $0.value.pagerId != pagerId }
        files = files.filter { !agents.contains(String($0.key.split(separator: "/").first ?? "")) }
        path.removeAll { route in
            switch route {
            case .pager(let id), .pagerDetail(let id), .decision(let id, _, _), .answered(let id, _): id == pagerId
            }
        }
    }

    // MARK: Alerts

    // Asked once, when there is a pager to be paged on.
    private func askForAlertsOnce() async {
        guard !askedForAlerts, !myPagers.isEmpty else { return }
        askedForAlerts = true
        let center = UNUserNotificationCenter.current()
        guard await center.notificationSettings().authorizationStatus == .notDetermined else { return }
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    // Gives the device token to each pager not yet given it. A request that does not reach the server is tried again
    // on the next refresh; one the server refuses is not.
    func givePushToken() async {
        guard live, let token = deviceToken else { return }
        let client = self.client, environment = Self.pushEnvironment
        for p in myPagers {
            guard pushGiven.insert("\(p.pagerId) \(token)").inserted else { continue }
            do throws(APIError) { try await client.push(p, token: token, environment: environment) } catch {
                if error.isTransport { pushGiven.remove("\(p.pagerId) \(token)") }
            }
        }
    }

    // The app icon shows how many decisions are waiting on pagers that are on.
    private func showWaitingOnIcon() async {
        let waiting = myPagers.filter { isOn($0.pagerId) }.reduce(0) { $0 + openCount($1.pagerId) }
        guard waiting != badge else { return }
        badge = waiting
        try? await UNUserNotificationCenter.current().setBadgeCount(waiting)
    }

    // Tapping an alert opens its decision.
    func openAlert(pagerId: String, agentId: String, decisionId: String) async {
        await refreshAll()
        guard pager(pagerId) != nil else { return }
        path = [.pager(pagerId)]
        if asked(pagerId, agentId, decisionId) != nil { path.append(.decision(pagerId: pagerId, agentId: agentId, decisionId: decisionId)) }
    }

    // MARK: Pagers

    func startNewPager() {
        draft = LocalPager.make(name: "", server: server.absoluteString)
        createError = nil
        sheet = .newPager
    }

    func createPager(name: String, autoOff: AutoOff) async {
        guard var p = draft, !createBusy else { return }
        p.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        createBusy = true
        createError = nil
        defer { createBusy = false }
        do throws(APIError) {
            let made = live ? try await client.createPager(p, autoOff: autoOff) : PagerReply(pager: PagerState(pagerId: p.pagerId, on: true, autoOff: autoOff, createdAt: Date()))
            if live { Keychain.save(p) }
            pagers.append(p)
            inboxes[p.pagerId] = PagerInbox(pager: made.pager, agents: [])
            if live { sealedInboxes[p.pagerId] = SealedPagerInbox(pager: made.pager, agents: []) }
            draft = nil
            sheet = nil
            path = [.pager(p.pagerId)]
            Task { await givePushToken() }
        } catch {
            // A refusal says why; only a pager the server never answered about is "can't reach".
            if case .server(let status, let body) = error, status < 500 {
                createError = body.message ?? "Your AgentPager server refused this pager (\(body.error))."
            } else {
                createError = "Can’t reach your AgentPager server at \(server.absoluteString)."
            }
        }
    }

    // The name lives only on this phone.
    func rename(_ pagerId: String, _ name: String) {
        guard let i = pagers.firstIndex(where: { $0.pagerId == pagerId }) else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, pagers[i].name != trimmed else { return }
        pagers[i].name = trimmed
        if live { Keychain.save(pagers[i]) }
    }

    func setOn(_ pagerId: String, _ on: Bool) async {
        guard let p = pager(pagerId) else { return }
        guard live else { inboxes[pagerId]?.pager.on = on; inboxes[pagerId]?.pager.offSince = on ? nil : Date(); return }
        do throws(APIError) { inboxes[pagerId]?.pager = try await client.setOn(p, on).pager } catch { await refresh(pagerId) }
        await showWaitingOnIcon()
    }

    func setAutoOff(_ pagerId: String, _ autoOff: AutoOff) async {
        guard let p = pager(pagerId) else { return }
        guard live else { inboxes[pagerId]?.pager.autoOff = autoOff; return }
        do throws(APIError) { inboxes[pagerId]?.pager = try await client.setAutoOff(p, autoOff).pager } catch { await refresh(pagerId) }
    }

    // Deleted from the service with its agents and decisions, then from this phone.
    func deletePager(_ pagerId: String) async {
        guard let p = pager(pagerId) else { return }
        if live {
            do throws(APIError) { try await client.delete(p) } catch {
                guard error.tag == "UnknownPager" else { await refresh(pagerId); return }
            }
        }
        path = []
        drop(pagerId)
    }

    // MARK: Decisions

    func agents(_ pagerId: String) -> [AgentInbox] { inboxes[pagerId]?.agents ?? [] }
    func agent(_ agentId: String) -> AgentInfo? { inboxes.values.lazy.flatMap(\.agents).first { $0.agent.agentId == agentId }?.agent }
    private func pagerOf(_ agentId: String) -> LocalPager? {
        myPagers.first { p in agents(p.pagerId).contains { $0.agent.agentId == agentId } }
    }
    private func sending(_ decisionId: String) -> Bool { undo?.decisionId == decisionId || inFlight[decisionId] != nil }

    func asked(_ pagerId: String, _ agentId: String, _ decisionId: String) -> Asked? {
        guard let a = agents(pagerId).first(where: { $0.agent.agentId == agentId }),
              let d = (a.open + a.answered).first(where: { $0.decisionId == decisionId }) else { return nil }
        return Asked(agent: a.agent, decision: d)
    }

    func openCount(_ pagerId: String) -> Int {
        agents(pagerId).reduce(0) { n, a in n + a.open.filter { !sending($0.decisionId) }.count }
    }

    // Decisions grouped by project. Projects with open decisions come first, the one waiting longest on top; then the
    // rest, the most recently answered on top.
    func groups(_ pagerId: String) -> [ProjectGroup] {
        var byProject: [String: ProjectGroup] = [:]
        for a in agents(pagerId) {
            var g = byProject[a.agent.project] ?? ProjectGroup(project: a.agent.project, open: [], answered: [])
            for d in a.open { if sending(d.decisionId) { g.answered.append(Asked(agent: a.agent, decision: d)) } else { g.open.append(Asked(agent: a.agent, decision: d)) } }
            g.answered += a.answered.map { Asked(agent: a.agent, decision: $0) }
            byProject[a.agent.project] = g
        }
        let answeredAt = { (x: Asked) in x.decision.answer?.sentAt ?? .distantFuture }
        let all = byProject.values.map { g in
            ProjectGroup(project: g.project, open: g.open.sorted { $0.decision.askedAt < $1.decision.askedAt }, answered: g.answered.sorted { answeredAt($0) > answeredAt($1) })
        }
        return all.sorted { a, b in
            switch (a.open.first, b.open.first) {
            case let (x?, y?): return x.decision.askedAt < y.decision.askedAt
            case (.some, nil): return true
            case (nil, .some): return false
            case (nil, nil): return (a.answered.first.map(answeredAt) ?? .distantPast) > (b.answered.first.map(answeredAt) ?? .distantPast)
            }
        }
    }

    // The owner's answer: the one sent, or one still in its Undo window or on its way.
    func choice(_ d: Decision) -> Choice? {
        if let u = undo, u.decisionId == d.decisionId { return u.choice }
        return inFlight[d.decisionId]?.choice ?? d.answer?.choice
    }
    func rowState(_ d: Decision) -> RowState {
        if sending(d.decisionId) || d.answer == nil { return .sending }
        if d.acknowledgement != nil { return .confirmed }
        return d.warnedAt != nil && d.collectedAt == nil ? .notPickedUp : .waiting
    }

    // A brief's attachments, kept in memory once read and opened: a decision never changes (I5). They go with the
    // pager when the phone drops it. Each is fetched by its slot in the card's list and opened bound to that slot; one
    // that won't open is refused, and the brief shows it as one it couldn't load.
    @ObservationIgnored var files: [String: Data] = [:]
    func attachment(_ agentId: String, _ decisionId: String, _ name: String) async throws(APIError) -> Data {
        let id = agentId + "/" + decisionId + "/" + name
        if let data = files[id] { return data }
        guard live, let p = pagerOf(agentId) else { throw .transport("This phone holds no key for the pager.") }
        guard let slot = asked(p.pagerId, agentId, decisionId)?.decision.attachments?.firstIndex(where: { $0.name == name }) else { throw .transport("This decision has no attachment \(name).") }
        let part = try await client.file(p, agentId: agentId, decisionId: decisionId, slot: slot)
        guard let data = Sealed.attachment(part, pager: p, decisionId: decisionId, slot: slot) else { throw .transport("This attachment can’t be read.") }
        // A page is held to the page contract before any of it shows, since the server can't check it (I4.9).
        if let entries = asked(p.pagerId, agentId, decisionId)?.decision.attachments, entries[slot].type == "text/markdown" {
            do throws(PartError) { _ = try Parts.page(data, attachments: entries.map { (name: $0.name, type: $0.type) }) } catch { throw .transport("This page can’t be read.") }
        }
        files[id] = data
        return data
    }

    // MARK: Answering

    func send(pagerId: String, agentId: String, decisionId: String, choice: Choice) {
        // Sealed now, to the key inside the card being answered, and sent as sealed on every try (I5). A card the phone
        // couldn't read offers nothing to send.
        guard let d = asked(pagerId, agentId, decisionId)?.decision, !d.unreadable else { return }
        let sealed: String
        if live { guard let s = Sealed.answer(choice, to: d.answerKey, pagerId: pagerId, decisionId: decisionId) else { return }; sealed = s } else { sealed = "" }
        if let pending = undo { undo = nil; commit(pending) }
        let p = PreparedAnswer(pagerId: pagerId, agentId: agentId, decisionId: decisionId, requestId: randomToken(), choice: choice, sealed: sealed, deadline: Date().addingTimeInterval(Self.undoSeconds))
        drafts[decisionId] = choice
        undo = p
        if case .decision(_, _, decisionId)? = path.last { path.removeLast() }
        Task {
            try? await Task.sleep(for: .seconds(Self.undoSeconds))
            if undo?.requestId == p.requestId { undo = nil; commit(p) }
        }
    }

    func undoSend() {
        guard let p = undo else { return }
        undo = nil
        let route = Route.decision(pagerId: p.pagerId, agentId: p.agentId, decisionId: p.decisionId)
        if path.last != route { path.append(route) }
    }

    // Leaving the app during the Undo window sends the answer at once.
    func flushUndo() {
        guard let p = undo else { return }
        undo = nil
        commit(p)
    }

    func commit(_ p: PreparedAnswer) {
        // A pager no longer on this phone takes its answers with it.
        guard pagers.contains(where: { $0.pagerId == p.pagerId }) else {
            inFlight[p.decisionId] = nil
            notConfirmed.removeAll { $0.requestId == p.requestId }
            return
        }
        inFlight[p.decisionId] = p
        drafts[p.decisionId] = nil
        // Kept before it is sent, so whichever send the server stores, the phone can show it.
        if live, sentAnswers[p.requestId] == nil { sentAnswers[p.requestId] = SentAnswer(pagerId: p.pagerId, decisionId: p.decisionId, choice: p.choice, sealed: p.sealed) }
        // An answer goes only to the server its pager was made on; it waits while the phone points elsewhere.
        guard live, let pager = pager(p.pagerId), !sendingNow.contains(p.requestId) else { return }
        sendingNow.insert(p.requestId)
        let client = self.client
        let background = BackgroundTask.begin("send-answer")
        Task {
            defer { background.end(); sendingNow.remove(p.requestId) }
            for delay in Self.retryDelays {
                if delay > 0 { try? await Task.sleep(for: .seconds(delay)) }
                do throws(APIError) {
                    if failSends > 0 { failSends -= 1; throw APIError.transport("simulated failure") }
                    _ = try await client.answer(pager, agentId: p.agentId, decisionId: p.decisionId, requestId: p.requestId, sealed: p.sealed)
                    notConfirmed.removeAll { $0.requestId == p.requestId }
                    await refresh(p.pagerId)
                    return
                } catch {
                    if !error.isTransport {
                        // AlreadyAnswered, a pager turned off and the like: the server's state wins. The send stays on
                        // record: an earlier try of it may have been stored before its reply was lost, and it shows as
                        // the answer only if the server hands back exactly the part it sealed.
                        inFlight[p.decisionId] = nil
                        notConfirmed.removeAll { $0.requestId == p.requestId }
                        await refresh(p.pagerId)
                        return
                    }
                }
            }
            // Unless its pager went while it was trying.
            if pagers.contains(where: { $0.pagerId == p.pagerId }), !notConfirmed.contains(where: { $0.requestId == p.requestId }) { notConfirmed.append(p) }
        }
    }

    // Every answer not yet confirmed goes again with the same requestId: those kept from an earlier launch, and those
    // already reported as not confirmed, which leave the alert once one gets through.
    func resumeSends() {
        for p in inFlight.values { commit(p) }
    }

    func retryNotConfirmed() {
        let all = notConfirmed
        notConfirmed = []
        for p in all { commit(p) }
    }

    func cancelNotConfirmed() {
        for p in notConfirmed {
            inFlight[p.decisionId] = nil
            drafts[p.decisionId] = p.choice
        }
        notConfirmed = []
    }

    // "Your answer to “Book the train?” is not confirmed.", naming every answer the alert covers.
    var notConfirmedText: String {
        let titles = notConfirmed.map { p in "“" + (inboxes[p.pagerId]?.agents.lazy.flatMap(\.open).first { $0.decisionId == p.decisionId }?.title ?? "a decision") + "”" }
        let list = titles.count > 1 ? titles.dropLast().joined(separator: ", ") + " and " + (titles.last ?? "") : titles.first ?? ""
        return titles.count > 1 ? "Your answers to \(list) are not confirmed. Retry sends the same prepared answers." : "Your answer to \(list) is not confirmed. Retry sends the same prepared answer."
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
