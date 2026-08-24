import SwiftUI

private enum WaiAirColors {
  static let background = Color(red: 0.08, green: 0.08, blue: 0.10)
  static let yellow = Color(red: 0.96, green: 0.77, blue: 0.09)
  static let gray = Color(red: 0.55, green: 0.55, blue: 0.58)
  static let white = Color.white
  static let green = Color(red: 0.20, green: 0.78, blue: 0.35)
  static let amber = Color(red: 0.98, green: 0.65, blue: 0.12)
  static let red = Color(red: 0.95, green: 0.30, blue: 0.28)
}

struct ContentView: View {
  @EnvironmentObject private var store: WatchFlightStore

  var body: some View {
    TabView {
      MyFlightTab(flight: store.primary)
        .tag(0)
      ArrivingTab(flight: store.primary)
        .tag(1)
      SettingsTab(settings: $store.settings, onSave: store.saveSettings)
        .tag(2)
    }
    .tabViewStyle(.verticalPage)
    .background(WaiAirColors.background)
    .onAppear { store.reload() }
  }
}

private struct MyFlightTab: View {
  let flight: WatchFlight?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text("MY FLIGHT")
          .font(.caption2)
          .foregroundStyle(WaiAirColors.gray)
          .tracking(1)

        if let flight {
          Text(flight.flightNumber)
            .font(.system(size: 28, weight: .bold))
            .foregroundStyle(WaiAirColors.white)

          Text("\(flight.origin) → \(flight.destination)")
            .font(.caption)
            .foregroundStyle(WaiAirColors.gray)

          Text(flight.departureTime)
            .font(.system(size: 24, weight: .semibold))
            .foregroundStyle(WaiAirColors.yellow)

          StatusBadge(status: flight.status)

          if !flight.gate.isEmpty {
            GatePill(gate: flight.gate)
          }
        } else {
          Text("No tracked flight")
            .font(.caption)
            .foregroundStyle(WaiAirColors.gray)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 8)
      .padding(.top, 4)
    }
  }
}

private struct ArrivingTab: View {
  let flight: WatchFlight?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text("ARRIVING")
          .font(.caption2)
          .foregroundStyle(WaiAirColors.gray)
          .tracking(1)

        if let flight {
          Text(flight.inboundFlightNumber.isEmpty ? flight.flightNumber : flight.inboundFlightNumber)
            .font(.system(size: 22, weight: .bold))
            .foregroundStyle(WaiAirColors.white)

          Text(flight.landsInLabel.isEmpty ? flight.countdownLabel : flight.landsInLabel)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(WaiAirColors.yellow)

          Text(flight.arrivalTime)
            .font(.caption)
            .foregroundStyle(WaiAirColors.gray)
        } else {
          Text("No inbound flight")
            .font(.caption)
            .foregroundStyle(WaiAirColors.gray)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 8)
      .padding(.top, 4)
    }
  }
}

private struct SettingsTab: View {
  @Binding var settings: WatchSettings
  let onSave: () -> Void

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 12) {
        Text("SETTINGS")
          .font(.caption2)
          .foregroundStyle(WaiAirColors.gray)
          .tracking(1)

        VStack(alignment: .leading, spacing: 4) {
          Text("Airport")
            .font(.caption2)
            .foregroundStyle(WaiAirColors.gray)
          TextField("IATA", text: $settings.airport)
            .textInputAutocapitalization(.characters)
            .onChange(of: settings.airport) { _, _ in onSave() }
        }

        Toggle(isOn: $settings.darkTheme) {
          Text("Dark theme")
            .font(.caption)
        }
        .onChange(of: settings.darkTheme) { _, _ in onSave() }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 8)
      .padding(.top, 4)
    }
  }
}

private struct StatusBadge: View {
  let status: String

  private var color: Color {
    let lower = status.lowercased()
    if lower.contains("delay") || lower.contains("late") { return WaiAirColors.amber }
    if lower.contains("cancel") || lower.contains("divert") { return WaiAirColors.red }
    if lower.contains("land") || lower.contains("arriv") || lower.contains("board") { return WaiAirColors.green }
    return WaiAirColors.green
  }

  var body: some View {
    Text(status.uppercased())
      .font(.caption2.weight(.bold))
      .foregroundStyle(color)
      .padding(.horizontal, 8)
      .padding(.vertical, 4)
      .background(color.opacity(0.18))
      .clipShape(Capsule())
  }
}

private struct GatePill: View {
  let gate: String

  var body: some View {
    Text("Gate \(gate)")
      .font(.caption.weight(.semibold))
      .foregroundStyle(WaiAirColors.background)
      .padding(.horizontal, 10)
      .padding(.vertical, 5)
      .background(WaiAirColors.yellow)
      .clipShape(Capsule())
  }
}
