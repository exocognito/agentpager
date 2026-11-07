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

    // MARK: Alerts as the owner sees them

    // An alert as the service sent it, as iOS hands it to the extension: Apple's alert, and the whole payload as its
    // userInfo.
    private func delivered(_ payload: [String: Any]) -> UNNotificationContent {
        let aps = payload["aps"] as? [String: Any] ?? [:]
        let alert = aps["alert"] as? [String: String] ?? [:]
        let content = UNMutableNotificationContent()
        content.title = alert["title"] ?? ""
        content.body = alert["body"] ?? ""
        content.sound = .default
        content.threadIdentifier = aps["thread-id"] as? String ?? ""
        content.interruptionLevel = aps["interruption-level"] as? String == "time-sensitive" ? .timeSensitive : .active
        content.userInfo = payload
        return content
    }

    // An alert as the service sends it today, with no preview.
    private func today(kind: String, title: String, body: String) -> UNNotificationContent {
        delivered(["aps": ["alert": ["title": title, "body": body], "thread-id": "0f1e2d3c4b5a69788796a5b4c3d2e1f0", "interruption-level": kind == "decision" ? "time-sensitive" : "active"],
                   "kind": kind, "pagerId": "0f1e2d3c4b5a69788796a5b4c3d2e1f0", "agentId": "agent-1", "decisionId": "decision-1"])
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

    // Everything but the words is the alert as sent: its thread, level, sound and payload.
    private func assertSame(_ shown: UNNotificationContent, _ alert: UNNotificationContent, words: (title: String, body: String)? = nil, _ name: String = "", file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(shown.title, words?.title ?? alert.title, name, file: file, line: line)
        XCTAssertEqual(shown.body, words?.body ?? alert.body, name, file: file, line: line)
        XCTAssertEqual(shown.subtitle, alert.subtitle, name, file: file, line: line)
        XCTAssertEqual(shown.threadIdentifier, alert.threadIdentifier, name, file: file, line: line)
        XCTAssertEqual(shown.interruptionLevel, alert.interruptionLevel, name, file: file, line: line)
        XCTAssertNotNil(shown.sound, name, file: file, line: line)
        XCTAssertEqual(shown.userInfo as NSDictionary, alert.userInfo as NSDictionary, name, file: file, line: line)
    }

    // packages/contract/vectors/alerts.json: payloads as the service sends them, with the key of the pager each names,
    // and what the owner sees. Read where it is, from the Mac, as the Simulator allows.
    private struct Case { var name: String; var payload: [String: Any]; var key: Data; var shows: (title: String, body: String)? }
    private func cases() throws -> [Case] {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("contract/vectors/alerts.json")
        let v = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        return try XCTUnwrap(v["payloads"] as? [[String: Any]]).map { c in
            let shows = (c["shows"] as? [String: String]).map { (title: $0["title"] ?? "", body: $0["body"] ?? "") }
            var key = try XCTUnwrap(c["recipientPrivateKey"] as? String).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
            while key.count % 4 != 0 { key += "=" }
            return Case(name: c["name"] as? String ?? "?", payload: try XCTUnwrap(c["payload"] as? [String: Any]), key: try XCTUnwrap(Data(base64Encoded: key)), shows: shows)
        }
    }
    private func vector(_ name: String) throws -> Case { try XCTUnwrap(try cases().first { $0.name == name }, name) }

    // Saves the pager a vector names, with its key, as the app saves a pager.
    private func hold(_ c: Case) throws {
        let pagerId = try XCTUnwrap(c.payload["pagerId"] as? String)
        let key = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: c.key)
        let id = stride(from: 0, to: 32, by: 2).map { UInt8(pagerId.dropFirst($0).prefix(2), radix: 16) ?? 0 }
        let number = "ap1_" + base64url(Data(id + Array(SHA256.hash(data: key.publicKey.rawRepresentation)).prefix(8)))
        made.append(pagerId)
        Keychain.save(LocalPager(pagerId: pagerId, number: number, phoneKey: randomToken(), privateKey: c.key, name: "Alerts vector", server: server, createdAt: Date()))
    }

    private func assertShowsItsPreviewsWords(_ name: String, file: StaticString = #filePath, line: UInt = #line) throws {
        let c = try vector(name)
        try hold(c)
        let alert = delivered(c.payload)
        let words = try XCTUnwrap(c.shows, file: file, line: line)
        XCTAssertNotEqual(alert.body, words.body, "the payload carries only the plain words", file: file, line: line)
        assertSame(shown(alert), alert, words: words, name, file: file, line: line)
    }

    func test_B17_2_aDecisionAlertShowsWhoAskedTheProjectAndTheQuestion() throws {
        try assertShowsItsPreviewsWords("a decision")
    }

    func test_B17_5_anAcknowledgementAlertShowsTheAgentsNextSteps() throws {
        try assertShowsItsPreviewsWords("an acknowledgement")
    }

    func test_B17_8_aNotPickedUpAlertNamesWhoAskedTheComputerTheProjectAndTheQuestion() throws {
        try assertShowsItsPreviewsWords("a warning, carrying its decision's preview")
    }

    // A preview for another pager or decision, of another kind, changed, cut short or sealed to another key: the alert
    // shows as sent, with none of the preview.
    func testAnAlertWhosePreviewCantBeReadShowsAsSent() throws {
        let unreadable = try cases().filter { $0.shows == nil }
        XCTAssertEqual(unreadable.count, 9)
        for c in unreadable {
            for pagerId in made { Keychain.delete(pagerId) }
            made = []
            try hold(c)
            let alert = delivered(c.payload)
            assertSame(shown(alert), alert, c.name)
        }
    }

    func testAnAlertForAPagerThisPhoneDoesntHoldShowsAsSent() throws {
        let alert = delivered(try vector("a decision").payload)
        assertSame(shown(alert), alert)
    }

    // The service's alerts from before encryption carry their own words and no preview: they show as sent.
    func testAnAlertWithNoPreviewShowsAsSent() throws {
        try hold(try vector("a decision"))
        for alert in [today(kind: "decision", title: "Codex · shop", body: "Ship the new checkout today?\nIt passed review.\nRecommended: A. Ship"),
                      today(kind: "acknowledgement", title: "Codex · shop", body: "Shipping now; I'll post the release notes."),
                      today(kind: "warning", title: "Codex · shop", body: "Codex on mini (shop) hasn’t picked up your answer to “Ship the new checkout today?” after 3 min.")] {
            assertSame(shown(alert), alert)
        }
        let held = try vector("an alert with no preview")
        assertSame(shown(delivered(held.payload)), delivered(held.payload))
    }

    // iOS's time can run out while the extension works: the alert then shows as sent, once, and the extension's own
    // result after that is dropped.
    func testAnAlertShowsAsSentWhenTheExtensionRunsOutOfTime() {
        let alert = today(kind: "decision", title: "Codex · shop", body: "Ship the new checkout today?")
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
