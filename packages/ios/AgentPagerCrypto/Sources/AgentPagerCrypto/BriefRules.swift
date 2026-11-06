// The brief's Markdown rules, ported from packages/contract/brief.ts (BriefMarkdown, briefProblem, missingAttachment)
// so the phone refuses exactly the cards the command refuses. They are read as JavaScript reads them: line by line
// on "\n" alone, with JavaScript's whitespace (\s and trim()) and its line terminators (what `.` doesn't match), over
// Unicode scalars, never Swift's characters, which would join "\r\n". The shared vectors pin the two together.

typealias Line = [Unicode.Scalar]

enum BriefRules {
    // What brief.ts's \s and trim() treat as whitespace, and what its `.` doesn't match.
    static func isSpace(_ s: Unicode.Scalar) -> Bool { jsWhitespace.contains(s.value) }
    static func isTerminator(_ s: Unicode.Scalar) -> Bool { [0x0A, 0x0D, 0x2028, 0x2029].contains(s.value) }
    static func isWordCharacter(_ s: Unicode.Scalar?) -> Bool {
        guard let s, s.isASCII else { return false }
        return s.properties.isAlphabetic || ("0"..."9").contains(s) || s == "_"
    }
    static func isUpper(_ s: Unicode.Scalar) -> Bool { ("A"..."Z").contains(s) }
    static func isLetter(_ s: Unicode.Scalar) -> Bool { s.isASCII && s.properties.isAlphabetic }

    static func trim(_ line: some Collection<Unicode.Scalar>) -> Line {
        Array(line.drop(while: isSpace).reversed().drop(while: isSpace).reversed())
    }
    static func lines(_ text: String) -> [Line] {
        Array(text.unicodeScalars).split(separator: "\n", omittingEmptySubsequences: false).map(Array.init)
    }
    static func string(_ line: some Sequence<Unicode.Scalar>) -> String {
        var s = String.UnicodeScalarView()
        s.append(contentsOf: line)
        return String(s)
    }
    static func run(_ line: Line, from: Int, of c: Unicode.Scalar) -> Int {
        var n = 0
        while from + n < line.count, line[from + n] == c { n += 1 }
        return n
    }

    // brief.ts withoutCodeSpans: a backslash before ASCII punctuation makes it text; a code span opens with a run of
    // backticks and closes at the next run of the same length; an unpaired run is literal; spans and escapes drop.
    static func withoutCodeSpans(_ line: Line) -> Line {
        var out: Line = [], at = 0
        while at < line.count {
            if line[at] == "\\", at + 1 < line.count, isPunctuation(line[at + 1]) { at += 2; continue }
            if line[at] != "`" { out.append(line[at]); at += 1; continue }
            let open = run(line, from: at, of: "`")
            var close = -1, i = at + open
            while i < line.count {
                guard let next = line[i...].firstIndex(of: "`") else { break }
                let r = run(line, from: next, of: "`")
                if r == open { close = next; break }
                i = next + r
            }
            if close < 0 { out.append(contentsOf: line[at..<(at + open)]); at += open; continue }
            at = close + open
        }
        return out
    }
    static func isPunctuation(_ s: Unicode.Scalar) -> Bool {
        ("!"..."/").contains(s) || (":"..."@").contains(s) || ("["..."`").contains(s) || ("{"..."~").contains(s)
    }

    // /^\s*(`{3,}|~{3,})/: the fence run, if the line opens or closes one.
    static func fence(_ line: Line) -> Line? {
        let start = line.firstIndex { !isSpace($0) } ?? line.count
        guard start < line.count, line[start] == "`" || line[start] == "~" else { return nil }
        let n = run(line, from: start, of: line[start])
        return n >= 3 ? Array(line[start..<(start + n)]) : nil
    }
    // /^(:{3,})([a-z]+)(?:[ \t]+(.*?))?\s*$/: the colons, the name and its argument (nil when there is none).
    static func containerOpen(_ line: Line) -> (colons: Int, name: String, argument: Line?)? {
        let colons = run(line, from: 0, of: ":")
        guard colons >= 3 else { return nil }
        var j = colons
        while j < line.count, ("a"..."z").contains(line[j]) { j += 1 }
        guard j > colons else { return nil }
        let name = string(line[colons..<j]), rest = Array(line[j...])
        if rest.allSatisfy(isSpace) { return (colons, name, rest.isEmpty ? nil : []) }
        guard let first = rest.first, first == " " || first == "\t" else { return nil }
        let k = rest.firstIndex { $0 != " " && $0 != "\t" } ?? rest.count
        var end = rest.count
        while end > k, isSpace(rest[end - 1]) { end -= 1 }
        let argument = Array(rest[k..<end])
        return argument.contains(where: isTerminator) ? nil : (colons, name, argument)
    }
    // /^(:{3,})\s*$/
    static func containerClose(_ line: Line) -> Int? {
        let colons = run(line, from: 0, of: ":")
        return colons >= 3 && line[colons...].allSatisfy(isSpace) ? colons : nil
    }

