const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLIST_VERSION = '$(CURRENT_PROJECT_VERSION)';

const EXTRA_PLISTS = [
  ['ios', 'WaiAir', 'Info.plist'],
  ['ios', 'ExpoWidgetsTarget', 'Info.plist'],
  ['targets', 'watch', 'Info.plist'],
  ['targets', 'watch-widget', 'Info.plist'],
];

function setPlistBundleVersion(filePath) {
  if (!fs.existsSync(filePath)) return;
  const xml = fs.readFileSync(filePath, 'utf8');
  const next = xml.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${PLIST_VERSION}$2`,
  );
  if (next !== xml) fs.writeFileSync(filePath, next);
}

/**
 * One source of truth for CFBundleVersion: app.config.js ios.buildNumber.
 * Plists use $(CURRENT_PROJECT_VERSION); this plugin writes that build setting
 * on every native target (app, widget, Watch, complication).
 */
function withSyncedBuildNumber(config) {
  const buildNumber = String(config.ios?.buildNumber ?? '1');

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.CFBundleVersion = PLIST_VERSION;
    return cfg;
  });

  config = withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (!entry || entry.isa !== 'XCBuildConfiguration' || !entry.buildSettings) continue;
      entry.buildSettings.CURRENT_PROJECT_VERSION = buildNumber;
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      for (const parts of EXTRA_PLISTS) {
        setPlistBundleVersion(path.join(root, ...parts));
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withSyncedBuildNumber;
