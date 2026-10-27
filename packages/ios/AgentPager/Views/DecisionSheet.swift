import SwiftUI

struct DecisionSheet: View {
    @Environment(AppModel.self) private var model
    var sessionId: String
    var decisionId: String
    @State private var selection: Int?
    @State private var feedback = ""
    @State private var path: [String] = []
    @State private var restored = false

    private var agentName: String { model.inboxes[sessionId]?.session.name ?? "" }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let d = model.decision(sessionId, decisionId) {
                    if d.status != .open { ThreadContent(sessionId: sessionId, decision: d) { path.append("page:" + $0) } }
                    else if d.card.isBrief { brief(d) } else { choose(d) }
                } else {
                    ContentUnavailableView("Decision Cleared", systemImage: "tray", description: Text("This decision is no longer on your pager."))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) { Text(agentName).font(.subheadline).foregroundStyle(.secondary) }
                ToolbarItem(placement: .topBarTrailing) { Button(role: .close) { model.sheet = nil }.accessibilityIdentifier("close-decision") }
            }
            .navigationDestination(for: String.self) { value in
                if let d = model.decision(sessionId, decisionId) {
                    if value.hasPrefix("page:") {
                        BriefPageView(sessionId: sessionId, decision: d, name: String(value.dropFirst(5))) { path.append("page:" + $0) }
                    } else {
                        AskChangesView(decision: d, text: $feedback) { model.send(sessionId: sessionId, decisionId: decisionId, choice: .feedback(feedback)) }
                    }
                }
            }
        }
        .onAppear {
            guard !restored else { return }
            restored = true
            switch model.drafts[decisionId] {
            case .option(let n): selection = n
            case .feedback(let text): feedback = text; path = ["changes"]
            case nil: break
            }
        }
    }

    private func brief(_ d: Decision) -> some View {
        BriefView(sessionId: sessionId, decision: d, picked: $selection,
                  askForChanges: { path.append("changes") },
                  openPage: { path.append("page:" + $0) },
                  send: { model.send(sessionId: sessionId, decisionId: decisionId, choice: .option($0)) })
    }

    private func choose(_ d: Decision) -> some View {
        List {
            // A section header, not a clear row: insetGrouped rows clip to their rounded shape and shave the
            // glyphs at the corners.
            Section {} header: { DecisionHeader(decision: d) }
            Section("Choose one") {
                ForEach(d.card.options, id: \.number) { o in
                    Button { selection = o.number } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Text(o.mark).font(.title3).frame(width: 28)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(o.title).foregroundStyle(.primary)
                                if let detail = o.detail { Text(detail).font(.subheadline).foregroundStyle(.secondary) }
                                if d.card.recommended == o.number { RecommendedTag().padding(.top, 2) }
                            }
                            Spacer(minLength: 0)
                            if selection == o.number {
                                Image(systemName: "checkmark").font(.body.weight(.semibold)).foregroundStyle(.tint)
                            }
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selection == o.number ? .isSelected : [])
                    .accessibilityIdentifier("option-\(o.number)")
                }
            }
            Section {
                NavigationLink(value: "changes") { Text("Ask for Changes").foregroundStyle(.tint) }
                    .accessibilityIdentifier("ask-for-changes")
            }
        }
        .listStyle(.insetGrouped)
        .safeAreaInset(edge: .bottom) {
            Button {
                if let n = selection { model.send(sessionId: sessionId, decisionId: decisionId, choice: .option(n)) }
            } label: {
                Text("Send").font(.headline).frame(maxWidth: .infinity, minHeight: 34)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .disabled(selection == nil)
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
            .accessibilityIdentifier("send-button")
        }
    }
}

struct DecisionHeader: View {
    var decision: Decision
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Explicit label colours: a section header dims the hierarchical .primary and .secondary styles.
            Text(decision.title).font(.title2.bold()).foregroundStyle(Color(.label))
            if let detail = decision.detail { Text(detail).font(.body).foregroundStyle(Color(.secondaryLabel)) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .textCase(nil)
    }
}

struct RecommendedTag: View {
    var body: some View {
        Text("Recommended")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.tint)
            .padding(.horizontal, 8).padding(.vertical, 2)
            .background(Color.accentColor.opacity(0.14), in: .capsule)
    }
}

struct AskChangesView: View {
    var decision: Decision
    @Binding var text: String
    var send: () -> Void
    @FocusState private var focused: Bool

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var hasHTML: Bool { text.range(of: "<[A-Za-z/!?]", options: .regularExpression) != nil }
    private var valid: Bool { !trimmed.isEmpty && text.count <= 1000 && !hasHTML }

    var body: some View {
        List {
            Section {
                TextEditor(text: $text)
                    .frame(minHeight: 140)
                    .focused($focused)
                    .accessibilityIdentifier("feedback-text")
            } header: {
                Text("What should your agent change?")
            } footer: {
                Text(hasHTML ? "Leave out HTML tags; your agent gets plain text." : "Your agent gets this note instead of one of the options.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Ask for Changes")
        .navigationSubtitle(decision.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: send) { Image(systemName: "arrow.up") }
                    .buttonStyle(.glassProminent)
                    .disabled(!valid)
                    .accessibilityLabel("Send")
                    .accessibilityIdentifier("send-feedback")
            }
        }
        .onAppear { focused = true }
    }
}

