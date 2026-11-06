import SwiftUI
import UIKit
import ImageIO

// A decision brief (the canvas's headed template), laid out as an iOS inset-grouped page: "Decision: " and the
// question with one "x ago", then each section's heading above its own card: Context, Options (the
// tradeoffs table, and a row to the Options screen), Recommendation, Next steps and Small print. Each folds by
// its heading. Viewing an option never chooses it; the answer bar below does, with today's Undo window and
// acknowledgement.
struct BriefView: View {
    var agentId: String
    var decision: Decision
    // The answer button picked, while the decision is open; nil once it is answered.
    var picked: Binding<Int?>?
    // Under the question: when it was asked, and answered.
    var subtitle: String
    var openPage: (String) -> Void = { _ in }
    var openOptions: () -> Void = {}
    // The answer bar, the pager-off bar, or the closed record.
    var bottom: AnyView?

    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var folded: Set<String>
    @State private var document: BriefDocument
    @State private var fullScreen: FullScreenImage?

    init(agentId: String, decision: Decision, picked: Binding<Int?>? = nil, subtitle: String, openPage: @escaping (String) -> Void = { _ in }, openOptions: @escaping () -> Void = {}, bottom: AnyView? = nil) {
        self.agentId = agentId
        self.decision = decision
        self.picked = picked
        self.subtitle = subtitle
        self.openPage = openPage
        self.openOptions = openOptions
        self.bottom = bottom
        let document = BriefDocument(markdown: decision.card.markdown ?? "")
        _document = State(initialValue: document)
        // Next steps and the small print start folded.
        _folded = State(initialValue: Set(document.sections.filter { $0.kind == .nextSteps }.map { "section-\($0.id)" } + ["smallprint"]))
    }

