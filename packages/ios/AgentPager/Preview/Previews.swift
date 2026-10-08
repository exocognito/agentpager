import SwiftUI

// Canvas-matching sample data. Previews never touch the network or the Keychain.
enum Sample {
    static let now = Date()
    static func summary(_ id: String, _ name: String, _ status: PagerStatus, endsIn: TimeInterval = 24 * 3600, open: Int = 0, endedAgo: TimeInterval = 0, reason: EndReason? = nil) -> PagerSummary {
        status == .ended
            ? PagerSummary(sessionId: id, name: name, status: .ended, endedAt: now.addingTimeInterval(-endedAgo), endReason: reason)
            : PagerSummary(sessionId: id, name: name, status: status, lifetime: .day, createdAt: now, pairedAt: status == .active ? now : nil, endsAt: now.addingTimeInterval(endsIn), triesLeft: 3, openCount: open, lastActivityAt: now)
    }
    static func option(_ n: Int, _ e: String, _ t: String, _ d: String? = nil) -> Option { Option(number: n, emoji: e, title: t, detail: d) }
    static let maya = Decision(decisionId: "d2", status: .open, title: "Send Maya the update?", detail: "Maya asked for an update once the phone flow was ready.",
                               card: Card(type: "generic", options: [option(1, "📨", "Send now", "As drafted."), option(2, "🌅", "Send at 9:00 tomorrow", "It lands at the top of Maya’s morning."), option(3, "🗑️", "Don’t send it")], recommended: 1), askedAt: now)
    static let aim = Decision(decisionId: "d1", status: .open, title: "What should we aim for first?", detail: "Maya’s team can start this week; reliability work can follow their first real session.",
                              card: Card(type: "generic", options: [option(1, "🚀", "Ship to Maya’s team"), option(2, "🛠️", "Reliability first")], recommended: 1), askedAt: now)
    static let merge = Decision(decisionId: "d3", status: .open, title: "Merge PR #142?", detail: "All 12 checks pass. Two files touch the webhook handler.",
                                card: Card(type: "generic", options: [option(1, "✅", "Merge"), option(2, "⏸️", "Wait")]), askedAt: now)
    static let install = Decision(decisionId: "d0", status: .acknowledged, title: "Install dependencies", detail: nil,
                                  card: Card(type: "generic", options: [option(1, "🧪", "Update the test with the new flow"), option(2, "📦", "Pin the old version")]), askedAt: now,
                                  answer: Answer(answerId: "a0", decisionId: "d0", choice: .option(1), sentAt: now.addingTimeInterval(-120)),
                                  acknowledgement: Acknowledgement(decisionId: "d0", answerId: "a0", nextSteps: "Updating the test now.", acknowledgedAt: now.addingTimeInterval(-60)))
    static var mayaAnswered: Decision {
        var d = maya
        d.status = .acknowledged
        d.answer = Answer(answerId: "a2", decisionId: "d2", choice: .option(2), sentAt: now.addingTimeInterval(-60))
        d.acknowledgement = Acknowledgement(decisionId: "d2", answerId: "a2", nextSteps: "Sending it at 9:00 tomorrow.", acknowledgedAt: now)
        return d
    }

    static func model(empty: Bool = false) -> AppModel {
        let m = AppModel(live: false)
        guard !empty else { return m }
        let server = m.server.absoluteString
        let pagers: [(PagerSummary, [Decision], [Decision])] = [
            (summary("s1", "Claude Code · blueprint", .active, open: 3), [aim, maya, merge], [install]),
            (summary("s2", "Codex · agentpager", .unpaired, endsIn: 14 * 60 + 30), [], []),
            (summary("s3", "Pi · release notes", .ended, endedAgo: 40 * 60, reason: .agentFinished), [], []),
            (summary("s4", "Claude · trip planner", .ended, endedAgo: 26 * 3600, reason: .ownerEnded), [], []),
            (summary("s5", "Research agent", .ended, endedAgo: 3 * 86400, reason: .timedOut), [], []),
        ]
        for (i, (s, open, answered)) in pagers.enumerated() {
            m.keys.append(PagerKey(sessionId: s.sessionId, phoneKey: "k", server: server, madeByPhone: s.status == .unpaired, linkCode: String(repeating: "c", count: 32), linkURL: nil, createdAt: now.addingTimeInterval(Double(-i))))
            m.inboxes[s.sessionId] = Inbox(session: s, open: open, answered: answered)
        }
        m.lastSuccess = now
        return m
    }

