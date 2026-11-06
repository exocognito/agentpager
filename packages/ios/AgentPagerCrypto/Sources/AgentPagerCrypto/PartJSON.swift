// JSON as JavaScript's JSON.parse reads it (RFC 8259, nothing more), for a part's plaintext. Not Foundation's
// JSONDecoder, which also takes trailing commas, compares field names by Unicode canonical equivalence (so
// "answer\u{212A}ey", with a Kelvin sign, is "answerKey" to it) and keeps the first of a repeated field where
// JavaScript keeps the last. What this refuses that JSON.parse takes, the contract's shapes refuse anyway: a field
// name outside ASCII (no shape has one, and every shape refuses a field it doesn't have), a field named twice (the
// contract's repeatsAField), a lone surrogate (every string field is well-formed text or ASCII), and nesting past 64
// (no shape nests past 4).

public struct PartJSON: Sendable {
    indirect enum Value: Sendable {
        case object([String: Value])
        case array([Value])
        case string(String)
        case number(Double)
        case bool(Bool)
        case null
    }
    let value: Value

    init(_ bytes: [UInt8]) throws(PartError) {
        var parser = Parser(bytes: bytes)
        value = try parser.document()
    }

    struct Parser {
        let bytes: [UInt8]
        var at = 0
        static let maxDepth = 64

        func fail(_ why: String) -> PartError { PartError("not JSON: \(why) at byte \(at)") }
        var next: UInt8? { at < bytes.count ? bytes[at] : nil }
        mutating func space() { while let b = next, b == 0x20 || b == 0x09 || b == 0x0A || b == 0x0D { at += 1 } }
        mutating func expect(_ c: Character) throws(PartError) {
            guard next == c.asciiValue else { throw fail("expected \(c)") }
            at += 1
        }