    // brief.ts proseLines: the lines that are prose, not fenced code. A fence closes on the same character, at least
    // as long, alone on its line; inside a :::chat block every line is chat, fence markers included.
    static func proseLines(_ markdown: String) -> [Line] {
        var out: [Line] = [], fence: Line? = nil, chat = 0
        for line in lines(markdown) {
            if chat > 0 { if containerClose(line) != nil { chat = 0 }; out.append(line); continue }
            let f = Self.fence(line)
            if let open = fence {
                if let f, f[0] == open[0], f.count >= open.count, trim(line) == f { fence = nil }
                continue
            }
            if f != nil { fence = f; continue }
            if let c = containerOpen(line), c.name == "chat" { chat = c.colons }
            out.append(line)
        }
        return out
    }

    // brief.ts targets: /(!?)\[[^\]]*\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g over each prose line without its code spans.
    static func targets(_ markdown: String) -> [(image: Bool, target: String)] {
        proseLines(markdown).flatMap { links(withoutCodeSpans($0)) }
    }
    static func links(_ line: Line) -> [(image: Bool, target: String)] {
        var found: [(Bool, String)] = [], p = 0
        while p < line.count {
            if let (image, target, end) = link(line, at: p) { found.append((image, target)); p = end } else { p += 1 }
        }
        return found
    }
    static func link(_ line: Line, at p: Int) -> (Bool, String, Int)? {
        var i = p, image = false
        if line[i] == "!", i + 1 < line.count, line[i + 1] == "[" { image = true; i += 1 }
        guard line[i] == "[", let close = line[(i + 1)...].firstIndex(of: "]"), close + 1 < line.count, line[close + 1] == "(" else { return nil }
        var j = close + 2
        while j < line.count, line[j] != ")", !isSpace(line[j]) { j += 1 }
        let target = string(line[(close + 2)..<j])
        guard j < line.count else { return nil }
        if line[j] == ")" { return (image, target, j + 1) }
        var k = j
        while k < line.count, isSpace(line[k]) { k += 1 }
        guard k < line.count, line[k] == "\"", let quote = line[(k + 1)...].firstIndex(of: "\""), quote + 1 < line.count, line[quote + 1] == ")" else { return nil }
        return (image, target, quote + 2)
    }

    // brief.ts BriefMarkdown: HTML is refused outside fenced code and code spans.
    static func htmlOutsideCode(_ markdown: String) -> Bool {
        proseLines(markdown).contains { line in
            let prose = withoutCodeSpans(line)
            return prose.indices.contains { prose[$0] == "<" && $0 + 1 < prose.count && (isLetter(prose[$0 + 1]) || "/!?".unicodeScalars.contains(prose[$0 + 1])) }
        }
    }

    // brief.ts missingAttachment: every image names an image attachment and every link a page attachment, except
    // that a link may go to an https address.
    static func missingAttachment(_ markdown: String, _ attachments: [String: String]) -> String? {
        for (image, target) in targets(markdown) {
            if let type = attachments[target] {
                if image == (type == "text/markdown") { return image ? "the image \"\(target)\" names a page" : "the link \"\(target)\" names an image" }
                continue
            }
            if !image && target.hasPrefix("https://") { continue }
            return image ? "the image \"\(target)\" is not an attachment" : "the link \"\(target)\" is neither an attachment nor an https link"
        }
        return nil
    }

