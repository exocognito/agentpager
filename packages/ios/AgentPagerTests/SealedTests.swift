import XCTest
import CryptoKit
import Security
import AgentPagerCrypto
@testable import AgentPager

// What the phone shows of a pager's read (Model/Sealed.swift), with no server: parts sealed here as an agent seals
// them, then handed to the phone as a server could hand them, honestly or not. This target compiles its own copy of
// Keychain.swift for the alert extension's tests, so the app's pager is named by its module.
// What the phone keeps with each pager, its pins and its answers, is in the app's own Keychain, as the app keeps it:
// these run inside the app. Their pagers name a server the app never polls, and go in tearDown with all they kept.
typealias AppPager = AgentPager.LocalPager
typealias AppKeychain = AgentPager.Keychain
final class SealedTests: XCTestCase {
    private let agentKey = Curve25519.KeyAgreement.PrivateKey()
    private let agentId = String(repeating: "A", count: 32)
    private let decisionId = String(repeating: "D", count: 32)
    private var answerKey: String { Envelope.base64url(agentKey.publicKey.rawRepresentation) }
    private let pins = Pins()
    private var made: [String] = []

    override func tearDown() {
        for pagerId in made { AppKeychain.delete(pagerId) }
        made = []
    }

    private func pager(_ name: String, server: String = "http://127.0.0.1:9") -> AppPager {
        let p = AppPager.make(name: name, server: server)
        made.append(p.pagerId)
        return p
    }
    private func otherKey() -> String { Envelope.base64url(Curve25519.KeyAgreement.PrivateKey().publicKey.rawRepresentation) }

