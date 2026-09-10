const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLIST_BUILD = '$(CURRENT_PROJECT_VERSION)';
const PLIST_MARKETING = '$(MARKETING_VERSION)';

const EXTRA_PLISTS = [
  ['ios', 'WaiAir', 'Info.plist'],
  ['ios', 'ExpoWidgetsTarget', 'Info.plist'],
  ['targets', 'watch', 'Info.plist'],
  ['targets', 'watch-widget', 'Info.plist'],
];

function setPlistVersions(filePath) {
  if (!fs.existsSync(filePath)) return;
  let xml = fs.readFileSync(filePath, 'utf8');
  const next = xml
    .replace(
      /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${PLIST_BUILD}$2`,
    )
    .replace(
      /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${PLIST_MARKETING}$2`,
    );
  if (next !== xml) fs.writeFileSync(filePath, next);
}

/**
 * One source of truth: app.config.js ios.buildNumber + expo.version.
 * Plists use $(CURRENT_PROJECT_VERSION) / $(MARKETING_VERSION); this plugin
 * writes those build settings on every native target (app, widget, Watch,
 * complication).
 */
function withSyncedBuildNumber(config) {
  const buildNumber = String(config.ios?.buildNumber ?? '1');
  const marketing = String(config.ios?.version || config.version || '1.0.0');

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.CFBundleVersion = PLIST_BUILD;
    cfg.modResults.CFBundleShortVersionString = PLIST_MARKETING;
    return cfg;
  });

  config = withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (!entry || entry.isa !== 'XCBuildConfiguration' || !entry.buildSettings) continue;
      entry.buildSettings.CURRENT_PROJECT_VERSION = buildNumber;
      entry.buildSettings.MARKETING_VERSION = marketing;
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      for (const parts of EXTRA_PLISTS) {
        setPlistVersions(path.join(root, ...parts));
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withSyncedBuildNumber;
