import SwiftUI

@main
struct AgentPagerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    private var model: AppModel { appDelegate.model }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .task(id: scenePhase == .active) {
                    // Foreground: refresh about every 3 s. A closed app hears its agents through alerts (Alerts.swift).
                    if scenePhase == .active { model.reloadServer(); await model.pollLoop() }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase != .active { model.flushUndo() }
                }
        }
    }
}

// Pagers → a pager → its detail, a decision, or a project's answered decisions. No Settings screen: the server
// address is in the Settings app.
struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.path) {
            PagersView()
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .pager(let id): PagerView(pagerId: id)
                    case .pagerDetail(let id): PagerDetailView(pagerId: id)
                    case .decision(let p, let a, let d): DecisionView(pagerId: p, agentId: a, decisionId: d)
                    case .answered(let p, let project): AnsweredListView(pagerId: p, project: project)
                    }
                }
        }
        .sheet(item: $model.sheet) { sheet in
            switch sheet {
            case .newPager: NewPagerSheet().environment(model)
            }
        }
        .overlay(alignment: .bottom) {
            if let undo = model.undo { UndoPill(answer: undo) }
        }
        // One alert covers every answer whose retries all failed, once no other send is still trying, so it names
        // them all (an alert's text doesn't change while it shows); its buttons act on all of them.
        .alert("Answer Not Confirmed", isPresented: Binding(get: { !model.notConfirmed.isEmpty && model.sendingNow.isEmpty }, set: { _ in })) {
            Button("Cancel", role: .cancel) { model.cancelNotConfirmed() }
            Button("Retry") { model.retryNotConfirmed() }.keyboardShortcut(.defaultAction)
        } message: {
            Text(model.notConfirmedText)
        }
    }
}
