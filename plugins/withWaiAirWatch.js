const fs = require('fs');
const path = require('path');
const xcode = require('xcode');
const { IOSConfig, withFinalizedMod } = require('@expo/config-plugins');

const WATCH_BUNDLE_ID = 'com.waiair.WaiAir.watchkitapp';
const COMPLICATION_BUNDLE_ID = 'com.waiair.WaiAir.watchkitapp.widget';
const WATCH_TARGET_NAME = 'WaiAirWatch';
const COMPLICATION_TARGET_NAME = 'WaiAirComplication';
const WATCH_NAMES = ['WaiAirWatch', 'WaiAir Watch'];
const COMPLICATION_NAMES = ['WaiAirComplication', 'WaiAir Complication'];
const WATCH_SOURCE_DIR = path.join('targets', 'watch');
const COMPLICATION_SOURCE_DIR = path.join('targets', 'watch-widget');
const WATCH_ENTITLEMENTS = path.join('.targets', 'WaiAirWatch', 'generated.entitlements');
const COMPLICATION_ENTITLEMENTS = path.join(
  '.targets',
  'WaiAirComplication',
  'generated.entitlements',
);
const APP_GROUP_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.application-groups</key>
    <array>
      <string>group.com.waiair.WaiAir</string>
    </array>
  </dict>
