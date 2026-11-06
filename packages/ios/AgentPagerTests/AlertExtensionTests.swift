import XCTest
import CryptoKit
import Security
import UserNotifications

// The alert extension (AgentPagerNotifications): its own code, compiled in here, run inside the app in the Simulator.
// In the Simulator, iOS never runs a service extension for an alert from `xcrun simctl push`: it adds the alert
// directly (iOS 27.2, 6 Nov 2026). So the extension's code runs here instead, against the app's own Keychain, and
// the extension's built entitlements are read from its binary. That iOS runs the extension process itself, and that
// its entitlements let it read the app's group on a phone, are seen on a phone with alerts from the deployed service.
// In the Simulator a second process holding a keychain group reads that group's items (scratch lab, 6 Nov 2026).
// Run with: xcodebuild test ... -destination '<a Simulator>' -only-testing:AgentPagerTests
final class AlertExtensionTests: XCTestCase {
    // Pagers saved here name a server the app never polls, so the app hosting these tests leaves them alone.
    private let server = "http://127.0.0.1:9"
    private var made: [String] = []

    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator only: on a phone, the app's Keychain holds real pagers")
        #endif
    }

    override func tearDown() {
        for pagerId in made { Keychain.delete(pagerId) }
        made = []
    }

    private func save(_ name: String) -> LocalPager {
        let pager = LocalPager.make(name: name, server: server)
        made.append(pager.pagerId)
        Keychain.save(pager)
        return pager
    }

    // The access group of each item for a pager id, searched in every group the app has.
    private func groups(_ pagerId: String) -> [String] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: Keychain.service, kSecAttrAccount as String: pagerId,
            kSecMatchLimit as String: kSecMatchLimitAll, kSecReturnAttributes as String: true,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return [] }
        return ((result as? [[String: Any]]) ?? []).compactMap { $0[kSecAttrAccessGroup as String] as? String }
    }

    // The keychain groups in a binary's entitlements: the Simulator's __entitlements section and a phone's code
    // signature both hold them as an XML property list.
    private func keychainGroups(ofBinaryAt url: URL) throws -> [String] {
        let data = try Data(contentsOf: url)
        var from = data.startIndex
        while let start = data.range(of: Data("<?xml".utf8), in: from..<data.endIndex),
              let end = data.range(of: Data("</plist>".utf8), in: start.upperBound..<data.endIndex) {
            from = end.upperBound
            let plist = try? PropertyListSerialization.propertyList(from: data[start.lowerBound..<end.upperBound], format: nil) as? [String: Any]
            if let groups = plist?["keychain-access-groups"] as? [String] { return groups }
        }
        return []
    }

    // MARK: The extension reads pagers' keys

    // Each pager the app saves is found by its id, alone in the app's own group, with the key its number names. The
    // extension's entitlements name that same group, first.
    func test_B26_9_theExtensionFindsEachPagersOwnKey() throws {
        let pagers = [save("Alerts one"), save("Alerts two")]
        let extensionBinary = try XCTUnwrap(Bundle.main.builtInPlugInsURL?.appendingPathComponent("AgentPagerNotifications.appex/AgentPagerNotifications"))
        let extensionGroups = try keychainGroups(ofBinaryAt: extensionBinary)
        XCTAssertEqual(extensionGroups.count, 1, "the extension's keychain groups: \(extensionGroups)")
        for pager in pagers {
            let found = try XCTUnwrap(Keychain.pager(pager.pagerId), "no key for \(pager.name)")
            XCTAssertEqual(found, pager, "the pager reads back unchanged")
            let key = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: found.privateKey)
            let fingerprint = Array(SHA256.hash(data: key.publicKey.rawRepresentation).prefix(8))
            XCTAssertEqual(Array(Self.numberBytes(found.number).suffix(8)), fingerprint, "the key its number names")
            XCTAssertEqual(groups(pager.pagerId), extensionGroups, "one item, in the group the extension reads")
        }
        XCTAssertTrue(extensionGroups.allSatisfy { $0.hasSuffix(".me.agentpager.app.dev") }, "the app's own App ID: \(extensionGroups)")
        XCTAssertNil(Keychain.pager(String(repeating: "0", count: 32)), "no key for a pager this phone doesn't hold")
    }

    // Every pager item on this phone, whichever build made it, decodes and is found by its id, once, in the group the
    // extension reads. After installing this build over an older one, the older one's pagers pass too.
    func testEveryPagerThePhoneHoldsIsWhereTheExtensionReadsIt() throws {
        let extensionBinary = try XCTUnwrap(Bundle.main.builtInPlugInsURL?.appendingPathComponent("AgentPagerNotifications.appex/AgentPagerNotifications"))
        let extensionGroups = try keychainGroups(ofBinaryAt: extensionBinary)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: Keychain.service,
            kSecMatchLimit as String: kSecMatchLimitAll, kSecReturnAttributes as String: true, kSecReturnData as String: true,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        let items = (result as? [[String: Any]]) ?? []
        XCTAssertTrue(status == errSecSuccess || status == errSecItemNotFound, "status \(status)")
        for item in items {
            let account = item[kSecAttrAccount as String] as? String ?? ""
            let data = try XCTUnwrap(item[kSecValueData as String] as? Data)
            let pager = try JSONDecoder().decode(LocalPager.self, from: data)
            XCTAssertEqual(pager.pagerId, account)
            XCTAssertEqual(Keychain.pager(account), pager)
            XCTAssertEqual(groups(account), extensionGroups, "pager made \(pager.createdAt)")
        }
        print("AGENTPAGER_PAGERS_CHECKED=\(items.count)")
    }

    // Renaming saves the pager again: still one item, in the same group, read back as renamed.
    func testRenamingAPagerKeepsOneItemTheExtensionReads() throws {
        var pager = save("Alerts before")
        let before = groups(pager.pagerId)
        pager.name = "Alerts after"
        Keychain.save(pager)
        XCTAssertEqual(Keychain.pager(pager.pagerId), pager)
        XCTAssertEqual(groups(pager.pagerId), before)
        XCTAssertEqual(before.count, 1)
    }

    // Deleting a pager leaves no item for it in any group; the other pager keeps its own.
    func test_B22_10_deletingAPagerLeavesNoKeyForTheExtension() throws {
        let kept = save("Alerts kept"), gone = save("Alerts gone")
        XCTAssertNotNil(Keychain.pager(gone.pagerId))
        Keychain.delete(gone.pagerId)
        XCTAssertNil(Keychain.pager(gone.pagerId))
        XCTAssertEqual(groups(gone.pagerId), [])
        XCTAssertEqual(Keychain.pager(kept.pagerId), kept)
        XCTAssertTrue(Keychain.all().contains(kept))
        XCTAssertFalse(Keychain.all().contains { $0.pagerId == gone.pagerId })
    }

    private static func numberBytes(_ number: String) -> [UInt8] {
        var text = String(number.dropFirst(4)).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while text.count % 4 != 0 { text += "=" }
        return [UInt8](Data(base64Encoded: text) ?? Data())
    }

    // MARK: Alerts show as sent

    // An alert as packages/app/src/push.ts sends one: its words, thread, level and AgentPager's keys.
    private func sent(kind: String, title: String, body: String, pagerId: String = "0f1e2d3c4b5a69788796a5b4c3d2e1f0") -> UNNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.threadIdentifier = pagerId
        content.interruptionLevel = kind == "decision" ? .timeSensitive : .active
        content.userInfo = ["kind": kind, "pagerId": pagerId, "agentId": "agent-1", "decisionId": "decision-1"]
        return content
    }

    // Runs the extension on one alert, then iOS's expiry, and returns the one content it handed back.
    private func shown(_ alert: UNNotificationContent) -> UNNotificationContent {
        let service = NotificationService()
        var handed: [UNNotificationContent] = []
        service.didReceive(UNNotificationRequest(identifier: "alert", content: alert, trigger: nil)) { handed.append($0) }
        service.serviceExtensionTimeWillExpire()
        XCTAssertEqual(handed.count, 1, "the extension hands iOS exactly one content per alert")
        return handed.first ?? UNNotificationContent()
    }

    private func assertShownAsSent(_ alert: UNNotificationContent, file: StaticString = #filePath, line: UInt = #line) {
        let shown = shown(alert)
        XCTAssertEqual(shown.title, alert.title, file: file, line: line)
        XCTAssertEqual(shown.subtitle, alert.subtitle, file: file, line: line)
        XCTAssertEqual(shown.body, alert.body, file: file, line: line)
        XCTAssertEqual(shown.threadIdentifier, alert.threadIdentifier, file: file, line: line)
        XCTAssertEqual(shown.interruptionLevel, alert.interruptionLevel, file: file, line: line)
        XCTAssertNotNil(shown.sound, file: file, line: line)
        XCTAssertEqual(shown.userInfo as NSDictionary, alert.userInfo as NSDictionary, file: file, line: line)
    }

    func test_B17_2_aDecisionAlertShowsAsSent() {
        assertShownAsSent(sent(kind: "decision", title: "Codex · shop", body: "Ship the new checkout today?\nIt passed review.\nRecommended: A. Ship"))
    }

    // For a pager this phone holds, too: finding its key changes nothing yet.
    func test_B17_2_aDecisionAlertForAPagerHeldHereShowsAsSent() {
        let pager = save("Alerts held")
        assertShownAsSent(sent(kind: "decision", title: "Codex · shop", body: "Ship the new checkout today?", pagerId: pager.pagerId))
    }

    func test_B17_5_anAcknowledgementAlertShowsAsSent() {
        assertShownAsSent(sent(kind: "acknowledgement", title: "Codex · shop", body: "Shipping now; I'll post the release notes."))
    }

    func test_B17_8_aNotPickedUpAlertShowsAsSent() {
        assertShownAsSent(sent(kind: "warning", title: "Answer not picked up", body: "Codex on mini (shop) hasn’t picked up your answer to “Ship the new checkout today?” after 3 min."))
    }

    // iOS's time can run out while the extension works: the alert then shows as sent, once, and the extension's own
    // result after that is dropped.
    func test_B17_2_anAlertShowsAsSentWhenTheExtensionRunsOutOfTime() {
        let alert = sent(kind: "decision", title: "Codex · shop", body: "Ship the new checkout today?")
        let late = UNMutableNotificationContent()
        late.body = "late"
        let delivery = AlertDelivery()
        var handed: [UNNotificationContent] = []
        delivery.start(alert) { handed.append($0) }
        delivery.finish(nil) // serviceExtensionTimeWillExpire
        delivery.finish(late) // the extension's own result, too late
        XCTAssertEqual(handed.map(\.body), [alert.body])
    }
}