    static func letter(_ number: Int) -> Unicode.Scalar { Unicode.Scalar(UInt8(64 + number)) }
    static func withoutStars(_ line: some Sequence<Unicode.Scalar>) -> Line { line.filter { $0 != "✶" && $0 != "*" } }
    // /^##\s+(.*?)\s*$/ and the rest after "##" and its spaces, or nil.
    static func heading(_ line: Line) -> Line? {
        guard line.count > 2, line[0] == "#", line[1] == "#", isSpace(line[2]) else { return nil }
        let start = line[2...].firstIndex { !isSpace($0) } ?? line.count
        var end = line.count
        while end > start, isSpace(line[end - 1]) { end -= 1 }
        let text = Array(line[start..<end])
        return text.contains(where: isTerminator) ? nil : text
    }
    // /^##\s+Recommendation\b:?\s*(.*?)\s*$/: what follows the word, or nil. Not the heading's own match: a line
    // terminator right after the colon leaves this one matching and the heading not.
    static func recommendation(_ line: Line) -> Line? {
        guard line.count > 2, line[0] == "#", line[1] == "#", isSpace(line[2]) else { return nil }
        let start = line[2...].firstIndex { !isSpace($0) } ?? line.count
        let word = Array("Recommendation".unicodeScalars)
        guard line[start...].starts(with: word) else { return nil }
        var i = start + word.count
        if isWordCharacter(i < line.count ? line[i] : nil) { return nil }
        if i < line.count, line[i] == ":" { i += 1 }
        let from = line[i...].firstIndex { !isSpace($0) } ?? line.count
        var end = line.count
        while end > from, isSpace(line[end - 1]) { end -= 1 }
        let text = Array(line[from..<end])
        return text.contains(where: isTerminator) ? nil : text
    }
    static func startsWord(_ text: Line, _ word: String) -> Bool {
        let w = Array(word.unicodeScalars)
        return text.starts(with: w) && !isWordCharacter(text.count > w.count ? text[w.count] : nil)
    }

    // brief.ts briefProblem: recommendation headings, option blocks and Tradeoffs columns name options; containers
    // close; there is an Options section.
    static func briefProblem(_ markdown: String, optionCount: Int, recommended: Int?) -> String? {
        let letters = Set((0..<optionCount).map { letter($0 + 1) })
        var blocks = Set<Unicode.Scalar>(), open: [Int] = []
        var section: Line = [], tradeoffsHeader = false, options = false
        for line in proseLines(markdown) {
            if let h = heading(line) { section = h; tradeoffsHeader = false; options = options || startsWord(h, "Options") }
            if let rest = recommendation(line) {
                let said = trim(withoutStars(rest))
                guard said.count == 1, isUpper(said[0]) else { return "write the recommendation heading as \"## Recommendation: <letter>\"" }
                guard let recommended else { return "the brief recommends \(said[0]): set card.recommended" }
                if said[0] != letter(recommended) { return "the recommendation heading doesn't match card.recommended" }
            }
            if let c = containerOpen(line) {
                open.append(c.colons)
                if c.name == "option" {
                    let argument = trim(c.argument ?? [])
                    guard argument.count == 1, letters.contains(argument[0]) else { return "an option block names no option" }
                    guard blocks.insert(argument[0]).inserted else { return "an option has two blocks" }
                }
                continue
            }
            if let colons = containerClose(line) {
                guard let last = open.last, colons >= last else { return "a closing line closes no block" }
                open.removeLast()
                continue
            }
            let trimmed = trim(line)
            if startsWord(section, "Tradeoffs"), !tradeoffsHeader, trimmed.first == "|" {
                tradeoffsHeader = true
                var row = trimmed
                if row.first == "|" { row.removeFirst() }
                if row.last == "|" { row.removeLast() }
                for cell in row.split(separator: "|", omittingEmptySubsequences: false).dropFirst().map({ withoutStars(trim($0)) }) {
                    guard let first = cell.first, isUpper(first), !(cell.count > 1 && isLetter(cell[1])), letters.contains(first) else { return "every Tradeoffs column starts with an option letter" }
                }
            }
        }
        if !open.isEmpty { return "a block is never closed" }
        if !options { return "a brief needs an Options section" }
        return nil
    }
}
