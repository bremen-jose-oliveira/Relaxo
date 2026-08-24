import Foundation
import WidgetKit

enum SleepSnapshotStore {
  static let appGroupId = "group.com.joseoliv.relaxo"
  static let snapshotKey = "relaxo.watchSnapshot"
  static let widgetKind = "RelaxoWatchWidget"

  static func save(json: String) {
    guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
    defaults.set(json, forKey: snapshotKey)
    defaults.synchronize()
    WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
  }

  static func loadJSON() -> String? {
    UserDefaults(suiteName: appGroupId)?.string(forKey: snapshotKey)
  }

  static func load() -> WatchSleepSnapshot {
    guard
      let json = loadJSON(),
      let data = json.data(using: .utf8),
      let decoded = try? JSONDecoder().decode(WatchSleepSnapshot.self, from: data)
    else {
      return .placeholder
    }
    return decoded
  }
}

struct WatchSleepSnapshot: Codable {
  var v: Int
  var updatedAt: Double
  var statusTone: String
  var title: String
  var subtitle: String
  var asleep: Bool
  var paused: Bool
  var showTimer: Bool
  var timerLowerMs: Double
  var showPrediction: Bool
  var predictionTime: String
  var predictionLabel: String
  var readinessLabel: String
  var babyName: String

  static let placeholder = WatchSleepSnapshot(
    v: 1,
    updatedAt: 0,
    statusTone: "awake",
    title: "Relaxo",
    subtitle: "Open iPhone app to sync",
    asleep: false,
    paused: false,
    showTimer: false,
    timerLowerMs: 0,
    showPrediction: false,
    predictionTime: "",
    predictionLabel: "",
    readinessLabel: "",
    babyName: "Relaxo"
  )

  var iconName: String {
    if paused { return "moon.zzz.fill" }
    if asleep { return "moon.fill" }
    return "sun.max.fill"
  }

  var timerDate: Date {
    Date(timeIntervalSince1970: timerLowerMs / 1000.0)
  }
}
