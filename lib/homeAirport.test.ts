import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homeAirportFromOrigin, shouldSetHomeAirport } from './homeAirport.ts';

test('home airport is inferred only when none is stored', () => {
  assert.equal(shouldSetHomeAirport(null), true);
  assert.equal(shouldSetHomeAirport({ iata: '' }), true);
  assert.equal(shouldSetHomeAirport({ iata: 'HKT' }), false);
});

test('first-flight origin becomes home airport fields', () => {
  const home = homeAirportFromOrigin('icn', {
    iata: 'ICN',
    name: 'Incheon International Airport',
    city: 'Seoul',
    country: 'KR',
    lat: 37.46,
    lon: 126.45,
  });
  assert.equal(home?.iata, 'ICN');
  assert.equal(home?.city, 'Seoul');
  assert.equal(home?.country, 'KR');
  assert.equal(homeAirportFromOrigin(''), null);
});
