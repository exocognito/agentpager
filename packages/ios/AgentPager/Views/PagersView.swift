import SwiftUI

// The root: this phone's pagers, each with its status and how many decisions wait on it. No numbers, no gear.
struct PagersView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            if model.myPagers.isEmpty {
                ContentUnavailableView {
                    Label("No pagers", systemImage: "antenna.radiowaves.left.and.right")
                } description: {
                    Text("Make a pager, then give its number to your agents.")
                }
            } else {
                List {
                    Section {
                        ForEach(model.myPagers) { p in
                            NavigationLink(value: Route.pager(p.pagerId)) { PagerRow(pager: p) }
                                .accessibilityIdentifier("pager-\(p.name)")
                        }
                    } footer: {
                        Text("Make one per place you put a number: your AGENTS.md, a VM, a shared project. If a number leaks, switch it off and make a new one.")
                    }
                    if model.serverTrouble {
                        Section { Text(model.statusLine).foregroundStyle(.secondary).accessibilityIdentifier("status-line") }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Pagers")
        .navigationBarTitleDisplayMode(.large)
        .overlay(alignment: .bottomTrailing) {
            Button { model.startNewPager() } label: {
                Image(systemName: "plus").font(.title2.weight(.semibold)).foregroundStyle(.white)
                    .frame(width: 56, height: 56).background(Color.accentColor, in: .circle)
                    .shadow(color: Color.accentColor.opacity(0.3), radius: 8, y: 4)
            }
            .padding(.trailing, 24).padding(.bottom, 12)
            .accessibilityLabel("New pager")
            .accessibilityIdentifier("new-pager")
        }
    }
}

struct PagerRow: View {
    @Environment(AppModel.self) private var model
    var pager: LocalPager

    var body: some View {
        let state = model.state(pager.pagerId), on = state?.on ?? true, open = model.openCount(pager.pagerId)
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(pager.name).font(.body.weight(.semibold)).foregroundStyle(on ? .primary : .secondary).lineLimit(1)
                HStack(spacing: 7) {
                    Circle().fill(on ? Color.green : Color(.systemGray3)).frame(width: 9, height: 9)
                    Text(state.map { Wording.status($0, now: model.now) } ?? "Active").foregroundStyle(.secondary).lineLimit(1)
                }
                .font(.subheadline)
            }
            Spacer(minLength: 8)
            if on, open > 0 {
                Text("\(open)").font(.subheadline.weight(.semibold)).foregroundStyle(.white).monospacedDigit()
                    .frame(minWidth: 26, minHeight: 26).padding(.horizontal, open > 9 ? 4 : 0)
                    .background(Color.accentColor, in: .capsule)
                    .accessibilityLabel("\(open) open")
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}
