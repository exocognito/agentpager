import Foundation
import CryptoKit
import Security
import AgentPagerCrypto

// The phone's end of end-to-end encryption (B30, blueprint/areas/6-privacy.md). It opens what the server holds with
// the pager's private key, which never leaves this phone, into what the screens draw, and seals each answer to the key
// inside the card it answers, never to one the server hands it. The format and each part's shape are AgentPagerCrypto's,
// pinned to packages/contract/vectors/envelope.json.
//
// A part that doesn't open, or opens to something that isn't its kind's shape, is never shown in part (I4.9): a
// decision with such a card or acknowledgement, or whose agent's identity won't open, shows as one this phone can't
// read, with nothing of it and nothing to answer. So does a card that names another key than its agent's identity
// does: the server can seal a card to the pager's key as anyone can, but not with the agent's key in it, which it
// never sees, so an answer the phone seals reaches only that agent. So does an agent whose identity names another key
// than the one it first named (Pins, below). And so does an answered decision whose answer isn't exactly one this
// phone sent, since only the agent can open what the phone sent.

// An answer this phone sent, by the request id it went with: the choice, and the part it sealed, which the server
// must hand back unchanged for the phone to show the choice as the answer.
nonisolated struct SentAnswer: Codable, Hashable, Sendable {
    var pagerId: String
    var decisionId: String
    var choice: Choice
    var sealed: String
}

nonisolated enum Sealed {
    // Opened parts, by the key that opened them, kind, binding and part: each part never changes, so it is opened once.
    private static let cache = OpenedParts()

    // A pager's read, opened with this phone's key for that pager and bound to its id as the phone holds it, never the
    // id the server's reply names. A reply that names another pager isn't this pager's read: nil.
    static func inbox(_ sealed: SealedPagerInbox, pager: LocalPager, answers: [String: SentAnswer], pins: Pins) -> PagerInbox? {
        guard sealed.pager.pagerId == pager.pagerId else { return nil }
        guard let key = try? Curve25519.KeyAgreement.PrivateKey(rawRepresentation: pager.privateKey) else {
            return PagerInbox(pager: sealed.pager, agents: sealed.agents.map { unreadableAgent($0) })
        }
        let pagerId = pager.pagerId
        return PagerInbox(pager: sealed.pager, agents: sealed.agents.map { a in
            guard let identity: IdentityPart = open(a.agent.identity, key, .identity, PartContext(pagerId: pagerId)),
                  pins.keep(identity.answerKey, pagerId: pagerId, agentId: a.agent.agentId) == identity.answerKey else { return unreadableAgent(a) }
            let agent = AgentInfo(agentId: a.agent.agentId, app: identity.app, project: identity.project, machine: identity.machine,
                                  createdAt: a.agent.createdAt, finishedAt: a.agent.finishedAt, lastActivityAt: a.agent.lastActivityAt, openCount: a.agent.openCount)
            return AgentInbox(agent: agent, open: a.open.map { decision($0, key, pagerId, identity.answerKey, answers) }, answered: a.answered.map { decision($0, key, pagerId, identity.answerKey, answers) })
        })
    }

    private static func decision(_ d: SealedDecision, _ key: Curve25519.KeyAgreement.PrivateKey, _ pagerId: String, _ agentKey: String, _ answers: [String: SentAnswer]) -> Decision {
        let at = PartContext(pagerId: pagerId, decisionId: d.decisionId)
        guard let card: CardPart = open(d.card, key, .card, at), card.answerKey == agentKey else { return unreadable(d) }
        // The card names each attachment, the server only how many and how big: they must agree.
        let entries = card.attachments ?? []
        guard entries.count == d.attachments.count else { return unreadable(d) }
        var answer: Answer?
        if let a = d.answer {
            guard let sent = answers[a.requestId], sent.decisionId == d.decisionId, sent.pagerId == pagerId, sent.sealed == a.answer else { return unreadable(d) }
            answer = Answer(answerId: a.answerId, decisionId: d.decisionId, choice: sent.choice, sentAt: a.sentAt)
        }
        var acknowledgement: Acknowledgement?
        if let k = d.acknowledgement {
            guard let ack: AcknowledgementPart = open(k.acknowledgement, key, .acknowledgement, at) else { return unreadable(d) }
            acknowledgement = Acknowledgement(decisionId: d.decisionId, answerId: k.answerId, nextSteps: ack.nextSteps, acknowledgedAt: k.acknowledgedAt)
        }
        let status: DecisionStatus
        if case .feedback? = answer?.choice { status = .feedback }
        else if answer == nil { status = .open }
        else { status = acknowledgement == nil ? .answered : .acknowledged }
        let options = card.card.options.map { Option(number: $0.number, title: $0.title, label: $0.label, prioritizes: $0.prioritizes) }
        return Decision(decisionId: d.decisionId, status: status, title: card.title, detail: card.detail,
                        card: Card(type: "brief", options: options, recommended: card.card.recommended, markdown: card.card.markdown),
                        attachments: entries.isEmpty ? nil : zip(entries, d.attachments).map { AttachmentInfo(name: $0.name, type: $0.type, bytes: $1.bytes) },
                        askedAt: d.askedAt, answer: answer, collectedAt: d.collectedAt, warnedAt: d.warnedAt, acknowledgement: acknowledgement,
                        closed: closed(d), answerKey: card.answerKey)
    }

    // Nothing of it: no question, no options, no answer to show or give. What the server knows stays, so the phone
    // still knows whether it is open, when it came and whether an agent read its answer.
    private static func unreadable(_ d: SealedDecision) -> Decision {
        Decision(decisionId: d.decisionId, status: d.status == .open ? .open : d.status == .acknowledged ? .acknowledged : .answered,
                 title: Wording.unreadableDecision, card: Card(type: "brief", options: [], recommended: nil, markdown: nil), askedAt: d.askedAt,
                 answer: d.answer.map { Answer(answerId: $0.answerId, decisionId: d.decisionId, choice: .feedback(""), sentAt: $0.sentAt) },
                 collectedAt: d.collectedAt, warnedAt: d.warnedAt, closed: closed(d), unreadable: true)
    }
    // Only a decision with no answer closes unanswered: one the service sends with an answer too shows as answered.
    private static func closed(_ d: SealedDecision) -> Closed? { d.status == .open ? d.closed : nil }
    private static func unreadableAgent(_ a: SealedAgentInbox) -> AgentInbox {
        let agent = AgentInfo(agentId: a.agent.agentId, app: Wording.unreadableAgent, project: Wording.unreadableProject, machine: nil, createdAt: a.agent.createdAt,
                              finishedAt: a.agent.finishedAt, lastActivityAt: a.agent.lastActivityAt, openCount: a.agent.openCount, unreadable: true)
        return AgentInbox(agent: agent, open: a.open.map(unreadable), answered: a.answered.map(unreadable))
    }

    private static func open<P: Part>(_ part: String, _ key: Curve25519.KeyAgreement.PrivateKey, _ kind: PartKind, _ at: PartContext) -> P? {
        let hex = { (data: Data) in data.map { String(format: "%02x", $0) }.joined() }
        let id = "\(hex(key.publicKey.rawRepresentation)) \(kind.rawValue) \(at.pagerId) \(at.decisionId ?? "") " + hex(Data(SHA256.hash(data: Data(part.utf8))))
        if let hit = cache.get(id) { return hit as? P }
        let opened: P?
        do { opened = try Parts.decode(P.self, from: try Envelope.open(part, with: key, kind: kind, context: at)) } catch { opened = nil }
        cache.set(id, opened as (any Sendable)?)
        return opened
    }

    // One attachment's bytes, opened from its part with the pager's key and bound to its decision and slot. Nil when
    // it doesn't open: the brief then shows it as one it couldn't load.
    static func attachment(_ part: Data, pager: LocalPager, decisionId: String, slot: Int) -> Data? {
        guard let text = String(data: part, encoding: .utf8), let key = try? Curve25519.KeyAgreement.PrivateKey(rawRepresentation: pager.privateKey) else { return nil }
        return try? Envelope.open(text, with: key, kind: .attachment, context: PartContext(pagerId: pager.pagerId, decisionId: decisionId, index: slot))
    }

    // The owner's answer, sealed to the key inside the card it answers and bound to its pager and decision.
    static func answer(_ choice: Choice, to answerKey: String, pagerId: String, decisionId: String) -> String? {
        guard let raw = Envelope.fromBase64url(answerKey), let key = try? Curve25519.KeyAgreement.PublicKey(rawRepresentation: raw) else { return nil }
        let chosen: ChoicePart = switch choice {
        case .option(let n): .option(n)
        case .feedback(let text): .feedback(text)
        }
        let part = AnswerPart(choice: chosen)
        return try? Envelope.seal(to: key, kind: .answer, context: PartContext(pagerId: pagerId, decisionId: decisionId), plaintext: part.encoded())
    }
}

