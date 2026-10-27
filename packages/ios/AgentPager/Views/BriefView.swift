import SwiftUI
import UIKit
import ImageIO

// A decision brief (the canvas's headed template): the question with one "x ago", then Context, Options,
// Tradeoffs, Recommendation, Next steps and Small print, each folded by tapping its heading. Viewing an option
// never chooses it; the answer bar below does, with today's Undo window and acknowledgement.
struct BriefView: View {
    var sessionId: String
    var decision: Decision
    // The answer tile picked, while the decision is open; nil once it is answered.
    var picked: Binding<Int?>?
    var askForChanges: () -> Void = {}
    var openPage: (String) -> Void = { _ in }
    var send: (Int) -> Void = { _ in }
    // Shown above the sections once answered: your answer and your agent's reply.
    var answered: AnyView?

    @Environment(AppModel.self) private var model
    @State private var viewing = 1
    @State private var folded: Set<String> = ["smallprint"]
    @State private var document: BriefDocument
    @State private var fullScreen: FullScreenImage?

    init(sessionId: String, decision: Decision, picked: Binding<Int?>? = nil, askForChanges: @escaping () -> Void = {}, openPage: @escaping (String) -> Void = { _ in }, send: @escaping (Int) -> Void = { _ in }, answered: AnyView? = nil) {
        self.sessionId = sessionId
        self.decision = decision
        self.picked = picked
        self.askForChanges = askForChanges
        self.openPage = openPage
        self.send = send
        self.answered = answered
        _document = State(initialValue: BriefDocument(markdown: decision.card.markdown ?? ""))
        // Once answered, the brief opens on the option you sent.
        if case .option(let n)? = decision.answer?.choice { _viewing = State(initialValue: n) }
    }

