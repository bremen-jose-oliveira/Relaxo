import Foundation
import WatchConnectivity

final class WatchConnectivitySession: NSObject, WCSessionDelegate {
  static let shared = WatchConnectivitySession()

  private override init() {
    super.init()
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  /// Send a sleep action to the paired iPhone (Nap / End / Pause / …).
  func sendAction(_ action: String, completion: @escaping (Bool) -> Void) {
    activate()
    let session = WCSession.default
    let payload: [String: Any] = [
      "action": action,
      "at": Int(Date().timeIntervalSince1970 * 1000)
    ]

    guard session.activationState == .activated else {
      completion(false)
      return
    }

    if session.isReachable {
      session.sendMessage(payload, replyHandler: { _ in
        completion(true)
      }, errorHandler: { _ in
        session.transferUserInfo(payload)
        completion(true)
      })
    } else {
      session.transferUserInfo(payload)
      completion(session.isCompanionAppInstalled)
    }
  }

  private func applyContext(_ context: [String: Any]) {
    guard let json = context["snapshot"] as? String, !json.isEmpty else { return }
    SleepSnapshotStore.save(json: json)
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated {
      applyContext(session.receivedApplicationContext)
    }
  }

  func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    applyContext(applicationContext)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    applyContext(userInfo)
  }

  #if os(watchOS)
  func sessionReachabilityDidChange(_ session: WCSession) {}
  #endif
}
