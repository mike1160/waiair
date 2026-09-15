import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTUAL_TIME_SLACK_MS, flightProgressPct, pastActualIso, planeRouteT, routeIsFrozen } from './flightTimes.ts';

const AMS_LYS = {
  scheduledTime: '2026-09-09T19:00:00',
  scheduledDeparture: '2026-09-09T19:00:00',
  arrivalTime: '2026-09-09T21:00:00',
  scheduledArrival: '2026-09-09T21:00:00',
  origin: 'AMS',
  destination: 'LYS',
  originCountry: 'NL',
  destCountry: 'FR',
};

/** Halfway along a 19:00–21:00 AMS–LYS schedule. */
const MID = Date.parse('2026-09-09T20:00:00+02:00');

test('pastActualIso: a future runway time is a prediction (BR75 BKK→AMS before departure), past or near-now times are actual', () => {
  const beforeDeparture = Date.parse('2026-09-15T02:56:00Z');
  assert.equal(pastActualIso('2026-09-15T19:12:00+02:00', beforeDeparture), '');
  const afterLanding = Date.parse('2026-09-15T17:30:00Z');
  assert.equal(pastActualIso('2026-09-15T19:12:00+02:00', afterLanding), '2026-09-15T19:12:00+02:00');
  const landing = Date.parse('2026-09-15T17:12:00Z');
  assert.equal(pastActualIso('2026-09-15T19:12:00+02:00', landing - ACTUAL_TIME_SLACK_MS + 1), '2026-09-15T19:12:00+02:00');
  assert.equal(pastActualIso('', afterLanding), '');
  assert.equal(pastActualIso('not a time', afterLanding), 'not a time');
});

test('cancelled progress is 0 regardless of clock', () => {
  const cancelled = { ...AMS_LYS, status: 'cancelled' };
  assert.equal(flightProgressPct(cancelled, MID), 0);
  assert.equal(flightProgressPct({ ...AMS_LYS, status: 'canceled' }, MID), 0);
  assert.equal(flightProgressPct(cancelled, Date.parse('2026-09-09T22:00:00+02:00')), 0);
  assert.equal(flightProgressPct(cancelled, Date.parse('2026-09-09T18:00:00+02:00')), 0);
});

test('scheduled mid-flight still interpolates when not frozen', () => {
  const pct = flightProgressPct({ ...AMS_LYS, status: 'en-route' }, MID);
  assert.ok(pct > 0.4 && pct < 0.6, `expected ~0.5, got ${pct}`);
});

test('diverted progress is 0 and does not follow the original dest', () => {
  assert.equal(routeIsFrozen('diverted'), true);
  assert.equal(flightProgressPct({ ...AMS_LYS, status: 'diverted' }, MID), 0);
});

test('frozen routes pin the plane at the origin (t = 0), not the 0.03 clamp', () => {
  assert.equal(planeRouteT(0.5, 'cancelled'), 0);
  assert.equal(planeRouteT(1, 'canceled'), 0);
  assert.equal(planeRouteT(0.8, 'diverted'), 0);
  assert.ok(planeRouteT(0, 'en-route') >= 0.03);
});
