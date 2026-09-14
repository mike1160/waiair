import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chooseLeg,
  journeyRows,
  journeyStatus,
  legJourneys,
  trackedJourneyFlight,
  trackedJourneyLegs,
  withFinalArrival,
  type LegFields,
} from './flightLegs.ts';

type Leg = LegFields & { number: string; id: string };

function leg(id: string, origin: string, dep: string, destination: string, arr: string, extra: Partial<Leg> = {}): Leg {
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
    ...extra,
  };
}

/** BR75 on 15 Sep 2026 as AeroDataBox returns it: two legs with the same number. */
const TPE_BKK = leg('tpe-bkk', 'TPE', '2026-09-15T07:45:00+08:00', 'BKK', '2026-09-15T10:50:00+07:00', { arrTerminal: '1' });
const BKK_AMS = leg('bkk-ams', 'BKK', '2026-09-15T12:15:00+07:00', 'AMS', '2026-09-15T19:20:00+02:00', { arrTerminal: '3', baggage: '12' });

test('legJourneys chains TPE→BKK and BKK→AMS into one journey, whatever the input order', () => {
  const journeys = legJourneys([BKK_AMS, TPE_BKK]);
  assert.equal(journeys.length, 1);
  assert.deepEqual(journeys[0].map(l => l.id), ['tpe-bkk', 'bkk-ams']);
});

test('legJourneys keeps other days apart and does not chain legs that do not connect', () => {
  const yTpeBkk = leg('y-tpe-bkk', 'TPE', '2026-09-14T07:45:00+08:00', 'BKK', '2026-09-14T10:50:00+07:00');
  const yBkkAms = leg('y-bkk-ams', 'BKK', '2026-09-14T12:15:00+07:00', 'AMS', '2026-09-14T19:20:00+02:00');
  const journeys = legJourneys([BKK_AMS, yBkkAms, TPE_BKK, yTpeBkk]);
  assert.deepEqual(journeys.map(j => j.map(l => l.id)), [['y-tpe-bkk', 'y-bkk-ams'], ['tpe-bkk', 'bkk-ams']]);

  const elsewhere = leg('hkg-ams', 'HKG', '2026-09-15T12:15:00+08:00', 'AMS', '2026-09-15T19:20:00+02:00');
  assert.equal(legJourneys([TPE_BKK, elsewhere]).length, 2);
});

test('legJourneys never chains a different flight number, even when it connects (KL844 BKK→AMS after BR75 lands in BKK)', () => {
  const kl844 = leg('kl844', 'BKK', '2026-09-15T12:05:00+07:00', 'AMS', '2026-09-15T19:00:00+02:00', { number: 'KL 844' });
  const journeys = legJourneys([TPE_BKK, kl844, BKK_AMS]);
  assert.deepEqual(journeys.map(j => j.map(l => l.id)), [['tpe-bkk', 'bkk-ams'], ['kl844']]);
  // Spacing and case do not split the same number.
  const spaced = { ...BKK_AMS, id: 'spaced', number: 'br 75' };
  assert.deepEqual(legJourneys([TPE_BKK, spaced]).map(j => j.map(l => l.id)), [['tpe-bkk', 'spaced']]);
});

test('From BKK: the BKK→AMS leg is primary (not TPE→BKK), and it is already the final leg', () => {
  const choice = chooseLeg(legJourneys([TPE_BKK, BKK_AMS])[0], 'BKK');
  assert.equal(choice.kind, 'fromOrigin');
  if (choice.kind !== 'fromOrigin') return;
  assert.equal(choice.leg.id, 'bkk-ams');
  assert.equal(choice.finalLeg.id, 'bkk-ams');
  assert.deepEqual(choice.via, []);
  assert.deepEqual([choice.index, choice.total], [2, 2]);
  assert.equal(withFinalArrival(choice.leg, choice.finalLeg), BKK_AMS);
});