    static let palette: [PaletteEntry] = [("🍋", "lemon"), ("🦊", "fox"), ("🚲", "bicycle"), ("🐙", "octopus"), ("🎈", "balloon"), ("🌙", "moon"), ("🔑", "key"), ("🌵", "cactus"), ("🐢", "turtle"), ("🍉", "watermelon"), ("⚓", "anchor"), ("🎸", "guitar"), ("🍄", "mushroom"), ("🚀", "rocket"), ("🧊", "ice"), ("🌻", "sunflower"), ("🦉", "owl"), ("🍩", "doughnut"), ("⛵", "sailboat"), ("🔔", "bell"), ("🐝", "bee"), ("🌈", "rainbow"), ("🧲", "magnet"), ("🥕", "carrot"), ("🪁", "kite")].map { PaletteEntry(emoji: $0.0, name: $0.1) }

    static func pairing(_ entered: [String?], phase: PairingFlow.Phase, tries: Int = 3) -> PairingFlow {
        let f = PairingFlow(target: PairingTarget(code: String(repeating: "c", count: 32), sessionId: nil), phoneKey: "k")
        f.name = "Codex · agentpager"
        f.palette = palette
        f.entered = entered
        f.focus = phase == .entering ? entered.firstIndex(where: { $0 == nil }) : nil
        f.triesLeft = tries
        f.phase = phase
        return f
    }
}

extension Sample {
    // `-demo <state>` launches the app on canvas sample data with no network, for screenshots.
    static func demo(_ state: String?) -> AppModel? {
        guard let state else { return nil }
        let m = model(empty: state == "empty" || state == "connect")
        let agent: [Route] = [.agent("s1")]
        let pairingTarget = ActiveSheet.pairing(PairingTarget(code: String(repeating: "c", count: 32), sessionId: nil))
        func pair(_ e: [String?], _ p: PairingFlow.Phase, _ t: Int = 3) { m.demoFlow = pairing(e, phase: p, tries: t); m.sheet = pairingTarget }
        switch state {
        case "connect":
            m.keys.append(PagerKey(sessionId: "w", phoneKey: "k", server: m.server.absoluteString, madeByPhone: true, linkCode: "k7Qm2vXa9LpR4tWn8ZcE1yHs5BdF3uJg", linkURL: "https://agentpager.me/start/k7Qm2vXa9LpR4tWn8ZcE1yHs5BdF3uJg", createdAt: .now))
            m.inboxes["w"] = Inbox(session: PagerSummary(sessionId: "w", name: nil, status: .waiting, lifetime: .day, endsAt: .now.addingTimeInterval(900)), open: [], answered: [])
            m.sheet = .connect
        case "agent": m.path = agent
        case "decision": m.path = agent; m.sheet = .decision(sessionId: "s1", decisionId: "d2")
        case "selected": m.path = agent; m.drafts["d2"] = .option(2); m.sheet = .decision(sessionId: "s1", decisionId: "d2")
        case "changes": m.path = agent; m.drafts["d2"] = .feedback("Please make it shorter."); m.sheet = .decision(sessionId: "s1", decisionId: "d2")
        case "undo": m.path = agent; m.undo = PreparedAnswer(sessionId: "s1", decisionId: "d2", requestId: "r", choice: .option(2), deadline: .now.addingTimeInterval(3600))
        case "waiting": m.path = agent; m.inFlight["d2"] = PreparedAnswer(sessionId: "s1", decisionId: "d2", requestId: "r", choice: .option(2), deadline: .now)
        case "confirmed": m.path = agent; m.inboxes["s1"]?.open = [aim, merge]; m.inboxes["s1"]?.answered = [mayaAnswered, install]
        case "thread": m.path = agent; m.inboxes["s1"]?.open = [aim, merge]; m.inboxes["s1"]?.answered = [mayaAnswered, install]; m.sheet = .thread(sessionId: "s1", decisionId: "d2")
        case "notconfirmed": m.path = agent; m.notConfirmed = PreparedAnswer(sessionId: "s1", decisionId: "d2", requestId: "r", choice: .option(2), deadline: .now); m.inFlight["d2"] = m.notConfirmed
        case "ended": m.path = [.agent("s3")]
        case "ended-failed": m.inboxes["s3"]?.session.endReason = .pairingFailed; m.path = [.agent("s3")]
        case "pair-empty": pair([nil, nil, nil], .entering)
        case "pair-two": pair(["🦊", "🌵", nil], .entering)
        case "pair-ready": pair(["🦊", "🌵", "🦊"], .entering)
        case "pair-checking": pair(["🦊", "🌵", "🦊"], .checking)
        case "pair-wrong": pair(["🦊", "🌵", "🐢"], .wrong, 2)
        case "pair-last": pair(["🦊", "🐙", "🦊"], .wrong, 1)
        case "pair-failed": pair([nil, nil, nil], .failed, 0)
        case "pair-paired": pair(["🦊", "🌵", "🦊"], .paired(summary("s2", "Codex · agentpager", .active)))
        default: break
        }
        return m
    }
}

private struct SheetHost<Content: View>: View {
    var model: AppModel
    @ViewBuilder var content: Content
    var body: some View {
        RootView().environment(model)
            .sheet(isPresented: .constant(true)) { content.environment(model) }
    }
}

