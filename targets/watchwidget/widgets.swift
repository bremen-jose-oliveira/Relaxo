import WidgetKit
import SwiftUI

struct RelaxoWatchEntry: TimelineEntry {
  let date: Date
  let snapshot: WatchSleepSnapshot
}

struct RelaxoWatchProvider: TimelineProvider {
  func placeholder(in context: Context) -> RelaxoWatchEntry {
    RelaxoWatchEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (RelaxoWatchEntry) -> Void) {
    completion(RelaxoWatchEntry(date: Date(), snapshot: SleepSnapshotStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<RelaxoWatchEntry>) -> Void) {
    let snapshot = SleepSnapshotStore.load()
    let now = Date()
    let entry = RelaxoWatchEntry(date: now, snapshot: snapshot)
    // Refresh often enough for awake/asleep glance; phone push also reloads.
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now.addingTimeInterval(900)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}

struct RelaxoWatchWidgetView: View {
  @Environment(\.widgetFamily) var family
  var entry: RelaxoWatchEntry

  private var snapshot: WatchSleepSnapshot { entry.snapshot }

  var body: some View {
    switch family {
    case .accessoryCircular:
      circular
    case .accessoryRectangular:
      rectangular
    case .accessoryInline:
      inline
    case .accessoryCorner:
      corner
    default:
      rectangular
    }
  }

  private var circular: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 2) {
        Image(systemName: snapshot.iconName)
          .font(.caption.weight(.semibold))
        if snapshot.showTimer {
          Text(snapshot.timerDate, style: .timer)
            .font(.system(.caption2, design: .rounded).monospacedDigit())
            .widgetAccentable()
            .minimumScaleFactor(0.7)
            .lineLimit(1)
        } else if snapshot.showPrediction, !snapshot.predictionTime.isEmpty {
          Text(snapshot.predictionTime)
            .font(.caption2.weight(.semibold))
            .widgetAccentable()
            .minimumScaleFactor(0.7)
            .lineLimit(1)
        } else {
          Text(shortStatus)
            .font(.caption2.weight(.semibold))
            .widgetAccentable()
        }
      }
    }
  }

  private var rectangular: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 4) {
        Image(systemName: snapshot.iconName)
        Text(snapshot.asleep ? snapshot.title : snapshot.babyName)
          .font(.headline)
          .widgetAccentable()
          .lineLimit(1)
      }
      if snapshot.showTimer {
        Text(snapshot.timerDate, style: .timer)
          .font(.system(.body, design: .rounded).monospacedDigit())
      } else if snapshot.showPrediction, !snapshot.predictionTime.isEmpty {
        Text(snapshot.predictionTime)
          .font(.body.weight(.semibold))
        if !snapshot.predictionLabel.isEmpty {
          Text(snapshot.predictionLabel)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      } else {
        Text(snapshot.subtitle)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var inline: some View {
    Text("Relaxo · \(inlineDetail)")
  }

  private var inlineDetail: String {
    if snapshot.showTimer {
      return shortStatus
    }
    if snapshot.showPrediction, !snapshot.predictionTime.isEmpty {
      return snapshot.predictionTime
    }
    return shortStatus
  }

  private var corner: some View {
    HStack(spacing: 2) {
      Image(systemName: snapshot.iconName)
      if snapshot.showTimer {
        Text(snapshot.timerDate, style: .timer)
          .font(.caption2.monospacedDigit())
      } else if snapshot.showPrediction, !snapshot.predictionTime.isEmpty {
        Text(snapshot.predictionTime)
          .font(.caption2)
      } else {
        Text(shortStatus)
          .font(.caption2)
      }
    }
    .widgetAccentable()
  }

  private var shortStatus: String {
    if snapshot.paused { return "Awake" }
    if snapshot.asleep { return "Sleep" }
    return "Awake"
  }
}

struct RelaxoWatchWidget: Widget {
  let kind: String = SleepSnapshotStore.widgetKind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: RelaxoWatchProvider()) { entry in
      RelaxoWatchWidgetView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("Relaxo Sleep")
    .description("Baby sleep status, awake timer, and next nap.")
    .supportedFamilies([
      .accessoryCircular,
      .accessoryRectangular,
      .accessoryInline,
      .accessoryCorner,
    ])
  }
}

#Preview(as: .accessoryRectangular) {
  RelaxoWatchWidget()
} timeline: {
  RelaxoWatchEntry(date: .now, snapshot: .placeholder)
}
