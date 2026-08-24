import ExpoModulesCore
import WatchConnectivity
import WidgetKit

private let appGroupId = "group.com.joseoliv.relaxo"
private let bridgeKey = "relaxo.widgetBridge"
private let queueKey = "relaxo.widgetPending"
private let watchSnapshotKey = "relaxo.watchSnapshot"
private let watchWidgetKind = "RelaxoWatchWidget"
private let watchActionSource = "RelaxoWatch"

private final class PhoneWatchSession: NSObject, WCSessionDelegate {
  static let shared = PhoneWatchSession()

  /// Called from the Expo module so we can emit JS events.
  weak var module: WidgetBridgeModule?

  private override init() {
    super.init()
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    if session.activationState != .activated {
      session.activate()
    }
  }

  func pushSnapshotJSON(_ json: String) {
    activate()
    let session = WCSession.default
    let payload: [String: Any] = ["snapshot": json]
    guard session.activationState == .activated else { return }

    do {
      try session.updateApplicationContext(payload)
    } catch {
      // Keep latest for when the watch becomes reachable.
    }

    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
    } else {
      session.transferUserInfo(payload)
    }
  }

  private func enqueueWatchAction(_ action: String, at: Int) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
    let item: [String: Any] = [
      "id": UUID().uuidString.lowercased(),
      "source": watchActionSource,
      "target": action,
      "at": at,
      "sleepEventId": NSNull()
    ]
    var queue = defaults.array(forKey: queueKey) as? [[String: Any]] ?? []
    queue.append(item)
    if queue.count > 40 {
      queue = Array(queue.suffix(40))
    }
    defaults.set(queue, forKey: queueKey)
    defaults.synchronize()
  }

  private func handleWatchActionMessage(_ message: [String: Any]) {
    guard let action = message["action"] as? String, !action.isEmpty else { return }
    let at = (message["at"] as? Int) ?? Int(Date().timeIntervalSince1970 * 1000)
    enqueueWatchAction(action, at: at)
    module?.emitWatchAction(target: action, timestamp: at)
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {}

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if message["snapshot"] != nil { return }
    handleWatchActionMessage(message)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    if message["snapshot"] != nil {
      replyHandler(["ok": true])
      return
    }
    handleWatchActionMessage(message)
    replyHandler(["ok": true])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    if userInfo["snapshot"] != nil { return }
    handleWatchActionMessage(userInfo)
  }
}

public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    Events("onWatchAction")

    OnCreate {
      PhoneWatchSession.shared.module = self
      PhoneWatchSession.shared.activate()
    }

    Function("setBridge") { (json: String?) in
      guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
      if let json, !json.isEmpty {
        defaults.set(json, forKey: bridgeKey)
      } else {
        defaults.removeObject(forKey: bridgeKey)
      }
      defaults.synchronize()
    }

    Function("setWatchSnapshot") { (json: String?) in
      guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
      if let json, !json.isEmpty {
        defaults.set(json, forKey: watchSnapshotKey)
        defaults.synchronize()
        PhoneWatchSession.shared.pushSnapshotJSON(json)
      } else {
        defaults.removeObject(forKey: watchSnapshotKey)
        defaults.synchronize()
      }
      WidgetCenter.shared.reloadTimelines(ofKind: watchWidgetKind)
    }

    Function("getPendingActionsJson") { () -> String in
      guard let defaults = UserDefaults(suiteName: appGroupId) else {
        return "[]"
      }
      if let array = defaults.array(forKey: queueKey) as? [[String: Any]],
         let data = try? JSONSerialization.data(withJSONObject: array),
         let json = String(data: data, encoding: .utf8) {
        return json
      }
      return "[]"
    }

    Function("clearPendingActions") { (idsJson: String?) in
      guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
      guard var array = defaults.array(forKey: queueKey) as? [[String: Any]] else {
        return
      }
      if let idsJson,
         let data = idsJson.data(using: .utf8),
         let ids = try? JSONSerialization.jsonObject(with: data) as? [String],
         !ids.isEmpty {
        let idSet = Set(ids)
        array = array.filter { item in
          guard let id = item["id"] as? String else { return true }
          return !idSet.contains(id)
        }
      } else {
        array = []
      }
      defaults.set(array, forKey: queueKey)
      defaults.synchronize()
    }
  }

  func emitWatchAction(target: String, timestamp: Int) {
    sendEvent("onWatchAction", [
      "target": target,
      "timestamp": timestamp,
      "source": watchActionSource
    ])
  }
}