    private var recommended: Option? { decision.card.recommended.flatMap(decision.option) }
    private var star: String? { recommended?.letter }
    // The option outlined in the table: the one picked to send, or the one sent.
    private var outlined: String? {
        if let n = picked?.wrappedValue { return decision.option(n)?.letter }
        if case .option(let n)? = model.choice(decision) { return decision.option(n)?.letter }
        return nil
    }
    private var context: BriefContext {
        BriefContext(agentId: agentId, decisionId: decision.decisionId, star: star, picked: outlined, openPage: openPage) { [agentId, decision] names, start in
            fullScreen = FullScreenImage(agentId: agentId, decisionId: decision.decisionId, names: names, start: start)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Decision: \(decision.title)").font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                    Text(subtitle).font(.footnote).foregroundStyle(.secondary).accessibilityIdentifier("brief-subtitle")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 4).padding(.top, 12).padding(.bottom, 4)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("brief-header")

                ForEach(document.screen) { section in sectionView(section) }
                if !document.smallPrint.isEmpty { smallPrint }
            }
            .padding(.horizontal, 16).padding(.bottom, 24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityIdentifier("brief-scroll")
        .background(Color(.systemGroupedBackground))
        .environment(\.briefContext, context)
        .environment(\.openURL, OpenURLAction { url in
            // An attachment opens as a page; only an https link leaves the app.
            if url.scheme == nil { openPage(url.relativeString); return .handled }
            return url.scheme == "https" ? .systemAction : .discarded
        })
        .safeAreaInset(edge: .bottom) { if let bottom { bottom } }
        .fullScreenCover(item: $fullScreen) { FullScreenImageView(image: $0) }
    }

    // MARK: Sections

    @ViewBuilder private func sectionView(_ s: BriefDocument.Section) -> some View {
        let key = "section-\(s.id)"
        let open = !folded.contains(key) || s.title.isEmpty
        VStack(alignment: .leading, spacing: 0) {
            if !s.title.isEmpty { FoldHeading(title: s.kind == .recommendation ? recommendationTitle(s.title, letter: star) : s.title, open: open) { toggle(key) } }
            if open { card(rows(s), tradeoffs: s.kind == .tradeoffs) }
        }
    }

    private func toggle(_ key: String) {
        withAnimation(.snappy(duration: 0.2)) { if folded.contains(key) { folded.remove(key) } else { folded.insert(key) } }
    }

    // A section's card, as rows split by inset hairlines: its text, each "**Why:** …" lead-in as a label over
    // its line, each link as a row that opens it, and on Options a last row to the Options sheet.
    private enum Row {
        case blocks([BriefBlock])
        case labeled(String, String)
        case link(String, String)
        case options
    }

    private func rows(_ s: BriefDocument.Section) -> [Row] {
        var out: [Row] = []
        var run: [BriefBlock] = []
        func flush() { if !run.isEmpty { out.append(.blocks(run)); run = [] } }
        for block in s.blocks {
            if case .link(let text, let target) = block { flush(); out.append(.link(text, target)) }
            else if case .paragraph(let text) = block, let m = text.wholeMatch(of: /\*\*([^*]+):\*\*\s*(.*)/) { flush(); out.append(.labeled(String(m.1), String(m.2))) }
            else { run.append(block) }
        }
        flush()
        if s.kind == .tradeoffs { out.append(.options) }
        return out
    }

    private func card(_ rows: [Row], tradeoffs: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { n, row in
                if n > 0 { Divider().padding(.leading, 16) }
                switch row {
                case .blocks(let blocks):
                    BriefBlocksView(blocks: blocks, tradeoffs: tradeoffs).padding(.horizontal, 16).padding(.vertical, 14)
                case .labeled(let label, let text):
                    VStack(alignment: .leading, spacing: 2) {
                        Text(label).font(.footnote).foregroundStyle(.secondary)
                        Text(Inline.text(text)).font(.callout).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                case .link(let text, let target):
                    NavigationRow(text: text, id: "link-\(target)") {
                        if target.hasPrefix("https://"), let url = URL(string: target) { openURL(url) } else { openPage(target) }
                    }
                case .options:
                    NavigationRow(text: "Read more on options", id: "open-options", action: openOptions)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20))
        .clipShape(.rect(cornerRadius: 20))
    }

    // Small print sits on the page, like a list's footer.
    private var smallPrint: some View {
        let open = !folded.contains("smallprint")
        return VStack(alignment: .leading, spacing: 6) {
            Button { toggle("smallprint") } label: {
                HStack {
                    Text("Small print · \(document.smallPrintCount)").font(.subheadline).foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                        .rotationEffect(.degrees(open ? 90 : 0))
                }
                .frame(minHeight: 44).contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fold-smallprint")
            .accessibilityValue(open ? "Open" : "Folded")
            if open { BriefBlocksView(blocks: document.smallPrint, small: true).padding(.bottom, 8) }
        }
        .padding(.horizontal, 4)
    }
}

// A section heading above its card, like a prominent list header; tapping it folds the card.
struct FoldHeading: View {
    var title: String
    var open: Bool
    var toggle: () -> Void
    var body: some View {
        Button(action: toggle) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(title).font(.title3.weight(.semibold)).foregroundStyle(Color(.label)).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.subheadline.weight(.semibold)).foregroundStyle(.tertiary)
                    .rotationEffect(.degrees(open ? 90 : 0))
            }
            .padding(.horizontal, 4)
            .frame(minHeight: 44).contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isHeader)
        .accessibilityValue(open ? "Open" : "Folded")
        .accessibilityIdentifier("fold-\(title)")
    }
}

// A card row that goes somewhere, in the label colour with a grey chevron, highlighted while pressed.
struct NavigationRow: View {
    var text: String
    var id: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(text).font(.body).foregroundStyle(Color(.label)).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 48)
            .contentShape(.rect)
        }
        .buttonStyle(RowButtonStyle())
        .accessibilityIdentifier(id)
    }
}

struct RowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.background(configuration.isPressed ? Color(.systemGray4) : .clear)
    }
}

// The Options sheet: one option at a time, with its title, what it prioritizes, what it changes, why to choose or
// pass on it, what it assumes and what it looks like. Swipe, or use the segmented control at the top, to see
// another; seeing an option never chooses it.
struct BriefOptionsView: View {
    var agentId: String
    var decision: Decision
    var openPage: (String) -> Void
    @State private var shown: Int
    @State private var document: BriefDocument
    @State private var fullScreen: FullScreenImage?

    // Opens on `start` (the option picked to send), else the option sent, else A.
    init(agentId: String, decision: Decision, start: Int?, openPage: @escaping (String) -> Void) {
        self.agentId = agentId
        self.decision = decision
        self.openPage = openPage
        _document = State(initialValue: BriefDocument(markdown: decision.card.markdown ?? ""))
        var answered: Int? { if case .option(let n)? = decision.answer?.choice { n } else { nil } }
        _shown = State(initialValue: start ?? answered ?? 1)
    }

