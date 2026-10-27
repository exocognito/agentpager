import SwiftUI

struct AgentsListView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            if model.listed.isEmpty {
                ContentUnavailableView {
                    Label("No Agents connected", systemImage: "antenna.radiowaves.left.and.right")
                } description: {
                    Text("Connect an agent to get its decisions on this phone.")
                }
            } else {
                List {
                    if !model.active.isEmpty {
                        Section("Active pagers") {
                            ForEach(model.active, id: \.sessionId) { s in row(s) }
                        }
                    }
                    if !model.ended.isEmpty {
                        Section {
                            ForEach(model.ended, id: \.sessionId) { s in row(s) }
                        } header: {
                            Text("Ended in the last 24 hours")
                        } footer: {
                            Text("Read only. Each one is removed from this phone 24 hours after it ends.")
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Agents")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { model.sheet = .settings } label: { Image(systemName: "gearshape") }
                    .accessibilityLabel("Settings")
                    .accessibilityIdentifier("settings-button")
            }
            ToolbarSpacer(.flexible, placement: .bottomBar)
            if model.serverTrouble {
                ToolbarItem(placement: .bottomBar) {
                    Text(model.statusLine).font(.footnote.weight(.semibold)).fixedSize().padding(.horizontal, 6)
                        .accessibilityIdentifier("status-line")
                }
            }
            ToolbarSpacer(.flexible, placement: .bottomBar)
            ToolbarItem(placement: .bottomBar) {
                Button { model.sheet = .connect } label: { Image(systemName: "plus") }
                    .buttonStyle(.glassProminent)
                    .accessibilityLabel("Connect an agent")
                    .accessibilityIdentifier("connect-button")
            }
        }
    }

    @ViewBuilder private func row(_ s: PagerSummary) -> some View {
        if s.status == .unpaired, let key = model.key(s.sessionId), let code = key.linkCode {
            Button { model.sheet = .pairing(PairingTarget(code: code, sessionId: s.sessionId)) } label: {
                HStack { AgentRow(summary: s, now: model.now); Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary) }
            }
            .foregroundStyle(.primary)
            .accessibilityIdentifier("agent-\(s.name ?? s.sessionId)")
        } else {
            NavigationLink(value: Route.agent(s.sessionId)) { AgentRow(summary: s, now: model.now) }
                .accessibilityIdentifier("agent-\(s.name ?? s.sessionId)")
        }
    }
}

struct AgentRow: View {
    var summary: PagerSummary
    var now: Date

    var dot: Color {
        switch summary.status {
        case .active: .green
        case .unpaired, .waiting: .orange
        case .ended: Color(.systemGray3)
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle().fill(dot).frame(width: 10, height: 10)
            VStack(alignment: .leading, spacing: 2) {
                Text(summary.name ?? "Agent")
                    .font(.body.weight(summary.status == .ended ? .regular : .semibold))
                    .lineLimit(1)
                Text(Wording.subtitle(summary, now: now)).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            if summary.status == .active, let n = summary.openCount, n > 0 {
                Text("\(n)").foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}
