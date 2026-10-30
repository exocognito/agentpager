import SwiftUI

// A pager's detail: the switch, its name, when it turns off, what to give agents, and Delete. Changes apply as made.
struct PagerDetailView: View {
    @Environment(AppModel.self) private var model
    var pagerId: String
    @State private var name = ""
    @State private var confirmDelete = false
    @FocusState private var naming: Bool

    var body: some View {
        if let p = model.pager(pagerId) {
            Form {
                Section {
                    Toggle("Pager on", isOn: Binding(get: { model.isOn(pagerId) }, set: { on in Task { await model.setOn(pagerId, on) } }))
                        .tint(.green)
                        .accessibilityIdentifier("pager-on")
                }
                Section {
                    TextField("Name", text: $name)
                        .focused($naming)
                        .submitLabel(.done)
                        .onSubmit { model.rename(pagerId, name) }
                        .accessibilityIdentifier("pager-name")
                    Picker("Turn off", selection: Binding(get: { model.state(pagerId)?.autoOff ?? .never }, set: { a in Task { await model.setAutoOff(pagerId, a) } })) {
                        ForEach(AutoOff.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .tint(.secondary)
                    .accessibilityIdentifier("turn-off")
                }
                Section { InstructionsBlock(text: model.instructions(p)) } header: { SectionHeader(text: "Give agents this") }
                    .listRowBackground(Color(.systemGray5))
                Section {
                    Button("Delete pager", role: .destructive) { confirmDelete = true }
                        .accessibilityIdentifier("delete-pager")
                        .confirmationDialog("Delete \(p.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                            Button("Delete pager", role: .destructive) { Task { await model.deletePager(pagerId) } }
                        } message: {
                            Text("Its decisions are deleted from this phone and the service, and agents with its number can’t reach you.")
                        }
                }
            }
            .navigationTitle(p.name)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { name = p.name }
            .onChange(of: naming) { _, focused in if !focused { model.rename(pagerId, name) } }
            .onDisappear { model.rename(pagerId, name) }
        }
    }
}

// The New pager sheet: no grab handle; the number is made here and shows before Create.
struct NewPagerSheet: View {
    @Environment(AppModel.self) private var model
    @State private var name = ""
    @State private var autoOff: AutoOff = .never
    @FocusState private var naming: Bool

    private var valid: Bool { !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name).focused($naming).accessibilityIdentifier("new-pager-name")
                    Picker("Turn off", selection: $autoOff) {
                        ForEach(AutoOff.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .tint(.secondary)
                    .accessibilityIdentifier("new-pager-turn-off")
                } footer: {
                    if let error = model.createError { Text(error).foregroundStyle(.red) }
                    else { Text("Only you see the name. A pager that turns off can be switched back on any time.") }
                }
                if let draft = model.draft {
                    Section { InstructionsBlock(text: model.instructions(draft)) } header: { SectionHeader(text: "Give agents this") }
                        .listRowBackground(Color(.systemGray5))
                }
            }
            .navigationTitle("New pager")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { model.sheet = nil; model.draft = nil } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await model.createPager(name: name, autoOff: autoOff) } }
                        .disabled(!valid || model.createBusy)
                        .accessibilityIdentifier("create-pager")
                }
            }
        }
        .presentationDragIndicator(.hidden)
        .onAppear { name = model.draft?.name ?? ""; autoOff = model.draftAutoOff; naming = name.isEmpty }
    }
}

// What the owner gives agents, copied as one block with the copy icon.
struct InstructionsBlock: View {
    var text: String
    @State private var copied = false

    var body: some View {
        let lines = text.components(separatedBy: "\n")
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 14) {
                Text(lines.first ?? "")
                // Breaks anywhere in the number without a hyphen: a number can hold a real one.
                Text(lines.dropFirst().joined(separator: "\n").map(String.init).joined(separator: "\u{200B}")).font(.callout.monospaced()).foregroundStyle(.secondary)
                    .accessibilityLabel(lines.dropFirst().joined(separator: "\n"))
                    .accessibilityIdentifier("connect-line")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                UIPasteboard.general.string = text
                copied = true
                Task { try? await Task.sleep(for: .seconds(1.5)); copied = false }
            } label: {
                Image(systemName: copied ? "checkmark" : "doc.on.doc").font(.body).foregroundStyle(.tint)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(copied ? "Copied" : "Copy")
            .accessibilityIdentifier("copy-instructions")
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("instructions")
    }
}
