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
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: Route.pagerDetail(pagerId)) { Image(systemName: "gearshape") }
                    .accessibilityLabel("Pager settings")
                    .accessibilityIdentifier("pager-settings")
            }
        }
        .refreshable { await model.refresh(pagerId) }
    }

    // "8 answered", or with who asked when nothing is open: "5 answered · Codex, pi".
    private func answeredLabel(_ g: ProjectGroup) -> String {
        let count = "\(g.answered.count) answered"
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
                HStack(spacing: 6) {
                    if state == .confirmed {
                        Image(systemName: "checkmark").font(.footnote.weight(.bold)).foregroundStyle(.green).accessibilityLabel("Agent confirmed")
                    }
                    Text(asked.agent.app + " · " + (model.choice(d).map { d.choiceText($0) } ?? "")).lineLimit(1)
                }
                .font(.subheadline).foregroundStyle(.secondary)
                if state != .confirmed { SendStatusLine(decision: d, app: asked.agent.app).font(.subheadline).foregroundStyle(.secondary) }
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

// The chosen option's letter in a filled circle, or a note's bubble.
struct ChoiceBadge: View {
    var decision: Decision
    var choice: Choice?
    var size: CGFloat
    var body: some View {
        Group {
            if case .option(let n)? = choice, let o = decision.option(n) {
                Text(o.letter).font(size > 30 ? .title3.weight(.semibold) : .subheadline.weight(.semibold)).foregroundStyle(.white)
            } else {
                Image(systemName: "text.bubble").font(size > 30 ? .body : .footnote).foregroundStyle(.white)
            }
        }
        .frame(width: size, height: size).background(Color.accentColor, in: .circle)
    }
}

// Before the agent confirms: a countdown while Undo is open, then sending, then waiting for the agent.
struct SendStatusLine: View {
    @Environment(AppModel.self) private var model
    var decision: Decision
    var app: String

    var body: some View {
        HStack(spacing: 7) {
            if let u = model.undo, u.decisionId == decision.decisionId {
                Image(systemName: "clock")
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text("Sending in \(max(1, Int(u.deadline.timeIntervalSince(context.date).rounded(.up))))s").monospacedDigit()
                }
            } else {
                ProgressView().controlSize(.mini)
                Text(model.rowState(decision) == .sending ? "Sending…" : "Waiting for \(app)…")
            }
        }
    }
}

// A small uppercase list header, as in the mocks.
struct SectionHeader: View {
    var text: String
    var body: some View { Text(text).font(.footnote).textCase(.uppercase).foregroundStyle(.secondary) }
}
