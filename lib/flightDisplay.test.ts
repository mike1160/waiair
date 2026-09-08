import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  statusClockForPhase,
  shouldStrikeScheduledClock,
  shouldStrikeGate,
  EMPTY_CLOCK,
} from './flightTimes.ts';

test('statusClockForPhase: landed uses arrival clock even on a departure board', () => {
  const clock = statusClockForPhase({
    phase: 'landed',
    type: 'departure',
    depIso: '2026-09-06T15:56:00+07:00',
    arrIso: '2026-09-06T23:42:00+09:00',
    originIata: 'HKT',
    destIata: 'ICN',
    originCountry: 'TH',
    destCountry: 'KR',
  });
  assert.ok(clock);
  assert.equal(clock.iso, '2026-09-06T23:42:00+09:00');
  assert.equal(clock.iata, 'ICN');
  assert.equal(clock.country, 'KR');
});

test('statusClockForPhase: header and card share arrival ISO for arrived status', () => {
  const input = {
    status: 'arrived',
    type: 'departure' as const,
    depIso: '2026-09-06T15:56:00+07:00',
    arrIso: '2026-09-06T23:42:00+09:00',
    originIata: 'HKT',
    destIata: 'ICN',
  };
  const a = statusClockForPhase({ ...input, phase: 'landed' });
  const b = statusClockForPhase(input);
  assert.deepEqual(a, b);
  assert.equal(a?.iso, input.arrIso);
});

test('statusClockForPhase: pre-departure delayed omits clock on departure tab', () => {
  const clock = statusClockForPhase({
    phase: 'delayed',
    type: 'departure',
    delayed: true,
    depIso: '2026-09-06T15:56:00+07:00',
    arrIso: '2026-09-06T23:42:00+09:00',
    originIata: 'HKT',
    destIata: 'ICN',
  });
  assert.equal(clock, null);
});

test('statusClockForPhase: scheduled departure uses origin clock', () => {
  const clock = statusClockForPhase({
    phase: 'scheduled',
    type: 'departure',
    depIso: '2026-09-06T15:20:00+07:00',
    arrIso: '2026-09-06T23:10:00+09:00',
    originIata: 'HKT',
    destIata: 'ICN',
  });
  assert.equal(clock?.iso, '2026-09-06T15:20:00+07:00');
  assert.equal(clock?.iata, 'HKT');
});

test('strikethrough: scheduled only when it differs from actual', () => {
  assert.equal(shouldStrikeScheduledClock('15:20', '15:56'), true);
  assert.equal(shouldStrikeScheduledClock('15:56', '15:56'), false);
  assert.equal(shouldStrikeScheduledClock('', '15:56'), false);
  assert.equal(shouldStrikeScheduledClock('15:20', EMPTY_CLOCK), false);
  assert.equal(shouldStrikeScheduledClock(EMPTY_CLOCK, '15:56'), false);
});

test('strikethrough: gate only when it actually changed', () => {
  assert.equal(shouldStrikeGate(true), true);
  assert.equal(shouldStrikeGate(false), false);
});
