import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardingLegFlight, journeyOfTracked, suggestBoardingLeg } from './boardingSegment.ts';
import { legDepartureMs, withFinalArrival, type LegFields } from './flightLegs.ts';

type Leg = LegFields & { number: string; id: string };

function leg(id: string, origin: string, dep: string, destination: string, arr: string): Leg {
  return {
    id,
    number: 'BR75',
    origin,
    destination,
    destCity: destination,
    scheduledTime: dep,
    scheduledDeparture: dep,
    departureTime: dep,
    scheduledArrival: arr,
    arrivalTime: arr,
  };
}

const TPE_BKK = leg('tpe-bkk', 'TPE', '2026-09-15T07:45:00+08:00', 'BKK', '2026-09-15T10:50:00+07:00');
const BKK_AMS = leg('bkk-ams', 'BKK', '2026-09-15T12:15:00+07:00', 'AMS', '2026-09-15T19:20:00+02:00');
/** How the tracked flight looks when BR75 was added from Taipei: TPE departure, AMS arrival. */
const TRACKED_FROM_TPE = { ...withFinalArrival(TPE_BKK, BKK_AMS), via: ['BKK'] };

function trackedOf(f: Leg) {
  return { origin: f.origin, destination: f.destination, depMs: legDepartureMs(f) };
}

test('BR75 tracked from TPE, trip in Bangkok: suggests boarding in BKK', () => {
  const journey = journeyOfTracked([BKK_AMS, TPE_BKK], trackedOf(TRACKED_FROM_TPE));
  assert.deepEqual(journey?.map(l => l.id), ['tpe-bkk', 'bkk-ams']);
  assert.deepEqual(suggestBoardingLeg(journey, trackedOf(TRACKED_FROM_TPE), ['BKK', 'HKT']), { routeOrigin: 'TPE', boardIata: 'BKK' });
});

test('no prompt when the route origin is already a trip airport', () => {
  const journey = journeyOfTracked([TPE_BKK, BKK_AMS], trackedOf(TRACKED_FROM_TPE));
  assert.equal(suggestBoardingLeg(journey, trackedOf(TRACKED_FROM_TPE), ['TPE', 'BKK']), null);
});

test('no prompt when no later leg departs from a trip airport', () => {
  const journey = journeyOfTracked([TPE_BKK, BKK_AMS], trackedOf(TRACKED_FROM_TPE));
  assert.equal(suggestBoardingLeg(journey, trackedOf(TRACKED_FROM_TPE), ['SIN']), null);
});

test('flying TPE → BKK only never asks about boarding in Bangkok', () => {
  const journey = journeyOfTracked([TPE_BKK, BKK_AMS], trackedOf(TPE_BKK));
  assert.equal(suggestBoardingLeg(journey, trackedOf(TPE_BKK), ['BKK']), null);
});

test('a direct flight never asks', () => {
  const journey = journeyOfTracked([BKK_AMS], trackedOf(BKK_AMS));
  assert.equal(suggestBoardingLeg(journey, trackedOf(BKK_AMS), ['HKT']), null);
});

test('boardingLegFlight re-bases onto the BKK leg with the final arrival', () => {
  const journey = journeyOfTracked([TPE_BKK, BKK_AMS], trackedOf(TRACKED_FROM_TPE));
  const rebased = boardingLegFlight(journey, 'BKK');
  assert.equal(rebased?.origin, 'BKK');
  assert.equal(rebased?.destination, 'AMS');
  assert.equal(rebased?.scheduledDeparture, '2026-09-15T12:15:00+07:00');
  assert.deepEqual(rebased?.via, []);
  assert.equal(boardingLegFlight(journey, 'SIN'), null);
});
