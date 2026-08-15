const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const REPLACEMENT = `@MainActor
  private func getForegroundActiveScene() -> UIWindowScene? {
    if let active = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
      return active
    }
    return UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundInactive }) as? UIWindowScene
  }`;

/**
 * expo-store-review 57.0.2 calls SceneGeometry.foregroundScene(), which is not
 * in Expo SDK 57's expo-modules-core. Replace it with UIKit scene lookup.
 */
function withStoreReviewSceneFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const file = path.join(
        cfg.modRequest.projectRoot,
        'node_modules/expo-store-review/ios/StoreReviewModule.swift',
      );
      if (!fs.existsSync(file)) return cfg;
      const src = fs.readFileSync(file, 'utf8');
      if (!src.includes('SceneGeometry')) return cfg;
      const next = src.replace(
        /@MainActor\s+private func getForegroundActiveScene\(\) -> UIWindowScene\? \{[\s\S]*?return SceneGeometry\.foregroundScene\(\)\s*\}/,
        REPLACEMENT,
      );
      if (next !== src) fs.writeFileSync(file, next);
      return cfg;
    },
  ]);
}

module.exports = withStoreReviewSceneFix;
