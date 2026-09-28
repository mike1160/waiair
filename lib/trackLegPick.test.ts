import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickTrackLeg, trackLegRows } from './trackLegPick.ts';

/** BR75 as the proxy answers for 29 Sep 2026: two legs of one number, TPE → BKK → AMS. */
const LEG1 = {
  number: 'BR 75',
  origin: 'TPE',
  destination: 'BKK',
  scheduledTime: '2026-09-29T09:20:00+08:00',
  arrivalTime: '2026-09-29T12:15:00+07:00',
};
const LEG2 = {
  number: 'BR 75',
  origin: 'BKK',
  destination: 'AMS',
  destCity: 'Amsterdam',
  scheduledTime: '2026-09-29T14:05:00+07:00',
  arrivalTime: '2026-09-29T21:00:00+02:00',
};
const BR75 = [LEG1, LEG2];

/** Two rotations of a single-leg number, to prove the nearest-in-time pick is untouched. */
const TG208_TODAY = { number: 'TG208', origin: 'HKT', destination: 'BKK', scheduledTime: '2026-09-29T13:00:00+07:00' };
const TG208_TOMORROW = { number: 'TG208', origin: 'HKT', destination: 'BKK', scheduledTime: '2026-09-30T13:00:00+07:00' };

const MORNING = new Date('2026-09-29T07:00:00+07:00').getTime();

test('[W/2] BR75 added from Bangkok is the Bangkok leg, not whichever leg leaves soonest', () => {
  // The bug: at 07:00 the TPE departure is nearest, so the card showed a flight from Taipei.
  const picked = pickTrackLeg(BR75, { originIata: 'BKK', nowMs: MORNING });
  assert.equal(picked?.origin, 'BKK');
  assert.equal(picked?.destination, 'AMS', 'and it arrives in Amsterdam, not Bangkok');
  assert.equal(picked?.scheduledTime, LEG2.scheduledTime);
});

test('[W/2] the merged leg carries the journey arrival, so the countdown ends in Amsterdam', () => {
  const picked = pickTrackLeg(BR75, { originIata: 'BKK', nowMs: MORNING });
  assert.equal(picked?.arrivalTime, LEG2.arrivalTime);
  assert.deepEqual(picked?.via, [], 'BKK → AMS is the last leg: nothing in between');
});

test('[W/2] a scanned boarding pass decides where the traveller boards', () => {
  // Home airport says Taipei, the pass says Bangkok. The pass wins at the call site; here it simply works.
  assert.equal(pickTrackLeg(BR75, { originIata: 'TPE', nowMs: MORNING })?.origin, 'TPE');
  assert.equal(pickTrackLeg(BR75, { originIata: 'BKK', nowMs: MORNING })?.origin, 'BKK');
});

test('[W/2] a journey that touches neither airport is left as separate legs', () => {
  const rows = trackLegRows(BR75, 'AMS');
  assert.deepEqual(rows.map(r => `${r.origin}->${r.destination}`), ['TPE->BKK', 'BKK->AMS']);
  assert.deepEqual(rows.map(r => r.legOf), [{ index: 1, total: 2 }, { index: 2, total: 2 }], 'and labeled as legs');
  // Unchanged behaviour: nearest departure wins, and the card says which leg it is.
  assert.equal(pickTrackLeg(BR75, { originIata: 'AMS', nowMs: MORNING })?.origin, 'TPE');
});

test('[W/2] no origin at all behaves as it always did', () => {
  assert.equal(pickTrackLeg(BR75, { nowMs: MORNING })?.origin, 'TPE');
  assert.equal(pickTrackLeg(BR75, { originIata: '', nowMs: MORNING })?.origin, 'TPE');
});

test('[W/2] a date picks that day, and then the nearest to it', () => {
  assert.equal(pickTrackLeg([TG208_TODAY, TG208_TOMORROW], { dateIso: '2026-09-30' })?.scheduledTime,
    TG208_TOMORROW.scheduledTime);
  assert.equal(pickTrackLeg([TG208_TODAY, TG208_TOMORROW], { dateIso: '2026-10-05' })?.scheduledTime,
    TG208_TOMORROW.scheduledTime, 'nothing on that day: the nearest departure');
});

test('[W/2] rotations of a single-leg number still go by the clock', () => {
  assert.equal(pickTrackLeg([TG208_TOMORROW, TG208_TODAY], { originIata: 'BKK', nowMs: MORNING })?.scheduledTime,
    TG208_TODAY.scheduledTime);
  // The arrival airport is not a boarding airport: merging must not re-base an arrival onto the home airport.
  assert.equal(pickTrackLeg([TG208_TODAY], { originIata: 'BKK', nowMs: MORNING })?.origin, 'HKT');
});

test('[W/2] nothing to pick from is undefined, not a guess', () => {
  assert.equal(pickTrackLeg([], { originIata: 'BKK' }), undefined);
});
