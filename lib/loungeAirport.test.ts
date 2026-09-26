import test from 'node:test';
import assert from 'node:assert/strict';

import { loungeAirportFor } from './loungeAirport.ts';

test('a departure shows the airport you board at', () => {
  // [S/1] Not both ends: two panels meant the same question twice, with nothing saying which airport.
  assert.equal(loungeAirportFor('departure', 'BKK', 'AMS'), 'BKK');
});

test('an arrival shows the airport you land at, as it always did', () => {
  assert.equal(loungeAirportFor('arrival', 'BKK', 'AMS'), 'AMS');
  // A flight followed from the arrivals board often has no origin at all.
  assert.equal(loungeAirportFor('arrival', '', 'AMS'), 'AMS');
});

test('a departure with no origin falls back to the other end rather than showing nothing', () => {
  assert.equal(loungeAirportFor('departure', '', 'AMS'), 'AMS');
  assert.equal(loungeAirportFor('departure', undefined, 'AMS'), 'AMS');
});

test('codes are normalised, and nothing known means nothing shown', () => {
  assert.equal(loungeAirportFor('departure', ' bkk ', 'AMS'), 'BKK');
  assert.equal(loungeAirportFor('departure', '', ''), '');
  assert.equal(loungeAirportFor('arrival', 'BKK', ''), '');
  assert.equal(loungeAirportFor('arrival', undefined, undefined), '');
});
