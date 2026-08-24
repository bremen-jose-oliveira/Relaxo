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
  var primaryLabel: String
  var primaryTarget: String
  var secondaryLabel: String
  var secondaryTarget: String

  enum CodingKeys: String, CodingKey {
    case v, updatedAt, statusTone, title, subtitle, asleep, paused, showTimer
    case timerLowerMs, showPrediction, predictionTime, predictionLabel
    case readinessLabel, babyName
    case primaryLabel, primaryTarget, secondaryLabel, secondaryTarget
  }

  init(
    v: Int,
    updatedAt: Double,
    statusTone: String,
    title: String,
    subtitle: String,
    asleep: Bool,
    paused: Bool,
    showTimer: Bool,
    timerLowerMs: Double,
    showPrediction: Bool,
    predictionTime: String,
    predictionLabel: String,
    readinessLabel: String,
    babyName: String,
    primaryLabel: String = "Nap",
    primaryTarget: String = "start-nap",
    secondaryLabel: String = "Bedtime",
    secondaryTarget: String = "start-bedtime"
  ) {
    self.v = v
    self.updatedAt = updatedAt
    self.statusTone = statusTone
    self.title = title
    self.subtitle = subtitle
    self.asleep = asleep
    self.paused = paused
    self.showTimer = showTimer
    self.timerLowerMs = timerLowerMs
    self.showPrediction = showPrediction
    self.predictionTime = predictionTime
    self.predictionLabel = predictionLabel
    self.readinessLabel = readinessLabel
    self.babyName = babyName
    self.primaryLabel = primaryLabel
    self.primaryTarget = primaryTarget
    self.secondaryLabel = secondaryLabel
    self.secondaryTarget = secondaryTarget
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    v = try c.decodeIfPresent(Int.self, forKey: .v) ?? 1
    updatedAt = try c.decodeIfPresent(Double.self, forKey: .updatedAt) ?? 0
    statusTone = try c.decodeIfPresent(String.self, forKey: .statusTone) ?? "awake"
    title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Relaxo"
    subtitle = try c.decodeIfPresent(String.self, forKey: .subtitle) ?? ""
    asleep = try c.decodeIfPresent(Bool.self, forKey: .asleep) ?? false
    paused = try c.decodeIfPresent(Bool.self, forKey: .paused) ?? false
    showTimer = try c.decodeIfPresent(Bool.self, forKey: .showTimer) ?? false
    timerLowerMs = try c.decodeIfPresent(Double.self, forKey: .timerLowerMs) ?? 0
    showPrediction = try c.decodeIfPresent(Bool.self, forKey: .showPrediction) ?? false
    predictionTime = try c.decodeIfPresent(String.self, forKey: .predictionTime) ?? ""
    predictionLabel = try c.decodeIfPresent(String.self, forKey: .predictionLabel) ?? ""
    readinessLabel = try c.decodeIfPresent(String.self, forKey: .readinessLabel) ?? ""
    babyName = try c.decodeIfPresent(String.self, forKey: .babyName) ?? "Relaxo"
    // Older snapshots without button fields still decode.
    if asleep {
      primaryLabel = try c.decodeIfPresent(String.self, forKey: .primaryLabel) ?? "End"
      primaryTarget = try c.decodeIfPresent(String.self, forKey: .primaryTarget) ?? "end"
      secondaryLabel = try c.decodeIfPresent(String.self, forKey: .secondaryLabel) ?? (paused ? "Resume" : "Pause")
      secondaryTarget = try c.decodeIfPresent(String.self, forKey: .secondaryTarget) ?? (paused ? "resume" : "pause")
    } else {
      primaryLabel = try c.decodeIfPresent(String.self, forKey: .primaryLabel) ?? "Nap"
      primaryTarget = try c.decodeIfPresent(String.self, forKey: .primaryTarget) ?? "start-nap"
      secondaryLabel = try c.decodeIfPresent(String.self, forKey: .secondaryLabel) ?? "Bedtime"
      secondaryTarget = try c.decodeIfPresent(String.self, forKey: .secondaryTarget) ?? "start-bedtime"
    }
  }

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
