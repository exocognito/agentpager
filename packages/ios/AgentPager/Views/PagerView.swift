import SwiftUI

// One pager: its decisions grouped by project, oldest first, each with who asked and when. Answered decisions fold
// into an "N answered" row per project. The gear opens the pager's detail.
struct PagerView: View {
    @Environment(AppModel.self) private var model
    var pagerId: String

    var body: some View {
        let groups = model.groups(pagerId)
        Group {
            if groups.isEmpty {
                ContentUnavailableView("No decisions yet", systemImage: "tray", description: Text("Your agents’ questions appear here."))
            } else {
                List {
                    ForEach(groups) { g in
                        Section {
                            ForEach(g.open) { a in
                                NavigationLink(value: Route.decision(pagerId: pagerId, agentId: a.agent.agentId, decisionId: a.decision.decisionId)) { OpenDecisionRow(asked: a) }
                                    .accessibilityIdentifier("open-\(a.decision.title)")
                            }
                            if !g.answered.isEmpty {
                                NavigationLink(value: Route.answered(pagerId: pagerId, project: g.project)) {
                                    Text(answeredLabel(g)).foregroundStyle(.tint)
                                }
                                .accessibilityIdentifier("answered-\(g.project)")
                            }
                        } header: { SectionHeader(text: g.project) }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle(model.pager(pagerId)?.name ?? "Pager")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // A pager made on a dev server says so beside its name (B23.11).
            if let p = model.pager(pagerId), p.onDevServer {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 6) {
                        Text(p.name).font(.headline).lineLimit(1)
                        DevMark()
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("pager-title")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: Route.pagerDetail(pagerId)) { Image(systemName: "gearshape") }
                    .accessibilityLabel("Pager settings")
                    .accessibilityIdentifier("pager-settings")
            }
        }
        .refreshable { await model.refresh(pagerId) }
    }

    // "8 answered", or with who asked when nothing is open: "5 answered · Codex, pi". Decisions that closed unanswered
    // are counted apart: "3 answered, 2 closed".
    private func answeredLabel(_ g: ProjectGroup) -> String {
        let closed = g.answered.filter { model.rowState($0.decision) == .closed }.count, answered = g.answered.count - closed
        let count = closed == 0 ? "\(answered) answered" : answered == 0 ? "\(closed) closed" : "\(answered) answered, \(closed) closed"
        guard g.open.isEmpty else { return count }
        var apps: [String] = []
        for a in g.answered where !apps.contains(a.agent.app) { apps.append(a.agent.app) }
        return count + " · " + apps.joined(separator: ", ")
    }
}

struct OpenDecisionRow: View {
    @Environment(AppModel.self) private var model
    var asked: Asked
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle().fill(Color.accentColor).frame(width: 10, height: 10).padding(.top, 7)
            VStack(alignment: .leading, spacing: 3) {
                Text(asked.decision.title).font(.body.weight(.semibold)).lineLimit(3)
                Text("\(asked.agent.app) · \(Wording.ago(asked.decision.askedAt, now: model.now))").font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 3)
        .accessibilityElement(children: .combine)
    }
}

// A project's answered decisions, newest first (not drawn in the mocks).
struct AnsweredListView: View {
    @Environment(AppModel.self) private var model
    var pagerId: String
    var project: String

    var body: some View {
        let answered = model.groups(pagerId).first { $0.project == project }?.answered ?? []
        List {
            ForEach(answered) { a in
                NavigationLink(value: Route.decision(pagerId: pagerId, agentId: a.agent.agentId, decisionId: a.decision.decisionId)) { AnsweredDecisionRow(asked: a) }
                    .accessibilityIdentifier("answered-\(a.decision.title)")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(project)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AnsweredDecisionRow: View {
    @Environment(AppModel.self) private var model
    var asked: Asked

    var body: some View {
        let d = asked.decision, state = model.rowState(d)
        HStack(alignment: .top, spacing: 12) {
            ChoiceBadge(decision: d, choice: model.choice(d), size: 26)
            VStack(alignment: .leading, spacing: 3) {
                Text(d.title).lineLimit(2)
                if d.unreadable {
                    Text(asked.agent.app).lineLimit(1).font(.subheadline).foregroundStyle(.secondary)
                } else if state == .closed, let closed = d.closed {
                    Text(Wording.closedUnanswered(closed, asked.agent)).lineLimit(2).font(.subheadline).foregroundStyle(.secondary)
                } else {
                    HStack(spacing: 6) {
                        if state == .confirmed {
                            Image(systemName: "checkmark").font(.footnote.weight(.bold)).foregroundStyle(.green).accessibilityLabel("Agent confirmed")
                        }
                        Text(asked.agent.app + " · " + (model.choice(d).map { d.choiceText($0) } ?? "")).lineLimit(1)
                    }
                    .font(.subheadline).foregroundStyle(.secondary)
                    if state != .confirmed { SendStatusLine(decision: d, agent: asked.agent).font(.subheadline).foregroundStyle(.secondary) }
                }
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

// The chosen option's letter in a filled circle, or a note's bubble; a grey cross for one that closed unanswered.
struct ChoiceBadge: View {
    var decision: Decision
    var choice: Choice?
    var size: CGFloat
    private var unanswered: Bool { choice == nil && decision.closed != nil }
    var body: some View {
        Group {
            if decision.unreadable {
                Image(systemName: "lock").font(size > 30 ? .body : .footnote).foregroundStyle(.white)
            } else if unanswered {
                Image(systemName: "xmark").font(size > 30 ? .body.weight(.semibold) : .footnote.weight(.semibold)).foregroundStyle(.white).accessibilityLabel("Closed")
            } else if case .option(let n)? = choice, let o = decision.option(n) {
                Text(o.letter).font(size > 30 ? .title3.weight(.semibold) : .subheadline.weight(.semibold)).foregroundStyle(.white)
            } else {
                Image(systemName: "text.bubble").font(size > 30 ? .body : .footnote).foregroundStyle(.white)
            }
        }
        .frame(width: size, height: size).background(unanswered && !decision.unreadable ? Color(.systemGray) : Color.accentColor, in: .circle)
    }
}

// Before the agent confirms: a countdown while Undo is open, then sending, then waiting for the agent, or the warning
// that it hasn't picked the answer up.
struct SendStatusLine: View {
    @Environment(AppModel.self) private var model
    var decision: Decision
    var agent: AgentInfo

    var body: some View {
        HStack(spacing: 7) {
            if let u = model.undo, u.decisionId == decision.decisionId {
                Image(systemName: "clock")
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text("Sending in \(max(1, Int(u.deadline.timeIntervalSince(context.date).rounded(.up))))s").monospacedDigit()
                }
            } else if model.rowState(decision) == .notPickedUp {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                Text(Wording.notPickedUp(agent)).fixedSize(horizontal: false, vertical: true)
            } else {
                ProgressView().controlSize(.mini)
                Text(model.rowState(decision) == .sending ? "Sending…" : "Waiting for \(agent.app)…")
            }
        }
    }
}

// A small uppercase list header, as in the mocks.
struct SectionHeader: View {
    var text: String
    var body: some View { Text(text).font(.footnote).textCase(.uppercase).foregroundStyle(.secondary) }
}
