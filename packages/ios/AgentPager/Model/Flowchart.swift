import Foundation
import UIKit

// The Mermaid flowchart subset a brief draws on the phone: `flowchart TD|LR` (or `graph`), nodes written `Id`,
// `Id[Label]`, `Id(Label)`, `Id{Label}` or `Id((Label))`, chained with `-->`, `---`, `-.->` or `==>`, edge labels as
// `-->|label|` or `-- label -->`, and a rating class as `:::green` or `class A,B green`. Anything else is not
// drawn: the source shows instead, so nothing is hidden.
nonisolated struct Flowchart: Sendable {
    enum Shape: Sendable { case box, round, decision }
    struct Node: Sendable { var id: String; var label: String; var shape: Shape; var rating: String? }
    struct Edge: Sendable { var from: Int; var to: Int; var label: String?; var dotted: Bool }

    var across: Bool
    var nodes: [Node] = []
    var edges: [Edge] = []

    static let ratings: Set<String> = ["green", "yellow", "orange", "red"]

    static func parse(_ lines: [String]) -> Flowchart? {
        let statements = lines.flatMap { $0.split(separator: ";").map { $0.trimmingCharacters(in: .whitespaces) } }.filter { !$0.isEmpty && !$0.hasPrefix("%%") }
        guard let head = statements.first?.wholeMatch(of: /(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/) else { return nil }
        var chart = Flowchart(across: head.1 == "LR" || head.1 == "RL")
        for statement in statements.dropFirst() {
            if statement.hasPrefix("classDef") || statement.hasPrefix("style") || statement.hasPrefix("linkStyle") || statement.hasPrefix("click") { continue }
            if statement.hasPrefix("subgraph") || statement == "end" || statement.hasPrefix("direction") { continue }
            if let c = statement.wholeMatch(of: /class\s+([A-Za-z0-9_,\s]+?)\s+([a-z]+)/) {
                for id in c.1.split(separator: ",").map({ $0.trimmingCharacters(in: .whitespaces) }) {
                    if let n = chart.nodes.firstIndex(where: { $0.id == id }), ratings.contains(String(c.2)) { chart.nodes[n].rating = String(c.2) }
                }
                continue
            }
            guard chart.chain(statement) else { return nil }
        }
        return chart.nodes.isEmpty || chart.nodes.count > 30 ? nil : chart
    }

    // One statement: a node, then any number of edge-and-node pairs.
    private mutating func chain(_ statement: String) -> Bool {
        var rest = Substring(statement)
        guard var from = node(&rest) else { return false }
        while !rest.trimmingCharacters(in: .whitespaces).isEmpty {
            guard let (label, dotted) = edge(&rest), let to = node(&rest) else { return false }
            edges.append(Edge(from: from, to: to, label: label, dotted: dotted))
            from = to
        }
        return true
    }

    private mutating func node(_ rest: inout Substring) -> Int? {
        rest = rest.drop { $0 == " " }
        guard let m = rest.prefixMatch(of: /([A-Za-z0-9_]+)(?:\(\((.*?)\)\)|\(\[(.*?)\]\)|\[(.*?)\]|\((.*?)\)|\{(.*?)\})?(?::::([a-z]+))?/) else { return nil }
        rest = rest[m.range.upperBound...]
        let id = String(m.1)
        let shape: Shape = m.6 != nil ? .decision : (m.2 != nil || m.3 != nil || m.5 != nil) ? .round : .box
        let written = [m.2, m.3, m.4, m.5, m.6].compactMap { $0 }.first.map { Self.clean(String($0)) }
        let rating = m.7.map(String.init).flatMap { Self.ratings.contains($0) ? $0 : nil }
        if let n = nodes.firstIndex(where: { $0.id == id }) {
            if let written { nodes[n].label = written; nodes[n].shape = shape }
            if let rating { nodes[n].rating = rating }
            return n
        }
        nodes.append(Node(id: id, label: written ?? id, shape: shape, rating: rating))
        return nodes.count - 1
    }

    private func edge(_ rest: inout Substring) -> (String?, Bool)? {
        rest = rest.drop { $0 == " " }
        if let m = rest.prefixMatch(of: /(-->|---|-\.->|-\.-|==>|===)\s*(?:\|([^|]*)\|)?/) {
            rest = rest[m.range.upperBound...]
            return (m.2.map { Self.clean(String($0)) }, m.1.contains("."))
        }
        if let m = rest.prefixMatch(of: /(--|-\.|==)\s+(.+?)\s+(-->|\.->|==>|---)/) {
            rest = rest[m.range.upperBound...]
            return (Self.clean(String(m.2)), m.1 == "-.")
        }
        return nil
    }

    private static func clean(_ s: String) -> String {
        var t = s.trimmingCharacters(in: .whitespaces)
        if t.count >= 2, t.hasPrefix("\""), t.hasSuffix("\"") { t = String(t.dropFirst().dropLast()) }
        return t.replacing(/<br\s*\/?>/, with: "\n")
    }
}

// Where each node and edge goes at a given width: nodes in ranks by their longest path from a start, top to
// bottom (or left to right when the chart asks and it fits).
nonisolated struct FlowchartLayout: Sendable {
    struct Placed: Sendable { var frame: CGRect; var node: Flowchart.Node; var dashed: Bool }
    var nodes: [Placed] = []
    var size: CGSize = .zero

    static let font = UIFont.systemFont(ofSize: 13, weight: .semibold)
    static let labelFont = UIFont.systemFont(ofSize: 11)
    private static let gap: CGFloat = 14

    init(_ chart: Flowchart, width: CGFloat) {
        guard width > 40 else { return }
        let n = chart.nodes.count
        var rank = Array(repeating: 0, count: n)
        for _ in 0..<n {
            var moved = false
            for e in chart.edges where e.from != e.to && rank[e.to] < rank[e.from] + 1 && rank[e.from] + 1 < n {
                rank[e.to] = rank[e.from] + 1; moved = true
            }
            if !moved { break }
        }
        var ranks: [[Int]] = Array(repeating: [], count: (rank.max() ?? 0) + 1)
        for i in 0..<n { ranks[rank[i]].append(i) }
        // Order each rank by where its parents sit, so edges cross less.
        for r in ranks.indices.dropFirst() {
            let above = ranks[r - 1]
            func weight(_ i: Int) -> Double {
                let parents = chart.edges.filter { $0.to == i }.compactMap { above.firstIndex(of: $0.from) }
                return parents.isEmpty ? Double(above.count) : Double(parents.reduce(0, +)) / Double(parents.count)
            }
            ranks[r] = ranks[r].enumerated().sorted { (weight($0.element), $0.offset) < (weight($1.element), $1.offset) }.map(\.element)
        }
        let dashed = (0..<n).map { i in let into = chart.edges.filter { $0.to == i }; return !into.isEmpty && into.allSatisfy(\.dotted) }
        func measure(_ i: Int, max: CGFloat) -> CGSize {
            let text = (chart.nodes[i].label as NSString).boundingRect(with: CGSize(width: max - 24, height: 400), options: [.usesLineFragmentOrigin], attributes: [.font: Self.font], context: nil)
            return CGSize(width: min(max, ceil(text.width) + 24), height: Swift.max(32, ceil(text.height) + 14))
        }

        if chart.across {
            let widest = ranks.map { $0.map { measure($0, max: 150).width }.max() ?? 0 }
            let total = widest.reduce(0, +) + CGFloat(ranks.count - 1) * 40
            if total <= width {
                var x = (width - total) / 2, frames = [CGRect](repeating: .zero, count: n)
                let columns = ranks.map { r in r.map { measure($0, max: 150) } }
                let tallest = columns.map { c in c.reduce(0) { $0 + $1.height } + CGFloat(max(0, c.count - 1)) * Self.gap }.max() ?? 0
                for (c, r) in ranks.enumerated() {
                    var y = (tallest - (columns[c].reduce(0) { $0 + $1.height } + CGFloat(max(0, r.count - 1)) * Self.gap)) / 2
                    for (k, i) in r.enumerated() {
                        let s = columns[c][k]
                        frames[i] = CGRect(x: x + (widest[c] - s.width) / 2, y: y + 14, width: s.width, height: s.height)
                        y += s.height + Self.gap
                    }
                    x += widest[c] + 40
                }
                nodes = (0..<n).map { Placed(frame: frames[$0], node: chart.nodes[$0], dashed: dashed[$0]) }
                size = CGSize(width: width, height: tallest + 28)
                return
            }
        }

        var frames = [CGRect](repeating: .zero, count: n), y: CGFloat = 0
        for (r, row) in ranks.enumerated() {
            let cap = min(170, (width - CGFloat(row.count - 1) * Self.gap) / CGFloat(max(row.count, 1)))
            let sizes = row.map { measure($0, max: cap) }
            let total = sizes.reduce(0) { $0 + $1.width } + CGFloat(row.count - 1) * Self.gap
            // A row sits under the middle of its parents when it can.
            let parents = row.flatMap { i in chart.edges.filter { $0.to == i && rank[$0.from] < r }.map { frames[$0.from].midX } }
            let middle = parents.isEmpty ? width / 2 : parents.reduce(0, +) / CGFloat(parents.count)
            var x = min(max(0, middle - total / 2), width - total)
            if r > 0 {
                let labelled = chart.edges.contains { rank[$0.to] == r && $0.label != nil }
                y += labelled ? 34 : 24
            }
            let height = sizes.map(\.height).max() ?? 32
            for (k, i) in row.enumerated() {
                frames[i] = CGRect(x: x, y: y + (height - sizes[k].height) / 2, width: sizes[k].width, height: sizes[k].height)
                x += sizes[k].width + Self.gap
            }
            y += height
        }
        nodes = (0..<n).map { Placed(frame: frames[$0], node: chart.nodes[$0], dashed: dashed[$0]) }
        size = CGSize(width: width, height: y)
    }
}

// Where a line from the middle of `a` toward `b` leaves `a`'s box.
nonisolated func boxExit(_ a: CGRect, toward b: CGPoint) -> CGPoint {
    let c = CGPoint(x: a.midX, y: a.midY), dx = b.x - c.x, dy = b.y - c.y
    guard dx != 0 || dy != 0 else { return c }
    let sx = dx == 0 ? CGFloat.infinity : (a.width / 2) / abs(dx)
    let sy = dy == 0 ? CGFloat.infinity : (a.height / 2) / abs(dy)
    let s = min(sx, sy)
    return CGPoint(x: c.x + dx * s, y: c.y + dy * s)
}
