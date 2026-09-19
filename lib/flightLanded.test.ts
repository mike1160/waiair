import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actualTimeIsArrival, flightHasLanded } from './flightLanded.ts';

/** TG922 BKK → FRA on a flight-number row: took off 12:53 Bangkok, due 19:00 Frankfurt (17:00 UTC). */
const inTheAir = {
  status: 'en-route',
  boardSide: 'both' as const,
  actualTime: '2026-09-19T12:53:00+07:00', // the actual DEPARTURE on this kind of row
  actualArrival: '',
  destination: 'FRA',
  destCountry: 'DE',
};
const AIRBORNE_NOW = Date.parse('2026-09-19T15:33:00Z');

test('a flight that has taken off has not landed — actualTime on a flight-number row is the departure', () => {
  assert.equal(flightHasLanded(inTheAir, AIRBORNE_NOW), false);
  // The page used to read this row as an arrival and call it landed the moment it left the gate.
  assert.equal(actualTimeIsArrival('both'), false);
  assert.equal(actualTimeIsArrival('departure'), false);
  assert.equal(actualTimeIsArrival(undefined), false);
  assert.equal(actualTimeIsArrival('arrival'), true);
});

test('an arrival board row does hold the arrival in actualTime', () => {
  const landedRow = {
    status: 'landed',
    boardSide: 'arrival' as const,
    actualTime: '2026-09-19T06:49:00+07:00',
    destination: 'BKK',
    destCountry: 'TH',
  };
  assert.equal(flightHasLanded(landedRow, Date.parse('2026-09-19T01:00:00Z')), true);

  // Same row while still en route: the touchdown time is in the future.
  const soon = { ...landedRow, status: 'en-route', actualTime: '2026-09-19T06:49:00+07:00' };
  assert.equal(flightHasLanded(soon, Date.parse('2026-09-18T20:00:00Z')), false);
  assert.equal(flightHasLanded(soon, Date.parse('2026-09-19T00:00:00Z')), true);
});

test('status and a real arrival time still win, on any kind of row', () => {
  assert.equal(flightHasLanded({ status: 'landed' }, AIRBORNE_NOW), true);
  assert.equal(
    flightHasLanded({ ...inTheAir, actualArrival: '2026-09-19T18:40:00+02:00' }, Date.parse('2026-09-19T17:00:00Z')),
    true,
  );
  assert.equal(
    flightHasLanded({ ...inTheAir, actualArrival: '2026-09-19T18:40:00+02:00' }, AIRBORNE_NOW),
    false,
    'an arrival time that has not come round yet is not a landing',
  );
  // No usable time at all: not landed.
  assert.equal(flightHasLanded({ status: 'scheduled', boardSide: 'both' }, AIRBORNE_NOW), false);
});
