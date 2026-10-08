import Foundation

// The app's words: agents and their pagers, never sessions. Subtitles are "Status · time" everywhere.
enum Wording {
    static func remaining(until end: Date, now: Date) -> String {
        let seconds = max(0, end.timeIntervalSince(now))
        let minutes = Int(seconds / 60)
        if minutes < 60 { return "\(max(minutes, 0))m" }
        let hours = Int((seconds / 3600).rounded())
        if hours < 48 { return "\(hours)h" }
        return "\(Int((seconds / 86400).rounded()))d"
    }

    static func ago(_ date: Date, now: Date) -> String {
        let seconds = max(0, now.timeIntervalSince(date))
        if seconds < 60 { return "just now" }
        if seconds < 3600 { return "\(Int(seconds / 60))m ago" }
        if seconds < 86400 { return "\(Int(seconds / 3600))h ago" }
        return "\(Int(seconds / 86400))d ago"
    }

    static func subtitle(_ s: PagerSummary, now: Date) -> String {
        switch s.status {
        case .ended: return "Pager ended · " + ago(s.endedAt ?? now, now: now)
        case .unpaired, .waiting: return "Pager not paired · Ends in " + remaining(until: s.endsAt ?? now, now: now)
        case .active: return "Pager active · Ends in " + remaining(until: s.endsAt ?? now, now: now)
        }
    }

    static func exactEnd(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "MMM d 'at' h:mm a"
        return "Pager ends " + f.string(from: date)
    }

    static func time(_ date: Date) -> String {
        date.formatted(date: .omitted, time: .shortened)
    }

    // "Claude Code · blueprint" -> "Claude Code"
    static func shortName(_ name: String) -> String {
        name.components(separatedBy: " · ").first ?? name
    }

    // The pairing window is the pager's first 15 minutes, so a phone-made link has less left by the time its agent joins.
    static func pairingHint(until end: Date?, now: Date) -> String {
        guard let end else { return "Pair within 15 minutes, or this pager ends." }
        let minutes = max(1, Int((end.timeIntervalSince(now) / 60).rounded(.up)))
        return "Pair within \(minutes) minute\(minutes == 1 ? "" : "s"), or this pager ends."
    }
    static let lastTry = "Last try. If it’s wrong, this pager ends."
    static func wrong(_ triesLeft: Int) -> String {
        triesLeft == 1 ? lastTry : "Those don’t match. \(triesLeft) tries left."
    }
}
