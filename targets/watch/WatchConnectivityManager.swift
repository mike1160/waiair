import Foundation
import WatchConnectivity

final class WatchConnectivityManager: NSObject, ObservableObject {
  static let shared = WatchConnectivityManager()

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }
}

extension WatchConnectivityManager: WCSessionDelegate {
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if let context = session.receivedApplicationContext as? [String: Any], !context.isEmpty {
      DispatchQueue.main.async {
        WatchFlightStore.shared.applyContext(context)
      }
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async {
      WatchFlightStore.shared.applyContext(applicationContext)
    }
  }
}
