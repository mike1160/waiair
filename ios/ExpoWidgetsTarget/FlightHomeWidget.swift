import WidgetKit
import SwiftUI

private let appGroupId = "group.com.waiair.WaiAir"
private let widgetFlightKey = "widgetFlight"
private let trackedFlightsKey = "trackedFlights"

private enum WidgetColors {
  static let bg = Color(red: 0.06, green: 0.07, blue: 0.09)
  static let yellow = Color(red: 0.96, green: 0.77, blue: 0.09)
  static let white = Color.white
  static let muted = Color(red: 0.53, green: 0.53, blue: 0.53)
  static let green = Color(red: 0.0, green: 0.78, blue: 0.33)
  static let amber = Color(red: 1.0, green: 0.60, blue: 0.0)
  static let red = Color(red: 0.96, green: 0.26, blue: 0.21)
}

struct WidgetFlightCard: Codable {
  var hasFlight: Bool
  var flightNumber: String?
  var from: String?
  var to: String?
  var departureTime: String?
  var status: String?
  var statusLabel: String?
  var gate: String?
  var emptyTitle: String?
  var emptySubtitle: String?
  var brandLabel: String?
}

struct FlightHomeEntry: TimelineEntry {
  let date: Date
  let card: WidgetFlightCard
}

enum WidgetFlightStore {
  static func loadCard() -> WidgetFlightCard {
    guard let defaults = UserDefaults(suiteName: appGroupId) else {
      return emptyCard()
    }
    if let card = decodeCard(defaults.string(forKey: widgetFlightKey))
      ?? decodeCardData(defaults.data(forKey: widgetFlightKey)) {
      return card
    }
    if let fallback = cardFromTrackedList(defaults.string(forKey: trackedFlightsKey)) {
      return fallback
    }
    return emptyCard()
  }

  private static func emptyCard() -> WidgetFlightCard {
    WidgetFlightCard(
      hasFlight: false,
      emptyTitle: "Track a flight",
      emptySubtitle: "Tap to add your flight",
      brandLabel: "WaiAir"
    )
  }

  private static func decodeCard(_ json: String?) -> WidgetFlightCard? {
    guard let json, let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetFlightCard.self, from: data)
  }

  private static func decodeCardData(_ data: Data?) -> WidgetFlightCard? {
    guard let data else { return nil }
    return try? JSONDecoder().decode(WidgetFlightCard.self, from: data)
  }

  private static func cardFromTrackedList(_ json: String?) -> WidgetFlightCard? {
    guard let json, let data = json.data(using: .utf8),
          let raw = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
          let first = raw.first else { return nil }
    let number = String(first["flightNumber"] as? String ?? "").replacingOccurrences(of: " ", with: "")
    if number.isEmpty { return nil }
    return WidgetFlightCard(
      hasFlight: true,
      flightNumber: number.uppercased(),
      from: (first["origin"] as? String ?? "—").uppercased(),
      to: (first["destination"] as? String ?? "—").uppercased(),
      departureTime: first["departureTime"] as? String,
      status: first["status"] as? String,
      statusLabel: first["status"] as? String,
      gate: first["gate"] as? String
    )
  }
}

