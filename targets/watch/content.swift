import SwiftUI
import WatchConnectivity
import WatchKit

struct ContentView: View {
  @State private var snapshot = SleepSnapshotStore.load()
  @State private var tick = Date()
  @State private var busy = false
  @State private var statusHint = ""

  private let timer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 8) {
          Image(systemName: snapshot.iconName)
            .font(.title2)
            .foregroundStyle(accent)
          VStack(alignment: .leading, spacing: 2) {
            Text(snapshot.babyName)
              .font(.headline)
            Text(statusLine)
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }

        if snapshot.showTimer {
          Text(timerText)
            .font(.system(.title3, design: .rounded).monospacedDigit())
            .foregroundStyle(accent)
        }

        if !snapshot.asleep, snapshot.showPrediction, !snapshot.predictionTime.isEmpty {
          VStack(alignment: .leading, spacing: 2) {
            Text(snapshot.predictionLabel.isEmpty ? "Next" : snapshot.predictionLabel)
              .font(.caption2)
              .foregroundStyle(.secondary)
            Text(snapshot.predictionTime)
              .font(.title3.weight(.semibold))
          }
        }

        if !snapshot.readinessLabel.isEmpty, !snapshot.asleep {
          Text(snapshot.readinessLabel)
            .font(.caption)
            .foregroundStyle(.secondary)
        }

        VStack(spacing: 8) {
          Button {
            sendAction(snapshot.primaryTarget)
          } label: {
            Text(buttonTitle(snapshot.primaryLabel, fallback: snapshot.asleep ? "End" : "Nap"))
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.borderedProminent)
          .tint(snapshot.asleep ? Color(red: 0.83, green: 0.52, blue: 0.49) : accent)
          .disabled(busy || snapshot.primaryTarget.isEmpty)

          Button {
            sendAction(snapshot.secondaryTarget)
          } label: {
            Text(buttonTitle(snapshot.secondaryLabel, fallback: snapshot.asleep ? "Pause" : "Bedtime"))
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .disabled(busy || snapshot.secondaryTarget.isEmpty)
        }
        .padding(.top, 4)

        if !statusHint.isEmpty {
          Text(statusHint)
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 4)
    }
    .onAppear { refresh() }
    .onReceive(timer) { date in
      tick = date
      refresh()
    }
    .onReceive(NotificationCenter.default.publisher(for: WKExtension.applicationDidBecomeActiveNotification)) { _ in
      refresh()
    }
  }

  private var accent: Color {
    switch snapshot.statusTone {
    case "asleep": return Color(red: 0.64, green: 0.65, blue: 0.81)
    case "paused": return Color(red: 0.49, green: 0.66, blue: 0.85)
    default: return Color(red: 0.86, green: 0.71, blue: 0.69)
    }
  }

  private var statusLine: String {
    if snapshot.paused { return snapshot.title }
    if snapshot.asleep { return snapshot.title }
    return snapshot.subtitle
  }

  private var timerText: String {
    let elapsed = max(0, Int(tick.timeIntervalSince(snapshot.timerDate)))
    let hours = elapsed / 3600
    let minutes = (elapsed % 3600) / 60
    if hours > 0 {
      return String(format: "%d:%02d", hours, minutes)
    }
    return String(format: "%dm", minutes)
  }

  private func buttonTitle(_ label: String, fallback: String) -> String {
    label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? fallback : label
  }

  private func refresh() {
    snapshot = SleepSnapshotStore.load()
  }

  private func sendAction(_ target: String) {
    let action = target.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !action.isEmpty, !busy else { return }
    busy = true
    statusHint = ""
    WatchConnectivitySession.shared.sendAction(action) { ok in
      DispatchQueue.main.async {
        busy = false
        statusHint = ok ? "Sent to iPhone" : "Open iPhone app nearby"
        // Optimistic local flip so the watch feels responsive.
        applyOptimistic(action)
        refresh()
      }
    }
  }

  private func applyOptimistic(_ action: String) {
    var next = snapshot
    let nowMs = Date().timeIntervalSince1970 * 1000
    switch action {
    case "start-nap", "start-bedtime":
      next.asleep = true
      next.paused = false
      next.statusTone = "asleep"
      next.title = action == "start-bedtime" ? "Bedtime" : "Nap"
      next.subtitle = "Sleeping"
      next.showTimer = true
      next.timerLowerMs = nowMs
      next.primaryLabel = "End"
      next.primaryTarget = "end"
      next.secondaryLabel = "Pause"
      next.secondaryTarget = "pause"
      next.showPrediction = false
    case "end":
      next.asleep = false
      next.paused = false
      next.statusTone = "awake"
      next.title = next.babyName
      next.subtitle = "Awake"
      next.showTimer = true
      next.timerLowerMs = nowMs
      next.primaryLabel = "Nap"
      next.primaryTarget = "start-nap"
      next.secondaryLabel = "Bedtime"
      next.secondaryTarget = "start-bedtime"
    case "pause":
      next.paused = true
      next.asleep = true
      next.statusTone = "paused"
      next.title = "Awake"
      next.subtitle = "Paused"
      next.showTimer = true
      next.timerLowerMs = nowMs
      next.primaryLabel = "End"
      next.primaryTarget = "end"
      next.secondaryLabel = "Resume"
      next.secondaryTarget = "resume"
    case "resume":
      next.paused = false
      next.asleep = true
      next.statusTone = "asleep"
      next.subtitle = "Sleeping"
      next.showTimer = true
      next.primaryLabel = "End"
      next.primaryTarget = "end"
      next.secondaryLabel = "Pause"
      next.secondaryTarget = "pause"
    default:
      return
    }
    if let data = try? JSONEncoder().encode(next),
       let json = String(data: data, encoding: .utf8) {
      SleepSnapshotStore.save(json: json)
    }
  }
}

#Preview {
  ContentView()
}
