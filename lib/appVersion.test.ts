import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatAppVersionLabel, resolveAppVersion } from './appVersion.ts';

test('prefers native Info.plist / versionName over expoConfig (OTA)', () => {
  const got = resolveAppVersion({
    nativeVersion: '1.17.0',
    nativeBuild: '132',
    configVersion: '1.16.2',
    configBuild: '120',
  });
  assert.deepEqual(got, { version: '1.17.0', build: '132' });
  assert.equal(formatAppVersionLabel(got.version, got.build), '1.17.0 (132)');
});

test('falls back to expoConfig when native fields are empty', () => {
  const got = resolveAppVersion({
    nativeVersion: null,
    nativeBuild: '',
    configVersion: '1.17.0',
    configBuild: 141,
  });
  assert.deepEqual(got, { version: '1.17.0', build: '141' });
});

test('omits the build parentheses when no build is known', () => {
  const got = resolveAppVersion({ configVersion: '1.17.0' });
  assert.equal(formatAppVersionLabel(got.version, got.build), '1.17.0');
});