    private var star: String? { decision.card.recommended.flatMap(decision.option)?.letter }

    var body: some View {
        TabView(selection: $shown) {
            ForEach(decision.card.options, id: \.number) { o in
                ScrollView {
                    page(o).padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 24)
                }
                .tag(o.number)
                .accessibilityIdentifier("option-page-\(o.letter)")
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .background(Color(.systemBackground))
        .navigationTitle("Options")
        .navigationBarTitleDisplayMode(.inline)
        // The A/B picker sits at the top of the sheet, under its title.
        .safeAreaInset(edge: .top, spacing: 0) {
            Picker("Show option", selection: $shown) {
                ForEach(decision.card.options, id: \.number) { o in
                    Text(o.letter + (o.letter == star ? " ✶" : "")).tag(o.number)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: CGFloat(decision.card.options.count) * 72)
            .padding(.bottom, 10)
            .frame(maxWidth: .infinity)
            .background(Color(.systemBackground))
            .overlay(alignment: .bottom) { Divider() }
            .accessibilityIdentifier("option-picker")
        }
        .environment(\.briefContext, BriefContext(agentId: agentId, decisionId: decision.decisionId, star: star, openPage: openPage) { [agentId, decision] names, start in
            fullScreen = FullScreenImage(agentId: agentId, decisionId: decision.decisionId, names: names, start: start)
        })
        .environment(\.openURL, OpenURLAction { url in
            if url.scheme == nil { openPage(url.relativeString); return .handled }
            return url.scheme == "https" ? .systemAction : .discarded
        })
        .fullScreenCover(item: $fullScreen) { FullScreenImageView(image: $0) }
    }

    private func page(_ o: Option) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("Option \(o.letter)" + (o.label.map { " · " + $0 } ?? ""))
                    Spacer(minLength: 0)
                    if o.letter == star { Text("✶ Recommended").foregroundStyle(Color(.label)).fixedSize() }
                }
                .font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                Text(o.title).font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                if let p = o.prioritizes { Text("Prioritizes \(p)").font(.subheadline).foregroundStyle(.secondary) }
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("option-header-\(o.letter)")
            if let block = document.options[o.letter] { optionBlock(o, block) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // What the option changes and the case for and against it come first, then what it looks like.
    @ViewBuilder private func optionBlock(_ o: Option, _ block: BriefDocument.OptionBlock) -> some View {
        let mine = o.letter == star ? star : nil
        if !block.sections.isEmpty { BriefBlocksView(blocks: block.sections) }
        if !block.preview.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                if let caption = block.caption {
                    Text(starred(caption, letter: mine)).font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                }
                BriefBlocksView(blocks: block.preview, inPreview: true)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemGray6), in: .rect(cornerRadius: 14))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("option-preview-\(o.letter)")
        }
    }
}

// What the blocks of one brief need: where their attachments come from, the recommended letter, and how to open a
// page or a strip of images at one of them.
struct BriefContext {
    var agentId = ""
    var decisionId = ""
    var star: String?
    // The option to outline in the tradeoffs table: picked to send, or sent.
    var picked: String?
    var openPage: (String) -> Void = { _ in }
    var openImages: (_ names: [String], _ start: Int) -> Void = { _, _ in }
}
extension EnvironmentValues {
    @Entry var briefContext = BriefContext()
}

struct FullScreenImage: Identifiable, Hashable {
    var agentId: String
    var decisionId: String
    var names: [String]
    var start: Int
    var id: String { decisionId + "/" + names.joined(separator: "/") + "#\(start)" }
}

// MARK: Blocks

// Color only rates: best to worst, in tradeoffs, diagrams, diffs and rated cells. It never marks the recommendation.
enum Rating: String {
    case green, yellow, orange, red
    private var hex: (light: (bg: UInt32, ink: UInt32), dark: (bg: UInt32, ink: UInt32)) {
        switch self {
        case .green: ((0xe3f4e8, 0x17603a), (0x163a24, 0x8fdca8))
        case .yellow: ((0xfcf1c4, 0x5f4a00), (0x3a3007, 0xf0d46a))
        case .orange: ((0xfde3cf, 0x8a3c00), (0x452610, 0xffb27a))
        case .red: ((0xfbdedc, 0x9b1c14), (0x461816, 0xff9d95))
        }
    }
    var background: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: hex.dark.bg) : UIColor(hex: hex.light.bg) }) }
    var ink: Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: hex.dark.ink) : UIColor(hex: hex.light.ink) }) }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
    }
}

