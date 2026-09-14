import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterRouteFlights, matchesRouteDirection } from './routeFilter.ts';

const KL875 = { number: 'KL875', origin: 'AMS', destination: 'BKK', boardSide: 'departure' };
const KL876 = { number: 'KL876', origin: 'BKK', destination: 'AMS', boardSide: 'arrival' };
const TG921 = { number: 'TG921', origin: 'ams', destination: ' bkk ', boardSide: 'arrival' };
const KL803 = { number: 'KL803', origin: 'AMS', destination: 'KUL', boardSide: 'departure' };

test('route AMS → BKK keeps only AMS → BKK flights, never the return leg', () => {
  const shown = filterRouteFlights([KL875, KL876, TG921, KL803], 'AMS', 'BKK');
  assert.deepEqual(shown.map(f => f.number), ['KL875', 'TG921']);
});

test('route BKK → AMS is the mirror image', () => {
  assert.deepEqual(filterRouteFlights([KL875, KL876, KL803], 'bkk', 'ams').map(f => f.number), ['KL876']);
});

test('rows with a missing or unusable end are not shown on a route', () => {
  assert.equal(matchesRouteDirection({ origin: 'AMS', destination: '' }, 'AMS', 'BKK'), false);
  assert.equal(matchesRouteDirection({ origin: '', destination: 'BKK' }, 'AMS', 'BKK'), false);
  assert.equal(matchesRouteDirection({}, 'AMS', 'BKK'), false);
});

test('an invalid route (empty or same airport) matches nothing', () => {
  assert.deepEqual(filterRouteFlights([KL875], '', 'BKK'), []);
  assert.deepEqual(filterRouteFlights([KL875], 'AMS', 'AMS'), []);
});
