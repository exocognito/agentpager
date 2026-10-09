import SwiftUI

@main
struct AgentPagerApp: App {
    @State private var model = Sample.demo(UserDefaults.standard.string(forKey: "demo")) ?? AppModel()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        if ProcessInfo.processInfo.arguments.contains("-resetKeys") { Keychain.deleteAll(); InboxCache.deleteAll() }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .onOpenURL { model.handle(url: $0) }
                .task(id: scenePhase == .active) {
                    // Foreground only: refresh about every 3 s. There are no push notifications in this build.
                    if scenePhase == .active { await model.pollLoop() }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase != .active { model.flushUndo() }
                }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.path) {
            AgentsListView()
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .agent(let id): AgentView(sessionId: id)
                    }
                }
        }
        .sheet(item: $model.sheet) { sheet in
            SheetContent(sheet: sheet)
        }
        .overlay(alignment: .bottom) {
            if let undo = model.undo { UndoPill(answer: undo) }
        }
        .alert("Answer Not Confirmed", isPresented: Binding(get: { model.notConfirmed != nil }, set: { if !$0 { model.cancelNotConfirmed() } })) {
            Button("Cancel", role: .cancel) { model.cancelNotConfirmed() }
            Button("Retry") { model.retryNotConfirmed() }.keyboardShortcut(.defaultAction)
        } message: {
            Text("Your answer is not confirmed. Retry sends the same prepared answer.")
        }
    }
}

struct SheetContent: View {
    @Environment(AppModel.self) private var model
    var sheet: ActiveSheet

    var body: some View {
        switch sheet {
        case .connect:
            ConnectSheet()
        case .pairing(let target):
            let phoneKey = target.sessionId.flatMap { model.key($0)?.phoneKey } ?? randomToken()
            PairingSheet(flow: model.demoFlow ?? PairingFlow(target: target, phoneKey: phoneKey))
        case .decision(let s, let d):
            DecisionSheet(sessionId: s, decisionId: d)
        case .thread(let s, let d):
            ThreadSheet(sessionId: s, decisionId: d)
        case .settings:
            SettingsSheet()
        }
    }
}
