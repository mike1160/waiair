import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addLocalDays,
  airportDateKey,
  fidsFlightsCacheKey,
  toLocalDateString,
} from './localFlightTime.ts';

test('toLocalDateString uses the local calendar, never UTC', () => {
  const d = new Date(2026, 8, 14, 1, 0, 0);
  assert.equal(toLocalDateString(d), '2026-09-14');
  const utcDay = d.toISOString().slice(0, 10);
  if (utcDay !== '2026-09-14') {
    assert.notEqual(utcDay, toLocalDateString(d));
  }
});

test('addLocalDays is a local calendar step, not Date.now() + 86400000', () => {
  const today = new Date(2026, 8, 14, 23, 30, 0);
  assert.equal(toLocalDateString(addLocalDays(today, 1)), '2026-09-15');
  assert.equal(toLocalDateString(addLocalDays(today, -1)), '2026-09-13');
});

test('airportDateKey without a known airport uses device local, not UTC', () => {
  const d = new Date(2026, 8, 14, 1, 0, 0);
  assert.equal(airportDateKey(undefined, undefined, d), '2026-09-14');
  assert.equal(airportDateKey('ZZZ', undefined, d), '2026-09-14');
});

test('airportDateKey for BKK is Asia/Bangkok', () => {
  const utcEvening = new Date('2026-09-13T18:30:00Z');
  assert.equal(airportDateKey('BKK', 'TH', utcEvening), '2026-09-14');
});

test('FIDS cache keys include the date so today and tomorrow never collide', () => {
  assert.equal(fidsFlightsCacheKey('dep', 'bkk', '2026-09-14'), 'flights-BKK-2026-09-14-dep');
  assert.equal(fidsFlightsCacheKey('dep', 'BKK', '2026-09-15'), 'flights-BKK-2026-09-15-dep');
  assert.notEqual(
    fidsFlightsCacheKey('dep', 'BKK', '2026-09-14'),
    fidsFlightsCacheKey('dep', 'BKK', '2026-09-15'),
  );
  assert.equal(
    fidsFlightsCacheKey('dep', 'BKK', '2026-09-14', 'live'),
    'flights-BKK-2026-09-14-dep-LIVE',
  );
});