    private var recommended: Option? { decision.card.recommended.flatMap(decision.option) }
    private var star: String? { recommended?.letter }
    private var context: BriefContext {
        BriefContext(sessionId: sessionId, decisionId: decision.decisionId, star: star, openPage: openPage) { [sessionId, decision] name in
            fullScreen = FullScreenImage(sessionId: sessionId, decisionId: decision.decisionId, name: name)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(decision.title).font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                    Text(Wording.ago(decision.askedAt, now: model.now)).font(.footnote).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 16)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("brief-header")

                VStack(alignment: .leading, spacing: 0) {
                    if let answered { answered.padding(.top, 16) }
                    ForEach(document.sections) { section in sectionView(section) }
                    if !document.smallPrint.isEmpty { smallPrint }
                }
                .padding(.horizontal, 20).padding(.bottom, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemBackground), in: UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20))
            }
        }
        .accessibilityIdentifier("brief-scroll")
        .background(Color(.systemGroupedBackground))
        .environment(\.briefContext, context)
        .environment(\.openURL, OpenURLAction { url in
            // An attachment opens as a page; only an https link leaves the app.
            if url.scheme == nil { openPage(url.relativeString); return .handled }
            return url.scheme == "https" ? .systemAction : .discarded
        })
        .safeAreaInset(edge: .bottom) { if let picked { answerBar(picked) } }
        .fullScreenCover(item: $fullScreen) { FullScreenImageView(image: $0) }
    }

    // MARK: Sections

    @ViewBuilder private func sectionView(_ s: BriefDocument.Section) -> some View {
        let key = "section-\(s.id)"
        let open = !folded.contains(key)
        VStack(alignment: .leading, spacing: 10) {
            if !s.title.isEmpty { FoldHeading(title: s.kind == .recommendation ? starred(s.title, letter: star) : s.title, open: open, id: key) { toggle(key) } }
            if open || s.title.isEmpty {
                if !s.blocks.isEmpty { BriefBlocksView(blocks: s.blocks, tradeoffs: s.kind == .tradeoffs) }
                if s.kind == .options { options }
            }
        }
        .padding(.top, s.id == 0 ? 16 : 18)
    }

    private func toggle(_ key: String) {
        withAnimation(.snappy(duration: 0.2)) { if folded.contains(key) { folded.remove(key) } else { folded.insert(key) } }
    }

    private var options: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(decision.card.options, id: \.number) { o in optionRow(o) }
            if let shown = decision.option(viewing), let block = document.options[shown.letter] {
                optionBlock(shown, block)
            }
        }
    }

    private func optionRow(_ o: Option) -> some View {
        let on = viewing == o.number
        return Button { viewing = o.number } label: {
            HStack(alignment: .center, spacing: 12) {
                if let thumb = document.options[o.letter]?.thumbnail {
                    AttachmentImage(name: thumb, fill: true)
                        .frame(width: 64, height: 44)
                        .clipShape(.rect(cornerRadius: 6))
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(o.letter). \(o.title)").font(.body.weight(on ? .semibold : .regular)).foregroundStyle(.primary)
                        Spacer(minLength: 0)
                        if o.number == decision.card.recommended {
                            Text("✶ Recommended").font(.footnote.weight(.semibold)).foregroundStyle(Color(.label)).fixedSize()
                        }
                    }
                    if let p = o.prioritizes { Text("Prioritizes \(p)").font(.footnote).foregroundStyle(.secondary) }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
            .background(Color(.systemGray6), in: .rect(cornerRadius: 14))
            // Viewing is a black ring, never blue: blue only means your own selection.
            .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(on ? Color(.label) : .clear, lineWidth: 1.5) }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier("option-row-\(o.letter)")
    }

    @ViewBuilder private func optionBlock(_ o: Option, _ block: BriefDocument.OptionBlock) -> some View {
        let name = o.letter + (o.letter == star ? "✶" : "")
        if !block.preview.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                let image = block.preview.lazy.compactMap(imageName).first
                if let caption = block.caption {
                    Text(starred(caption, letter: o.letter == star ? star : nil)).font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                } else if let image {
                    HStack {
                        (Text(name).fontWeight(.semibold) + Text(" ") + Text(o.label ?? o.title)).font(.footnote).foregroundStyle(.secondary)
                        Spacer()
                        Button { context.openImage(image) } label: {
                            Image(systemName: "arrow.up.left.and.arrow.down.right").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                                .frame(width: 32, height: 32).background(Color(.systemBackground), in: .circle)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Open full screen")
                    }
                }
                BriefBlocksView(blocks: block.preview, inPreview: true)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemGray6), in: .rect(cornerRadius: 12))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("option-preview-\(o.letter)")
        }
        if !block.changes.isEmpty {
            BriefBlocksView(blocks: block.changes.map { b in
                if case .heading(let level, let text) = b { return .heading(level: level, text: starred(text, letter: o.letter == star ? star : nil)) }
                return b
            })
            .padding(.top, 6)
        }
    }

    private func imageName(_ b: BriefBlock) -> String? { if case .image(_, let name) = b { name } else { nil } }

    private var smallPrint: some View {
        let open = !folded.contains("smallprint")
        return VStack(alignment: .leading, spacing: 6) {
            Divider().padding(.bottom, 2)
            Button { toggle("smallprint") } label: {
                HStack {
                    Text("Small print · \(document.smallPrintCount)").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                        .rotationEffect(.degrees(open ? 90 : 0))
                }
                .frame(minHeight: 44).contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fold-smallprint")
            .accessibilityValue(open ? "Open" : "Folded")
            if open { BriefBlocksView(blocks: document.smallPrint, small: true) }
        }
        .padding(.top, 18)
    }

    // MARK: Answer bar

    private func answerBar(_ picked: Binding<Int?>) -> some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                ForEach(decision.card.options, id: \.number) { o in
                    let on = picked.wrappedValue == o.number
                    Button { picked.wrappedValue = on ? nil : o.number } label: {
                        VStack(spacing: 2) {
                            Text(o.letter + (o.letter == star ? "✶" : "")).font(.body.weight(on ? .semibold : .regular))
                            Text(o.label ?? o.title).font(.caption).foregroundStyle(on ? Color.accentColor : .secondary)
                                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                        }
                        .foregroundStyle(on ? Color.accentColor : Color(.label))
                        .padding(.horizontal, 6).padding(.vertical, 8)
                        .frame(maxWidth: .infinity, minHeight: 60)
                        .background(on ? Color.accentColor.opacity(0.08) : Color(.systemGray6), in: .rect(cornerRadius: 14))
                        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(on ? Color.accentColor : .clear, lineWidth: 1.5) }
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Option \(o.letter): \(o.label ?? o.title)")
                    .accessibilityAddTraits(on ? .isSelected : [])
                    .accessibilityIdentifier("tile-\(o.letter)")
                }
            }
            if let n = picked.wrappedValue, let o = decision.option(n) {
                Button { send(n) } label: {
                    Text("Send option \(o.letter)").font(.headline).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Color.accentColor, in: .rect(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("send-option")
            } else {
                Button(action: askForChanges) {
                    Label("Ask for changes", systemImage: "text.bubble").font(.headline).foregroundStyle(Color.accentColor)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Color(.systemGray6), in: .rect(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("ask-for-changes")
            }
        }
        .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 8)
        .background(Color(.systemBackground))
        .overlay(alignment: .top) { Divider() }
    }
}

