import UIKit
import UserNotifications

// Alerts (C17::get-paged). The app registers with Apple at launch and gives its device token to every pager it holds,
// so the agents on them reach it while it is closed. Tapping an alert opens that decision.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    let model = Sample.demo(UserDefaults.standard.string(forKey: "demo")) ?? AppModel()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        if model.live { application.registerForRemoteNotifications() }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        model.deviceToken = deviceToken.map { String(format: "%02x", $0) }.joined()
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("AgentPager: no device token: \(error.localizedDescription)")
    }

    // An alert woke the app in the background: refresh, so the list and the badge are current.
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
        await model.refreshAll()
        return .newData
    }

    // With the app open the list updates by itself, so only a decision on a pager not on screen shows a banner.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        let info = notification.request.content.userInfo
        Task { await model.refreshAll() }
        guard info["kind"] as? String == "decision", let pagerId = info["pagerId"] as? String, model.path.last != .pager(pagerId) else { return [] }
        return [.banner, .list, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        guard let pagerId = info["pagerId"] as? String, let agentId = info["agentId"] as? String, let decisionId = info["decisionId"] as? String else { return }
        await model.openAlert(pagerId: pagerId, agentId: agentId, decisionId: decisionId)
    }
}
