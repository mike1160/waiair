import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dismissReturnChip,
  memoryAfterTrack,
  reverseRoutePrefill,
  shouldShowReturnChip,
  shouldShowWelcomeBack,
  type HomeMemory,
} from './homeMemory.ts';

const OUT = {
  originIata: 'HKT',
  destIata: 'ICN',
  originCity: 'Phuket',
  destCity: 'Seoul',
  travelDayYmd: '2026-09-10',
};

test('return chip shows once on the travel day, hides after tap or the next day', () => {
  const mem = memoryAfterTrack(null, OUT);
  assert.equal(shouldShowReturnChip(mem, '2026-09-10'), true);
  assert.equal(shouldShowReturnChip(mem, '2026-09-09'), true);
  assert.equal(shouldShowReturnChip(mem, '2026-09-11'), false);
  assert.equal(shouldShowReturnChip(dismissReturnChip(mem), '2026-09-10'), false);
  assert.equal(shouldShowReturnChip(null, '2026-09-10'), false);
});

test('return chip hides when origin equals dest', () => {
  const mem = memoryAfterTrack(null, { ...OUT, destIata: 'HKT', destCity: 'Phuket' });
  assert.equal(shouldShowReturnChip(mem, '2026-09-10'), false);
});

test('welcome back only on empty home after at least one tracked flight', () => {
  const mem = memoryAfterTrack(null, OUT);
  assert.equal(shouldShowWelcomeBack(mem, 0), true);
  assert.equal(shouldShowWelcomeBack(mem, 1), false);
  assert.equal(shouldShowWelcomeBack(null, 0), false);
});

test('reverse-route prefill swaps airports and omits a date', () => {
  const mem = memoryAfterTrack(null, { ...OUT, arrivalDayYmd: '2026-09-10' });
  const pre = reverseRoutePrefill(mem);
  assert.equal(pre.originIata, 'ICN');
  assert.equal(pre.destIata, 'HKT');
  assert.equal(pre.destCity, 'Phuket');
  assert.equal(pre.query, 'ICN HKT');
  assert.equal(pre.query.includes('2026'), false);
  assert.equal(pre.anchorYmd, '2026-09-10');
});

test('return prefill falls back to travel day when arrival is unknown', () => {
  const mem = memoryAfterTrack(null, OUT);
  assert.equal(reverseRoutePrefill(mem).anchorYmd, '2026-09-10');
});

test('a later add replaces memory and re-shows the return chip', () => {
  const first = dismissReturnChip(memoryAfterTrack(null, OUT));
  const second = memoryAfterTrack(first, {
    originIata: 'ICN',
    destIata: 'HKT',
    originCity: 'Seoul',
    destCity: 'Phuket',
    travelDayYmd: '2026-09-18',
  });
  assert.equal(second.returnChipDismissed, false);
  assert.equal(shouldShowReturnChip(second, '2026-09-18'), true);
  assert.equal(reverseRoutePrefill(second).query, 'HKT ICN');
});

test('welcome back survives untrack (memory is not cleared)', () => {
  const mem: HomeMemory = memoryAfterTrack(null, OUT);
  assert.equal(shouldShowWelcomeBack(mem, 0), true);
  assert.equal(mem.hasTrackedOnce, true);
});
