import SwiftUI

@main
struct WaiAirWatchApp: App {
  @StateObject private var store = WatchFlightStore.shared

  init() {
    WatchConnectivityManager.shared.activate()
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(store)
    }
  }
}
