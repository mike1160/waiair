import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LATE_WARNING_MAX_AGE_MS,
  LATE_WARNING_PREFIX,
  isExpiredLateWarningKey,
  lateWarningDateYmd,
  lateWarningStorageKey,
} from './lateAircraftWarningStore.ts';

test('late warning storage key is lateWarning_{flight}_{date}', () => {
  assert.equal(lateWarningStorageKey('oz 747', '2026-09-06'), 'lateWarning_OZ747_2026-09-06');
  assert.equal(lateWarningStorageKey('', '2026-09-06'), '');
  assert.equal(lateWarningStorageKey('OZ747', 'nope'), '');
});

test('flight date comes from scheduled ISO, else today', () => {
  assert.equal(lateWarningDateYmd('2026-09-06T17:20:00+09:00'), '2026-09-06');
  const now = new Date(2026, 8, 16, 12, 0, 0);
  assert.equal(lateWarningDateYmd('', now), '2026-09-16');
});

test('prune keys older than 48 hours, keep recent and future', () => {
  const now = Date.parse('2026-09-16T12:00:00');
  assert.equal(isExpiredLateWarningKey('lateWarning_OZ747_2026-09-13', now), true);
  assert.equal(isExpiredLateWarningKey('lateWarning_OZ747_2026-09-14', now), true);
  assert.equal(isExpiredLateWarningKey('lateWarning_OZ747_2026-09-15', now), false);
  assert.equal(isExpiredLateWarningKey('lateWarning_OZ747_2026-09-16', now), false);
  assert.equal(isExpiredLateWarningKey('lateWarning_OZ747_2026-09-20', now), false);
  assert.equal(isExpiredLateWarningKey('waiair.notify.sent.v1:OZ747-delay-2026-09-13', now), false);
  assert.equal(LATE_WARNING_PREFIX, 'lateWarning_');
  assert.equal(LATE_WARNING_MAX_AGE_MS, 48 * 60 * 60 * 1000);
});
