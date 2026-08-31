#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_CONFIG = path.join(__dirname, '..', 'app.config.js');
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
  `iOS buildNumber:      ${oldBuild} → ${newBuild}`,
  `Android versionCode:  ${oldCode == null ? '(none)' : oldCode} → ${newCode}`,
].join('\n');

if (!dryRun) {
  let next = raw
    .replace(/("version":\s*")[^"]+(")/, `$1${newVersion}$2`)
    .replace(/("buildNumber":\s*")[^"]+(")/, `$1${newBuild}$2`)
    .replace(/("versionCode":\s*)\d+/, `$1${newCode}`);
  fs.writeFileSync(APP_CONFIG, next);
}

process.stdout.write(summary + '\n');