// Inline Markdown (bold, italic, code, links) plus the Kit's ":green[…]" rating spans.
enum Inline {
    static func text(_ source: String) -> AttributedString {
        var out = AttributedString()
        var rest = Substring(source)
        while let m = rest.firstMatch(of: /:(green|yellow|orange|red)\[([^\]]*)\]/) {
            out += markdown(String(rest[..<m.range.lowerBound]))
            var span = markdown(String(m.2))
            if let r = Rating(rawValue: String(m.1)) {
                span.foregroundColor = r.ink
                span.backgroundColor = r.background
                span.inlinePresentationIntent = .stronglyEmphasized
            }
            out += span
            rest = rest[m.range.upperBound...]
        }
        return out + markdown(String(rest))
    }
    static func markdown(_ s: String) -> AttributedString {
        (try? AttributedString(markdown: s, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(s)
    }
    // A cell that is one rating span is drawn as a tinted cell.
    static func rated(_ cell: String) -> (Rating, String)? {
        guard let m = cell.wholeMatch(of: /:(green|yellow|orange|red)\[([^\]]*)\]/), let r = Rating(rawValue: String(m.1)) else { return nil }
        return (r, String(m.2))
    }
}

struct BriefBlocksView: View {
    var blocks: [BriefBlock]
    var tradeoffs = false
    var inPreview = false
    var small = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                switch item {
                case .block(let block): BlockView(block: block, tradeoffs: tradeoffs, inPreview: inPreview, small: small)
                case .images(let names): ImageStrip(names: names)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // Images one after another draw as one strip of thumbnails.
    private enum Item { case block(BriefBlock), images([String]) }
    private var items: [Item] {
        blocks.reduce(into: []) { out, block in
            guard case .image(_, let name) = block else { out.append(.block(block)); return }
            if case .images(let names)? = out.last { out[out.count - 1] = .images(names + [name]) } else { out.append(.images([name])) }
        }
    }
}

struct BlockView: View {
    var block: BriefBlock
    var tradeoffs = false
    var inPreview = false
    var small = false
    @Environment(\.briefContext) private var context

    private var bodyFont: Font { small ? .footnote : inPreview ? .footnote : .callout }

    var body: some View {
        switch block {
        case .heading(let level, let text):
            Text(Inline.text(text))
                .font(level <= 1 ? .title3.weight(.bold) : level == 2 ? .headline : .callout.weight(.semibold))
                .padding(.top, level <= 2 ? 6 : 4)
                .accessibilityAddTraits(.isHeader)
        case .paragraph(let text):
            Text(Inline.text(text)).font(bodyFont)
                .foregroundStyle(inPreview || small ? Color(.secondaryLabel) : Color(.label))
                .frame(maxWidth: .infinity, alignment: inPreview ? .center : .leading)
                .multilineTextAlignment(inPreview ? .center : .leading)
                .fixedSize(horizontal: false, vertical: true)
        case .list(let ordered, let items):
            VStack(alignment: .leading, spacing: small ? 6 : 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { n, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(ordered ? "\(n + 1)." : "•").font(bodyFont).foregroundStyle(.secondary).frame(minWidth: 12, alignment: .leading)
                        Text(Inline.text(item)).font(bodyFont).foregroundStyle(small ? Color(.secondaryLabel) : Color(.label)).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        case .code(let language, let title, let lines):
            if language == "mermaid" { MermaidBlock(source: lines) } else { CodeBlock(title: title, lines: lines, diff: language == "diff") }
        case .table(let header, let rows):
            TableBlock(header: header, rows: rows, letters: tradeoffs, star: context.star, picked: tradeoffs ? context.picked : nil)
        case .image(_, let name):
            ImageStrip(names: [name])
        case .link(let text, let target):
            LinkRow(text: text, target: target)
        case .chat(let lines):
            ChatBlock(lines: lines)
        case .container("draft", let argument, let blocks):
            VStack(alignment: .leading, spacing: 6) {
                if !argument.isEmpty { Text(argument.capitalized).font(.footnote.weight(.semibold)).foregroundStyle(.secondary) }
                BriefBlocksView(blocks: blocks)
            }
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemBackground), in: .rect(cornerRadius: 10))
            .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Color(.systemGray4), lineWidth: 0.5) }
        case .container(_, _, let blocks):
            BriefBlocksView(blocks: blocks, inPreview: inPreview, small: small)
        case .rule:
            Divider()
        }
    }
}

