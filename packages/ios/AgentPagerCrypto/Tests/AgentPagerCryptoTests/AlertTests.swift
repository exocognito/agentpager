import CryptoKit
import Foundation
import XCTest
@testable import AgentPagerCrypto

// packages/contract/vectors/alerts.json, read where it is: the same file the contract's tests read.
let alertVectorsURL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appending(path: "contract/vectors/alerts.json")

final class AlertTests: XCTestCase {
    private func vectors() throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: alertVectorsURL)) as? [String: Any])
    }
    private func words(_ value: Any?) -> AlertWords? {
        guard let w = value as? [String: String], let title = w["title"], let body = w["body"] else { return nil }
        return AlertWords(title: title, body: body)
    }

    // The plain words, the payload's keys, which part each kind's preview is, and the minutes: as the contract has them.
    func testTheContractsNamesAndPlainWords() throws {
        let v = try vectors()
        let plain = try XCTUnwrap(v["plain"] as? [String: Any])
        XCTAssertEqual(plain["title"] as? String, Alerts.plainTitle)
        XCTAssertEqual(plain["bodies"] as? [String: String], Dictionary(uniqueKeysWithValues: AlertKind.allCases.map { ($0.rawValue, $0.plainBody) }))
        XCTAssertEqual(v["keys"] as? [String], AlertFields.keys)
        XCTAssertEqual(v["previewKinds"] as? [String: String], Dictionary(uniqueKeysWithValues: AlertKind.allCases.map { ($0.rawValue, $0.previewKind.rawValue) }))
        XCTAssertEqual(v["pickupMinutes"] as? Int, Alerts.pickupMinutes)
        XCTAssertEqual(v["decisionBodyMax"] as? Int, Alerts.decisionBodyMax)
    }

    // Each opened preview's words, as the contract writes them (B17.2, B17.5, B17.8).
    func testTheWordsAreTheContracts() throws {
        let cases = try XCTUnwrap(try vectors()["words"] as? [[String: Any]])
        XCTAssertEqual(cases.count, 8)
        for c in cases {
            let name = c["name"] as? String ?? "?"
            let json = Data(try XCTUnwrap(c["previewJSON"] as? String).utf8)
            let shown: AlertWords
            switch AlertKind(rawValue: c["kind"] as? String ?? "") {
            case .decision: shown = Alerts.decisionWords(try Parts.decode(DecisionPreviewPart.self, from: json))
            case .warning: shown = Alerts.warningWords(try Parts.decode(DecisionPreviewPart.self, from: json))
            case .acknowledgement: shown = Alerts.acknowledgementWords(try Parts.decode(AcknowledgementPreviewPart.self, from: json))
            case nil: return XCTFail("\(name): no kind")
            }
            XCTAssertEqual(shown, words(c["shows"]), name)
        }
    }

    // Each payload as the service sends it: the words its preview opens to with the pager's key, or nil when it
    // can't be read and the alert shows as sent.
    func testEachPayloadShowsWhatItsPreviewSaysOrAsSent() throws {
        let cases = try XCTUnwrap(try vectors()["payloads"] as? [[String: Any]])
        XCTAssertEqual(cases.count, 12)
        var read = 0
        for c in cases {
            let name = c["name"] as? String ?? "?"
            let payload = try XCTUnwrap(c["payload"] as? [String: Any])
            let alert = try XCTUnwrap(AlertFields(payload), name)
            let key = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: try XCTUnwrap(Envelope.fromBase64url(try XCTUnwrap(c["recipientPrivateKey"] as? String))))
            let expected = words(c["shows"])
            XCTAssertEqual(Alerts.read(alert, with: key), expected, name)
            if expected != nil { read += 1 }
        }
        XCTAssertEqual(read, 3)
    }

    func testFieldsAreAgentPagersKeysOnly() {
        let ids: [AnyHashable: Any] = ["kind": "decision", "pagerId": "p", "agentId": "a", "decisionId": "d"]
        XCTAssertNil(AlertFields(ids.merging(["kind": "brief"]) { $1 }), "an unknown kind")
        XCTAssertNil(AlertFields(ids.merging(["pagerId": 7]) { $1 }), "a pager id that isn't text")
        XCTAssertNil(AlertFields(ids.filter { $0.key != AnyHashable("decisionId") }), "no decision")
        XCTAssertNil(AlertFields(ids)?.preview, "no preview: an alert from before encryption")
        XCTAssertNil(AlertFields(ids.merging(["preview": 1]) { $1 })?.preview, "a preview that isn't text")
        XCTAssertEqual(AlertFields(ids.merging(["preview": "abc"]) { $1 })?.preview, "abc")
    }
}
