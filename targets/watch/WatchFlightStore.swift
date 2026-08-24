import Foundation
import Combine

struct WatchFlight: Codable, Identifiable {
  var id: String { flightNumber }
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

struct WatchSettings: Codable {
  var airport: String
  var darkTheme: Bool
}

final class WatchFlightStore: ObservableObject {
  static let shared = WatchFlightStore()
  static let appGroup = "group.com.waiair.WaiAir"
  static let flightsKey = "watchTrackedFlights"
  static let settingsKey = "watchSettings"

  @Published var primary: WatchFlight?
  @Published var settings = WatchSettings(airport: "BKK", darkTheme: true)

  private init() {
    reload()
  }

  func reload() {
    guard let defaults = UserDefaults(suiteName: Self.appGroup) else { return }

    if let json = defaults.string(forKey: Self.flightsKey),
       let data = json.data(using: .utf8),
       let flights = try? JSONDecoder().decode([WatchFlight].self, from: data) {
      primary = flights.first
    } else {
      primary = nil
    }

    if let settingsJson = defaults.string(forKey: Self.settingsKey),
       let data = settingsJson.data(using: .utf8),
       let decoded = try? JSONDecoder().decode(WatchSettings.self, from: data) {
      settings = decoded
    }
  }

  func saveSettings() {
    guard let defaults = UserDefaults(suiteName: Self.appGroup),
          let data = try? JSONEncoder().encode(settings),
          let json = String(data: data, encoding: .utf8) else { return }
    defaults.set(json, forKey: Self.settingsKey)
  }

  /// Apply iPhone sync payload and persist to the Watch App Group (separate from iPhone container).
  func applyContext(_ context: [String: Any]) {
    guard let defaults = UserDefaults(suiteName: Self.appGroup) else { return }

    if let json = context["watchTrackedFlights"] as? String {
      defaults.set(json, forKey: Self.flightsKey)
      if let data = json.data(using: .utf8),
         let flights = try? JSONDecoder().decode([WatchFlight].self, from: data) {
        primary = flights.first
      } else {
        primary = nil
      }
    }

    if let settingsJson = context["watchSettings"] as? String {
      defaults.set(settingsJson, forKey: Self.settingsKey)
      if let data = settingsJson.data(using: .utf8),
         let decoded = try? JSONDecoder().decode(WatchSettings.self, from: data) {
        settings = decoded
      }
    }
  }
}