</plist>
`;

function unquote(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^"(.*)"$/, '$1');
}

function writeFileIfMissing(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents);
  }
}

function ensureEntitlements(projectRoot) {
  const iosRoot = path.join(projectRoot, 'ios');
  writeFileIfMissing(path.join(iosRoot, WATCH_ENTITLEMENTS), APP_GROUP_ENTITLEMENTS);
  writeFileIfMissing(path.join(iosRoot, COMPLICATION_ENTITLEMENTS), APP_GROUP_ENTITLEMENTS);
}

function listTargetFiles(projectRoot, relativeDir) {
  const absDir = path.join(projectRoot, relativeDir);
  if (!fs.existsSync(absDir)) {
    throw new Error(`[withWaiAirWatch] Missing source directory: ${absDir}`);
  }
  const skip = new Set(['expo-target.config.json', 'project.json', 'Info.plist', '.DS_Store']);
  const swiftFiles = [];
  const resourceFiles = [];
  for (const name of fs.readdirSync(absDir)) {
    if (skip.has(name)) continue;
    const full = path.join(absDir, name);
    const relFromIos = path.join('..', relativeDir, name);
    if (name.endsWith('.swift')) {
      swiftFiles.push(relFromIos);
    } else if (name.endsWith('.xcassets') || fs.statSync(full).isDirectory()) {
      resourceFiles.push(relFromIos);
    }
  }
  return { swiftFiles, resourceFiles, absDir };
}

function nativeTargets(project) {
  const section = project.pbxNativeTargetSection() || {};
  return Object.keys(section)
    .filter((key) => !key.endsWith('_comment'))
    .map((uuid) => ({ uuid, target: section[uuid] }));
}

function findTarget(project, names, bundleId) {
  const byName = nativeTargets(project).find(({ target }) => {
    const name = unquote(target.name);
    const productName = unquote(target.productName);
    return names.includes(name) || names.includes(productName);
  });
  if (byName) return byName;

  const configs = project.pbxXCBuildConfigurationSection() || {};
  const lists = project.pbxXCConfigurationList() || {};
  return nativeTargets(project).find(({ target }) => {
    const list = lists[target.buildConfigurationList];
    if (!list?.buildConfigurations) return false;
    return list.buildConfigurations.some((entry) => {
      const settings = configs[entry.value]?.buildSettings || {};
      return unquote(settings.PRODUCT_BUNDLE_IDENTIFIER) === bundleId;
    });
  });
}

function applyBuildSettings(project, targetUuid, settings) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
  const configs = project.pbxXCBuildConfigurationSection();
  for (const entry of list.buildConfigurations) {
    const config = configs[entry.value];
    if (!config?.buildSettings) continue;
    Object.assign(config.buildSettings, settings);
  }
}

function watchBuildSettings(config, { infoPlist, entitlements, displayName, bundleId }) {
  const teamId = config.ios?.appleTeamId || 'J56ZKH58J9';
  const companionId = config.ios?.bundleIdentifier || 'com.waiair.WaiAir';
  const version = config.ios?.version || config.version || '1.0.0';
  const buildNumber = String(config.ios?.buildNumber || '1');
  return {
    ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
    CLANG_ANALYZER_NONNULL: 'YES',
    CLANG_ENABLE_OBJC_WEAK: 'YES',
    CODE_SIGN_ENTITLEMENTS: entitlements,
    CODE_SIGN_STYLE: 'Automatic',
    CURRENT_PROJECT_VERSION: buildNumber,
    DEVELOPMENT_TEAM: teamId,
    ENABLE_PREVIEWS: 'YES',
    GENERATE_INFOPLIST_FILE: 'YES',
    INFOPLIST_FILE: `"${infoPlist}"`,
    INFOPLIST_KEY_CFBundleDisplayName: `"${displayName}"`,
    INFOPLIST_KEY_UISupportedInterfaceOrientations:
      '"UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown"',
    INFOPLIST_KEY_WKCompanionAppBundleIdentifier: companionId,
    LD_RUNPATH_SEARCH_PATHS: ['"$(inherited)"', '"@executable_path/Frameworks"'],
    MARKETING_VERSION: version,
    PRODUCT_BUNDLE_IDENTIFIER: bundleId,
    PRODUCT_NAME: '"$(TARGET_NAME)"',
    REGISTER_APP_GROUPS: 'YES',
    SDKROOT: 'watchos',
    SKIP_INSTALL: 'YES',
    SWIFT_EMIT_LOC_STRINGS: 'YES',
    SWIFT_VERSION: '5.0',
    TARGETED_DEVICE_FAMILY: '4',
    WATCHOS_DEPLOYMENT_TARGET: '10.0',
  };
}

function complicationBuildSettings(config, { infoPlist, entitlements, displayName, bundleId }) {
  const teamId = config.ios?.appleTeamId || 'J56ZKH58J9';
  const version = config.ios?.version || config.version || '1.0.0';
  const buildNumber = String(config.ios?.buildNumber || '1');
  return {
    CLANG_ANALYZER_NONNULL: 'YES',
    CLANG_ENABLE_OBJC_WEAK: 'YES',
    CODE_SIGN_ENTITLEMENTS: entitlements,
    CODE_SIGN_STYLE: 'Automatic',
    CURRENT_PROJECT_VERSION: buildNumber,
    DEVELOPMENT_TEAM: teamId,
    GENERATE_INFOPLIST_FILE: 'YES',
    INFOPLIST_FILE: `"${infoPlist}"`,
    INFOPLIST_KEY_CFBundleDisplayName: `"${displayName}"`,
    INFOPLIST_KEY_NSHumanReadableCopyright: '""',
    LD_RUNPATH_SEARCH_PATHS: ['"$(inherited)"', '"@executable_path/Frameworks"'],
    MARKETING_VERSION: version,
    PRODUCT_BUNDLE_IDENTIFIER: bundleId,
    PRODUCT_NAME: '"$(TARGET_NAME)"',
    REGISTER_APP_GROUPS: 'YES',
    SDKROOT: 'watchos',
    SKIP_INSTALL: 'YES',
    SWIFT_EMIT_LOC_STRINGS: 'YES',
    SWIFT_VERSION: '5.0',
    TARGETED_DEVICE_FAMILY: '4',
    WATCHOS_DEPLOYMENT_TARGET: '10.0',
  };
}

function ensureTargetAttributes(project, targetUuid, teamId) {
  const firstProject = project.getFirstProject();
  const pbxProject = project.pbxProjectSection()[firstProject.uuid];
  pbxProject.attributes = pbxProject.attributes || {};
  pbxProject.attributes.TargetAttributes = pbxProject.attributes.TargetAttributes || {};
  pbxProject.attributes.TargetAttributes[targetUuid] = {
    CreatedOnToolsVersion: '14.3',
    DevelopmentTeam: teamId,
    ProvisioningStyle: 'Automatic',
  };
}

function hasBuildPhase(project, targetUuid, isa, comment) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const section = project.hash.project.objects[isa] || {};
  return (target.buildPhases || []).some(
    (phase) => (!comment || phase.comment === comment) && section[phase.value],
  );
}

function addGroupToMain(project, groupUuid) {
  const groups = project.hash.project.objects.PBXGroup;
  for (const key of Object.keys(groups)) {
    if (key.endsWith('_comment')) continue;
    const group = groups[key];
    if (group.name === undefined && group.path === undefined) {
      project.addToPbxGroup(groupUuid, key);
      return;
    }
  }
}

function addNativeTarget(project, { name, productName, productType, productFile, explicitFileType }) {
  const targetUuid = project.generateUuid();
  const configList = project.addXCConfigurationList(
    [
      { name: 'Debug', isa: 'XCBuildConfiguration', buildSettings: {} },
      { name: 'Release', isa: 'XCBuildConfiguration', buildSettings: {} },
    ],
    'Release',
    `Build configuration list for PBXNativeTarget "${name}"`,
  );
  const product = project.addProductFile(productFile.replace(/\.(app|appex)$/, ''), {
    explicitFileType,
    includeInIndex: 0,
    path: productFile,
    sourceTree: 'BUILT_PRODUCTS_DIR',
    group: 'Products',
    target: targetUuid,
  });
  const target = {
    uuid: targetUuid,
    pbxNativeTarget: {
      isa: 'PBXNativeTarget',
      name,
      productName,
      productReference: product.fileRef,
      productType: `"${productType}"`,
      buildConfigurationList: configList.uuid,
      buildPhases: [],
      buildRules: [],
      dependencies: [],
    },
  };
  project.addToPbxNativeTargetSection(target);
  project.addToPbxProjectSection(target);
  return { targetUuid, product };
}

function ensureEmbedPhase(project, hostTargetUuid, product, { name, dstSubfolderSpec, dstPath, folderType }) {
  if (!hasBuildPhase(project, hostTargetUuid, 'PBXCopyFilesBuildPhase', name)) {
    project.addBuildPhase([], 'PBXCopyFilesBuildPhase', name, hostTargetUuid, folderType, dstPath);
  }
  const section = project.hash.project.objects.PBXCopyFilesBuildPhase;
  const host = project.pbxNativeTargetSection()[hostTargetUuid];
  const phaseRef = (host.buildPhases || []).find((phase) => phase.comment === name);
  if (!phaseRef) return;
  const phase = section[phaseRef.value];
  phase.dstSubfolderSpec = dstSubfolderSpec;
  if (dstPath) phase.dstPath = `"${dstPath}"`;
  if (!project.pbxBuildFileSection()[product.uuid]) {
    product.settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] };
    project.addToPbxBuildFileSection(product);
  }
  const already = (phase.files || []).some((file) => file.value === product.uuid);
  if (!already) {
    phase.files.push({
      value: product.uuid,
      comment: `${product.basename} in ${name}`,
    });
  }
}

function ensureDependency(project, hostUuid, targetUuid) {
  const host = project.pbxNativeTargetSection()[hostUuid];
  host.dependencies = host.dependencies || [];
  const deps = project.hash.project.objects.PBXTargetDependency || {};
  if (host.dependencies.some((dep) => deps[dep.value]?.target === targetUuid)) return;
  project.hash.project.objects.PBXTargetDependency ??= {};
  project.hash.project.objects.PBXContainerItemProxy ??= {};
  project.addTargetDependency(hostUuid, [targetUuid]);
}

function addSourcesAndResources(project, { targetUuid, groupName, groupPath, swiftFiles, resourceFiles }) {
  if (!project.pbxGroupByName(groupName)) {
    const group = project.addPbxGroup(
      [...swiftFiles, ...resourceFiles].map((file) => path.basename(file)),
      groupName,
      groupPath,
    );
    addGroupToMain(project, group.uuid);
  }

  if (!hasBuildPhase(project, targetUuid, 'PBXSourcesBuildPhase', 'Sources')) {
    project.addBuildPhase(
      swiftFiles.map((file) => path.basename(file)),
      'PBXSourcesBuildPhase',
      'Sources',
      targetUuid,
    );
  }
  if (!hasBuildPhase(project, targetUuid, 'PBXResourcesBuildPhase', 'Resources')) {
    project.addBuildPhase(
      resourceFiles.map((file) => path.basename(file)),
      'PBXResourcesBuildPhase',
      'Resources',
      targetUuid,
    );
  }
}

function addWatchTargets(project, config) {
  const projectRoot = config.modRequest.projectRoot;
  const teamId = config.ios?.appleTeamId || 'J56ZKH58J9';
  const mainTargetUuid = project.getFirstTarget().uuid;
  const watchFiles = listTargetFiles(projectRoot, WATCH_SOURCE_DIR);
  const complicationFiles = listTargetFiles(projectRoot, COMPLICATION_SOURCE_DIR);

  let watch = findTarget(project, WATCH_NAMES, WATCH_BUNDLE_ID);
  let watchProduct = null;
  if (!watch) {
    const created = addNativeTarget(project, {
      name: WATCH_TARGET_NAME,
      productName: WATCH_TARGET_NAME,
      productType: 'com.apple.product-type.application',
      productFile: `${WATCH_TARGET_NAME}.app`,
      explicitFileType: 'wrapper.application',
    });
    watch = { uuid: created.targetUuid };
    watchProduct = created.product;
    addSourcesAndResources(project, {
      targetUuid: watch.uuid,
      groupName: WATCH_TARGET_NAME,
      groupPath: '../targets/watch',
      swiftFiles: watchFiles.swiftFiles,
      resourceFiles: watchFiles.resourceFiles,
    });
  }

  applyBuildSettings(
    project,
    watch.uuid,
    watchBuildSettings(config, {
      infoPlist: '../targets/watch/Info.plist',
      entitlements: WATCH_ENTITLEMENTS,
      displayName: 'WaiAir Watch',
      bundleId: WATCH_BUNDLE_ID,
    }),
  );
  ensureTargetAttributes(project, watch.uuid, teamId);

  let complication = findTarget(project, COMPLICATION_NAMES, COMPLICATION_BUNDLE_ID);
  let complicationProduct = null;
  if (!complication) {
    const created = addNativeTarget(project, {
      name: COMPLICATION_TARGET_NAME,
      productName: COMPLICATION_TARGET_NAME,
      productType: 'com.apple.product-type.app-extension',
      productFile: `${COMPLICATION_TARGET_NAME}.appex`,
      explicitFileType: 'wrapper.app-extension',
    });
    complication = { uuid: created.targetUuid };
    complicationProduct = created.product;
    if (!hasBuildPhase(project, complication.uuid, 'PBXFrameworksBuildPhase', 'Frameworks')) {
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', complication.uuid);
    }
    project.addFramework('WidgetKit.framework', { target: complication.uuid });
    project.addFramework('SwiftUI.framework', { target: complication.uuid });
    addSourcesAndResources(project, {
      targetUuid: complication.uuid,
      groupName: COMPLICATION_TARGET_NAME,
      groupPath: '../targets/watch-widget',
      swiftFiles: complicationFiles.swiftFiles,
      resourceFiles: complicationFiles.resourceFiles,
    });
  }

  applyBuildSettings(
    project,
    complication.uuid,
    complicationBuildSettings(config, {
      infoPlist: '../targets/watch-widget/Info.plist',
      entitlements: COMPLICATION_ENTITLEMENTS,
      displayName: 'WaiAir Complication',
      bundleId: COMPLICATION_BUNDLE_ID,
    }),
  );
  ensureTargetAttributes(project, complication.uuid, teamId);

  const fileRefs = project.pbxFileReferenceSection();
  if (!watchProduct) {
    const fileRef = Object.keys(fileRefs).find((key) => {
      if (key.endsWith('_comment')) return false;
      const filePath = unquote(fileRefs[key].path);
      return filePath === `${WATCH_TARGET_NAME}.app` || filePath === 'WaiAir Watch.app';
    });
    if (fileRef) {
      watchProduct = { uuid: project.generateUuid(), fileRef, basename: fileRefs[fileRef].path };
    }
  }
  if (!complicationProduct) {
    const fileRef = Object.keys(fileRefs).find((key) => {
      if (key.endsWith('_comment')) return false;
      const filePath = unquote(fileRefs[key].path);
      return (
        filePath === `${COMPLICATION_TARGET_NAME}.appex` ||
        filePath === 'WaiAir Complication.appex'
      );
    });
    if (fileRef) {
      complicationProduct = {
        uuid: project.generateUuid(),
        fileRef,
        basename: fileRefs[fileRef].path,
      };
    }
  }

  if (watchProduct) {
    ensureEmbedPhase(project, mainTargetUuid, watchProduct, {
      name: 'Embed Watch Content',
      dstSubfolderSpec: 16,
      dstPath: '$(CONTENTS_FOLDER_PATH)/Watch',
      folderType: 'watch2_app',
    });
    ensureDependency(project, mainTargetUuid, watch.uuid);
  }
  if (complicationProduct) {
    ensureEmbedPhase(project, watch.uuid, complicationProduct, {
      name: 'Embed Foundation Extensions',
      dstSubfolderSpec: 13,
      dstPath: '',
      folderType: 'app_extension',
    });
    ensureDependency(project, watch.uuid, complication.uuid);
  }
}

function pbxprojHasWatchTargets(pbxPath) {
  if (!fs.existsSync(pbxPath)) return false;
  const contents = fs.readFileSync(pbxPath, 'utf8');
  return (
    contents.includes('productName = WaiAirWatch') &&
    contents.includes(WATCH_BUNDLE_ID) &&
    contents.includes('productName = WaiAirComplication') &&
    contents.includes(COMPLICATION_BUNDLE_ID)
  );
}

function withWaiAirWatch(config) {
  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      ensureEntitlements(cfg.modRequest.projectRoot);
      const pbxPath = IOSConfig.Paths.getPBXProjectPath(cfg.modRequest.projectRoot);
      if (pbxprojHasWatchTargets(pbxPath)) return cfg;
      const project = xcode.project(pbxPath);
      project.parseSync();
      addWatchTargets(project, cfg);
      fs.writeFileSync(pbxPath, project.writeSync());
      return cfg;
    },
  ]);
}

module.exports = withWaiAirWatch;
