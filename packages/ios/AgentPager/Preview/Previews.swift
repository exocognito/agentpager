import SwiftUI

// The mocks' sample data (docs/v2/mocks). Previews and `-demo` never touch the network or the Keychain.
enum Sample {
    static let now = Date()
    static let work = "a0000000000000000000000000000001", vm = "a0000000000000000000000000000002", acme = "a0000000000000000000000000000003"
    static let codex = "codex000000000000000000000000001", claude = "claude00000000000000000000000001", pi = "pi00000000000000000000000000001x", codexBilling = "codex000000000000000000000000002"
    static let vmCodex = "codex000000000000000000000000003", acmeCodex = "codex000000000000000000000000004"
    static let m11 = "m11guarantee00000000000000000001"
    static let numbers = [work: "ap1_Hc84pWq2zTn6bVx1yRk9mDs3fGj7Lk3Q", vm: "ap1_7Kq2mXv9tRbN4cWz8hL1sP6dF3gJ9wTe", acme: "ap1_Qm4rT8vY2nB6cX1zL9kH3jF7dS5aW0eU"]

    static func agent(_ id: String, _ app: String, _ project: String) -> AgentInfo {
        AgentInfo(agentId: id, app: app, project: project, createdAt: now.addingTimeInterval(-86400), finishedAt: nil, lastActivityAt: now, openCount: 0)
    }
    static func option(_ n: Int, _ title: String, _ label: String, _ prioritizes: String) -> Option {
        Option(number: n, title: title, label: label, prioritizes: prioritizes)
    }
    static func brief(_ id: String, _ title: String, ago: TimeInterval, markdown: String = "## Options\n", options: [Option]? = nil, recommended: Int? = nil) -> Decision {
        Decision(decisionId: id, status: .open, title: title, card: Card(type: "brief", options: options ?? [option(1, "Go ahead", "Go ahead", "getting it done"), option(2, "Wait", "Wait", "caution")], recommended: recommended, markdown: markdown), askedAt: now.addingTimeInterval(-ago))
    }
    static func answered(_ d: Decision, _ choice: Choice, at: Date, ack: String?) -> Decision {
        var d = d
        d.answer = Answer(answerId: "a-" + d.decisionId, decisionId: d.decisionId, choice: choice, sentAt: at)
        if let ack { d.acknowledgement = Acknowledgement(decisionId: d.decisionId, answerId: "a-" + d.decisionId, nextSteps: ack, acknowledgedAt: at) }
        if case .feedback = choice { d.status = .feedback } else { d.status = ack == nil ? .answered : .acknowledged }
        return d
    }
    static func done(_ prefix: String, _ count: Int) -> [Decision] {
        (1...count).map { n in answered(brief("\(prefix)\(n)", "Earlier decision \(n)", ago: Double(n) * 86400), .option(1), at: now.addingTimeInterval(-Double(n) * 86000), ack: "Done.") }
    }

