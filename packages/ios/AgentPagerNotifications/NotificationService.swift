import AgentPagerCrypto
import CryptoKit
import UserNotifications
import os

// AgentPager's notification service extension. iOS runs it for each alert sent with mutable-content: 1, before the
// alert shows, and shows whatever it hands back. It has no network code and makes no request: everything it needs is
// in the alert and in the keychain group it shares with the app (Keychain.swift).
//
// The service sends plain words that say only what kind of alert it is, and an encrypted preview. The extension
// opens the preview with the key of the pager the alert names, bound to the alert's kind, pager and decision, and
// shows the real words (B17.2, B17.5, B17.8; packages/contract/alerts.ts). Anything it can't do leaves the alert as
// sent: no preview (the service's alerts from before encryption), no key for that pager, a preview that doesn't
// open or isn't its kind's shape, or iOS's time running out.
final class NotificationService: UNNotificationServiceExtension {
    private let delivery = AlertDelivery()

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        delivery.start(request.content, contentHandler)
        delivery.finish(Self.content(for: request.content))
    }

    // iOS's time for this alert is nearly up: it shows as sent.
    override func serviceExtensionTimeWillExpire() {
        delivery.finish(nil)
    }

    private static let log = Logger(subsystem: "me.agentpager.app.dev.notifications", category: "alerts")

    // What the owner sees for an alert the service sent: its preview's words, or the alert as sent.
    static func content(for sent: UNNotificationContent) -> UNNotificationContent {
        guard let alert = AlertFields(sent.userInfo), alert.preview != nil else {
            log.notice("an alert with no preview: shown as sent")
            return sent
        }
        guard let pager = Keychain.pager(alert.pagerId), let key = try? Curve25519.KeyAgreement.PrivateKey(rawRepresentation: pager.privateKey) else {
            log.notice("an alert for a pager this phone doesn't hold: shown as sent")
            return sent
        }
        guard let words = Alerts.read(alert, with: key), let shown = sent.mutableCopy() as? UNMutableNotificationContent else {
            log.notice("an alert whose preview can't be read: shown as sent")
            return sent
        }
        shown.title = words.title
        shown.body = words.body
        log.notice("an alert shown with its preview's words")
        return shown
    }
}

// Hands iOS one content for an alert, exactly once: the extension's own, or, if iOS's time runs out first, the alert
// as sent. Either may come first, on any thread.
final class AlertDelivery: @unchecked Sendable {
    private let lock = NSLock()
    private var sent: UNNotificationContent?
    private var handler: ((UNNotificationContent) -> Void)?

    func start(_ sent: UNNotificationContent, _ handler: @escaping (UNNotificationContent) -> Void) {
        lock.withLock { self.sent = sent; self.handler = handler }
    }

    // Nil shows the alert as sent. Every call after the first does nothing.
    func finish(_ content: UNNotificationContent?) {
        let (handler, sent) = lock.withLock { () -> (((UNNotificationContent) -> Void)?, UNNotificationContent?) in
            defer { self.handler = nil }
            return (self.handler, self.sent)
        }
        guard let handler, let sent else { return }
        handler(content ?? sent)
    }
}
