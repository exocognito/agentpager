import SwiftUI
import Observation

// The phone shows the pager's 25-emoji palette; it is never told which 3 are the code.
// Tries are counted on the server. A Pair button submits; nothing auto-submits.
@Observable
final class PairingFlow {
    enum Phase: Equatable { case loading, entering, checking, wrong, failed, paired(PagerSummary), unavailable(String, String) }

    let target: PairingTarget
    let phoneKey: String
    var name: String?
    var palette: [PaletteEntry] = []
    var entered: [String?] = [nil, nil, nil]
    var focus: Int? = 0
    var triesLeft = 3
    var windowEndsAt: Date?
    var phase: Phase = .loading
    var note: String?

    init(target: PairingTarget, phoneKey: String) {
        self.target = target
        self.phoneKey = phoneKey
    }

    var full: Bool { entered.allSatisfy { $0 != nil } }
    func label(_ emoji: String) -> String { palette.first { $0.emoji == emoji }?.name ?? emoji }

    func statusText(now: Date) -> String {
        if let note { return note }
        switch phase {
        case .checking: return "Checking…"
        case .wrong: return Wording.wrong(triesLeft)
        default:
            if triesLeft == 1 { return Wording.lastTry }
            if triesLeft < 3 { return "\(triesLeft) tries left." }
            return Wording.pairingHint(until: windowEndsAt, now: now)
        }
    }
    var statusIsAlarm: Bool { note == nil && (phase == .wrong || triesLeft == 1) && phase != .checking }

    func tapSlot(_ i: Int) {
        guard phase == .entering || phase == .wrong else { return }
        phase = .entering
        focus = i
    }

    func tapEmoji(_ emoji: String) {
        switch phase {
        case .wrong:
            entered = [emoji, nil, nil]
            focus = 1
            phase = .entering
        case .entering:
            guard let f = focus else { return }
            entered[f] = emoji
            focus = entered.firstIndex(where: { $0 == nil })
        default: return
        }
        note = nil
    }

    func load(_ client: APIClient) async {
        do throws(APIError) {
            let info = try await client.startInfo(code: target.code)
            name = info.name
            palette = info.palette
            triesLeft = info.triesLeft
            windowEndsAt = info.status == .unpaired ? info.endsAt : nil
            switch info.status {
            case .waiting: phase = .unavailable("Waiting for Your Agent", "Give your agent this AgentPager link first. Pairing opens once it connects.")
            case .active: phase = .unavailable("Already Paired", "This agent is already paired with a phone.")
            case .ended: phase = .unavailable("This Pager Has Ended", "Try connecting an agent again.")
            case .unpaired: if phase == .loading { phase = .entering }
            }
        } catch {
            switch error.tag {
            case "LinkInvalid": phase = .unavailable("Link Expired", "This AgentPager link has expired. Ask your agent for a new one, or connect an agent again.")
            default: phase = .unavailable("Can’t Reach Server", "Check that your AgentPager server is running, then try again.")
            }
        }
    }

    func pair(_ client: APIClient) async -> PagerSummary? {
        guard full, phase == .entering else { return nil }
        let code = entered.compactMap { $0 }
        phase = .checking
        note = nil
        focus = nil
        do throws(APIError) {
            let env = try await client.pair(code: target.code, emojis: code, phoneKey: phoneKey)
            phase = .paired(env.session)
            return env.session
        } catch {
            switch error {
            case .server(_, let body) where body.error == "WrongCode":
                triesLeft = body.triesLeft ?? max(triesLeft - 1, 1)
                phase = .wrong
            case .server(_, let body) where body.error == "PagerEnded":
                triesLeft = 0
                phase = body.endReason == .pairingFailed ? .failed : .unavailable("This Pager Has Ended", "Try connecting an agent again.")
            case .server(_, let body) where body.error == "AlreadyPaired":
                phase = .unavailable("Already Paired", "Another phone already paired with this agent.")
            case .server(_, let body) where body.error == "LinkInvalid":
                phase = .unavailable("Link Expired", "This AgentPager link has expired. Ask your agent for a new one, or connect an agent again.")
            case .server(_, let body) where body.error == "WaitingForAgent":
                phase = .unavailable("Waiting for Your Agent", "Give your agent this AgentPager link first. Pairing opens once it connects.")
            default:
                // Nothing was counted; the same key and code can be sent again.
                phase = .entering
                focus = nil
                note = "Couldn’t reach the server. Tap Pair to try again."
            }
            return nil
        }
    }
}

struct PairingSheet: View {
    @Environment(AppModel.self) private var model
    @State var flow: PairingFlow

