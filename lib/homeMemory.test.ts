import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dismissReturnChip,
  memoryAfterLanding,
  memoryAfterTrack,
  parseHomeMemory,
  reverseRoutePrefill,
  shouldRememberDestination,
  shouldShowReturnChip,
  shouldShowWelcomeBack,
  storedMemoryNeedsPersist,
  type HomeMemory,
} from './homeMemory.ts';

const OUT = {
  originIata: 'AMS',
  destIata: 'LYS',
  originCity: 'Amsterdam',
  destCity: 'Lyon',
  travelDayYmd: '2026-09-09',
};

test('return chip shows once on the travel day, hides after tap or the next day', () => {
  const mem = memoryAfterTrack(null, OUT);
  assert.equal(shouldShowReturnChip(mem, '2026-09-09'), true);
  assert.equal(shouldShowReturnChip(mem, '2026-09-08'), true);
  assert.equal(shouldShowReturnChip(mem, '2026-09-10'), false);
  assert.equal(shouldShowReturnChip(dismissReturnChip(mem), '2026-09-09'), false);
  assert.equal(shouldShowReturnChip(null, '2026-09-09'), false);
});

test('return chip hides when origin equals dest', () => {
  const mem = memoryAfterTrack(null, { ...OUT, destIata: 'AMS', destCity: 'Amsterdam' });
  assert.equal(shouldShowReturnChip(mem, '2026-09-09'), false);
});

test('tracking a flight does not unlock welcome back or dest-again', () => {
  const mem = memoryAfterTrack(null, OUT);
  assert.equal(shouldShowWelcomeBack(mem, 0), false);
  assert.equal(mem.destReachedLanded, false);
  assert.equal(mem.lastLandedDestIata, '');
});

test('welcome back only after a tracked flight actually landed', () => {
  const tracked = memoryAfterTrack(null, OUT);
  const mem = memoryAfterLanding(tracked, OUT);
  assert.equal(shouldShowWelcomeBack(mem, 0), true);
  assert.equal(shouldShowWelcomeBack(mem, 1), false);
  assert.equal(shouldShowWelcomeBack(null, 0), false);
  assert.equal(mem.lastLandedDestIata, 'LYS');
  assert.equal(mem.lastLandedDestCity, 'Lyon');
});

test('cancelled never remembers dest, even if the Now phase is done', () => {
  assert.equal(shouldRememberDestination({ status: 'cancelled' }), false);
  assert.equal(shouldRememberDestination({ status: 'canceled', phase: 'done' }), false);
  const mem = memoryAfterTrack(null, OUT);
  assert.equal(shouldShowWelcomeBack(mem, 0), false);
});

test('diverted never remembers dest', () => {
  assert.equal(shouldRememberDestination({ status: 'diverted' }), false);
  assert.equal(shouldRememberDestination({ status: 'diversion', phase: 'done' }), false);
});

test('removed before departure never remembers dest', () => {
  const mem = memoryAfterTrack(null, OUT);
  assert.equal(shouldRememberDestination({ status: 'scheduled' }), false);
  assert.equal(shouldRememberDestination({ status: 'boarding' }), false);
  assert.equal(shouldShowWelcomeBack(mem, 0), false);
  assert.equal(mem.destReachedLanded, false);
});

test('day passed without a seen landing never remembers dest', () => {
  const mem = memoryAfterTrack(null, { ...OUT, travelDayYmd: '2026-09-01' });
  assert.equal(shouldRememberDestination({ status: 'en-route', phase: 'en-route' }), false);
  assert.equal(shouldShowWelcomeBack(mem, 0), false);
  assert.equal(mem.lastLandedDestIata, '');
});

test('landed or post-landing Now phases remember dest', () => {
  assert.equal(shouldRememberDestination({ status: 'landed' }), true);
  assert.equal(shouldRememberDestination({ status: 'arrived' }), true);
  assert.equal(shouldRememberDestination({ status: 'en-route', phase: 'baggage' }), true);
  assert.equal(shouldRememberDestination({ status: 'en-route', phase: 'transport' }), true);
  assert.equal(shouldRememberDestination({ status: 'en-route', phase: 'done' }), true);
});

test('migrate clears last-destination when the stored record never landed', () => {
  const raw = JSON.stringify({
    lastOriginIata: 'AMS',
    lastDestIata: 'LYS',
    lastOriginCity: 'Amsterdam',
    lastDestCity: 'Lyon',
    travelDayYmd: '2026-09-09',
    returnChipDismissed: false,
    hasTrackedOnce: true,
  });
  const mem = parseHomeMemory(raw);
  assert.ok(mem);
  assert.equal(mem.destReachedLanded, false);
  assert.equal(mem.lastLandedDestIata, '');
  assert.equal(mem.lastLandedDestCity, '');
  assert.equal(shouldShowWelcomeBack(mem, 0), false);
  assert.equal(storedMemoryNeedsPersist(raw), true);
});

test('migrate keeps a dest that did land while tracked', () => {
  const raw = JSON.stringify({
    lastOriginIata: 'AMS',
    lastDestIata: 'LYS',
    lastOriginCity: 'Amsterdam',
    lastDestCity: 'Lyon',
    travelDayYmd: '2026-09-09',
    returnChipDismissed: false,
    hasTrackedOnce: true,
    destReachedLanded: true,
    lastLandedDestIata: 'LYS',
    lastLandedDestCity: 'Lyon',
  });
  const mem = parseHomeMemory(raw);
  assert.equal(mem?.lastLandedDestIata, 'LYS');
  assert.equal(shouldShowWelcomeBack(mem, 0), true);
  assert.equal(storedMemoryNeedsPersist(raw), false);
});

test('reverse-route prefill swaps airports and omits a date', () => {
  const mem = memoryAfterTrack(null, { ...OUT, arrivalDayYmd: '2026-09-09' });
  const pre = reverseRoutePrefill(mem);
  assert.equal(pre.originIata, 'LYS');
  assert.equal(pre.destIata, 'AMS');
  assert.equal(pre.destCity, 'Amsterdam');
  assert.equal(pre.query, 'LYS AMS');
  assert.equal(pre.query.includes('2026'), false);
  assert.equal(pre.anchorYmd, '2026-09-09');
});

test('return prefill falls back to travel day when arrival is unknown', () => {
  const mem = memoryAfterTrack(null, OUT);
  assert.equal(reverseRoutePrefill(mem).anchorYmd, '2026-09-09');
});

test('a later add replaces memory and re-shows the return chip', () => {
  const first = dismissReturnChip(memoryAfterTrack(null, OUT));
  const second = memoryAfterTrack(first, {
    originIata: 'LYS',
    destIata: 'AMS',
    originCity: 'Lyon',
    destCity: 'Amsterdam',
    travelDayYmd: '2026-09-18',
  });
  assert.equal(second.returnChipDismissed, false);
  assert.equal(shouldShowReturnChip(second, '2026-09-18'), true);
  assert.equal(reverseRoutePrefill(second).query, 'AMS LYS');
});

test('welcome back survives untrack after a landed dest (memory is not cleared)', () => {
  const mem: HomeMemory = memoryAfterLanding(memoryAfterTrack(null, OUT), OUT);
  assert.equal(shouldShowWelcomeBack(mem, 0), true);
  assert.equal(mem.hasTrackedOnce, true);
  assert.equal(mem.destReachedLanded, true);
});