struct LinkRow: View {
    var text: String
    var target: String
    @Environment(\.briefContext) private var context
    @Environment(\.openURL) private var openURL
    var body: some View {
        Button {
            if target.hasPrefix("https://"), let url = URL(string: target) { openURL(url) } else { context.openPage(target) }
        } label: {
            HStack(spacing: 5) {
                Text(text).font(.subheadline.weight(.semibold)).multilineTextAlignment(.leading)
                Image(systemName: "chevron.right").font(.caption.weight(.bold))
            }
            .foregroundStyle(Color.accentColor)
            .frame(minHeight: 32, alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("link-\(target)")
    }
}

// The Tradeoffs table: "A Cards" columns gain ✶ on the recommended letter; a rated cell is tinted best to worst.
// The option picked to send is outlined, header to last row.
struct TableBlock: View {
    var header: [String]
    var rows: [[String]]
    var letters: Bool
    var star: String?
    var picked: String?

    private var columns: Int { max(header.count, rows.map(\.count).max() ?? 0) }
    private var labelWidth: CGFloat { [2: 150, 3: 96, 4: 76][columns] ?? 64 }
    private var pickedColumn: Int? {
        guard letters, let picked else { return nil }
        return header.indices.dropFirst().first { letter(header[$0])?.0 == picked }
    }

    var body: some View {
        Grid(alignment: .topLeading, horizontalSpacing: 4, verticalSpacing: 4) {
            if header.contains(where: { !$0.isEmpty }) {
                GridRow {
                    ForEach(0..<columns, id: \.self) { c in
                        headerCell(c < header.count ? header[c] : "", first: c == 0).column(c, of: pickedColumn)
                    }
                }
            }
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                GridRow {
                    ForEach(0..<columns, id: \.self) { c in
                        let cell = c < row.count ? row[c] : ""
                        if c == 0 {
                            Text(Inline.text(cell)).font(.footnote.weight(.medium)).foregroundStyle(Color(.label))
                                .frame(width: labelWidth, alignment: .leading).padding(.vertical, 8)
                        } else { valueCell(cell).column(c, of: pickedColumn) }
                    }
                }
            }
        }
        .overlayPreferenceValue(PickedColumn.self) { anchors in
            GeometryReader { g in
                if let first = anchors.first {
                    let r = anchors.dropFirst().reduce(g[first]) { $0.union(g[$1]) }.insetBy(dx: -3, dy: -3)
                    RoundedRectangle(cornerRadius: 11).strokeBorder(Color.accentColor, lineWidth: 2)
                        .frame(width: r.width, height: r.height).offset(x: r.minX, y: r.minY)
                }
            }
            .accessibilityHidden(true)
        }
        .animation(.snappy(duration: 0.2), value: picked)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // "B Check" or "B ✶ Check": the letter, and the rest of the header.
    private func letter(_ text: String) -> (String, String)? {
        guard let m = text.firstMatch(of: /^([A-Z])\s?✶?(?![A-Za-z])\s*(.*)$/) else { return nil }
        return (String(m.1), String(m.2))
    }

    @ViewBuilder private func headerCell(_ text: String, first: Bool) -> some View {
        if first {
            Text(Inline.text(text)).font(.footnote).foregroundStyle(.secondary).frame(width: labelWidth, alignment: .leading)
        } else if letters, let (l, rest) = letter(text) {
            let head = Text(l + (l == star ? " ✶" : "")).fontWeight(.semibold).foregroundStyle(Color(.label))
            let tail = Text(rest.isEmpty ? "" : " " + rest).foregroundStyle(.secondary)
            Text("\(head)\(tail)")
                .font(.footnote).padding(.horizontal, 6).padding(.top, 4).padding(.bottom, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Text(Inline.text(text)).font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                .padding(.horizontal, 6).padding(.top, 4).padding(.bottom, 2).frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder private func valueCell(_ cell: String) -> some View {
        if let (rating, text) = Inline.rated(cell) {
            Text(Inline.markdown(text)).font(.footnote).foregroundStyle(rating.ink)
                .padding(.horizontal, 6).padding(.vertical, 8).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(rating.background, in: .rect(cornerRadius: 8))
        } else {
            Text(Inline.text(cell)).font(.footnote).foregroundStyle(Color(.label))
                .padding(.horizontal, 6).padding(.vertical, 8).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

// The cells of the picked column report their bounds, so the table can draw one outline around them.
private struct PickedColumn: PreferenceKey {
    static let defaultValue: [Anchor<CGRect>] = []
    static func reduce(value: inout [Anchor<CGRect>], nextValue: () -> [Anchor<CGRect>]) { value += nextValue() }
}
private extension View {
    func column(_ c: Int, of picked: Int?) -> some View {
        anchorPreference(key: PickedColumn.self, value: .bounds) { c == picked ? [$0] : [] }
    }
}

// One plain diff style for code, schemas and prose: 13 pt mono, 20 pt lines, scrolling sideways.
struct CodeBlock: View {
    var title: String?
    var lines: [String]
    var diff: Bool
    @State private var width: CGFloat = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let title { Text(title).font(.system(size: 13, design: .monospaced)).foregroundStyle(.secondary).padding(.horizontal, 12).padding(.bottom, 4) }
            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                        let rating: Rating? = !diff ? nil : line.hasPrefix("+") ? .green : line.hasPrefix("-") ? .red : nil
                        Text(line.isEmpty ? " " : line)
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundStyle(rating?.ink ?? Color(.label))
                            .lineLimit(1).fixedSize()
                            .frame(minHeight: 20)
                            .padding(.horizontal, 12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(rating?.background ?? .clear)
                    }
                }
                .frame(minWidth: width, alignment: .leading)
            }
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        }
        .padding(.vertical, 10)
        .background(Color(.systemGray6), in: .rect(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }
}

// Mermaid, drawn in AgentPager's style: a flowchart the phone can lay out is drawn; anything else shows its
// source, so nothing is hidden.
struct MermaidBlock: View {
    var source: [String]
    var body: some View {
        if let chart = Flowchart.parse(source) {
            FlowchartView(chart: chart)
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Label("Diagram", systemImage: "point.3.connected.trianglepath.dotted").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                CodeBlock(title: nil, lines: source, diff: false)
            }
        }
    }
}

// Rating classes color a node like a table cell; a node reached only by dotted edges has a dashed border.
struct FlowchartView: View {
    var chart: Flowchart
    @State private var width: CGFloat = 0

    var body: some View {
        let layout = FlowchartLayout(chart, width: width)
        Canvas { context, _ in
            let line = Color(.secondaryLabel)
            for e in chart.edges where e.from < layout.nodes.count && e.to < layout.nodes.count {
                let a = layout.nodes[e.from].frame, b = layout.nodes[e.to].frame
                let start = boxExit(a, toward: CGPoint(x: b.midX, y: b.midY)), end = boxExit(b, toward: CGPoint(x: a.midX, y: a.midY))
                var path = Path()
                path.move(to: start); path.addLine(to: end)
                context.stroke(path, with: .color(line), style: StrokeStyle(lineWidth: 1.25, lineCap: .round, dash: e.dotted ? [4, 3] : []))
                let angle = atan2(end.y - start.y, end.x - start.x)
                var head = Path()
                head.move(to: CGPoint(x: end.x - 7 * cos(angle - .pi / 7), y: end.y - 7 * sin(angle - .pi / 7)))
                head.addLine(to: end)
                head.addLine(to: CGPoint(x: end.x - 7 * cos(angle + .pi / 7), y: end.y - 7 * sin(angle + .pi / 7)))
                context.stroke(head, with: .color(line), style: StrokeStyle(lineWidth: 1.25, lineCap: .round, lineJoin: .round))
                if let label = e.label {
                    let text = context.resolve(Text(label).font(.system(size: 11)).foregroundStyle(Color(.secondaryLabel)))
                    let s = text.measure(in: CGSize(width: 150, height: 60))
                    let mid = CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
                    // Beside an upright edge, above a level one.
                    let at = abs(end.y - start.y) > abs(end.x - start.x)
                        ? CGPoint(x: mid.x + (end.x < start.x ? -6 - s.width : 6), y: mid.y - s.height / 2)
                        : CGPoint(x: mid.x - s.width / 2, y: mid.y - s.height - 3)
                    context.draw(text, in: CGRect(origin: at, size: s))
                }
            }
            for p in layout.nodes {
                let r = p.frame
                let shape = p.node.shape == .round ? Path(roundedRect: r, cornerRadius: r.height / 2) : Path(roundedRect: r, cornerRadius: 8)
                let rating = p.node.rating.flatMap(Rating.init(rawValue:))
                context.fill(shape, with: .color(rating?.background ?? Color(.systemBackground)))
                context.stroke(shape, with: .color(rating?.ink ?? Color(.systemGray)), style: StrokeStyle(lineWidth: 1.5, dash: p.dashed ? [4, 3] : []))
                let text = context.resolve(Text(p.node.label).font(.system(size: 13, weight: .semibold)).foregroundStyle(rating?.ink ?? Color(.label)))
                let s = text.measure(in: CGSize(width: r.width - 20, height: r.height))
                context.draw(text, in: CGRect(x: r.midX - s.width / 2, y: r.midY - s.height / 2, width: s.width, height: s.height))
            }
        }
        .frame(height: max(layout.size.height, 1))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .accessibilityElement()
        .accessibilityLabel("Diagram: " + chart.nodes.map(\.label).joined(separator: ", "))
    }
}

// A conversation: the first speaker writes in, on the right; everyone else answers on the left, named.
struct ChatBlock: View {
    var lines: [ChatLine]
    var body: some View {
        let first = lines.first?.speaker
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(lines.enumerated()), id: \.offset) { n, line in
                let mine = line.speaker == first
                VStack(alignment: mine ? .trailing : .leading, spacing: 3) {
                    if !mine, n == 0 || lines[n - 1].speaker != line.speaker {
                        Text(line.speaker).font(.caption).foregroundStyle(.secondary).padding(.horizontal, 4)
                    }
                    Text(Inline.text(line.text)).font(.subheadline)
                        .foregroundStyle(mine ? Color.white : Color(.label))
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(mine ? Color(.darkGray) : Color(.systemBackground), in: UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: mine ? 16 : 4, bottomTrailingRadius: mine ? 4 : 16, topTrailingRadius: 16))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
                .padding(mine ? .leading : .trailing, 40)
            }
        }
    }
}

// A run of attached images as thumbnails, like attachments; tapping one opens the run full screen at it.
struct ImageStrip: View {
    var names: [String]
    @Environment(\.briefContext) private var context

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(Array(names.enumerated()), id: \.offset) { n, name in
                    Button { context.openImages(names, n) } label: {
                        AttachmentImage(name: name, thumbnail: 120)
                            .clipShape(.rect(cornerRadius: 10))
                            .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Color(.systemGray4), lineWidth: 0.5) }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("image-\(name)")
                }
            }
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
    }
}