test('From TPE: departs from TPE, arrives at the final destination AMS via BKK', () => {
  const choice = chooseLeg(legJourneys([TPE_BKK, BKK_AMS])[0], 'tpe');
  assert.equal(choice.kind, 'fromOrigin');
  if (choice.kind !== 'fromOrigin') return;
  assert.equal(choice.leg.id, 'tpe-bkk');
  assert.deepEqual(choice.via, ['BKK']);
  const shown = withFinalArrival(choice.leg, choice.finalLeg);
  assert.equal(shown.origin, 'TPE');
  assert.equal(shown.scheduledDeparture, '2026-09-15T07:45:00+08:00');
  assert.equal(shown.destination, 'AMS');
  assert.equal(shown.scheduledArrival, '2026-09-15T19:20:00+02:00');
  assert.equal(shown.arrTerminal, '3');
  assert.equal(shown.baggage, '12');
  // The legs themselves are untouched.
  assert.equal(TPE_BKK.destination, 'BKK');
});

test('no leg from the user\'s airport (or none set): all legs, numbered 1/2 and 2/2', () => {
  for (const origin of ['AMS', '', null, undefined]) {
    const choice = chooseLeg(legJourneys([TPE_BKK, BKK_AMS])[0], origin);
    assert.equal(choice.kind, 'allLegs', String(origin));
    if (choice.kind !== 'allLegs') continue;
    assert.deepEqual(choice.legs.map(l => [l.leg.id, l.index, l.total]), [['tpe-bkk', 1, 2], ['bkk-ams', 2, 2]]);
  }
});

test('a single-leg flight is direct, whatever the origin', () => {
  const nonstop = leg('kl844', 'BKK', '2026-09-15T12:05:00+07:00', 'AMS', '2026-09-15T19:00:00+02:00');
  assert.deepEqual(chooseLeg([nonstop], 'BKK'), { kind: 'direct', flight: nonstop });
  assert.deepEqual(chooseLeg([nonstop], 'TPE'), { kind: 'direct', flight: nonstop });
});

test('journeyRows (search): From BKK → one BR75 row BKK→AMS; From TPE → TPE→AMS via BKK; From AMS → both legs labeled', () => {
  const nonstop = leg('kl844', 'BKK', '2026-09-15T12:05:00+07:00', 'AMS', '2026-09-15T19:00:00+02:00', { number: 'KL844' });

  // Rows come per journey in departure order (BR75 starts 07:45 in TPE); Home sorts by departure afterwards.
  const fromBkk = journeyRows([TPE_BKK, BKK_AMS, nonstop], 'BKK');
  assert.deepEqual(fromBkk.map(r => [r.number, r.origin, r.destination, r.via, r.legOf]), [
    ['BR75', 'BKK', 'AMS', [], undefined],
    ['KL844', 'BKK', 'AMS', undefined, undefined],
  ]);
  assert.equal(fromBkk[0].id, 'bkk-ams');

  const fromTpe = journeyRows([TPE_BKK, BKK_AMS], 'TPE');
  assert.equal(fromTpe.length, 1);
  assert.deepEqual([fromTpe[0].origin, fromTpe[0].destination, fromTpe[0].via], ['TPE', 'AMS', ['BKK']]);
  assert.equal(fromTpe[0].scheduledDeparture, '2026-09-15T07:45:00+08:00');
  assert.equal(fromTpe[0].scheduledArrival, '2026-09-15T19:20:00+02:00');

  const fromAms = journeyRows([TPE_BKK, BKK_AMS], 'AMS');
  assert.deepEqual(fromAms.map(r => [r.origin, r.destination, r.legOf]), [
    ['TPE', 'BKK', { index: 1, total: 2 }],
    ['BKK', 'AMS', { index: 2, total: 2 }],
  ]);
});

