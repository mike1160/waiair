import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrivalLegFlight, suggestArrivalLeg } from './arrivalSegment.ts';
import { journeyOfTracked, suggestBoardingLeg } from './boardingSegment.ts';
import { legDepartureMs } from './flightLegs.ts';
import { pickTrackLeg } from './trackLegPick.ts';

/** BR75 for 29 Sep 2026: TPE → BKK → AMS, two legs of one number. */
const LEG1 = {
  number: 'BR 75',
  origin: 'TPE',
  originCity: 'Taipei',
  destination: 'BKK',
  destCity: 'Bangkok',
  scheduledTime: '2026-09-29T09:20:00+08:00',
  arrivalTime: '2026-09-29T12:15:00+07:00',
};
const LEG2 = {
  number: 'BR 75',
  origin: 'BKK',
  originCity: 'Bangkok',
  destination: 'AMS',
  destCity: 'Amsterdam',
  scheduledTime: '2026-09-29T14:05:00+07:00',
  arrivalTime: '2026-09-29T21:00:00+02:00',
};
const BR75 = [LEG1, LEG2];

/** Three legs, to prove the arriving journey keeps its intermediate stops. */
const T1 = { number: 'XX1', origin: 'SIN', destination: 'HKT', scheduledTime: '2026-09-29T06:00:00+08:00', arrivalTime: '2026-09-29T07:30:00+07:00' };
const T2 = { number: 'XX1', origin: 'HKT', destination: 'BKK', scheduledTime: '2026-09-29T09:00:00+07:00', arrivalTime: '2026-09-29T10:20:00+07:00' };
const T3 = { number: 'XX1', origin: 'BKK', destination: 'AMS', scheduledTime: '2026-09-29T12:00:00+07:00', arrivalTime: '2026-09-29T19:00:00+02:00' };
const XX1 = [T1, T2, T3];

/** The merged flight the app actually tracks for a traveller whose airport is BKK. */
const MERGED = pickTrackLeg(BR75, { originIata: 'BKK', nowMs: new Date('2026-09-29T07:00:00+07:00').getTime() })!;
const trackedOf = (f: { origin?: string; destination?: string }) => ({
  origin: f.origin,
  destination: f.destination,
  depMs: legDepartureMs(f as never),
});

test('[W/3] the merged BKK → AMS flight is asked about arriving in Bangkok', () => {
  assert.deepEqual(suggestArrivalLeg(BR75, trackedOf(MERGED), 'BKK'), {
    trackedDestination: 'AMS',
    arriveIata: 'BKK',
  });
});

test('[W/3] yes re-bases onto the journey that lands at home', () => {
  const rebased = arrivalLegFlight(BR75, 'BKK');
  assert.equal(rebased?.origin, 'TPE');
  assert.equal(rebased?.destination, 'BKK');
  assert.equal(rebased?.scheduledTime, LEG1.scheduledTime, 'the Taipei departure');
  assert.equal(rebased?.arrivalTime, LEG1.arrivalTime, 'landing in Bangkok, not flying on');
  assert.deepEqual(rebased?.via, [], 'no stop before Bangkok');
});

test('[W/3] a longer journey keeps the stops before home', () => {
  const merged = pickTrackLeg(XX1, { originIata: 'BKK', nowMs: new Date('2026-09-29T05:00:00+07:00').getTime() })!;
  assert.equal(merged.origin, 'BKK');
  assert.deepEqual(suggestArrivalLeg(XX1, trackedOf(merged), 'BKK'), { trackedDestination: 'AMS', arriveIata: 'BKK' });
  const rebased = arrivalLegFlight(XX1, 'BKK');
  assert.equal(rebased?.origin, 'SIN');
  assert.equal(rebased?.destination, 'BKK');
  assert.deepEqual(rebased?.via, ['HKT']);
});

test('[W/3] nothing is asked when the journey never lands at home before departing', () => {
  // BKK is the journey's true origin: there is no arriving leg to offer.
  const onlyOut = [LEG2, { ...LEG2, origin: 'AMS', destination: 'LHR', scheduledTime: '2026-09-29T22:30:00+02:00', arrivalTime: '2026-09-29T23:40:00+01:00' }];
  const merged = pickTrackLeg(onlyOut, { originIata: 'BKK', nowMs: Date.parse('2026-09-29T07:00:00+07:00') })!;
  assert.equal(suggestArrivalLeg(onlyOut, trackedOf(merged), 'BKK'), null);
});

test('[W/3] nothing is asked about a single-leg flight, or one already arriving home', () => {
  assert.equal(suggestArrivalLeg([LEG2], trackedOf(LEG2), 'BKK'), null, 'one leg: nothing to re-base');
  assert.equal(suggestArrivalLeg(BR75, trackedOf(LEG1), 'BKK'), null, 'already arriving in Bangkok');
  const roundTrip = [LEG1, { ...LEG1, origin: 'BKK', destination: 'TPE', scheduledTime: '2026-09-29T15:00:00+07:00', arrivalTime: '2026-09-29T19:40:00+08:00' }];
  assert.equal(suggestArrivalLeg(roundTrip, { origin: 'BKK', destination: 'BKK', depMs: null }, 'BKK'), null);
});

test('[W/3] no home airport, no question', () => {
  assert.equal(suggestArrivalLeg(BR75, trackedOf(MERGED), ''), null);
  assert.equal(suggestArrivalLeg(BR75, trackedOf(MERGED), null), null);
  assert.equal(suggestArrivalLeg(null, trackedOf(MERGED), 'BKK'), null);
});

test('[W/3] the two prompts are mutually exclusive by construction', () => {
  const tracked = trackedOf(MERGED);
  // The arrival question fires exactly where the boarding question cannot: origin is the traveller's airport.
  assert.ok(suggestArrivalLeg(BR75, tracked, 'BKK'));
  assert.equal(suggestBoardingLeg(BR75, tracked, ['BKK']), null);
  // And the reverse: tracked from Taipei with BKK known from another trip is the boarding question's case.
  const whole = { ...LEG1, destination: 'AMS', arrivalTime: LEG2.arrivalTime };
  assert.ok(suggestBoardingLeg(BR75, trackedOf(whole), ['AMS', 'BKK']));
  assert.equal(suggestArrivalLeg(BR75, trackedOf(whole), 'AMS'), null);
});

test('[W/3] the existing journey lookup already works for a merged flight', () => {
  // This is what the arrival prompt depends on: journeyOfTracked matches the departure airport and time and
  // never the destination, so the merged AMS destination — which belongs to leg 2 — does not put it off.
  assert.equal(journeyOfTracked(BR75, trackedOf(MERGED))?.length, 2);
  assert.equal(journeyOfTracked(BR75, { origin: 'XXX', destination: 'AMS', depMs: null }), null);
});