struct FoldHeading: View {
    var title: String
    var open: Bool
    var id: String
    var toggle: () -> Void
    var body: some View {
        Button(action: toggle) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title).font(.headline).foregroundStyle(Color(.label)).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                    .rotationEffect(.degrees(open ? 90 : 0))
            }
            .frame(minHeight: 44).contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isHeader)
        .accessibilityValue(open ? "Open" : "Folded")
        .accessibilityIdentifier("fold-\(title)")
    }
}

// What the blocks of one brief need: where their attachments come from, the recommended letter, and how to open a
// page or an image.
struct BriefContext {
    var sessionId = ""
    var decisionId = ""
    var star: String?
    var openPage: (String) -> Void = { _ in }
    var openImage: (String) -> Void = { _ in }
}
extension EnvironmentValues {
    @Entry var briefContext = BriefContext()
}

struct FullScreenImage: Identifiable, Hashable {
    var sessionId: String
    var decisionId: String
    var name: String
    var id: String { decisionId + "/" + name }
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
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in BlockView(block: block, tradeoffs: tradeoffs, inPreview: inPreview, small: small) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct BlockView: View {
    var block: BriefBlock
    var tradeoffs = false
    var inPreview = false
    var small = false
    @Environment(\.briefContext) private var context

    private var bodyFont: Font { small ? .footnote : inPreview ? .footnote : .subheadline }

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
            TableBlock(header: header, rows: rows, letters: tradeoffs, star: context.star)
        case .image(_, let name):
            AttachmentImage(name: name)
                .frame(maxWidth: .infinity)
                .clipShape(.rect(cornerRadius: 10))
                .onTapGesture { context.openImage(name) }
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
struct TableBlock: View {
    var header: [String]
    var rows: [[String]]
    var letters: Bool
    var star: String?

    private var columns: Int { max(header.count, rows.map(\.count).max() ?? 0) }
    private var labelWidth: CGFloat { columns <= 2 ? 150 : 96 }

    var body: some View {
        Grid(alignment: .topLeading, horizontalSpacing: 3, verticalSpacing: 3) {
            if header.contains(where: { !$0.isEmpty }) {
                GridRow {
                    ForEach(0..<columns, id: \.self) { c in
                        headerCell(c < header.count ? header[c] : "", first: c == 0)
                    }
                }
            }
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                GridRow {
                    ForEach(0..<columns, id: \.self) { c in
                        let cell = c < row.count ? row[c] : ""
                        if c == 0 {
                            Text(Inline.text(cell)).font(.footnote.weight(.semibold)).foregroundStyle(Color(.label))
                                .frame(width: labelWidth, alignment: .leading).padding(.vertical, 8)
                        } else { valueCell(cell) }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func headerCell(_ text: String, first: Bool) -> some View {
        if first {
            Text(Inline.text(text)).font(.footnote).foregroundStyle(.secondary).frame(width: labelWidth, alignment: .leading)
        } else if letters, let m = text.firstMatch(of: /^([A-Z])✶?(?![A-Za-z])\s*(.*)$/) {
            let l = String(m.1)
            (Text(l + (l == star ? "✶" : "")).fontWeight(.semibold).foregroundStyle(Color(.label)) + Text(m.2.isEmpty ? "" : " " + m.2).foregroundStyle(.secondary))
                .font(.footnote).padding(.horizontal, 8).padding(.vertical, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Text(Inline.text(text)).font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                .padding(.horizontal, 8).padding(.vertical, 2).frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder private func valueCell(_ cell: String) -> some View {
        if let (rating, text) = Inline.rated(cell) {
            Text(Inline.markdown(text)).font(.footnote.weight(.semibold)).foregroundStyle(rating.ink)
                .padding(8).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(rating.background, in: .rect(cornerRadius: 8))
        } else {
            Text(Inline.text(cell)).font(.footnote).foregroundStyle(Color(.label))
                .padding(8).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
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

// An image the agent attached, loaded with the phone key and kept in memory.
struct AttachmentImage: View {
    var name: String
    var fill = false
    @Environment(\.briefContext) private var context
    @Environment(AppModel.self) private var model
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image).resizable().aspectRatio(contentMode: fill ? .fill : .fit)
            } else {
                Rectangle().fill(Color(.systemGray5))
                    .overlay { if failed { Image(systemName: "photo").foregroundStyle(.secondary) } else { ProgressView() } }
                    .aspectRatio(fill ? nil : 1.6, contentMode: .fit)
            }
        }
        .accessibilityLabel(name)
        .task(id: context.decisionId + name) {
            do { image = Self.decode(try await model.attachment(context.sessionId, context.decisionId, name)); failed = image == nil }
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

struct FullScreenImageView: View {
    var image: FullScreenImage
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            AttachmentImage(name: image.name)
                .environment(\.briefContext, BriefContext(sessionId: image.sessionId, decisionId: image.decisionId))
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemBackground))
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button(role: .close) { dismiss() } } }
                .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// A Markdown attachment, read like a page: its first heading is the title.
struct BriefPageView: View {
    var sessionId: String
    var decision: Decision
    var name: String
    var openPage: (String) -> Void
    @Environment(AppModel.self) private var model
    @State private var blocks: [BriefBlock]?
    @State private var failed = false
    @State private var fullScreen: FullScreenImage?

    private var agent: String { Wording.shortName(model.inboxes[sessionId]?.session.name ?? "your agent") }

    var body: some View {
        ScrollView {
            if let blocks {
                let titled: (String?, [BriefBlock]) = if case .heading(1, let t)? = blocks.first { (t, Array(blocks.dropFirst())) } else { (nil, blocks) }
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 4) {
                        if let t = titled.0 { Text(Inline.text(t)).font(.title3.weight(.semibold)) }
                        Text("Attached by \(agent) · \(minutes(blocks)) min read").font(.footnote).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 16)
                    BriefBlocksView(blocks: titled.1)
                        .padding(.horizontal, 20).padding(.vertical, 18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.systemBackground), in: UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20))
                }
            } else if failed {
                ContentUnavailableView("Page Unavailable", systemImage: "doc", description: Text("This page is no longer on the server."))
            } else {
                ProgressView().padding(40)
            }
        }
        .background(Color(.systemGroupedBackground))
        .environment(\.briefContext, BriefContext(sessionId: sessionId, decisionId: decision.decisionId, openPage: openPage) { [sessionId, decision] name in
            fullScreen = FullScreenImage(sessionId: sessionId, decisionId: decision.decisionId, name: name)
        })
        .environment(\.openURL, OpenURLAction { url in
            if url.scheme == nil { openPage(url.relativeString); return .handled }
            return url.scheme == "https" ? .systemAction : .discarded
        })
        .fullScreenCover(item: $fullScreen) { FullScreenImageView(image: $0) }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: name) {
            do { blocks = BriefMarkdown.parse(String(decoding: try await model.attachment(sessionId, decision.decisionId, name), as: UTF8.self)) }
            catch { failed = true }
        }
    }

    private var title: String {
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