#Preview("Agents") { RootView().environment(Sample.model()) }
#Preview("Agents · empty") { RootView().environment(Sample.model(empty: true)) }
#Preview("Connect an Agent") {
    let m = Sample.model(empty: true)
    m.keys.append(PagerKey(sessionId: "w", phoneKey: "k", server: m.server.absoluteString, madeByPhone: true, linkCode: "k7Qm2vXa9LpR4tWn8ZcE1yHs5BdF3uJg", linkURL: "https://agentpager.me/start/k7Qm2vXa9LpR4tWn8ZcE1yHs5BdF3uJg", createdAt: .now))
    m.inboxes["w"] = Inbox(session: PagerSummary(sessionId: "w", name: nil, status: .waiting, lifetime: .day, endsAt: .now.addingTimeInterval(900)), open: [], answered: [])
    return SheetHost(model: m) { ConnectSheet() }
}
#Preview("Pairing · empty") { SheetHost(model: Sample.model()) { PairingSheet(flow: Sample.pairing([nil, nil, nil], phase: .entering)) } }
#Preview("Pairing · two") { SheetHost(model: Sample.model()) { PairingSheet(flow: Sample.pairing(["🦊", "🌵", nil], phase: .entering)) } }
#Preview("Pairing · ready") { SheetHost(model: Sample.model()) { PairingSheet(flow: Sample.pairing(["🦊", "🌵", "🦊"], phase: .entering)) } }
#Preview("Pairing · checking") { SheetHost(model: Sample.model()) { PairingSheet(flow: Sample.pairing(["🦊", "🌵", "🦊"], phase: .checking)) } }
#Preview("Pairing · wrong") { SheetHost(model: Sample.model()) { PairingSheet(flow: Sample.pairing(["🦊", "🌵", "🐢"], phase: .wrong, tries: 2)) } }
#Preview("Pairing · last try") { SheetHost(model: Sample.model()) { PairingSheet(flow: Sample.pairing(["🦊", "🐙", "🦊"], phase: .wrong, tries: 1)) } }
#Preview("Pairing · failed") { SheetHost(model: Sample.model()) { PairingSheet(flow: Sample.pairing([nil, nil, nil], phase: .failed, tries: 0)) } }
#Preview("Pairing · paired") { SheetHost(model: Sample.model()) { PairingSheet(flow: Sample.pairing(["🦊", "🌵", "🦊"], phase: .paired(Sample.summary("s2", "Codex · agentpager", .active)))) } }
#Preview("Agent") { NavigationStack { AgentView(sessionId: "s1") }.environment(Sample.model()) }
#Preview("Agent · waiting for your agent") {
    let m = Sample.model()
    m.inFlight["d2"] = PreparedAnswer(sessionId: "s1", decisionId: "d2", requestId: "r", choice: .option(2), deadline: .now)
    return NavigationStack { AgentView(sessionId: "s1") }.environment(m)
}
#Preview("Agent · agent confirmed") {
    let m = Sample.model()
    m.inboxes["s1"]?.open = [Sample.aim, Sample.merge]
    m.inboxes["s1"]?.answered = [Sample.mayaAnswered, Sample.install]
    return NavigationStack { AgentView(sessionId: "s1") }.environment(m)
}
#Preview("Undo window") {
    let m = Sample.model()
    m.undo = PreparedAnswer(sessionId: "s1", decisionId: "d2", requestId: "r", choice: .option(2), deadline: .now.addingTimeInterval(5))
    m.path = [.agent("s1")]
    return RootView().environment(m)
}
#Preview("Decision") { SheetHost(model: Sample.model()) { DecisionSheet(sessionId: "s1", decisionId: "d2") } }
#Preview("Ask for Changes") {
    NavigationStack { AskChangesView(decision: Sample.maya, text: .constant("Please make it shorter.")) {} }.environment(Sample.model())
}
#Preview("Answered thread") {
    let m = Sample.model()
    m.inboxes["s1"]?.answered = [Sample.mayaAnswered]
    return SheetHost(model: m) { ThreadSheet(sessionId: "s1", decisionId: "d2") }
}
#Preview("Answer Not Confirmed") {
    let m = Sample.model()
    m.path = [.agent("s1")]
    m.notConfirmed = PreparedAnswer(sessionId: "s1", decisionId: "d2", requestId: "r", choice: .option(2), deadline: .now)
    return RootView().environment(m)
}
#Preview("Ended · agent finished") { NavigationStack { AgentView(sessionId: "s3") }.environment(Sample.model()) }
#Preview("Ended · pairing failed") {
    let m = Sample.model()
    m.inboxes["s3"]?.session.endReason = .pairingFailed
    return NavigationStack { AgentView(sessionId: "s3") }.environment(m)
}
