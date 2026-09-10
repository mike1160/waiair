#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APP_CONFIG = path.join(ROOT, 'app.config.js');
const EXPO_PLIST = path.join(ROOT, 'ios', 'WaiAir', 'Supporting', 'Expo.plist');
const ANDROID_MANIFEST = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const ANDROID_STRINGS = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
const dryRun = process.argv.includes('--dry-run');

function bumpKind() {
  if (process.argv.includes('--major')) return 'major';
  if (process.argv.includes('--minor')) return 'minor';
  if (process.argv.includes('--patch')) return 'patch';
  const env = String(process.env.WAIAIR_BUMP || '').toLowerCase();
  if (env === 'major' || env === 'minor' || env === 'patch') return env;
  try {
    const log = execSync('git log -30 --pretty=%s', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (/^feat(\(.+\))?(!)?:/m.test(log) || /^feat!/m.test(log)) return 'minor';
  } catch {
    /* default patch */
  }
  return 'patch';
}

function bumpSemver(version, kind) {
  const parts = String(version || '0.0.0').split('.');
  const major = parseInt(parts[0], 10) || 0;
  const minor = parseInt(parts[1], 10) || 0;
  const patch = parseInt(parts[2], 10) || 0;
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function readField(src, field) {
  const re = new RegExp(`"${field}":\\s*"([^"]+)"`);
  const m = src.match(re);
  return m ? m[1] : null;
}

function readNumberField(src, field) {
  const re = new RegExp(`"${field}":\\s*(\\d+)`);
  const m = src.match(re);
  return m ? parseInt(m[1], 10) : null;
}

/** Bare workflow needs a string runtimeVersion, never { policy }. Keep it equal to version. */
function setConfigRuntimeVersion(src, version) {
  if (/"runtimeVersion"\s*:\s*\{/.test(src)) {
    return src.replace(/"runtimeVersion"\s*:\s*\{[\s\S]*?\}/, `"runtimeVersion": "${version}"`);
  }
  if (/"runtimeVersion"\s*:\s*"/.test(src)) {
    return src.replace(/("runtimeVersion":\s*")[^"]+(")/, `$1${version}$2`);
  }
  return src.replace(/("version":\s*"[^"]+")/, `$1,\n    "runtimeVersion": "${version}"`);
}

function setPlistRuntimeVersion(src, version) {
  if (!/<key>EXUpdatesRuntimeVersion<\/key>/.test(src)) return src;
  return src.replace(
    /(<key>EXUpdatesRuntimeVersion<\/key>\s*<string>)[^<]*/,
    `$1${version}`,
  );
}

function setAndroidRuntimeVersion(src, version) {
  if (!src.includes('expo.modules.updates.EXPO_RUNTIME_VERSION')) return src;
  return src.replace(
    /(expo\.modules\.updates\.EXPO_RUNTIME_VERSION"[^>]*android:value=")(?!@)([^"]*)/,
    `$1${version}`,
  );
}

function setAndroidStringsRuntimeVersion(src, version) {
  if (!src.includes('expo_runtime_version')) return src;
  return src.replace(
    /(<string name="expo_runtime_version">)[^<]*/,
    `$1${version}`,
  );
}

const raw = fs.readFileSync(APP_CONFIG, 'utf8');
const kind = bumpKind();
const oldVersion = readField(raw, 'version') || '0.0.0';
const oldBuild = readField(raw, 'buildNumber') || '0';
const oldCode = readNumberField(raw, 'versionCode');

const newVersion = bumpSemver(oldVersion, kind);
const newBuild = String((parseInt(oldBuild, 10) || 0) + 1);
const baseCode = typeof oldCode === 'number' ? oldCode : (parseInt(oldBuild, 10) || 0);
const newCode = baseCode + 1;

const summary = [
  `semver (${kind}):     ${oldVersion} → ${newVersion}`,
  `runtimeVersion:       ${oldVersion} → ${newVersion}`,
  `iOS buildNumber:      ${oldBuild} → ${newBuild}`,
  `Android versionCode:  ${oldCode == null ? '(none)' : oldCode} → ${newCode}`,
].join('\n');

if (!dryRun) {
  let next = raw
    .replace(/("version":\s*")[^"]+(")/, `$1${newVersion}$2`)
    .replace(/("buildNumber":\s*")[^"]+(")/, `$1${newBuild}$2`)
    .replace(/("versionCode":\s*)\d+/, `$1${newCode}`);
  next = setConfigRuntimeVersion(next, newVersion);
  fs.writeFileSync(APP_CONFIG, next);

  if (fs.existsSync(EXPO_PLIST)) {
    const plist = fs.readFileSync(EXPO_PLIST, 'utf8');
    fs.writeFileSync(EXPO_PLIST, setPlistRuntimeVersion(plist, newVersion));
  }
  if (fs.existsSync(ANDROID_MANIFEST)) {
    const manifest = fs.readFileSync(ANDROID_MANIFEST, 'utf8');
    fs.writeFileSync(ANDROID_MANIFEST, setAndroidRuntimeVersion(manifest, newVersion));
  }
  if (fs.existsSync(ANDROID_STRINGS)) {
    const strings = fs.readFileSync(ANDROID_STRINGS, 'utf8');
    fs.writeFileSync(ANDROID_STRINGS, setAndroidStringsRuntimeVersion(strings, newVersion));
  }
}

process.stdout.write(summary + '\n');