    private func sealed(_ value: [String: Any], _ kind: PartKind, to pager: AppPager, _ at: PartContext) throws -> String {
        let key = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: pager.privateKey).publicKey
        return try Envelope.seal(to: key, kind: kind, context: at, plaintext: try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]))
    }
    // One agent with one open decision on this pager, every part sealed to its key and bound to it. Its identity names
    // the agent's own key unless told another.
    private func read(of pager: AppPager, title: String, cardKey: String? = nil, identityKey: String? = nil, identity: [String: Any]? = nil) throws -> SealedPagerInbox {
        let identity = try sealed(identity ?? ["app": "Codex", "project": "sealed", "answerKey": identityKey ?? answerKey], .identity, to: pager, PartContext(pagerId: pager.pagerId))
        let card: [String: Any] = ["title": title, "card": ["type": "brief", "options": [["number": 1, "title": "One", "prioritizes": "speed"], ["number": 2, "title": "Two", "prioritizes": "care"]], "markdown": "## Options\n"], "answerKey": cardKey ?? answerKey]
        let now = Date()
        return SealedPagerInbox(
            pager: PagerState(pagerId: pager.pagerId, on: true, autoOff: .never, createdAt: now),
            agents: [SealedAgentInbox(
                agent: SealedAgent(agentId: agentId, identity: identity, createdAt: now, finishedAt: nil, lastActivityAt: now, openCount: 1),
                open: [SealedDecision(decisionId: decisionId, status: .open, card: try sealed(card, .card, to: pager, PartContext(pagerId: pager.pagerId, decisionId: decisionId)), attachments: [], askedAt: now)],
                answered: [])])
    }

    func test_B30_2_aReadOfAnotherPagerIsNeverShownAsThisPagers() throws {
        let a = pager("A"), b = pager("B")
        let readOfB = try read(of: b, title: "On pager B?")
        // Read as B's, it opens, which leaves B's parts among the opened ones.
        XCTAssertEqual(Sealed.inbox(readOfB, pager: b, answers: [:], pins: pins)?.agents.first?.open.first?.title, "On pager B?")
        // Handed back for A as it came, naming B: not A's read at all.
        XCTAssertNil(Sealed.inbox(readOfB, pager: a, answers: [:], pins: pins))
        // Relabelled as A's: bound to A and opened with A's key, nothing of it opens.
        var relabelled = readOfB
        relabelled.pager.pagerId = a.pagerId
        let shown = try XCTUnwrap(Sealed.inbox(relabelled, pager: a, answers: [:], pins: pins))
        XCTAssertTrue(shown.agents.allSatisfy { $0.agent.unreadable && $0.open.allSatisfy { (d: AgentPager.Decision) in d.unreadable } })
        XCTAssertFalse(shown.agents.flatMap { $0.open }.contains { $0.title == "On pager B?" })
    }

    // An attachment is fetched for the one pager whose read lists its decision. Two pagers listing the same agent and
    // decision, as only a server could make them, leave neither: one pager's attachment never shows for another's.
    @MainActor
    func test_B30_2_anAttachmentIsOnlyEverTheOnePagersThatListsItsDecision() throws {
        let model = AppModel(live: false)
        let a = pager("A", server: model.server.absoluteString), b = pager("B", server: model.server.absoluteString)
        model.pagers = [a, b]
        let readA = try XCTUnwrap(Sealed.inbox(try read(of: a, title: "On A?"), pager: a, answers: [:], pins: pins))
        model.inboxes = [a.pagerId: readA]
        XCTAssertEqual(model.holder(agentId, decisionId)?.pagerId, a.pagerId)
        // B's read names the same agent and decision.
        model.inboxes[b.pagerId] = try XCTUnwrap(Sealed.inbox(try read(of: b, title: "On B?"), pager: b, answers: [:], pins: pins))
        XCTAssertNil(model.holder(agentId, decisionId))
    }

    func test_B30_1_aCardNamingAnotherKeyThanItsAgentsIdentityIsOneThePhoneCantRead() throws {
        let a = pager("A")
        let other = otherKey()
        let own = try XCTUnwrap(Sealed.inbox(try read(of: a, title: "Its own key?"), pager: a, answers: [:], pins: pins)?.agents.first?.open.first)
        XCTAssertEqual([own.title, own.answerKey], ["Its own key?", answerKey])
        let foreign = try XCTUnwrap(Sealed.inbox(try read(of: a, title: "Another key?", cardKey: other), pager: a, answers: [:], pins: pins)?.agents.first?.open.first)
        XCTAssertTrue(foreign.unreadable)
        XCTAssertNotEqual(foreign.title, "Another key?")
    }

    // MARK: B30.3 · the key each agent first names

    private func pinned(_ pager: AppPager) -> String? {
        AppKeychain.record(.pins, pagerId: pager.pagerId, account: agentId).flatMap { String(data: $0, encoding: .utf8) }
    }

    // The service replaces an agent's who-asked with one naming a key of its own, and seals its own card naming that
    // key, as anyone can seal to the pager. The phone shows that agent and its decision as ones it can't read, with
    // nothing to answer, and the pin stays: after a relaunch or a reinstall too, with nothing in memory, since it is
    // read back from the Keychain; and the agent's own who-asked still reads.
    @MainActor
    func test_B30_3_anAgentWhoseWhoAskedLaterNamesAnotherKeyShowsAsOneThePhoneCantRead() throws {
        let a = pager("A", server: AppModel(live: false).server.absoluteString)
        let first = try XCTUnwrap(Sealed.inbox(try read(of: a, title: "Its own key?"), pager: a, answers: [:], pins: pins)?.agents.first)
        XCTAssertFalse(first.agent.unreadable)
        XCTAssertEqual([first.agent.app, first.open.first?.title], ["Codex", "Its own key?"])
        XCTAssertEqual(pinned(a), answerKey)

        let other = otherKey()
        let replaced = try read(of: a, title: "The service's own?", cardKey: other, identityKey: other)
        for kept in [pins, Pins()] {
            let shown = try XCTUnwrap(Sealed.inbox(replaced, pager: a, answers: [:], pins: kept))
            let agent = try XCTUnwrap(shown.agents.first)
            XCTAssertTrue(agent.agent.unreadable)
            XCTAssertNotEqual(agent.agent.app, "Codex")
            let d = try XCTUnwrap(agent.open.first)
            XCTAssertTrue(d.unreadable)
            XCTAssertNotEqual(d.title, "The service's own?")
            XCTAssertTrue(d.card.options.isEmpty)
            XCTAssertEqual(d.answerKey, "")

            // Nothing to answer: Send sends nothing.
            let model = AppModel(live: false)
            model.pagers = [a]
            model.inboxes = [a.pagerId: shown]
            model.send(pagerId: a.pagerId, agentId: agentId, decisionId: decisionId, choice: .option(1))
            XCTAssertNil(model.undo)
            XCTAssertTrue(model.inFlight.isEmpty)
        }
        XCTAssertEqual(pinned(a), answerKey, "a pin is never replaced")
        let again = try XCTUnwrap(Sealed.inbox(try read(of: a, title: "Its own key again?"), pager: a, answers: [:], pins: Pins())?.agents.first)
        XCTAssertFalse(again.agent.unreadable)
        XCTAssertEqual(again.open.first?.title, "Its own key again?")
    }

    // An identity that doesn't open, or opens to something that isn't an identity, pins nothing: the first of the
    // agent's identities that does is the one it keeps.
    func test_B30_3_anIdentityThatDoesntOpenPinsNothing() throws {
        let a = pager("A"), b = pager("B")
        var foreign = try read(of: b, title: "Sealed to B?", identityKey: otherKey())
        foreign.pager.pagerId = a.pagerId
        let notAnIdentity = try read(of: a, title: "No key in it?", identity: ["app": "Codex", "project": "sealed"])
        for read in [foreign, notAnIdentity] {
            let agent = try XCTUnwrap(Sealed.inbox(read, pager: a, answers: [:], pins: pins)?.agents.first)
            XCTAssertTrue(agent.agent.unreadable)
            XCTAssertNil(pinned(a))
        }
        let real = try XCTUnwrap(Sealed.inbox(try read(of: a, title: "The real one?"), pager: a, answers: [:], pins: pins)?.agents.first)
        XCTAssertFalse(real.agent.unreadable)
        XCTAssertEqual(real.open.first?.title, "The real one?")
        XCTAssertEqual(pinned(a), answerKey)
    }

    // Pins are kept by pager and agent: the same agent id on two pagers, naming two keys, reads on each. Dropping a
    // pager, as Delete and a pager the service no longer knows do, takes its pins and leaves the other's.
    @MainActor
    func test_B30_3_eachPagerKeepsItsOwnPinsAndTheyGoWithIt() throws {
        let model = AppModel(live: false)
        let a = pager("A", server: model.server.absoluteString), b = pager("B", server: model.server.absoluteString)
        let keyB = otherKey()
        XCTAssertEqual(Sealed.inbox(try read(of: a, title: "On A?"), pager: a, answers: [:], pins: pins)?.agents.first?.open.first?.title, "On A?")
        XCTAssertEqual(Sealed.inbox(try read(of: b, title: "On B?", cardKey: keyB, identityKey: keyB), pager: b, answers: [:], pins: pins)?.agents.first?.open.first?.title, "On B?")
        XCTAssertEqual([pinned(a), pinned(b)], [answerKey, keyB])
        model.pagers = [a, b]
        model.drop(a.pagerId)
        XCTAssertEqual(AppKeychain.records(.pins, pagerId: a.pagerId), [:])
        XCTAssertEqual(pinned(b), keyB)
    }

    // A read that comes back after its pager went, as a poll started before Delete can, is dropped unopened: it shows
    // nothing and pins nothing, so no pin outlives its pager.
    @MainActor
    func test_B30_3_aReadThatComesBackAfterItsPagerWentPinsNothing() throws {
        let model = AppModel(live: false)
        let a = pager("A", server: model.server.absoluteString)
        model.pagers = [a]
        XCTAssertNil(model.apply(a, .success(try read(of: a, title: "Before Delete?"))))
        XCTAssertEqual(model.inboxes[a.pagerId]?.agents.first?.open.first?.title, "Before Delete?")
        XCTAssertEqual(pinned(a), answerKey)
        model.drop(a.pagerId)
        XCTAssertNil(pinned(a))
        XCTAssertNil(model.apply(a, .success(try read(of: a, title: "After Delete?"))))
        XCTAssertNil(model.inboxes[a.pagerId])
        XCTAssertEqual(AppKeychain.records(.pins, pagerId: a.pagerId), [:])
    }

    // MARK: B7.4 · answers kept with their pager

    // The read with its decision answered under a request id, the service holding the part it was handed.
    private func answered(of pager: AppPager, requestId: String, answer: String) throws -> SealedPagerInbox {
        var r = try read(of: pager, title: "Answered?")
        var d = r.agents[0].open.removeFirst()
        d.status = .answered
        d.answer = SealedAnswer(answerId: String(repeating: "N", count: 32), decisionId: decisionId, requestId: requestId, answer: answer, sentAt: Date())
        r.agents[0].answered = [d]
        return r
    }

    // The app is deleted and installed again: a new run, with nothing in memory and none of the app's files, finds
    // the answer's record in the Keychain with its pager, and shows the owner's answer. Only exactly the part this
    // phone sealed, under its request id, shows as the answer.
    func test_B7_4_anAnsweredDecisionShowsTheOwnersAnswerFromTheKeychainAlone() throws {
        let a = pager("A")
        AppKeychain.save(a)
        let requestId = randomToken()
        let sealedAnswer = try XCTUnwrap(Sealed.answer(.option(2), to: answerKey, pagerId: a.pagerId, decisionId: decisionId))
        KeptAnswers().keep(SentAnswer(pagerId: a.pagerId, decisionId: decisionId, choice: .option(2), sealed: sealedAnswer), requestId: requestId)

        let afterReinstall = KeptAnswers()
        let shown = try XCTUnwrap(Sealed.inbox(try answered(of: a, requestId: requestId, answer: sealedAnswer), pager: a, answers: afterReinstall.of(a.pagerId), pins: Pins())?.agents.first?.answered.first)
        XCTAssertFalse(shown.unreadable)
        XCTAssertEqual(shown.title, "Answered?")
        XCTAssertEqual(shown.answer?.choice, .option(2))

        var changed = sealedAnswer
        changed.removeLast()
        changed.append(sealedAnswer.last == "A" ? "B" : "A")
        for (rid, part) in [(requestId, changed), (randomToken(), sealedAnswer)] {
            let other = try XCTUnwrap(Sealed.inbox(try answered(of: a, requestId: rid, answer: part), pager: a, answers: afterReinstall.of(a.pagerId), pins: pins)?.agents.first?.answered.first)
            XCTAssertTrue(other.unreadable)
            XCTAssertNotEqual(other.answer?.choice, .option(2))
        }
    }

    // The upgrade: what answers.json held moves into the Keychain, each answer with its own pager, and the file goes.
    func test_B7_4_theAnswersKeptInTheOldFileMoveIntoTheKeychain() throws {
        let a = pager("A"), b = pager("B")
        let file = FileManager.default.temporaryDirectory.appending(path: "answers-\(UUID().uuidString).json")
        let old = ["r-a": SentAnswer(pagerId: a.pagerId, decisionId: decisionId, choice: .option(1), sealed: "sealed-a"),
                   "r-b": SentAnswer(pagerId: b.pagerId, decisionId: decisionId, choice: .feedback("Not yet"), sealed: "sealed-b")]
        try JSONEncoder().encode(old).write(to: file)
        let moving = KeptAnswers()
        moving.move(from: file)
        XCTAssertFalse(FileManager.default.fileExists(atPath: file.path))
        XCTAssertEqual(moving.of(a.pagerId), ["r-a": old["r-a"]!])
        let next = KeptAnswers()
        XCTAssertEqual(next.of(a.pagerId), ["r-a": old["r-a"]!])
        XCTAssertEqual(next.of(b.pagerId), ["r-b": old["r-b"]!])
        next.move(from: file)
        XCTAssertEqual(KeptAnswers().of(a.pagerId), ["r-a": old["r-a"]!])
    }

    // The file goes only once every answer in it reads back from the Keychain as it was: a record already kept under
    // one of its request ids is never replaced, so that answer hasn't moved, and the file stays.
    func test_B7_4_theOldFileStaysUntilEveryAnswerInItIsInTheKeychain() throws {
        let a = pager("A")
        let first = SentAnswer(pagerId: a.pagerId, decisionId: decisionId, choice: .option(1), sealed: "kept first")
        KeptAnswers().keep(first, requestId: "r-1")
        let file = FileManager.default.temporaryDirectory.appending(path: "answers-\(UUID().uuidString).json")
        let second = SentAnswer(pagerId: a.pagerId, decisionId: decisionId, choice: .option(2), sealed: "moved")
        try JSONEncoder().encode(["r-1": SentAnswer(pagerId: a.pagerId, decisionId: decisionId, choice: .option(2), sealed: "from the file"), "r-2": second]).write(to: file)
        KeptAnswers().move(from: file)
        XCTAssertTrue(FileManager.default.fileExists(atPath: file.path))
        XCTAssertEqual(KeptAnswers().of(a.pagerId), ["r-1": first, "r-2": second])
        try? FileManager.default.removeItem(at: file)
    }

    // Dropping a pager takes its answers' records and leaves the other pager's.
    @MainActor
    func test_B7_4_aPagersAnswersGoWithItAndNoOtherPagersDo() throws {
        let model = AppModel(live: false)
        let a = pager("A", server: model.server.absoluteString), b = pager("B", server: model.server.absoluteString)
        let kept = KeptAnswers()
        XCTAssertTrue(kept.keep(SentAnswer(pagerId: a.pagerId, decisionId: decisionId, choice: .option(1), sealed: "on A"), requestId: "r-a"))
        XCTAssertTrue(kept.keep(SentAnswer(pagerId: b.pagerId, decisionId: decisionId, choice: .option(1), sealed: "on B"), requestId: "r-b"))
        model.pagers = [a, b]
        model.drop(a.pagerId)
        XCTAssertEqual(AppKeychain.records(.answers, pagerId: a.pagerId), [:])
        XCTAssertEqual(KeptAnswers().of(a.pagerId), [:])
        XCTAssertEqual(KeptAnswers().of(b.pagerId).keys.sorted(), ["r-b"])

        // An old file still waiting to move, as when the Keychain refused part of a move, loses the dropped pager's
        // answers too, so the next launch's move doesn't bring them back.
        let file = FileManager.default.temporaryDirectory.appending(path: "answers-\(UUID().uuidString).json")
        let waitingOnB = SentAnswer(pagerId: b.pagerId, decisionId: decisionId, choice: .option(2), sealed: "on B, waiting")
        try JSONEncoder().encode(["r-a2": SentAnswer(pagerId: a.pagerId, decisionId: decisionId, choice: .option(2), sealed: "on A, waiting"), "r-b2": waitingOnB]).write(to: file)
        KeptAnswers().forget(a.pagerId, file: file)
        XCTAssertEqual(try JSONDecoder().decode([String: SentAnswer].self, from: Data(contentsOf: file)), ["r-b2": waitingOnB])
        KeptAnswers().move(from: file)
        XCTAssertEqual(AppKeychain.records(.answers, pagerId: a.pagerId), [:])
        XCTAssertEqual(KeptAnswers().of(b.pagerId).keys.sorted(), ["r-b", "r-b2"])
        XCTAssertFalse(FileManager.default.fileExists(atPath: file.path))
    }

    // Pins and answers are kept as the pager is: the same access group and accessibility, this device only.
    func test_B30_3_B7_4_pinsAndAnswersAreKeptAsTheirPagerIs() throws {
        let a = pager("A")
        AppKeychain.save(a)
        _ = Sealed.inbox(try read(of: a, title: "Pinned?"), pager: a, answers: [:], pins: pins)
        KeptAnswers().keep(SentAnswer(pagerId: a.pagerId, decisionId: decisionId, choice: .option(1), sealed: "kept"), requestId: "r-1")
        func attributes(_ service: String) -> [[String: Any]] {
            let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                        kSecMatchLimit as String: kSecMatchLimitAll, kSecReturnAttributes as String: true]
            var result: CFTypeRef?
            guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return [] }
            return (result as? [[String: Any]]) ?? []
        }
        let shape = { (item: [String: Any]) in [item[kSecAttrAccessGroup as String] as? String, item[kSecAttrAccessible as String] as? String] }
        let pagerItem = try XCTUnwrap(attributes(AppKeychain.service).first { $0[kSecAttrAccount as String] as? String == a.pagerId })
        XCTAssertEqual(shape(pagerItem)[1], kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
        for kind in AppKeychain.Kept.allCases {
            let items = attributes(kind.service(a.pagerId))
            XCTAssertEqual(items.count, 1, "\(kind)")
            XCTAssertEqual(items.map(shape), [shape(pagerItem)], "\(kind)")
        }
    }
}
