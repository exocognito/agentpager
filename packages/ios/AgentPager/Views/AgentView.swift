import SwiftUI

struct AgentView: View {
    @Environment(AppModel.self) private var model
    var sessionId: String
    @State private var confirmEnd = false

    private var summary: PagerSummary? { model.inboxes[sessionId]?.session }

    var body: some View {
        Group {
            if let s = summary, s.status == .ended {
                EndedView(summary: s)
            } else {
                list
            }
        }
        .navigationTitle(summary?.name ?? "Agent")
        .navigationSubtitle(summary.map { Wording.subtitle($0, now: model.now) } ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let s = summary, s.status != .ended {
                ToolbarItem(placement: .topBarTrailing) { menu(s) }
            }
        }
        .confirmationDialog(
            "End \(Wording.shortName(summary?.name ?? "this agent"))’s pager?",
            isPresented: $confirmEnd,
            titleVisibility: .visible
        ) {
            Button("End Pager", role: .destructive) { Task { await model.endPager(sessionId) } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your agent keeps running, but it can’t page you anymore. Open decisions are cleared.")
        }
        .refreshable { await model.refresh(sessionId) }
    }

    private var list: some View {
        let open = model.openDecisions(sessionId)
        let answered = model.answeredRows(sessionId)
        return List {
            if open.isEmpty && answered.isEmpty {
                Section {
                    Text("No decisions yet. Your agent’s questions appear here.").foregroundStyle(.secondary)
                }
            }
            if !open.isEmpty {
                Section("Open") {
                    ForEach(open) { d in
                        Button { model.sheet = .decision(sessionId: sessionId, decisionId: d.decisionId) } label: { OpenRow(decision: d) }
                            .foregroundStyle(.primary)
                            .accessibilityIdentifier("open-\(d.title)")
                    }
                }
            }
            if !answered.isEmpty {
                Section("Answered") {
                    ForEach(answered) { row in
                        Button { model.sheet = .thread(sessionId: sessionId, decisionId: row.decision.decisionId) } label: { AnsweredRowView(row: row) }
                            .foregroundStyle(.primary)
                            .accessibilityIdentifier("answered-\(row.decision.title)")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func menu(_ s: PagerSummary) -> some View {
        Menu {
            Section(s.endsAt.map(Wording.exactEnd) ?? "") {
                Menu {
                    ForEach(Lifetime.allCases) { l in
                        Button { Task { await model.setLifetime(sessionId, l) } } label: {
                            if s.lifetime == l { Label(l.label, systemImage: "checkmark") } else { Text(l.label) }
                        }
                    }
                } label: {
                    Text("Ends")
                    Text("in " + Wording.remaining(until: s.endsAt ?? model.now, now: model.now))
                }
                Button(role: .destructive) { confirmEnd = true } label: { Label("End Pager", systemImage: "xmark.circle") }
            }
        } label: {
            Image(systemName: "ellipsis")
        }
        .accessibilityLabel("More")
        .accessibilityIdentifier("agent-menu")
    }
}

struct OpenRow: View {
    var decision: Decision
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle().fill(Color.accentColor).frame(width: 10, height: 10).padding(.top, 6)
            VStack(alignment: .leading, spacing: 2) {
                Text(decision.title).font(.body.weight(.semibold)).lineLimit(2)
                if let detail = decision.detail {
                    Text(detail).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary).padding(.top, 4)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

// Before the agent confirms: a countdown while Undo is open, then sending, then waiting for the agent.
struct SendStatusLine: View {
    var row: AnsweredRow

    var body: some View {
        HStack(spacing: 7) {
            if let sendsAt = row.sendsAt {
                Image(systemName: "clock")
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text("Sending in \(max(1, Int(sendsAt.timeIntervalSince(context.date).rounded(.up))))s").monospacedDigit()
                }
            } else {
                ProgressView().controlSize(.mini)
                Text(row.state == .sending ? "Sending…" : "Waiting for your agent…")
            }
        }
    }
}

struct AnsweredRowView: View {
    var row: AnsweredRow

    private var chosen: Option? { if case .option(let n) = row.choice { row.decision.option(n) } else { nil } }
    private var answerText: String {
        switch row.choice {
        case .option(let n): row.decision.option(n)?.title ?? "Option \(n)"
        case .feedback(let text): text
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Group {
                if let chosen { Text(chosen.emoji).font(.title3) } else { Image(systemName: "text.bubble").foregroundStyle(.secondary) }
            }
            .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.decision.title).lineLimit(2)
                HStack(spacing: 6) {
                    if row.state == .confirmed {
                        Image(systemName: "checkmark").font(.footnote.weight(.bold)).foregroundStyle(.green)
                            .accessibilityLabel("Agent confirmed")
                    }
                    Text(answerText).lineLimit(1)
                }
                .font(.subheadline).foregroundStyle(.secondary)
                if row.state != .confirmed {
                    SendStatusLine(row: row)
                    .font(.subheadline).foregroundStyle(.secondary).padding(.top, 4)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary).padding(.top, 4)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

struct EndedView: View {
    @Environment(AppModel.self) private var model
    var summary: PagerSummary

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "clock.badge.xmark").font(.system(size: 56)).foregroundStyle(.secondary)
            Text("This pager has ended").font(.title2.bold()).padding(.top, 6)
            Text((summary.endReason ?? .timedOut).sentence).font(.body).foregroundStyle(.secondary)
                .accessibilityIdentifier("end-reason")
            Text("\(Wording.shortName(summary.name ?? "Your agent")) can’t page you anymore, and its decisions have been cleared.")
                .font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center).padding(.horizontal, 32)
            Button("Back to Agents") { model.path = [] }
                .buttonStyle(.bordered).buttonBorderShape(.capsule).padding(.top, 10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.bottom, 60)
    }
}