    // The M11 decision, docs/v2/card-example.yaml as the brief the binary compiles it to.
    static let m11Options = [
        option(1, "Smaller fix with manual recovery", "Small + manual", "less code and state, accepting an occasional Cancel or Run again after a connection failure"),
        option(2, "Precise automatic recovery", "Precise + automatic", "never leaving a job stuck, at the cost of durable request identities and more code"),
    ]
    static let m11Markdown = """
    ## Context: a lost reply
    The service hands the agent job A, but the reply is lost on the way. When the agent asks again it gets job B, and A is stuck. We don't know how often this happens in production.
    [How the mix-up happens](background.md)

    ## Options
    :::option A
    ### What A changes
    - Stop automatically repeating an unresolved Run.
    - Report an unanswered work-taking call as unknown, not empty.
    - Keep normal idle waits, live-run recovery and Cancel.
    ### Why choose A
    - No permanent receipt store and no new endpoint.
    - Fixes the one path that looked empty but wasn't.
    ### Why pass on A
    - After a connection failure you may have to inspect the page, Cancel a stuck job, or press Run again.
    ### Assumptions A makes
    - Lost replies are rare enough that manual recovery is acceptable.
    :::
    :::option B
    ### What B changes
    - Every hand-off gets a stored id and result; a retry with the same id gets the same job back.
    - A stuck job is recovered automatically from the stored acceptance.
    ### Why choose B
    - Stuck jobs recover on their own; you never touch them.
    ### Why pass on B
    - Stored ids and results for the life of the page, more code, and a second place a bug can hide.
    ### Assumptions B makes
    - Lost replies are common enough to be worth the machinery.
    :::

    ## Tradeoffs
    |                 | A Smaller fix + manual recovery | B Precise automatic recovery |
    |-----------------|---------------------------------|------------------------------|
    | Lost connection | :yellow[May need inspection, Cancel or Run again] | :green[Recover original job or stored acceptance automatically] |
    | Complexity      | :green[No permanent receipts or new endpoint] | :yellow[Durable request identities and more code] |
    | Idle waits      | :green[Normal idle waits stay] | :green[Normal idle waits stay; no permanent empty history] |

    ## Recommendation: A
    **Why:** Fix the misleading timeout and stop risky automatic repeats; accept occasional manual recovery instead of building precise replay.
    **Assumes:** If stuck jobs turn out to be frequent, pick B.

    ## Next steps: build only the chosen one
    **After A:** Ship the warning and Cancel this week.
    **After B:** Design the id and storage first, about a week.
    **If no decision:** Nothing changes; stuck jobs stay invisible.
    """
    static let background = """
    # How the mix-up happens

    Every few seconds the agent asks the service "is there work for me?". Usually the answer is "no", and that's normal.

    Sometimes the service says "yes, here is job A" but the reply never arrives: the connection dropped on the way back. The service has already marked A as running. The agent, having heard nothing, asks again, and this time gets job B.

    Now A sits marked as running forever, with nobody working on it. That's the stuck job you'd see on the page.

    ```mermaid
    flowchart LR
      ask --> lost[reply lost] --> again[ask again] --> stuck[B taken, A stuck]
    ```

    We don't know how often this happens in production. Option A makes the stuck state visible so you can clear it by hand; option B makes the service remember the hand-off so a retry gets A back.
    """
    static func m11Decision(_ id: String = m11, ago: TimeInterval = 3600) -> Decision {
        var d = brief(id, "Which M11 guarantee should we build?", ago: ago, markdown: m11Markdown, options: m11Options, recommended: 1)
        d.detail = "Two real alternatives: a smaller fix with occasional manual recovery, or precise automatic recovery."
        d.attachments = [AttachmentInfo(name: "background.md", type: "text/markdown", bytes: background.utf8.count)]
        return d
    }
    static var yesterday: (asked: Date, answered: Date) {
        let day = Calendar.current.date(byAdding: .day, value: -1, to: now) ?? now
        let at = { (h: Int, m: Int) in Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: day) ?? day }
        return (at(8, 3), at(8, 39))
    }

    static func model(empty: Bool = false) -> AppModel {
        let m = AppModel(live: false)
        guard !empty else { return m }
        let server = m.server.absoluteString
        for (i, (id, name)) in [(work, "Work"), (vm, "VM scratch"), (acme, "Acme project")].enumerated() {
            m.pagers.append(LocalPager(pagerId: id, number: numbers[id] ?? "", phoneKey: "k", privateKey: Data(), name: name, server: server, createdAt: now.addingTimeInterval(Double(i))))
        }
        let state = { (id: String, on: Bool, autoOff: AutoOff, offAt: Date?, offSince: Date?) in PagerState(pagerId: id, on: on, autoOff: autoOff, offAt: offAt, offSince: offSince, createdAt: now) }
        m.inboxes[work] = PagerInbox(pager: state(work, true, .never, nil, nil), agents: [
            AgentInbox(agent: agent(codex, "Codex", "atomic-pages"), open: [m11Decision(), brief("release", "Release M11 to production tonight?", ago: 12 * 60)], answered: done("ap", 8)),
            AgentInbox(agent: agent(claude, "Claude Code", "agentpager"), open: [brief("sheet", "Option detail: bottom sheet or full screen?", ago: 20 * 60)], answered: done("cc", 3)),
            AgentInbox(agent: agent(codexBilling, "Codex", "billing refactor"), open: [], answered: done("br", 3)),
            AgentInbox(agent: agent(pi, "pi", "billing refactor"), open: [], answered: done("bp", 2)),
        ])
        m.inboxes[vm] = PagerInbox(pager: state(vm, true, .day, now.addingTimeInterval(18 * 3600), nil), agents: [
            AgentInbox(agent: agent(vmCodex, "Codex", "scratch"), open: [brief("vm1", "Keep the VM's build cache?", ago: 40 * 60)], answered: []),
        ])
        m.inboxes[acme] = PagerInbox(pager: state(acme, false, .week, nil, Calendar.current.date(byAdding: .day, value: -1, to: now)), agents: [
            AgentInbox(agent: agent(acmeCodex, "Codex", "acme"), open: [m11Decision("m11acme000000000000000000000001", ago: 26 * 3600)], answered: []),
        ])
        for (agentId, decisionId) in [(codex, m11), (acmeCodex, "m11acme000000000000000000000001"), (codex, "m11done00000000000000000000001x")] {
            m.files["\(agentId)/\(decisionId)/background.md"] = Data(background.utf8)
        }
        m.lastSuccess = now
        return m
    }
}

