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

  private func ingest(_ payload: [String: Any]) {
    DispatchQueue.main.async {
      WatchFlightStore.shared.applyContext(payload)
    }
  }
}

extension WatchConnectivityManager: WCSessionDelegate {
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    guard activationState == .activated else { return }
    let context = session.receivedApplicationContext
    if !context.isEmpty {
      ingest(context)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    ingest(applicationContext)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    ingest(userInfo)
  }
}
