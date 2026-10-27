import Foundation

// A decision brief's Markdown (the Kit), parsed into the blocks the phone draws. The server has already refused
// HTML, letters that name no option and links to missing attachments; anything else renders as plain Markdown.
nonisolated struct ChatLine: Hashable, Sendable { var speaker: String; var text: String }

nonisolated indirect enum BriefBlock: Hashable, Sendable {
    case heading(level: Int, text: String)
    case paragraph(String)
    case list(ordered: Bool, items: [String])
    case code(language: String, title: String?, lines: [String])
    case table(header: [String], rows: [[String]])
    case image(alt: String, name: String)
    // A line that is only a link: "Read more background ›".
    case link(text: String, target: String)
    case chat([ChatLine])
    case container(kind: String, argument: String, blocks: [BriefBlock])
    case rule
}

nonisolated enum BriefMarkdown {
    static func parse(_ text: String) -> [BriefBlock] {
        var parser = Parser(lines: text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n"))
        return parser.blocks(closing: nil)
    }

    private struct Parser {
        var lines: [String]
        var i = 0

        // Blocks until the line that closes a container opened with `closing` colons, or the end.
        mutating func blocks(closing: Int?) -> [BriefBlock] {
            var out: [BriefBlock] = []
            var paragraph: [String] = []
            func flush() { if !paragraph.isEmpty { out.append(.paragraph(paragraph.joined(separator: " "))); paragraph = [] } }
            while i < lines.count {
                let line = lines[i]
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                if let n = colons(trimmed), trimmed.count == n {
                    i += 1
                    if closing != nil { flush(); return out }
                    continue
                }
                if trimmed.isEmpty { flush(); i += 1; continue }
                if let fence = fence(trimmed) { flush(); out.append(code(fence, info: String(trimmed.dropFirst(fence.count)))); continue }
                if let n = colons(trimmed), let open = trimmed.wholeMatch(of: /:{3,}([a-z]+)(?:[ \t]+(.*?))?\s*/) {
                    flush(); i += 1
                    let kind = String(open.1), argument = open.2.map { String($0).trimmingCharacters(in: .whitespaces) } ?? ""
                    out.append(kind == "chat" ? .chat(chat()) : .container(kind: kind, argument: argument, blocks: blocks(closing: n)))
                    continue
                }
                if let h = trimmed.wholeMatch(of: /(#{1,6})\s+(.*)/) { flush(); out.append(.heading(level: h.1.count, text: String(h.2))); i += 1; continue }
                if trimmed.hasPrefix("|") { flush(); out.append(table()); continue }
                if let m = trimmed.wholeMatch(of: /!\[([^\]]*)\]\(([^)\s]+)\)/) { flush(); out.append(.image(alt: String(m.1), name: String(m.2))); i += 1; continue }
                if let m = trimmed.wholeMatch(of: /\[([^\]]+)\]\(([^)\s]+)\)/) { flush(); out.append(.link(text: String(m.1), target: String(m.2))); i += 1; continue }
                if trimmed.wholeMatch(of: /(-{3,}|\*{3,}|_{3,})/) != nil { flush(); out.append(.rule); i += 1; continue }
                if let ordered = listMarker(line) { flush(); out.append(list(ordered: ordered)); continue }
                // A fixed lead-in ("**Why:**") starts its own paragraph, even on the next line.
                if trimmed.firstMatch(of: /^\*\*[^*]+:\*\*/) != nil { flush() }
                paragraph.append(trimmed)
                i += 1
            }
            flush()
            return out
        }

        func colons(_ s: String) -> Int? {
            let n = s.prefix { $0 == ":" }.count
            return n >= 3 ? n : nil
        }
        func fence(_ s: String) -> String? {
            guard let c = s.first, c == "`" || c == "~" else { return nil }
            let run = s.prefix { $0 == c }
            return run.count >= 3 ? String(run) : nil
        }
        // nil: not a list item; true: "1." or "1)"; false: "-", "*" or "+".
        func listMarker(_ line: String) -> Bool? {
            let t = line.trimmingCharacters(in: .whitespaces)
            if t.firstMatch(of: /^[-*+]\s+/) != nil { return false }
            if t.firstMatch(of: /^\d+[.)]\s+/) != nil { return true }
            return nil
        }

        mutating func code(_ fence: String, info: String) -> BriefBlock {
            let words = info.trimmingCharacters(in: .whitespaces).split(separator: " ", maxSplits: 1).map(String.init)
            i += 1
            var body: [String] = []
            while i < lines.count {
                let t = lines[i].trimmingCharacters(in: .whitespaces)
                if t.first == fence.first, t.allSatisfy({ $0 == fence.first }), t.count >= fence.count { i += 1; break }
                body.append(lines[i])
                i += 1
            }
            return .code(language: words.first?.lowercased() ?? "", title: words.count > 1 ? words[1] : nil, lines: body)
        }

        // "speaker: text", one line each, until the closing fence.
        mutating func chat() -> [ChatLine] {
            var out: [ChatLine] = []
            while i < lines.count {
                let t = lines[i].trimmingCharacters(in: .whitespaces)
                i += 1
                if let n = colons(t), t.count == n { break }
                guard !t.isEmpty else { continue }
                if let colon = t.firstIndex(of: ":") {
                    out.append(ChatLine(speaker: String(t[..<colon]).trimmingCharacters(in: .whitespaces), text: String(t[t.index(after: colon)...]).trimmingCharacters(in: .whitespaces)))
                } else if !out.isEmpty {
                    out[out.count - 1].text += " " + t
                }
            }
            return out
        }

        mutating func table() -> BriefBlock {
            var rows: [[String]] = []
            while i < lines.count, lines[i].trimmingCharacters(in: .whitespaces).hasPrefix("|") {
                let t = lines[i].trimmingCharacters(in: .whitespaces)
                i += 1
                if t.wholeMatch(of: /\|?(\s*:?-+:?\s*\|)+\s*:?-*:?\s*\|?/) != nil { continue }
                var cells = t.split(separator: "|", omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) }
                if cells.first == "" { cells.removeFirst() }
                if cells.last == "" { cells.removeLast() }
                rows.append(cells)
            }
            guard let header = rows.first else { return .table(header: [], rows: []) }
            return .table(header: header, rows: Array(rows.dropFirst()))
        }

        mutating func list(ordered: Bool) -> BriefBlock {
            var items: [String] = []
            while i < lines.count {
                let line = lines[i]
                if let o = listMarker(line), o == ordered {
                    let t = line.trimmingCharacters(in: .whitespaces)
                    items.append(String(t.trimmingPrefix(/[-*+]\s+|\d+[.)]\s+/)))
                } else if !items.isEmpty, line.hasPrefix("  "), !line.trimmingCharacters(in: .whitespaces).isEmpty {
                    items[items.count - 1] += " " + line.trimmingCharacters(in: .whitespaces)
                } else { break }
                i += 1
            }
            return .list(ordered: ordered, items: items)
        }
    }
}