// The key each agent first named, by pager and agent id (B30.3, blueprint/areas/6-privacy.md). Anyone can seal to a
// pager, the service included, so a service could replace an agent's identity with one naming a key of its own and
// show its own cards in that agent's place. An agent's identity is written once, at connect (packages/app/src/agent.ts),
// so the phone keeps the key named by the first of an agent's identities that opens, and takes the agent as readable
// only while its identity names that key. An identity that doesn't open never reaches here, so it pins nothing.
// Pins are kept in the Keychain with their pager (Keychain.swift › Kept), so neither a relaunch nor a reinstall resets
// them, and they go only with it. A pin is only ever added: the Keychain refuses a second for the same agent, and
// whatever it holds is the pin, so two reads racing to pin agree on the one that was stored first.
nonisolated final class Pins: @unchecked Sendable {
    private let lock = NSLock()
    // Pins read or made this run, by pager and agent id. A pin never changes, so it is read once.
    private var known: [String: [String: String]] = [:]

    // The key pinned for this agent: the one it first named, which is this one when none was pinned before. Nil when
    // the Keychain can't keep or read it: the phone can't tell, so it shows the agent as one it can't read.
    func keep(_ answerKey: String, pagerId: String, agentId: String) -> String? {
        lock.withLock {
            if let pinned = known[pagerId]?[agentId] { return pinned }
            let added = Keychain.add(.pins, pagerId: pagerId, account: agentId, data: Data(answerKey.utf8))
            guard added == errSecSuccess || added == errSecDuplicateItem,
                  let data = Keychain.record(.pins, pagerId: pagerId, account: agentId), let pinned = String(data: data, encoding: .utf8) else { return nil }
            known[pagerId, default: [:]][agentId] = pinned
            return pinned
        }
    }

    // The pager is gone: Keychain.delete took its pins.
    func forget(_ pagerId: String) {
        lock.withLock { known[pagerId] = nil }
    }
}

// The opened parts, shared by the polls: a lock, since the extension and the app both run Sealed off the main actor.
nonisolated final class OpenedParts: @unchecked Sendable {
    private let lock = NSLock()
    private var parts: [String: (any Sendable)?] = [:]
    func get(_ id: String) -> (any Sendable)?? { lock.withLock { parts[id] } }
    func set(_ id: String, _ value: (any Sendable)?) {
        lock.withLock {
            // Old reads go once there are many; a decision's parts are opened again if it comes back.
            if parts.count > 4000 { parts.removeAll() }
            parts[id] = value
        }
    }
}