// An image the agent attached, loaded with the phone key and kept in memory. As a thumbnail it is `thumbnail`
// points tall and fills a frame between 3:4 and 2:1.
struct AttachmentImage: View {
    var name: String
    var thumbnail: CGFloat?
    @Environment(\.briefContext) private var context
    @Environment(AppModel.self) private var model
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image, let h = thumbnail {
                Image(uiImage: image).resizable().scaledToFill()
                    .frame(width: min(max(h * image.size.width / max(image.size.height, 1), h * 0.75), h * 2), height: h)
                    .clipped()
            } else if let image {
                Image(uiImage: image).resizable().aspectRatio(contentMode: .fit)
            } else {
                Rectangle().fill(Color(.systemGray5))
                    .overlay { if failed { Image(systemName: "photo").foregroundStyle(.secondary) } else { ProgressView() } }
                    .frame(width: thumbnail.map { $0 * 0.75 }, height: thumbnail)
                    .aspectRatio(thumbnail == nil ? 1.6 : nil, contentMode: .fit)
            }
        }
        .accessibilityLabel(name)
        .task(id: context.decisionId + name) {
            do { image = Self.decode(try await model.attachment(context.agentId, context.decisionId, name)); failed = image == nil }
            catch { failed = true }
        }
    }
}

extension AttachmentImage {
    // Never decodes a full bitmap the header says is huge, and decodes at most a screen's worth of pixels.
    nonisolated static func decode(_ data: Data) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let w = props[kCGImagePropertyPixelWidth] as? Int, let h = props[kCGImagePropertyPixelHeight] as? Int,
              w > 0, h > 0, w <= 8192, h <= 8192, w * h <= 16_777_216 else { return nil }
        let options = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                       kCGImageSourceShouldCacheImmediately: true, kCGImageSourceThumbnailMaxPixelSize: 2400] as CFDictionary
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options).map { UIImage(cgImage: $0) }
    }
}

