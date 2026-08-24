import WidgetKit
import SwiftUI

private enum ComplicationColors {
  static let yellow = Color(red: 0.96, green: 0.77, blue: 0.09)
  static let gray = Color(red: 0.55, green: 0.55, blue: 0.58)
  static let green = Color(red: 0.20, green: 0.78, blue: 0.35)
}

struct ComplicationEntry: TimelineEntry {
  let date: Date
  let gate: String
  let departureTime: String
  let flightNumber: String
  let status: String
  let countdownLabel: String
}

struct WaiAirComplicationProvider: TimelineProvider {
  func placeholder(in context: Context) -> ComplicationEntry {
    ComplicationEntry(
      date: Date(),
      gate: "A12",
      departureTime: "14:30",
      flightNumber: "TG401",
      status: "On time",
      countdownLabel: "2h 15m"
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (ComplicationEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
    let entry = loadEntry()
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func loadEntry() -> ComplicationEntry {
    guard let defaults = UserDefaults(suiteName: "group.com.waiair.WaiAir"),
          let json = defaults.string(forKey: "watchTrackedFlights"),
          let data = json.data(using: .utf8),
          let flights = try? JSONDecoder().decode([WatchFlight].self, from: data),
          let flight = flights.first else {
      return ComplicationEntry(
        date: Date(),
        gate: "—",
        departureTime: "—",
        flightNumber: "WaiAir",
        status: "No flight",
        countdownLabel: ""
      )
    }
    return ComplicationEntry(
      date: Date(),
      gate: flight.gate.isEmpty ? "—" : flight.gate,
      departureTime: flight.departureTime,
      flightNumber: flight.flightNumber,
      status: flight.status,
      countdownLabel: flight.countdownLabel
    )
  }
}

struct WaiAirComplicationWidget: Widget {
  let kind = "WaiAirComplication"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: WaiAirComplicationProvider()) { entry in
      WaiAirComplicationView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("WaiAir")
    .description("Gate, departure, and flight status.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}

struct WaiAirComplicationView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ComplicationEntry

  var body: some View {
    switch family {
    case .accessoryCircular:
      VStack(spacing: 1) {
        Text(entry.gate)
          .font(.caption2.weight(.bold))
        Text(entry.departureTime)
          .font(.system(size: 9))
          .foregroundStyle(ComplicationColors.yellow)
      }
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 2) {
        Text(entry.flightNumber)
          .font(.caption.weight(.bold))
        HStack {
          Text(entry.status)
            .font(.caption2)
            .foregroundStyle(ComplicationColors.green)
          Spacer()
          if !entry.countdownLabel.isEmpty {
            Text(entry.countdownLabel)
              .font(.caption2)
              .foregroundStyle(ComplicationColors.yellow)
          }
        }
      }
    default:
      Text(entry.flightNumber)
    }
  }
}

@main
struct WaiAirComplicationBundle: WidgetBundle {
  var body: some Widget {
    WaiAirComplicationWidget()
  }
}

struct WatchFlight: Codable {
  let flightNumber: String
  let status: String
  let gate: String
  let departureTime: String
  let arrivalTime: String
  let origin: String
  let destination: String
  let inboundFlightNumber: String
  let landsInLabel: String
  let countdownLabel: String
  let terminal: String
}