struct ThreadSheet: View {
    @Environment(AppModel.self) private var model
    var sessionId: String
    var decisionId: String
    @State private var path: [String] = []

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let d = model.decision(sessionId, decisionId) {
                    ThreadContent(sessionId: sessionId, decision: d) { path.append($0) }
                } else {
                    ContentUnavailableView("Decision Cleared", systemImage: "tray", description: Text("This decision is no longer on your pager."))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) { Text(model.inboxes[sessionId]?.session.name ?? "").font(.subheadline).foregroundStyle(.secondary) }
                ToolbarItem(placement: .topBarTrailing) { Button(role: .close) { model.sheet = nil } }
            }
            .navigationDestination(for: String.self) { name in
                if let d = model.decision(sessionId, decisionId) { BriefPageView(sessionId: sessionId, decision: d, name: name) { path.append($0) } }
            }
        }
    }
}

// An answered decision as a thread: your answer and your agent's reply as bubbles, the options below.
struct ThreadContent: View {
    @Environment(AppModel.self) private var model
    var sessionId: String
    var decision: Decision
    var openPage: (String) -> Void = { _ in }

    private var row: AnsweredRow? { model.answeredRows(sessionId).first { $0.decision.decisionId == decision.decisionId } }
    private var chosenNumber: Int? { if case .option(let n) = row?.choice { n } else { nil } }

    var body: some View {
        if decision.card.isBrief {
            // The brief stays readable under the answer; nothing on it can be chosen again (SI3).
            BriefView(sessionId: sessionId, decision: decision, openPage: openPage, answered: AnyView(bubbles))
        } else {
            list
        }
    }

    @ViewBuilder private var bubbles: some View {
        if let row {
            VStack(spacing: 10) {
                Bubble(text: answerText(row), mine: true, caption: "You · " + Wording.time(decision.answer?.sentAt ?? model.now))
                if let ack = decision.acknowledgement {
                    Bubble(text: ack.nextSteps, mine: false, caption: "Your agent confirmed · " + Wording.time(ack.acknowledgedAt), onPlain: true)
                } else {
                    SendStatusLine(row: row)
                        .font(.subheadline).foregroundStyle(Color(.secondaryLabel))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var list: some View {
        List {
            Section {} header: { DecisionHeader(decision: decision) }
            if let row {
                Section {} header: {
                    VStack(spacing: 10) {
                        Bubble(text: answerText(row), mine: true, caption: "You · " + Wording.time(decision.answer?.sentAt ?? model.now))
                        if let ack = decision.acknowledgement {
                            Bubble(text: ack.nextSteps, mine: false, caption: "Your agent confirmed · " + Wording.time(ack.acknowledgedAt))
                        } else {
                            SendStatusLine(row: row)
                            .font(.subheadline).foregroundStyle(Color(.secondaryLabel))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .textCase(nil)
                }
            }
            Section("Options") {
                ForEach(decision.card.options, id: \.number) { o in
                    HStack(alignment: .top, spacing: 12) {
                        Text(o.mark).font(.title3).frame(width: 28)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(o.title).fontWeight(o.number == chosenNumber ? .semibold : .regular)
                            if let detail = o.detail { Text(detail).font(.subheadline).foregroundStyle(.secondary) }
                        }
                        Spacer(minLength: 0)
                    }
                    .opacity(o.number == chosenNumber ? 1 : 0.4)
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func answerText(_ row: AnsweredRow) -> String { decision.choiceText(row.choice) }
}

struct Bubble: View {
    var text: String
    var mine: Bool
    var caption: String
    // On a white page (a brief) the agent's bubble needs a grey of its own.
    var onPlain = false

    var body: some View {
        VStack(alignment: mine ? .trailing : .leading, spacing: 4) {
            Text(text)
                .font(.body)
                .padding(.horizontal, 14).padding(.vertical, 9)
                .foregroundStyle(mine ? Color.white : Color(.label))
                .background(mine ? Color.accentColor : onPlain ? Color(.systemGray6) : Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18))
            Text(caption).font(.caption).foregroundStyle(Color(.secondaryLabel)).padding(.horizontal, 6)
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
        .padding(mine ? .leading : .trailing, 48)
    }
}

struct UndoPill: View {
    @Environment(AppModel.self) private var model
    var answer: PreparedAnswer

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.25)) { context in
            let secs = max(1, Int(answer.deadline.timeIntervalSince(context.date).rounded(.up)))
            HStack(spacing: 14) {
                Text("Sending in \(secs)s").font(.subheadline.weight(.semibold)).monospacedDigit()
                Button("Undo") { model.undoSend() }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.borderless)
                    .accessibilityIdentifier("undo-button")
            }
            .padding(.leading, 18).padding(.trailing, 14).padding(.vertical, 12)
            .glassEffect(.regular, in: .capsule)
        }
        .padding(.bottom, 12)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