struct FlightHomeProvider: TimelineProvider {
  func placeholder(in context: Context) -> FlightHomeEntry {
    FlightHomeEntry(
      date: Date(),
      card: WidgetFlightCard(
        hasFlight: true,
        flightNumber: "TG401",
        from: "BKK",
        to: "SIN",
        departureTime: "14:30",
        status: "scheduled",
        statusLabel: "On time",
        gate: "A12",
        brandLabel: "WaiAir"
      )
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (FlightHomeEntry) -> Void) {
    completion(FlightHomeEntry(date: Date(), card: WidgetFlightStore.loadCard()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<FlightHomeEntry>) -> Void) {
    let entry = FlightHomeEntry(date: Date(), card: WidgetFlightStore.loadCard())
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}

struct FlightHomeWidget: Widget {
  let kind = "FlightHomeWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: FlightHomeProvider()) { entry in
      FlightHomeView(entry: entry)
        .containerBackground(WidgetColors.bg, for: .widget)
    }
    .configurationDisplayName("WaiAir")
    .description(String(localized: "home_widget_description"))
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

struct FlightHomeView: View {
  @Environment(\.widgetFamily) private var family
  let entry: FlightHomeEntry

  var body: some View {
    Group {
      if entry.card.hasFlight {
        switch family {
        case .systemSmall:
          SmallFlightView(card: entry.card)
        default:
          MediumFlightView(card: entry.card)
        }
      } else {
        EmptyFlightView(card: entry.card, compact: family == .systemSmall)
      }
    }
    .widgetURL(URL(string: "waiair://"))
  }
}

private struct EmptyFlightView: View {
  let card: WidgetFlightCard
  let compact: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 6 : 8) {
      Text("✈ \(card.brandLabel ?? "WaiAir")")
        .font(.caption.bold())
        .foregroundStyle(WidgetColors.yellow)
      Text(card.emptyTitle ?? "Track a flight")
        .font(.headline.weight(.semibold))
        .foregroundStyle(WidgetColors.white)
        .lineLimit(2)
      if !compact, let sub = card.emptySubtitle, !sub.isEmpty {
        Text(sub)
          .font(.footnote)
          .foregroundStyle(WidgetColors.muted)
          .lineLimit(2)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .padding(compact ? 12 : 16)
  }
}

private struct SmallFlightView: View {
  let card: WidgetFlightCard

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(card.flightNumber ?? "—")
        .font(.headline.bold())
        .foregroundStyle(WidgetColors.white)
        .minimumScaleFactor(0.7)
        .lineLimit(1)
      Text(card.statusLabel ?? card.status ?? "")
        .font(.callout.weight(.semibold))
        .foregroundStyle(statusColor(card))
        .lineLimit(1)
      Text(card.departureTime ?? "—")
        .font(.title2.bold().monospacedDigit())
        .foregroundStyle(WidgetColors.white)
        .lineLimit(1)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .padding(12)
  }
}

private struct MediumFlightView: View {
  let card: WidgetFlightCard

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(card.flightNumber ?? "—")
        .font(.headline.bold())
        .foregroundStyle(WidgetColors.white)
        .lineLimit(1)
      Text("\(card.from ?? "—") → \(card.to ?? "—")")
        .font(.body.weight(.semibold))
        .foregroundStyle(WidgetColors.white)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
      Text(card.departureTime ?? "—")
        .font(.title2.bold().monospacedDigit())
        .foregroundStyle(WidgetColors.white)
      HStack(spacing: 8) {
        Text(card.statusLabel ?? card.status ?? "")
          .font(.footnote.weight(.semibold))
          .foregroundStyle(statusColor(card))
        if let gate = gateLabel(card.gate) {
          Text("·")
            .foregroundStyle(WidgetColors.muted)
          Text(gate)
            .font(.footnote.weight(.medium))
            .foregroundStyle(WidgetColors.white)
        }
        Spacer(minLength: 0)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .padding(16)
  }
}

private func gateLabel(_ raw: String?) -> String? {
  let trimmed = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmed.isEmpty { return nil }
  if ["—", "-", "–", "n/a", "na", "tba", "tbd"].contains(trimmed.lowercased()) { return nil }
  if trimmed.lowercased().hasPrefix("gate") { return trimmed }
  return "Gate \(trimmed)"
}

private func statusColor(_ card: WidgetFlightCard) -> Color {
  let blob = "\(card.status ?? "") \(card.statusLabel ?? "")".lowercased()
  if blob.contains("cancel") { return WidgetColors.red }
  if blob.contains("delay") { return WidgetColors.amber }
  if blob.contains("board") || blob.contains("on time") || blob.contains("scheduled") || blob.contains("land") {
    return WidgetColors.green
  }
  return WidgetColors.yellow
}
