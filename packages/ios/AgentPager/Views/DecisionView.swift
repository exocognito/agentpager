import SwiftUI

// A decision, pushed full screen with a back chevron naming the pager. Options, background pages and Ask for changes
// open as bottom sheets with a grab handle; images stay full-screen covers. The bar at the bottom answers it, says
// its pager is off, or is the closed record once answered, or once it closed unanswered.
struct DecisionView: View {
    @Environment(AppModel.self) private var model
    var pagerId: String
    var agentId: String
    var decisionId: String
    @State private var selection: Int?
    @State private var feedback = ""
    @State private var sheet: Sheet?
    @State private var restored = false

    enum Sheet: Identifiable, Hashable {
        case options, page(String), changes
        var id: String {
            switch self {
            case .options: "options"
            case .page(let name): "page-\(name)"
            case .changes: "changes"
            }
        }
    }

    var body: some View {
        Group {
            if let a = model.asked(pagerId, agentId, decisionId), a.decision.unreadable {
                // Nothing of it is shown, and nothing can answer it (I4.9).
                ContentUnavailableView(Wording.unreadableDecision, systemImage: "lock.trianglebadge.exclamationmark", description: Text(Wording.unreadableDetail))
                    .accessibilityIdentifier("unreadable-decision")
            } else if let a = model.asked(pagerId, agentId, decisionId) {
                // Open: nothing chosen for it, and it hasn't closed unanswered (B5.17).
                let d = a.decision, open = model.choice(d) == nil && d.closed == nil
                BriefView(agentId: agentId, decision: d, picked: open ? $selection : nil, subtitle: subtitle(d),
                          openPage: { sheet = .page($0) }, openOptions: { sheet = .options }, bottom: AnyView(bar(a, open: open)))
            } else {
                ContentUnavailableView("Decision Cleared", systemImage: "tray", description: Text("This decision is no longer on your pager."))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(app).font(.subheadline).foregroundStyle(.secondary).accessibilityIdentifier("who-asked")
            }
        }
        .sheet(item: $sheet) { s in
            sheetContent(s)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .environment(model)
        }
        .onAppear {
            guard !restored else { return }
            restored = true
            if let s = model.demoSheet { model.demoSheet = nil; sheet = s }
            // A draft is restored only while the decision can still be answered.
            guard model.asked(pagerId, agentId, decisionId)?.decision.closed == nil else { return }
            switch model.drafts[decisionId] {
            case .option(let n): selection = n
            case .feedback(let text): feedback = text; sheet = .changes
            case nil: break
            }
        }
        // Closing unanswered while Ask for changes is open takes the sheet away: nothing can be sent.
        .onChange(of: model.asked(pagerId, agentId, decisionId)?.decision.closed != nil) { _, closed in
            if closed, sheet == .changes { sheet = nil }
        }
    }

    private var app: String {
        guard let a = model.agent(agentId) else { return "" }
        return a.finishedAt == nil ? a.app : a.app + " · finished"
    }

    private func subtitle(_ d: Decision) -> String {
        let (verb, at): (String, Date?) = d.answer.map { ("Answered", $0.sentAt) } ?? ("Closed", d.closed?.at)
        guard let at else { return Wording.ago(d.askedAt, now: model.now) }
        let sameDay = Calendar.current.isDate(d.askedAt, inSameDayAs: at)
        return "Asked \(Wording.when(d.askedAt)) · \(verb) \(sameDay ? Wording.time(at) : Wording.when(at))"
    }

    @ViewBuilder private func bar(_ a: Asked, open: Bool) -> some View {
        if let closed = a.decision.closed { UnansweredBar(asked: a, closed: closed) }
        else if !open { ClosedBar(asked: a) }
        else if !model.isOn(pagerId) { OffBar(decision: a.decision, pagerName: model.pager(pagerId)?.name ?? "This") { Task { await model.setOn(pagerId, true) } } }
        else {
            AnswerBar(decision: a.decision, picked: $selection, askForChanges: { sheet = .changes }) {
                model.send(pagerId: pagerId, agentId: agentId, decisionId: decisionId, choice: .option($0))
            }
        }
    }

