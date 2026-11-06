import UserNotifications
import os

// AgentPager's notification service extension. iOS runs it for each alert sent with mutable-content: 1, before the
// alert shows, and shows whatever it hands back. It has no network code and makes no request: everything it needs is
// in the alert and in the keychain group it shares with the app (Keychain.swift).
//
// M5 groundwork: every alert shows exactly as the service sent it (B17). The extension only looks up the key of the
// alert's pager by its pagerId, which shows it can; nothing it reads changes the alert yet.
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

    // What the owner sees for an alert the service sent: for now, the alert as sent.
    static func content(for sent: UNNotificationContent) -> UNNotificationContent {
        let found = (sent.userInfo["pagerId"] as? String).flatMap(Keychain.pager) != nil
        log.notice("alert for a pager this phone \(found ? "holds" : "doesn't hold", privacy: .public); shown as sent")
        return sent
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
