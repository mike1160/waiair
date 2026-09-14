import ExpoModulesCore
import PassKit

/// Apple Wallet for WaiAir: Apple's own "Add to Apple Wallet" badge (PKAddPassButton) and the add-pass sheet
/// (PKAddPassesViewController) for a .pkpass downloaded from the proxy.
public class WalletPassModule: Module {
  private var pendingDelegate: AddPassDelegate?

  public func definition() -> ModuleDefinition {
    Name("WalletPass")

    Function("canAddPasses") { () -> Bool in
      PKAddPassesViewController.canAddPasses()
    }

    /// Downloads the pass (with the given headers) and shows the add-pass sheet.
    /// Resolves "added" when the pass is in Wallet afterwards, "cancelled" otherwise.
    AsyncFunction("addPassFromUrl") { (url: URL, headers: [String: String], promise: Promise) in
      var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
      for (name, value) in headers {
        request.setValue(value, forHTTPHeaderField: name)
      }
      URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
          promise.reject("E_WALLET_DOWNLOAD", error.localizedDescription)
          return
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200, let data = data else {
          promise.reject("E_WALLET_HTTP", "Pass download failed with HTTP \(status)")
          return
        }
        DispatchQueue.main.async {
          self.present(data: data, promise: promise)
        }
      }.resume()
    }

    View(WalletPassButtonView.self) {
      Events("onPress")

      Prop("buttonStyle") { (view: WalletPassButtonView, style: String) in
        view.setButtonStyle(style)
      }
    }
  }

  private func present(data: Data, promise: Promise) {
    let pass: PKPass
    do {
      pass = try PKPass(data: data)
    } catch {
      promise.reject("E_WALLET_INVALID_PASS", error.localizedDescription)
      return
    }
    guard let controller = PKAddPassesViewController(pass: pass),
          let presenter = appContext?.utilities?.currentViewController() else {
      promise.reject("E_WALLET_UNAVAILABLE", "Apple Wallet is not available")
      return
    }
    let delegate = AddPassDelegate { [weak self] in
      self?.pendingDelegate = nil
      promise.resolve(PKPassLibrary().containsPass(pass) ? "added" : "cancelled")
    }
    pendingDelegate = delegate
    controller.delegate = delegate
    presenter.present(controller, animated: true)
  }
}

private final class AddPassDelegate: NSObject, PKAddPassesViewControllerDelegate {
  private let onFinish: () -> Void

  init(onFinish: @escaping () -> Void) {
    self.onFinish = onFinish
  }

  func addPassesViewControllerDidFinish(_ controller: PKAddPassesViewController) {
    controller.dismiss(animated: true) { self.onFinish() }
  }
}

/// PKAddPassButton: Apple's localized badge, required by the Wallet guidelines instead of a custom button.
final class WalletPassButtonView: ExpoView {
  let onPress = EventDispatcher()
  private let button = PKAddPassButton(addPassButtonStyle: .black)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    button.addTarget(self, action: #selector(pressed), for: .touchUpInside)
    addSubview(button)
  }

  func setButtonStyle(_ style: String) {
    button.addPassButtonStyle = style == "blackOutline" ? .blackOutline : .black
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  @objc private func pressed() {
    onPress()
  }
}
