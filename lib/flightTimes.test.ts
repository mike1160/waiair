import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flightProgressPct, planeRouteT, routeIsFrozen } from './flightTimes.ts';

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
