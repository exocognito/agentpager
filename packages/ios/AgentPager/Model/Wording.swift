import Foundation

// The app's words: pagers, agents and decisions, never sessions. A pager is active or off; the verb is "turn off".
enum Wording {
    static func remaining(until end: Date, now: Date) -> String {
        let seconds = max(0, end.timeIntervalSince(now))
        let minutes = Int(seconds / 60)
        if minutes < 60 { return "\(max(minutes, 1))m" }
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

    // "Active · Stays on", "Active · Turns off in 18h", "Off since yesterday".
    static func status(_ s: PagerState, now: Date) -> String {
        if s.on { return s.offAt.map { "Active · Turns off in " + remaining(until: $0, now: now) } ?? "Active · Stays on" }
        guard let since = s.offSince else { return "Off" }
        let calendar = Calendar.current
        if calendar.isDateInToday(since) { return "Off since " + time(since) }
        if calendar.isDateInYesterday(since) { return "Off since yesterday" }
        return "Off since " + since.formatted(.dateTime.month(.abbreviated).day())
    }

    static func time(_ date: Date) -> String {
        date.formatted(date: .omitted, time: .shortened)
    }

    // "8:39 AM", "yesterday, 8:39 AM", "Oct 27, 8:39 AM".
    static func when(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return time(date) }
        if calendar.isDateInYesterday(date) { return "yesterday, " + time(date) }
        return date.formatted(.dateTime.month(.abbreviated).day()) + ", " + time(date)
    }

    // An answer no agent has read in time: who, where and on what, so the owner knows which agent to go to.
    static func notPickedUp(_ agent: AgentInfo) -> String {
        "\(agent.app)\(agent.machine.map { " on " + $0 } ?? "") (\(agent.project)) hasn’t picked up your answer. It may be asleep, closed or disconnected: check in with it directly."
    }

    static func capitalized(_ text: String) -> String { text.prefix(1).uppercased() + text.dropFirst() }
}