// A strip of images full screen, opened at the one tapped; swipe for the one before or after it.
struct FullScreenImageView: View {
    var image: FullScreenImage
    @State private var shown: Int
    @Environment(\.dismiss) private var dismiss

    init(image: FullScreenImage) {
        self.image = image
        _shown = State(initialValue: image.start)
    }

    var body: some View {
        NavigationStack {
            TabView(selection: $shown) {
                ForEach(Array(image.names.enumerated()), id: \.offset) { n, name in
                    AttachmentImage(name: name).padding().tag(n)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: image.names.count > 1 ? .always : .never))
            .indexViewStyle(.page(backgroundDisplayMode: .always))
            .environment(\.briefContext, BriefContext(agentId: image.agentId, decisionId: image.decisionId))
            .background(Color(.systemBackground))
            .accessibilityIdentifier("image-viewer")
            .navigationTitle(image.names.count > 1 ? "\(shown + 1) of \(image.names.count)" : "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button(role: .close) { dismiss() } } }
        }
    }
}

// A Markdown attachment, read like a page: its first heading is the title.
struct BriefPageView: View {
    var agentId: String
    var decision: Decision
    var name: String
    var openPage: (String) -> Void
    @Environment(AppModel.self) private var model
    @State private var blocks: [BriefBlock]?
    @State private var failed = false
    @State private var fullScreen: FullScreenImage?

