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

function patchPodfileProperties(projectRoot) {
  const file = path.join(projectRoot, 'ios', 'Podfile.properties.json');
  if (!fs.existsSync(file)) return;
  let props;
  try {
    props = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return;
  }
  if (props.EXPO_USE_PRECOMPILED_MODULES === 'false') return;
  props.EXPO_USE_PRECOMPILED_MODULES = 'false';
  fs.writeFileSync(file, `${JSON.stringify(props, null, 2)}\n`);
}

/**
 * expo-store-review 57.0.2 calls SceneGeometry.foregroundScene(), which is not
 * in Expo SDK 57's expo-modules-core. Replace it with UIKit scene lookup.
 *
 * Also disables precompiled Expo XCFrameworks — mismatched ExpoFileSystem /
 * ExpoModulesCore binaries crash at launch (dyld: BaseModule.willDestroy).
 */
function withStoreReviewSceneFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      patchPodfileProperties(cfg.modRequest.projectRoot);

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
