import SwiftUI

// Rare things: the pager number agents use to open pagers without pairing, the server, and changing the number.
struct SettingsSheet: View {
    @Environment(AppModel.self) private var model
    @State private var copied = false
    @State private var confirmChange = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(model.pagerNumber?.number ?? (model.numberError == nil ? "Making a number…" : "No number yet"))
                        .font(.footnote.monospaced())
                        .foregroundStyle(model.pagerNumber == nil ? .secondary : .primary)
                        .textSelection(.enabled)
                        .accessibilityIdentifier("pager-number")
                    Button(copied ? "Copied" : "Copy for Your Agents") {
                        UIPasteboard.general.string = model.numberInstructions
                        copied = true
                        Task { try? await Task.sleep(for: .seconds(1.5)); copied = false }
                    }
                    .disabled(model.pagerNumber == nil)
                    .accessibilityIdentifier("copy-number")
                    // For getting the line to another device: AirDrop it to the Mac that runs the agents.
                    if let line = model.numberInstructions {
                        ShareLink(item: line) { Label("Share…", systemImage: "square.and.arrow.up") }
                            .accessibilityIdentifier("share-number")
                    } else {
                        Label("Share…", systemImage: "square.and.arrow.up").foregroundStyle(.tertiary)
                    }
                } header: {
                    Text("Pager number")
                } footer: {
                    if let error = model.numberError {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(error).foregroundStyle(.red)
                            Button("Try Again") { Task { await model.ensureNumber() } }
                        }
                    } else {
                        Text("Agents with this number open a pager on this phone without pairing. Put it only where agents you trust read it, such as your AGENTS.md. Copy or Share gives you a line to paste there.")
                    }
                }
                Section {
                    NavigationLink { ServerForm() } label: {
                        LabeledContent("Server", value: model.server.host() ?? model.server.absoluteString)
                    }
                    .accessibilityIdentifier("server-row")
                } footer: {
                    Text("Your pagers and pager number are kept per server. Now: \(model.statusLine).")
                }
                Section {
                    Button("Change Pager Number…", role: .destructive) { confirmChange = true }
                        .disabled(model.pagerNumber == nil || model.numberBusy)
                        .accessibilityIdentifier("change-number")
                        // Attached here so the dialog points at this button.
                        .confirmationDialog("Change your pager number?", isPresented: $confirmChange, titleVisibility: .visible) {
                            Button("Change Number", role: .destructive) { Task { await model.rotateNumber() } }
                        } message: {
                            Text("The old number stops working at once. Give your agents the new one.")
                        }
                } footer: {
                    Text("Agents using the old number can no longer open pagers. Pagers already open keep working.")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button(role: .close) { model.sheet = nil } }
            }
        }
        .task { await model.ensureNumber() }
    }
}

struct ServerForm: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var invalid = false

    var body: some View {
        Form {
            Section {
                TextField("http://192.168.1.10:8787", text: $text)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityIdentifier("server-field")
            } header: {
                Text("AgentPager server")
            } footer: {
                Text(invalid ? "Enter a full http:// or https:// address." : "Your pagers are kept per server.")
                    .foregroundStyle(invalid ? Color.red : Color.secondary)
            }
        }
        .navigationTitle("Server")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    if model.setServer(text) { Task { await model.ensureNumber() }; dismiss() } else { invalid = true }
                }
                .accessibilityIdentifier("server-save")
            }
        }
        .onAppear { text = model.server.absoluteString }
    }
}
