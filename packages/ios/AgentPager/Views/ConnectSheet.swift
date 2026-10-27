import SwiftUI
import CoreImage.CIFilterBuiltins

// One idea: an AgentPager link is a link, a QR code and an end time. The phone makes this one; an agent
// can also make one for the owner to scan with the Camera app.
struct ConnectSheet: View {
    @Environment(AppModel.self) private var model
    @State private var copied = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(spacing: 20) {
                        Text("Give this AgentPager link to your agent. Your agent can also make one for you to scan.")
                            .font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        qr
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 4, trailing: 12))
                }
                Section {
                    HStack(spacing: 12) {
                        Text(link ?? "Making a link…")
                            .font(.footnote.monospaced())
                            .foregroundStyle(link == nil ? .secondary : .primary)
                            .textSelection(.enabled)
                            .accessibilityIdentifier("connect-link")
                        Spacer(minLength: 0)
                        Button(copied ? "Copied" : "Copy") {
                            UIPasteboard.general.string = link
                            copied = true
                            Task { try? await Task.sleep(for: .seconds(1.5)); copied = false }
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .disabled(link == nil)
                    }
                    Picker(selection: Binding(get: { model.connectLifetime }, set: { l in Task { await model.setConnectLifetime(l) } })) {
                        ForEach(Lifetime.allCases) { Text($0.label).tag($0) }
                    } label: {
                        Label("Pager ends after", systemImage: "clock")
                    }
                    .pickerStyle(.menu)
                    .disabled(model.connectKey == nil)
                    .accessibilityIdentifier("connect-lifetime")
                    if let link, let url = URL(string: link) {
                        ShareLink(item: url) { Label("Share Link…", systemImage: "square.and.arrow.up") }
                    } else {
                        Label("Share Link…", systemImage: "square.and.arrow.up").foregroundStyle(.tertiary)
                    }
                } header: {
                    Text("AgentPager link")
                } footer: {
                    if let error = model.connectError {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(error).foregroundStyle(.red)
                            Button("Try Again") { Task { await model.ensureConnectLink() } }
                        }
                    } else {
                        Text(model.connectLifetime.note)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Connect an Agent")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button(role: .close) { model.sheet = nil } }
            }
        }
        .task { await model.ensureConnectLink() }
    }

    private var link: String? { model.connectKey?.linkURL }

    private var qr: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 20).fill(.white)
            if let link, let image = QRCode.image(link) {
                Image(uiImage: image).interpolation(.none).resizable().scaledToFit().padding(14)
                    .accessibilityLabel("QR code for the AgentPager link")
            } else if model.connectError == nil {
                ProgressView()
            }
        }
        .frame(width: 192, height: 192)
    }
}

enum QRCode {
    static func image(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage,
              let cg = CIContext().createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