        mutating func document() throws(PartError) -> Value {
            let v = try value(depth: 0)
            space()
            guard at == bytes.count else { throw fail("text after the value") }
            return v
        }
        mutating func value(depth: Int) throws(PartError) -> Value {
            guard depth < Self.maxDepth else { throw fail("nested too deep") }
            space()
            guard let b = next else { throw fail("no value") }
            switch b {
            case UInt8(ascii: "{"): return try object(depth: depth)
            case UInt8(ascii: "["): return try array(depth: depth)
            case UInt8(ascii: "\""): return .string(try string())
            case UInt8(ascii: "t"): try word("true"); return .bool(true)
            case UInt8(ascii: "f"): try word("false"); return .bool(false)
            case UInt8(ascii: "n"): try word("null"); return .null
            case UInt8(ascii: "-"), UInt8(ascii: "0")...UInt8(ascii: "9"): return .number(try number())
            default: throw fail("no value")
            }
        }
        mutating func word(_ w: String) throws(PartError) {
            let w = Array(w.utf8)
            guard bytes.count - at >= w.count, Array(bytes[at..<(at + w.count)]) == w else { throw fail("not a literal") }
            at += w.count
        }
        mutating func object(depth: Int) throws(PartError) -> Value {
            at += 1
            var fields: [String: Value] = [:]
            space()
            if next == UInt8(ascii: "}") { at += 1; return .object(fields) }
            while true {
                space()
                guard next == UInt8(ascii: "\"") else { throw fail("expected a field name") }
                let name = try string()
                guard name.unicodeScalars.allSatisfy(\.isASCII) else { throw fail("a field name outside ASCII") }
                guard fields[name] == nil else { throw fail("the field \(name) named twice") }
                space()
                try expect(":")
                fields[name] = try value(depth: depth + 1)
                space()
                if next == UInt8(ascii: ",") { at += 1; continue }
                try expect("}")
                return .object(fields)
            }
        }
        mutating func array(depth: Int) throws(PartError) -> Value {
            at += 1
            var items: [Value] = []
            space()
            if next == UInt8(ascii: "]") { at += 1; return .array(items) }
            while true {
                items.append(try value(depth: depth + 1))
                space()
                if next == UInt8(ascii: ",") { at += 1; continue }
                try expect("]")
                return .array(items)
            }
        }
        mutating func hex4() throws(PartError) -> UInt32 {
            guard bytes.count - at >= 4, let n = UInt32(String(decoding: bytes[at..<(at + 4)], as: UTF8.self), radix: 16),
                  bytes[at..<(at + 4)].allSatisfy({ ($0 >= 0x30 && $0 <= 0x39) || ($0 | 0x20 >= 0x61 && $0 | 0x20 <= 0x66) }) else { throw fail("a bad \\u escape") }
            at += 4
            return n
        }
        // The bytes are valid UTF-8 (checked before parsing), so a raw scalar is read by its lead byte.
        mutating func string() throws(PartError) -> String {
            at += 1
            var out = String.UnicodeScalarView()
            while true {
                guard let b = next else { throw fail("a string never closed") }
                switch b {
                case UInt8(ascii: "\""):
                    at += 1
                    return String(out)
                case UInt8(ascii: "\\"):
                    at += 1
                    guard let e = next else { throw fail("a string never closed") }
                    at += 1
                    switch e {
                    case UInt8(ascii: "\""): out.append("\"")
                    case UInt8(ascii: "\\"): out.append("\\")
                    case UInt8(ascii: "/"): out.append("/")
                    case UInt8(ascii: "b"): out.append("\u{08}")
                    case UInt8(ascii: "f"): out.append("\u{0C}")
                    case UInt8(ascii: "n"): out.append("\n")
                    case UInt8(ascii: "r"): out.append("\r")
                    case UInt8(ascii: "t"): out.append("\t")
                    case UInt8(ascii: "u"):
                        let unit = try hex4()
                        if (0xD800...0xDBFF).contains(unit) {
                            guard bytes.count - at >= 2, bytes[at] == UInt8(ascii: "\\"), bytes[at + 1] == UInt8(ascii: "u") else { throw fail("a lone surrogate") }
                            at += 2
                            let low = try hex4()
                            guard (0xDC00...0xDFFF).contains(low), let s = Unicode.Scalar(0x10000 + ((unit - 0xD800) << 10) + (low - 0xDC00)) else { throw fail("a lone surrogate") }
                            out.append(s)
                        } else {
                            guard let s = Unicode.Scalar(unit) else { throw fail("a lone surrogate") }
                            out.append(s)
                        }
                    default: throw fail("a bad escape")
                    }
                case 0x00..<0x20:
                    throw fail("a control character in a string")
                default:
                    let length = b < 0x80 ? 1 : b < 0xE0 ? 2 : b < 0xF0 ? 3 : 4
                    guard bytes.count - at >= length else { throw fail("cut UTF-8") }
                    for s in String(decoding: bytes[at..<(at + length)], as: UTF8.self).unicodeScalars { out.append(s) }
                    at += length
                }
            }
        }
        // -?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?, read to the nearest double as JavaScript reads it.
        mutating func number() throws(PartError) -> Double {
            let start = at
            func digits(_ p: inout Parser) -> Int { var n = 0; while let b = p.next, b >= 0x30, b <= 0x39 { p.at += 1; n += 1 }; return n }
            if next == UInt8(ascii: "-") { at += 1 }
            if next == UInt8(ascii: "0") { at += 1 } else if digits(&self) == 0 { throw fail("a bad number") }
            if next == UInt8(ascii: ".") { at += 1; guard digits(&self) > 0 else { throw fail("a bad number") } }
            if next == UInt8(ascii: "e") || next == UInt8(ascii: "E") {
                at += 1
                if next == UInt8(ascii: "+") || next == UInt8(ascii: "-") { at += 1 }
                guard digits(&self) > 0 else { throw fail("a bad number") }
            }
            guard let d = Double(String(decoding: bytes[start..<at], as: UTF8.self)) else { throw fail("a bad number") }
            return d
        }
    }
}