    @ViewBuilder private func sheetContent(_ s: Sheet) -> some View {
        if let d = model.asked(pagerId, agentId, decisionId)?.decision {
            switch s {
            case .options:
                SheetStack { open in BriefOptionsView(agentId: agentId, decision: d, start: model.choice(d) == nil ? selection : nil, openPage: open) }
            case .page(let name):
                SheetStack { open in BriefPageView(agentId: agentId, decision: d, name: name, openPage: open) }
            case .changes:
                NavigationStack {
                    AskChangesView(decision: d, text: $feedback, cancel: { sheet = nil }) {
                        sheet = nil
                        model.send(pagerId: pagerId, agentId: agentId, decisionId: decisionId, choice: .feedback(feedback))
                    }
                }
            }
        }
    }
}

// A sheet with its own navigation, so a page that links to another page pushes it inside the sheet.
struct SheetStack<Root: View>: View {
    @ViewBuilder var root: (@escaping (String) -> Void) -> Root
    @State private var pages: [String] = []
    @Environment(AppModel.self) private var model

    var body: some View {
        NavigationStack(path: $pages) {
            root { pages.append($0) }
                .navigationDestination(for: String.self) { name in PageDestination(name: name) { pages.append($0) } }
        }
    }
}

// A page opened from inside a sheet: the same decision's attachment.
private struct PageDestination: View {
    var name: String
    var open: (String) -> Void
    @Environment(AppModel.self) private var model
    var body: some View {
        if case .decision(let p, let a, let d)? = model.path.last, let decision = model.asked(p, a, d)?.decision {
            BriefPageView(agentId: a, decision: decision, name: name, openPage: open)
        }
    }
}

// Tinted buttons, one per option; the picked one fills with a ✓. Picking shows "Send option X".
struct AnswerBar: View {
    var decision: Decision
    @Binding var picked: Int?
    var askForChanges: () -> Void
    var send: (Int) -> Void

    var body: some View {
        VStack(spacing: 10) {
            OptionTiles(decision: decision, picked: $picked, enabled: true)
            if let n = picked, let o = decision.option(n) {
                Button { send(n) } label: {
                    Text("Send option \(o.letter)").font(.headline).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Color.accentColor, in: .rect(cornerRadius: 16))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("send-option")
            } else {
                Button(action: askForChanges) {
                    Label("Ask for changes", systemImage: "text.bubble").font(.headline).foregroundStyle(Color.accentColor)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Color(.systemGray6), in: .rect(cornerRadius: 16))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("ask-for-changes")
            }
        }
        .barStyle()
    }
}

struct OptionTiles: View {
    var decision: Decision
    @Binding var picked: Int?
    var enabled: Bool
    private var star: String? { decision.card.recommended.flatMap(decision.option)?.letter }

    var body: some View {
        HStack(spacing: 8) {
            ForEach(decision.card.options, id: \.number) { o in
                let on = picked == o.number
                Button { picked = on ? nil : o.number } label: {
                    VStack(spacing: 2) {
                        HStack(spacing: 4) {
                            if on { Image(systemName: "checkmark").font(.subheadline.weight(.bold)) }
                            Text(o.letter + (o.letter == star ? " ✶" : "")).font(.title3.weight(.semibold))
                        }
                        Text(o.label ?? o.title).font(.subheadline)
                            .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    }
                    .foregroundStyle(!enabled ? Color(.tertiaryLabel) : on ? Color.white : Color.accentColor)
                    .padding(.horizontal, 6).padding(.vertical, 8)
                    .frame(maxWidth: .infinity, minHeight: 60)
                    .background(!enabled ? Color(.systemGray6) : on ? Color.accentColor : Color.accentColor.opacity(0.12), in: .rect(cornerRadius: 16))
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .disabled(!enabled)
                .accessibilityLabel("Option \(o.letter)\(o.letter == star ? ", recommended" : ""): \(o.label ?? o.title)")
                .accessibilityAddTraits(on ? .isSelected : [])
                .accessibilityIdentifier("tile-\(o.letter)")
            }
        }
    }
}

// The pager is off: nothing can be sent until it is turned on again.
struct OffBar: View {
    var decision: Decision
    var pagerName: String
    var turnOn: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            OptionTiles(decision: decision, picked: .constant(nil), enabled: false)
            HStack(spacing: 12) {
                Image(systemName: "power").font(.body.weight(.semibold)).foregroundStyle(.secondary)
                Text("\(pagerName) pager is off").font(.body).lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 8)
                Button(action: turnOn) {
                    Text("Turn on").font(.headline).foregroundStyle(.white).padding(.horizontal, 18).padding(.vertical, 9)
                        .background(Color.accentColor, in: .capsule)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("turn-on")
            }
            .padding(.leading, 16).padding(.trailing, 8).padding(.vertical, 8)
            .background(Color(.systemGray6), in: .rect(cornerRadius: 16))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("pager-off-bar")
        }
        .barStyle()
    }
}

