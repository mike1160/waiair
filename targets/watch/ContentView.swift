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
  @State private var flightPageIndex = 0

  var body: some View {
    TabView {
      MyFlightTab(
        flights: store.flights,
        pageIndex: $flightPageIndex
      )
      .tag(0)
      ArrivingTab(
        flights: store.flights,
        pageIndex: flightPageIndex
      )
      .tag(1)
      SettingsTab(settings: $store.settings, onSave: store.saveSettings)
        .tag(2)
    }
    .tabViewStyle(.verticalPage)
    .background(WaiAirColors.background)
    .onAppear { store.reload() }
    .onChange(of: store.flights.count) { _, newCount in
      if flightPageIndex >= newCount {
        flightPageIndex = max(0, newCount - 1)
      }
    }
  }
}

private struct MyFlightTab: View {
  let flights: [WatchFlight]
  @Binding var pageIndex: Int

  var body: some View {
    VStack(spacing: 0) {
      Text("MY FLIGHT")
        .font(.caption2)
        .foregroundStyle(WaiAirColors.gray)
        .tracking(1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 8)
        .padding(.top, 4)

      if flights.isEmpty {
        ScrollView {
          Text("No tracked flight")
            .font(.caption)
            .foregroundStyle(WaiAirColors.gray)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 8)
            .padding(.top, 8)
        }
      } else {
        TabView(selection: $pageIndex) {
          ForEach(Array(flights.enumerated()), id: \.element.id) { index, flight in
            MyFlightPage(flight: flight)
              .tag(index)
          }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))

        if flights.count > 1 {
          FlightPagerDots(count: flights.count, active: pageIndex)
        }
      }
    }
  }
}

private struct MyFlightPage: View {
  let flight: WatchFlight

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
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
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 8)
      .padding(.top, 4)
    }
  }
}

private struct FlightPagerDots: View {
  let count: Int
  let active: Int
  private let maxSlots = WatchFlightStore.maxFlights

  var body: some View {
    HStack(spacing: 6) {
      ForEach(0..<maxSlots, id: \.self) { slot in
        Circle()
          .fill(dotFill(slot))
          .frame(width: slot == active ? 8 : 6, height: slot == active ? 8 : 6)
          .overlay {
            if slot >= count {
              Circle()
                .stroke(WaiAirColors.gray.opacity(0.35), lineWidth: 1)
            }
          }
      }
    }
    .padding(.vertical, 6)
  }

  private func dotFill(_ slot: Int) -> Color {
    guard slot < count else { return .clear }
    return slot == active ? WaiAirColors.yellow : WaiAirColors.gray.opacity(0.45)
  }
}

private struct ArrivingTab: View {
  let flights: [WatchFlight]
  let pageIndex: Int

  private var flight: WatchFlight? {
    guard !flights.isEmpty else { return nil }
    let idx = min(max(0, pageIndex), flights.count - 1)
    return flights[idx]
  }

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
            .autocorrectionDisabled()
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