test('journeyStatus: the user\'s leg until it lands, then the final leg; a cancelled leg cancels the journey', () => {
  const s = (a: string, b: string) => journeyStatus({ ...TPE_BKK, status: a }, { ...BKK_AMS, status: b });
  assert.equal(s('scheduled', 'scheduled'), 'scheduled');
  assert.equal(s('en-route', 'scheduled'), 'en-route');
  assert.equal(s('landed', 'boarding'), 'boarding');
  assert.equal(s('landed', 'en-route'), 'en-route');
  assert.equal(s('landed', 'landed'), 'landed');
  assert.equal(s('scheduled', 'cancelled'), 'cancelled');
  assert.equal(journeyStatus({ ...BKK_AMS, status: 'delayed' }, { ...BKK_AMS, status: 'delayed' }), 'delayed');
});

test('trackedJourneyFlight: tracked TPE→AMS → departs TPE, arrives AMS, status follows the journey; same-day, complete journeys only', () => {
  const tpeDep = Date.parse('2026-09-15T07:45:00+08:00');
  const tracked = { origin: 'TPE', destination: 'AMS', depMs: tpeDep };
  const live = [{ ...TPE_BKK, status: 'landed' }, { ...BKK_AMS, status: 'en-route' }];
  const shown = trackedJourneyFlight(live, tracked);
  assert.ok(shown);
  assert.deepEqual([shown!.origin, shown!.destination, shown!.status, shown!.via], ['TPE', 'AMS', 'en-route', ['BKK']]);
  assert.equal(shown!.scheduledArrival, '2026-09-15T19:20:00+02:00');
  assert.equal(shown!.scheduledTime, TPE_BKK.scheduledTime);
  // Applying the merged flight again (applyLiveUpdates after pollTracked) changes nothing, stops included.
  assert.deepEqual(trackedJourneyFlight([shown!], tracked), shown);

  // Tracked from BKK: the final leg itself, still marked as a journey.
  const fromBkk = trackedJourneyFlight(live, { origin: 'BKK', destination: 'AMS', depMs: Date.parse('2026-09-15T12:15:00+07:00') });
  assert.equal(fromBkk!.id, 'bkk-ams');
  assert.equal(fromBkk!.status, 'en-route');
  assert.deepEqual(fromBkk!.via, []);

  // A board with only the first leg (TPE departures) never replaces the final arrival.
  assert.equal(trackedJourneyFlight([{ ...TPE_BKK, status: 'en-route' }], tracked), null);
  // Tomorrow's service (+24h) is not today's tracked flight; wrong origin / missing ends → null.
  const tomorrow = [TPE_BKK, BKK_AMS].map(l => ({
    ...l,
    scheduledDeparture: l.scheduledDeparture!.replace('-15T', '-16T'),
    departureTime: l.departureTime!.replace('-15T', '-16T'),
    scheduledTime: l.scheduledTime!.replace('-15T', '-16T'),
    scheduledArrival: l.scheduledArrival!.replace('-15T', '-16T'),
    arrivalTime: l.arrivalTime!.replace('-15T', '-16T'),
  }));
  assert.equal(trackedJourneyFlight(tomorrow, tracked), null);
  assert.equal(trackedJourneyFlight(live, { ...tracked, origin: 'AMS' }), null);
  assert.equal(trackedJourneyFlight(live, { ...tracked, destination: '' }), null);
});

test('trackedJourneyLegs returns the live leg objects themselves (background refresh reads their raw data)', () => {
  const live = [{ ...TPE_BKK, status: 'landed' }, { ...BKK_AMS, status: 'boarding' }];
  const legs = trackedJourneyLegs(live, { origin: 'TPE', destination: 'AMS', depMs: Date.parse('2026-09-15T07:45:00+08:00') });
  assert.ok(legs);
  assert.equal(legs!.leg, live[0]);
  assert.equal(legs!.finalLeg, live[1]);
  assert.deepEqual(legs!.via, ['BKK']);
  assert.equal(trackedJourneyLegs([live[0]], { origin: 'TPE', destination: 'AMS', depMs: null }), null);
});