    var body: some View {
        NavigationStack {
            content
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .principal) {
                        Text(flow.name ?? "").font(.subheadline).foregroundStyle(.secondary)
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(role: .close) { model.sheet = nil }.accessibilityIdentifier("close-pairing")
                    }
                }
        }
        .task { if model.live, flow.phase == .loading { await flow.load(model.client) } }
        .interactiveDismissDisabled(flow.phase == .checking)
    }

    @ViewBuilder private var content: some View {
        switch flow.phase {
        case .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed:
            Outcome(symbol: "xmark.circle", color: .red, title: "Pairing Failed",
                    text: "That was the third wrong code, so this pager has ended. Try connecting an agent again.") {
                Button("Connect an Agent") { model.sheet = .connect }
                    .buttonStyle(.borderedProminent).controlSize(.large).padding(.top, 8)
            }
        case .paired(let s):
            Outcome(symbol: "checkmark.circle.fill", color: .green, title: "Paired",
                    text: "\(s.name ?? flow.name ?? "Your agent") can now page you. Pager ends in \(Wording.remaining(until: s.endsAt ?? .now, now: .now)).") { EmptyView() }
        case .unavailable(let title, let text):
            ContentUnavailableView(title, systemImage: "link", description: Text(text))
        default:
            pad
        }
    }

    private var pad: some View {
        VStack(spacing: 0) {
            Text("Pair This Agent").font(.title2.bold()).padding(.top, 8)
            Text("Tap the 3 emojis your agent shows you, in order.")
                .font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center)
                .padding(.horizontal, 24).padding(.top, 6)
            HStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { i in slot(i) }
            }
            .padding(.top, 20)
            TimelineView(.periodic(from: .now, by: 10)) { context in
                Text(flow.statusText(now: context.date))
                    .font(.subheadline)
                    .foregroundStyle(flow.statusIsAlarm ? Color.red : Color.secondary)
                    .frame(minHeight: 20)
                    .accessibilityIdentifier("pairing-status")
            }
            .padding(.top, 12)
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(56), spacing: 10), count: 5), spacing: 10) {
                ForEach(flow.palette, id: \.emoji) { e in
                    Button { flow.tapEmoji(e.emoji) } label: {
                        Text(e.emoji).font(.system(size: 30))
                            .frame(width: 56, height: 56)
                            .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 16))
                    }
                    .buttonStyle(.plain)
                    .disabled(flow.phase == .checking || (flow.phase == .entering && flow.focus == nil))
                    .accessibilityLabel(e.name)
                    .accessibilityIdentifier("palette-\(e.name)")
                }
            }
            .padding(.top, 16)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .safeAreaInset(edge: .bottom) {
            Button {
                Task {
                    if let s = await flow.pair(model.client) { model.paired(s, code: flow.target.code, phoneKey: flow.phoneKey) }
                    else if flow.phase == .failed { model.pairingFailed(sessionId: flow.target.sessionId) }
                }
            } label: {
                Text(flow.phase == .checking ? "Checking…" : "Pair").font(.headline).frame(maxWidth: .infinity, minHeight: 34)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .disabled(!flow.full || flow.phase != .entering)
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
            .accessibilityIdentifier("pair-button")
        }
    }

    private func slot(_ i: Int) -> some View {
        let emoji = flow.entered[i]
        let focused = flow.phase == .entering && flow.focus == i
        let wrong = flow.phase == .wrong
        return Button { flow.tapSlot(i) } label: {
            Text(emoji ?? " ").font(.system(size: 34))
                .frame(width: 64, height: 64)
                .background(Color(.tertiarySystemFill), in: .circle)
                .overlay {
                    Circle().strokeBorder(wrong ? Color.red : focused ? Color.accentColor : Color(.separator),
                                          lineWidth: wrong ? 2 : focused ? 3 : 0.5)
                }
        }
        .buttonStyle(.plain)
        .disabled(flow.phase == .checking)
        .accessibilityLabel("Emoji \(i + 1): \(emoji.map(flow.label) ?? "empty"). Tap to change.")
        .accessibilityIdentifier("slot-\(i)")
    }
}

struct Outcome<Actions: View>: View {
    var symbol: String
    var color: Color
    var title: String
    var text: String
    @ViewBuilder var actions: Actions

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: symbol).font(.system(size: 60)).foregroundStyle(color)
            Text(title).font(.title2.bold()).padding(.top, 6)
            Text(text).font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center).padding(.horizontal, 32)
            actions
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.bottom, 80)
    }
}
