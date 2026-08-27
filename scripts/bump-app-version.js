#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_JSON = path.join(__dirname, '..', 'app.json');
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

const raw = fs.readFileSync(APP_JSON, 'utf8');
const app = JSON.parse(raw);
const expo = app.expo || (app.expo = {});
if (!expo.ios) expo.ios = {};
if (!expo.android) expo.android = {};

const kind = bumpKind();
const oldVersion = String(expo.version || '0.0.0');
const oldBuild = String(expo.ios.buildNumber || '0');
const oldCode = expo.android.versionCode;

const newVersion = bumpSemver(oldVersion, kind);
const newBuild = String((parseInt(oldBuild, 10) || 0) + 1);
const baseCode = typeof oldCode === 'number' ? oldCode : (parseInt(oldBuild, 10) || 0);
const newCode = baseCode + 1;

const summary = [
  `semver (${kind}):     ${oldVersion} → ${newVersion}`,
  `iOS buildNumber:      ${oldBuild} → ${newBuild}`,
  `Android versionCode:  ${oldCode == null ? '(none)' : oldCode} → ${newCode}`,
].join('\n');

if (!dryRun) {
  expo.version = newVersion;
  expo.ios.buildNumber = newBuild;
  expo.android.versionCode = newCode;
  fs.writeFileSync(APP_JSON, JSON.stringify(app, null, 2) + '\n');
}

process.stdout.write(summary + '\n');
