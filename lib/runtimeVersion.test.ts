import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readVersion(src: string): string {
  const m = src.match(/"version":\s*"([^"]+)"/);
  assert.ok(m, 'app.config.js missing version string');
  return m[1];
}

function readRuntimeVersion(src: string): { kind: 'string' | 'policy'; value: string } {
  const str = src.match(/"runtimeVersion":\s*"([^"]+)"/);
  if (str) return { kind: 'string', value: str[1] };
  const policy = src.match(/"runtimeVersion"\s*:\s*\{[\s\S]*?"policy"\s*:\s*"([^"]+)"/);
  if (policy) return { kind: 'policy', value: policy[1] };
  assert.fail('app.config.js missing runtimeVersion');
}

function readPlistRuntime(src: string): string {
  const m = src.match(/<key>EXUpdatesRuntimeVersion<\/key>\s*<string>([^<]*)<\/string>/);
  assert.ok(m, 'Expo.plist missing EXUpdatesRuntimeVersion');
  return m[1];
}

test('runtimeVersion is a literal string equal to version (bare Metro)', () => {
  const config = readFileSync(join(ROOT, 'app.config.js'), 'utf8');
  const version = readVersion(config);
  const runtime = readRuntimeVersion(config);
  assert.equal(runtime.kind, 'string', 'runtimeVersion policies are not supported in the bare workflow');
  assert.equal(runtime.value, version);

  const plist = readFileSync(join(ROOT, 'ios/WaiAir/Supporting/Expo.plist'), 'utf8');
  assert.equal(readPlistRuntime(plist), version);

  const stringsPath = join(ROOT, 'android/app/src/main/res/values/strings.xml');
  if (existsSync(stringsPath)) {
    const strings = readFileSync(stringsPath, 'utf8');
    const android = strings.match(/<string name="expo_runtime_version">([^<]*)<\/string>/);
    if (android) assert.equal(android[1], version);
  }
});
