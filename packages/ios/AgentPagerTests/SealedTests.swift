import XCTest
import CryptoKit
import AgentPagerCrypto
@testable import AgentPager

// What the phone shows of a pager's read (Model/Sealed.swift), with no server: parts sealed here as an agent seals
// them, then handed to the phone as a server could hand them, honestly or not. This target compiles its own copy of
// Keychain.swift for the alert extension's tests, so the app's pager is named by its module.
typealias AppPager = AgentPager.LocalPager
final class SealedTests: XCTestCase {
    private let agentKey = Curve25519.KeyAgreement.PrivateKey()
    private let decisionId = String(repeating: "D", count: 32)
    private var answerKey: String { Envelope.base64url(agentKey.publicKey.rawRepresentation) }

    private func sealed(_ value: [String: Any], _ kind: PartKind, to pager: AppPager, _ at: PartContext) throws -> String {
        let key = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: pager.privateKey).publicKey
        return try Envelope.seal(to: key, kind: kind, context: at, plaintext: try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]))
    }
    // One agent with one open decision on this pager, every part sealed to its key and bound to it.
    private func read(of pager: AppPager, title: String, cardKey: String? = nil) throws -> SealedPagerInbox {
        let identity = try sealed(["app": "Codex", "project": "sealed", "answerKey": answerKey], .identity, to: pager, PartContext(pagerId: pager.pagerId))
        let card: [String: Any] = ["title": title, "card": ["type": "brief", "options": [["number": 1, "title": "One", "prioritizes": "speed"], ["number": 2, "title": "Two", "prioritizes": "care"]], "markdown": "## Options\n"], "answerKey": cardKey ?? answerKey]
        let now = Date()
        return SealedPagerInbox(
            pager: PagerState(pagerId: pager.pagerId, on: true, autoOff: .never, createdAt: now),
            agents: [SealedAgentInbox(
                agent: SealedAgent(agentId: String(repeating: "A", count: 32), identity: identity, createdAt: now, finishedAt: nil, lastActivityAt: now, openCount: 1),
                open: [SealedDecision(decisionId: decisionId, status: .open, card: try sealed(card, .card, to: pager, PartContext(pagerId: pager.pagerId, decisionId: decisionId)), attachments: [], askedAt: now)],
                answered: [])])
    }

    func test_B30_2_aReadOfAnotherPagerIsNeverShownAsThisPagers() throws {
        let a = AppPager.make(name: "A", server: "http://127.0.0.1:9"), b = AppPager.make(name: "B", server: "http://127.0.0.1:9")
        let readOfB = try read(of: b, title: "On pager B?")
        // Read as B's, it opens, which leaves B's parts among the opened ones.
        XCTAssertEqual(Sealed.inbox(readOfB, pager: b, answers: [:])?.agents.first?.open.first?.title, "On pager B?")
        // Handed back for A as it came, naming B: not A's read at all.
        XCTAssertNil(Sealed.inbox(readOfB, pager: a, answers: [:]))
        // Relabelled as A's: bound to A and opened with A's key, nothing of it opens.
        var relabelled = readOfB
        relabelled.pager.pagerId = a.pagerId
        let shown = try XCTUnwrap(Sealed.inbox(relabelled, pager: a, answers: [:]))
        XCTAssertTrue(shown.agents.allSatisfy { $0.agent.unreadable && $0.open.allSatisfy { (d: AgentPager.Decision) in d.unreadable } })
        XCTAssertFalse(shown.agents.flatMap { $0.open }.contains { $0.title == "On pager B?" })
    }

    // An attachment is fetched for the one pager whose read lists its decision. Two pagers listing the same agent and
    // decision, as only a server could make them, leave neither: one pager's attachment never shows for another's.
    @MainActor
    func test_B30_2_anAttachmentIsOnlyEverTheOnePagersThatListsItsDecision() throws {
        let model = AppModel(live: false)
        let a = AppPager.make(name: "A", server: model.server.absoluteString), b = AppPager.make(name: "B", server: model.server.absoluteString)
        model.pagers = [a, b]
        let readA = try XCTUnwrap(Sealed.inbox(try read(of: a, title: "On A?"), pager: a, answers: [:]))
        model.inboxes = [a.pagerId: readA]
        XCTAssertEqual(model.holder(String(repeating: "A", count: 32), decisionId)?.pagerId, a.pagerId)
        // B's read names the same agent and decision.
        model.inboxes[b.pagerId] = try XCTUnwrap(Sealed.inbox(try read(of: b, title: "On B?"), pager: b, answers: [:]))
        XCTAssertNil(model.holder(String(repeating: "A", count: 32), decisionId))
    }

    func test_B30_1_aCardNamingAnotherKeyThanItsAgentsIdentityIsOneThePhoneCantRead() throws {
        let a = AppPager.make(name: "A", server: "http://127.0.0.1:9")
        let other = Envelope.base64url(Curve25519.KeyAgreement.PrivateKey().publicKey.rawRepresentation)
        let own = try XCTUnwrap(Sealed.inbox(try read(of: a, title: "Its own key?"), pager: a, answers: [:])?.agents.first?.open.first)
        XCTAssertEqual([own.title, own.answerKey], ["Its own key?", answerKey])
        let foreign = try XCTUnwrap(Sealed.inbox(try read(of: a, title: "Another key?", cardKey: other), pager: a, answers: [:])?.agents.first?.open.first)
        XCTAssertTrue(foreign.unreadable)
        XCTAssertNotEqual(foreign.title, "Another key?")
    }
}
