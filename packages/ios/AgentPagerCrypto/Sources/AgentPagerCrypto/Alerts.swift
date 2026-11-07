import CryptoKit
import Foundation

// The phone's side of packages/contract/alerts.ts: what an alert's payload carries, and the words the alert
// extension shows once it opens the alert's preview with the pager's key. Both pass
// packages/contract/vectors/alerts.json. When the preview can't be read, the alert shows as sent: the service's
// plain words, which say only what kind of alert it is.

public enum AlertKind: String, CaseIterable, Sendable {
    case decision, acknowledgement, warning

    // Which kind of encrypted part the alert's preview is. The warning that no agent picked up an answer carries that
    // decision's own preview again.
    public var previewKind: PartKind { self == .acknowledgement ? .acknowledgementPreview : .decisionPreview }

    // The service's plain words for this kind, which show when the phone can't read the alert.
    public var plainBody: String {
        switch self {
        case .decision: "New decision"
        case .acknowledgement: "New acknowledgement"
        case .warning: "Answer not picked up"
        }
    }
}

public struct AlertWords: Hashable, Sendable {
    public var title: String
    public var body: String
    public init(title: String, body: String) {
        self.title = title
        self.body = body
    }
}

// AgentPager's keys at the top level of an alert's payload, beside Apple's `aps`. Nil when the kind, pager, agent or
// decision is missing, isn't a string or the kind isn't known; the preview is nil when the alert has none, as the
// service's alerts from before encryption don't, or when it isn't a string.
public struct AlertFields: Hashable, Sendable {
    public static let keys = ["kind", "pagerId", "agentId", "decisionId", "preview"]
    public var kind: AlertKind
    public var pagerId: String
    public var agentId: String
    public var decisionId: String
    public var preview: String?

    public init?(_ userInfo: [AnyHashable: Any]) {
        guard let kind = (userInfo["kind"] as? String).flatMap(AlertKind.init(rawValue:)),
              let pagerId = userInfo["pagerId"] as? String, let agentId = userInfo["agentId"] as? String,
              let decisionId = userInfo["decisionId"] as? String else { return nil }
        self.kind = kind
        self.pagerId = pagerId
        self.agentId = agentId
        self.decisionId = decisionId
        preview = userInfo["preview"] as? String
    }
}

public enum Alerts {
    public static let plainTitle = "AgentPager"
    public static let pickupMinutes = 3
    public static let decisionBodyMax = 600

    // The title: who asked and the project.
    public static func title(app: String, project: String) -> String { "\(app) · \(project)" }

    // A decision's body: the question, then its detail and the recommended option, which show when the alert is
    // expanded. Cut to 600 code points, as JavaScript's Array.from counts them, the last one "…".
    public static func decisionBody(title: String, detail: String?, recommended: RecommendedPart?) -> String {
        let lines = [title, detail, recommended.map { "Recommended: \($0.letter). \($0.title)" }].compactMap { $0 }.filter { !$0.isEmpty }
        let scalars = Array(lines.joined(separator: "\n").unicodeScalars)
        guard scalars.count > decisionBodyMax else { return String(String.UnicodeScalarView(scalars)) }
        return String(String.UnicodeScalarView(scalars[0..<(decisionBodyMax - 1)])) + "…"
    }

    // The warning that no agent has collected an answer: who, where and what.
    public static func pickupBody(app: String, project: String, machine: String?, title: String) -> String {
        let agent = "\(app)\(machine.map { $0.isEmpty ? "" : " on \($0)" } ?? "") (\(project))"
        return "\(agent) hasn’t picked up your answer to “\(title)” after \(pickupMinutes) min. AgentPager can’t reach it: it may be asleep, closed or disconnected. Check in with it directly."
    }

    public static func decisionWords(_ p: DecisionPreviewPart) -> AlertWords {
        AlertWords(title: title(app: p.app, project: p.project), body: decisionBody(title: p.title, detail: p.detail, recommended: p.recommended))
    }
    public static func warningWords(_ p: DecisionPreviewPart) -> AlertWords {
        AlertWords(title: title(app: p.app, project: p.project), body: pickupBody(app: p.app, project: p.project, machine: p.machine, title: p.title))
    }
    public static func acknowledgementWords(_ p: AcknowledgementPreviewPart) -> AlertWords {
        AlertWords(title: title(app: p.app, project: p.project), body: p.nextSteps)
    }

    // The words for an alert: its preview opened with the key of the pager it names, under the alert's kind, pager
    // and decision, then read as its kind's shape. Nil when there is no preview, or it doesn't open or isn't that
    // shape: then the alert shows as sent. Nothing of a preview that fails is returned.
    public static func read(_ alert: AlertFields, with key: Curve25519.KeyAgreement.PrivateKey) -> AlertWords? {
        guard let preview = alert.preview else { return nil }
        let context = PartContext(pagerId: alert.pagerId, decisionId: alert.decisionId)
        guard let bytes = try? Envelope.open(preview, with: key, kind: alert.kind.previewKind, context: context) else { return nil }
        switch alert.kind {
        case .decision: return (try? Parts.decode(DecisionPreviewPart.self, from: bytes)).map(decisionWords)
        case .warning: return (try? Parts.decode(DecisionPreviewPart.self, from: bytes)).map(warningWords)
        case .acknowledgement: return (try? Parts.decode(AcknowledgementPreviewPart.self, from: bytes)).map(acknowledgementWords)
        }
    }
}