// The brief as the template draws it: the `##` sections in order, each option's block, and the small print.
nonisolated struct BriefDocument: Sendable {
    enum Kind: Sendable { case context, options, tradeoffs, recommendation, nextSteps, other }
    struct Section: Identifiable, Sendable {
        var id: Int
        var title: String
        var kind: Kind
        var blocks: [BriefBlock]
    }
    struct OptionBlock: Sendable {
        var caption: String?
        var preview: [BriefBlock]
        var changes: [BriefBlock]
    }

    var sections: [Section] = []
    var options: [String: OptionBlock] = [:]
    var smallPrint: [BriefBlock] = []

    init(markdown: String) {
        var current = Section(id: 0, title: "", kind: .other, blocks: [])
        func close() { if !current.title.isEmpty || !current.blocks.isEmpty { sections.append(current) } }
        for block in BriefMarkdown.parse(markdown) {
            switch block {
            case .heading(2, let text):
                close()
                current = Section(id: sections.count + 1, title: text, kind: Self.kind(text), blocks: [])
            case .container("option", let letter, let blocks):
                options[letter] = Self.option(blocks)
            case .container("smallprint", _, let blocks):
                smallPrint += blocks
            default:
                current.blocks.append(block)
            }
        }
        close()
    }

    // The main screen's sections: Tradeoffs shows as "Decision Options" and takes in anything written under
    // Options outside its option blocks; the option blocks themselves open on the Options screen. A brief with
    // no Tradeoffs shows its Options heading as "Decision Options" instead.
    var screen: [Section] {
        let intro = sections.first { $0.kind == .options }?.blocks ?? []
        let tradeoffs = sections.first { $0.kind == .tradeoffs }?.id
        return sections.compactMap { s in
            switch s.kind {
            case .options: tradeoffs == nil ? Section(id: s.id, title: "Decision Options", kind: .tradeoffs, blocks: s.blocks) : nil
            case .tradeoffs: Section(id: s.id, title: "Decision Options", kind: .tradeoffs, blocks: s.id == tradeoffs ? intro + s.blocks : s.blocks)
            default: s
            }
        }
    }

    // Small print counts its list items, or its paragraphs when it has no list.
    var smallPrintCount: Int {
        let items = smallPrint.reduce(0) { n, b in if case .list(_, let items) = b { n + items.count } else { n } }
        return items > 0 ? items : smallPrint.count
    }

    static func kind(_ title: String) -> Kind {
        let t = title.lowercased()
        if t.hasPrefix("context") { return .context }
        if t.hasPrefix("options") { return .options }
        if t.hasPrefix("tradeoffs") { return .tradeoffs }
        if t.hasPrefix("recommendation") { return .recommendation }
        if t.hasPrefix("next steps") { return .nextSteps }
        return .other
    }

    // What an option looks like comes before its "What X changes" heading; a heading that opens the block
    // captions the preview.
    static func option(_ blocks: [BriefBlock]) -> OptionBlock {
        let split = blocks.firstIndex { if case .heading(_, let t) = $0 { t.lowercased().hasPrefix("what ") && t.lowercased().hasSuffix("changes") } else { false } } ?? blocks.endIndex
        var preview = Array(blocks[..<split])
        var caption: String?
        if case .heading(_, let t)? = preview.first { caption = t; preview.removeFirst() }
        return OptionBlock(caption: caption, preview: preview, changes: Array(blocks[split...]))
    }
}

// ✶ marks the recommended option wherever its letter stands alone after the first word: "What B changes" reads
// "What B ✶ changes".
nonisolated func starred(_ text: String, letter: String?) -> String {
    guard let letter, !text.contains("\(letter)✶"), !text.contains("\(letter) ✶") else { return text }
    var words = text.components(separatedBy: " ")
    for (n, word) in words.enumerated() where n > 0 {
        let bare = word.trimmingCharacters(in: CharacterSet(charactersIn: ".,:;"))
        if bare == letter { words[n] = word.replacingOccurrences(of: letter, with: "\(letter) ✶"); break }
    }
    return words.joined(separator: " ")
}

// The recommendation heading teaches the star where it first appears: "Recommendation: B" reads
// "Recommendation (✶): B".
nonisolated func recommendationTitle(_ text: String, letter: String?) -> String {
    guard let letter, let m = text.wholeMatch(of: /(\w+)\s*:\s*([A-Z])\s*✶?(?![A-Za-z])(.*)/), String(m.2) == letter else { return text }
    return "\(m.1) (✶): \(letter)\(m.3)"
}
