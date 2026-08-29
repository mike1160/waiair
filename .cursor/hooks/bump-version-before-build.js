#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function commandFromPayload(raw) {
  try {
    const data = JSON.parse(raw || '{}');
    return String(
      data.command
      || data.tool_input?.command
      || data.toolInput?.command
      || ''
    );
  } catch {
    return '';
  }
}

function isAppBuild(command) {
  return /\beas\s+build\b/.test(command)
    || /\bexpo\s+run:(ios|android)\b/.test(command)
    || /\bnpm\s+run\s+(ios|android)\b/.test(command)
    || /\byarn\s+(ios|android)\b/.test(command);
}

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
}

const payload = readStdin();
const command = commandFromPayload(payload);

if (process.env.WAIAIR_SKIP_BUMP === '1' || !isAppBuild(command) || /bump-app-version/.test(command)) {
  allow();
  process.exit(0);
}

const script = path.join(__dirname, '..', '..', 'scripts', 'bump-app-version.js');
const result = spawnSync(process.execPath, [script], {
  encoding: 'utf8',
  cwd: path.join(__dirname, '..', '..'),
});

if (result.status !== 0) {
  process.stdout.write(JSON.stringify({
    permission: 'ask',
    user_message: 'Version bump failed. Continue the build anyway?',
    agent_message: result.stderr || result.stdout || 'bump-app-version.js failed',
  }));
  process.exit(0);
}

const summary = String(result.stdout || '').trim();
process.stdout.write(JSON.stringify({
  permission: 'ask',
  user_message: `App-versie is bijgewerkt vóór deze build:\n\n${summary}\n\nDoorgaan met de build?`,
  agent_message: `Bumped app.json before build:\n${summary}`,
}));
