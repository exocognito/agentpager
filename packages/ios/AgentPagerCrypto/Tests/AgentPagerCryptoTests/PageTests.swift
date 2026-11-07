import XCTest
import AgentPagerCrypto

// A decrypted Markdown page is held to the page contract (brief.ts PageInput and Attachments) before the phone shows
// any of it: the service can't read a page to check it (I4.9).
final class PageTests: XCTestCase {
    private let attached = [(name: "flow.png", type: "image/png"), (name: "notes.md", type: "text/markdown")]
    private func page(_ text: String) -> Data { Data(text.utf8) }

    func test_I4_9_aPageWithinTheContractReads() throws {
        let text = "# Notes\n\nSee ![Flow](flow.png), [the rest](notes.md) and [the docs](https://example.com).\n\n```html\n<b>code</b>\n```\n"
        XCTAssertEqual(try Parts.page(page(text), attachments: attached), text)
        XCTAssertNoThrow(try Parts.page(page(String(repeating: "x", count: 20_000)), attachments: []))
    }

    func test_I4_9_aPageOutsideTheContractIsRefusedWhole() {
        let refused: [(String, Data)] = [
            ("over 20,000 characters", page(String(repeating: "x", count: 20_001))),
            ("over a million bytes", page(String(repeating: "a" + String(repeating: "\u{0301}", count: 40), count: 13_000))),
            ("not UTF-8", Data([0x23, 0x20, 0xff, 0xfe])),
            ("blank", page(" \n\t")),
            ("HTML outside code", page("# Notes\n<img src=x onerror=alert(1)>\n")),
            ("an image that isn't attached", page("![Mock](mock.png)\n")),
            ("a link that is neither attached nor https", page("[More](tel:1)\n")),
            ("an image naming a page", page("![Notes](notes.md)\n")),
        ]
        for (label, data) in refused {
            XCTAssertThrowsError(try Parts.page(data, attachments: attached), label)
        }
    }
}