    private var agent: String { model.agent(agentId)?.app ?? "your agent" }
    // The page's first heading is its title, in the sheet's bar.
    private var heading: String? { if case .heading(1, let t)? = blocks?.first { t } else { nil } }

    var body: some View {
        ScrollView {
            if let blocks {
                let body = heading == nil ? blocks : Array(blocks.dropFirst())
                VStack(alignment: .leading, spacing: 0) {
                    Text("Attached by \(agent) · \(minutes(blocks)) min read").font(.footnote).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 16)
                    BriefBlocksView(blocks: body)
                        .padding(.horizontal, 20).padding(.bottom, 24)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else if failed {
                ContentUnavailableView("Page Unavailable", systemImage: "doc", description: Text("This page is no longer on the server."))
            } else {
                ProgressView().padding(40)
            }
        }
        .background(Color(.systemBackground))
        .environment(\.briefContext, BriefContext(agentId: agentId, decisionId: decision.decisionId, openPage: openPage) { [agentId, decision] names, start in
            fullScreen = FullScreenImage(agentId: agentId, decisionId: decision.decisionId, names: names, start: start)
        })
        .environment(\.openURL, OpenURLAction { url in
            if url.scheme == nil { openPage(url.relativeString); return .handled }
            return url.scheme == "https" ? .systemAction : .discarded
        })
        .fullScreenCover(item: $fullScreen) { FullScreenImageView(image: $0) }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: name) {
            do { blocks = BriefMarkdown.parse(String(decoding: try await model.attachment(agentId, decision.decisionId, name), as: UTF8.self)) }
            catch { failed = true }
        }
    }

    private var title: String {
        if let heading { return heading }
        if name.lowercased().hasPrefix("background") { return "Background" }
        return "Notes"
    }
    private func minutes(_ blocks: [BriefBlock]) -> Int {
        let words = blocks.reduce(0) { n, b in
            switch b {
            case .paragraph(let t), .heading(_, let t): n + t.split(separator: " ").count
            case .list(_, let items): n + items.joined(separator: " ").split(separator: " ").count
            case .table(let h, let rows): n + (h + rows.flatMap { $0 }).count
            default: n
            }
        }
        return max(1, Int((Double(words) / 200).rounded()))
    }
}
