import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatAirportClock } from './flightTimes.ts';
import { resolveRouteEnds, routeDisplayClocks, type RouteFlightFields } from './resolveRoute.ts';

/** OZ747 ICN → HKT as stored after search / track (6 Sep 2026). */
const OZ747: RouteFlightFields = {
  origin: 'ICN',
  destination: 'HKT',
  originCountry: 'KR',
  destCountry: 'TH',
  boardSide: 'both',
  scheduledDeparture: '2026-09-06T17:56:00+09:00',
  departureTime: '2026-09-06T17:56:00+09:00',
  scheduledArrival: '2026-09-06T21:42:00+07:00',
  arrivalTime: '2026-09-06T21:42:00+07:00',
};

test('tracked OZ747 stays ICN → HKT when local airport is the destination (HKT pickup)', () => {
  for (const type of ['arrival', 'departure'] as const) {
    const shown = routeDisplayClocks(OZ747, type, 'HKT');
    assert.equal(shown.origin, 'ICN', type);
    assert.equal(shown.destination, 'HKT', type);
    assert.equal(shown.depClock, '17:56', type);
    assert.equal(shown.arrClock, '21:42', type);
    // Swapping ends and formatting each ISO in the other zone was the 6 Sep bug.
    assert.notEqual(formatAirportClock(shown.depIso, 'HKT', false, 'TH'), shown.depClock);
    assert.notEqual(formatAirportClock(shown.arrIso, 'ICN', false, 'KR'), shown.arrClock);
    assert.equal(formatAirportClock(shown.depIso, 'HKT', false, 'TH'), '15:56');
    assert.equal(formatAirportClock(shown.arrIso, 'ICN', false, 'KR'), '23:42');
  }
});

test('tracked OZ747 stays ICN → HKT when local airport is the origin (ICN arrival board)', () => {
  const shown = routeDisplayClocks(OZ747, 'arrival', 'ICN');
  assert.equal(shown.origin, 'ICN');
  assert.equal(shown.destination, 'HKT');
  assert.equal(shown.depClock, '17:56');
  assert.equal(shown.arrClock, '21:42');
  assert.equal(resolveRouteEnds(OZ747, 'arrival', 'ICN').origin, 'ICN');
});

test('incomplete arrival FIDS still pins dest to the local airport', () => {
  const ends = resolveRouteEnds({ origin: 'ICN', destination: '' }, 'arrival', 'HKT');
  assert.equal(ends.origin, 'ICN');
  assert.equal(ends.dest, 'HKT');
});