// The closed record: what was chosen and when, then the agent's confirmation and next steps. Nothing to tap.
struct ClosedBar: View {
    @Environment(AppModel.self) private var model
    var asked: Asked

    var body: some View {
        let d = asked.decision, choice = model.choice(d)
        VStack(alignment: .leading, spacing: 12) {
            Text("Closed decisions can’t be changed.").font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity)
            HStack(spacing: 12) {
                ChoiceBadge(decision: d, choice: choice, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(chosen(d, choice)).font(.title3.weight(.semibold)).lineLimit(3)
                    Text(sentLine(d, choice)).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("closed-choice")
            HStack(alignment: .top, spacing: 12) {
                if let ack = d.acknowledgement {
                    Image(systemName: "checkmark").font(.footnote.weight(.bold)).foregroundStyle(.green)
                        .frame(width: 28, height: 28).background(Color.green.opacity(0.15), in: .circle)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(asked.agent.app) confirmed · \(Wording.time(ack.acknowledgedAt))").font(.subheadline).foregroundStyle(.secondary)
                        Text(ack.nextSteps).font(.body).fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    SendStatusLine(decision: d, agent: asked.agent).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(Color(.systemGray6), in: .rect(cornerRadius: 16))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("agent-confirmation")
        }
        .barStyle()
    }

    private func chosen(_ d: Decision, _ choice: Choice?) -> String {
        switch choice {
        case .option(let n)?: d.option(n).map { "You chose \($0.letter)" + ($0.label.map { " · " + $0 } ?? "") } ?? "You chose option \(n)"
        case .feedback(let text)?: text
        case nil: ""
        }
    }
    private func sentLine(_ d: Decision, _ choice: Choice?) -> String {
        let when = d.answer.map { Wording.capitalized(Wording.when($0.sentAt)) } ?? "Sending"
        if case .feedback? = choice { return "Your note · " + when }
        return when
    }
}

// A decision that closed unanswered (B5.17): who asked finished before the owner answered, and when it closed. Nothing
// to pick or send.
struct UnansweredBar: View {
    var asked: Asked
    var closed: Closed

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nothing can be sent for this decision.").font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity)
            HStack(spacing: 12) {
                ChoiceBadge(decision: asked.decision, choice: nil, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(Wording.closedUnanswered(closed, asked.agent)).font(.title3.weight(.semibold)).lineLimit(3)
                    Text("Closed unanswered · " + Wording.capitalized(Wording.when(closed.at))).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("closed-unanswered")
        }
        .barStyle()
    }
}

private extension View {
    func barStyle() -> some View {
        padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 8)
            .background(Color(.systemBackground))
            .overlay(alignment: .top) { Divider() }
    }
}

struct AskChangesView: View {
    var decision: Decision
    @Binding var text: String
    var cancel: () -> Void
    var send: () -> Void
    @FocusState private var focused: Bool

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var hasHTML: Bool { text.range(of: "<[A-Za-z/!?]", options: .regularExpression) != nil }
    // A note's bytes are held too, so its sealed answer fits what the service takes (PART_MAX_BYTES in exchange.ts).
    private var valid: Bool { !trimmed.isEmpty && text.count <= 1000 && text.utf8.count <= 60_000 && !hasHTML }

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
        .navigationTitle("Ask for changes")
        .navigationSubtitle(decision.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: cancel) }
            ToolbarItem(placement: .confirmationAction) {
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