extension Sample {
    // `-demo <state>` launches the app on the mocks' sample data with no network, for screenshots.
    static func demo(_ state: String?) -> AppModel? {
        guard let state else { return nil }
        let m = model(empty: state == "empty")
        let decision = Route.decision(pagerId: work, agentId: codex, decisionId: m11)
        switch state {
        case "pager": m.path = [.pager(work)]
        case "detail": m.path = [.pager(work), .pagerDetail(work)]
        case "new":
            m.draft = LocalPager(pagerId: "new", number: numbers[vm] ?? "", phoneKey: "k", privateKey: Data(), name: "VM scratch", server: m.server.absoluteString, createdAt: now)
            m.draftAutoOff = .day
            m.sheet = .newPager
        case "decision": m.path = [.pager(work), decision]
        case "selected": m.drafts[m11] = .option(1); m.path = [.pager(work), decision]
        case "options": m.demoSheet = .options; m.path = [.pager(work), decision]
        case "page": m.demoSheet = .page("background.md"); m.path = [.pager(work), decision]
        case "changes":
            m.drafts[m11] = .feedback("Option B isn't an option, I can always write and ask for changes. Explain it to someone fresh to the project: when the problem occurs, what happens if we don't solve it, and a low-cost simple solution against a precise one.")
            m.path = [.pager(work), decision]
        case "off": m.path = [.pager(acme), .decision(pagerId: acme, agentId: acmeCodex, decisionId: "m11acme000000000000000000000001")]
        case "answered":
            let (asked, at) = yesterday
            var d = answered(m11Decision("m11done00000000000000000000001x"), .option(1), at: at, ack: "Build the smaller fix, the exact wording and the uncertainty warning. Keep normal waits, live-run recovery and Cancel. Don't build receipt replay.")
            d.askedAt = asked
            m.inboxes[work]?.agents[0].answered.insert(d, at: 0)
            m.path = [.pager(work), .decision(pagerId: work, agentId: codex, decisionId: d.decisionId)]
        case "notpickedup":
            var d = answered(m11Decision("m11late00000000000000000000001x"), .option(1), at: now.addingTimeInterval(-240), ack: nil)
            d.warnedAt = now.addingTimeInterval(-60)
            m.inboxes[work]?.agents[0].agent.machine = "air"
            m.inboxes[work]?.agents[0].answered.insert(d, at: 0)
            m.path = [.pager(work), .decision(pagerId: work, agentId: codex, decisionId: d.decisionId)]
        case "undo": m.path = [.pager(work)]; m.undo = PreparedAnswer(pagerId: work, agentId: codex, decisionId: m11, requestId: "r", choice: .option(1), deadline: .now.addingTimeInterval(3600))
        case "notconfirmed":
            let p = PreparedAnswer(pagerId: work, agentId: codex, decisionId: m11, requestId: "r", choice: .option(1), deadline: .now)
            m.path = [.pager(work)]; m.inFlight[m11] = p; m.notConfirmed = p
        default: break
        }
        return m
    }
}

#Preview("Pagers") { RootView().environment(Sample.model()) }
#Preview("Pagers · empty") { RootView().environment(Sample.model(empty: true)) }
#Preview("Pager") { NavigationStack { PagerView(pagerId: Sample.work) }.environment(Sample.model()) }
#Preview("Pager detail") { NavigationStack { PagerDetailView(pagerId: Sample.work) }.environment(Sample.model()) }
#Preview("New pager") { RootView().environment(Sample.demo("new") ?? Sample.model()) }
#Preview("Decision") { RootView().environment(Sample.demo("decision") ?? Sample.model()) }
#Preview("Decision · pager off") { RootView().environment(Sample.demo("off") ?? Sample.model()) }
#Preview("Answered decision") { RootView().environment(Sample.demo("answered") ?? Sample.model()) }
#Preview("Options") { RootView().environment(Sample.demo("options") ?? Sample.model()) }
#Preview("Undo window") { RootView().environment(Sample.demo("undo") ?? Sample.model()) }
