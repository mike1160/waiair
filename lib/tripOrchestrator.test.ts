/**
 * Phase B: which tracked flights are one journey, and which bookings belong to it.
 * node:test, no jest.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extrasForGroup, groupTrips, type TripFlight } from './tripOrchestrator.ts';

type Leg = {
  key: string;
  origin: string;
  destination: string;
  destCity?: string;
  dep: string;
  arr: string;
};

function leg(l: Leg): TripFlight {
  return {
    key: l.key,
    scheduledTime: l.dep,
    flight: {
      origin: l.origin,
      destination: l.destination,
      destCity: l.destCity,
      scheduledDeparture: l.dep,
      scheduledArrival: l.arr,
      scheduledTime: l.dep,
    },
  };
}

const OUT = leg({
  key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
  dep: '2027-03-14T14:05:00Z', arr: '2027-03-15T06:20:00Z',
});
const BACK = leg({
  key: 'kl876', origin: 'BKK', destination: 'AMS', destCity: 'Amsterdam',
  dep: '2027-03-21T23:30:00Z', arr: '2027-03-22T07:10:00Z',
});

test('a single flight is a group of one', () => {
  const groups = groupTrips([OUT]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].flights.map(f => f.key), ['kl875']);
  assert.equal(groups[0].name, 'Bangkok');
  assert.equal(groups[0].startDate, '2027-03-14');
  assert.equal(groups[0].endDate, '2027-03-14', 'one leg: it starts and ends the day it departs');
  assert.equal(groups[0].key, 'kl875|kl875');
});

test('a return trip a week apart is one group, named after the first destination', () => {
  const groups = groupTrips([BACK, OUT]);
  assert.equal(groups.length, 1);
  // Sorted by departure inside the group, whatever order they came in.
  assert.deepEqual(groups[0].flights.map(f => f.key), ['kl875', 'kl876']);
  assert.equal(groups[0].name, 'Bangkok');
  assert.equal(groups[0].startDate, '2027-03-14');
  // The return leg lands on the 22nd, but the trip is over when it takes off on the 21st.
  assert.equal(groups[0].endDate, '2027-03-21');
  assert.equal(groups[0].key, 'kl875|kl876');
});

test('two unrelated flights are two groups, oldest first', () => {
  const lhr = leg({
    key: 'ba431', origin: 'AMS', destination: 'LHR', destCity: 'London',
    dep: '2027-04-13T09:00:00Z', arr: '2027-04-13T09:20:00Z',
  });
  const groups = groupTrips([lhr, OUT]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(g => g.name), ['Bangkok', 'London']);
  assert.deepEqual(groups.map(g => g.flights.length), [1, 1]);
});

test('a three-leg trip stays one group', () => {
  const cnx = leg({
    key: 'tg102', origin: 'BKK', destination: 'CNX', destCity: 'Chiang Mai',
    dep: '2027-03-16T08:00:00Z', arr: '2027-03-16T09:20:00Z',
  });
  const home = leg({
    key: 'tg103', origin: 'CNX', destination: 'AMS', destCity: 'Amsterdam',
    dep: '2027-03-21T10:00:00Z', arr: '2027-03-21T18:00:00Z',
  });
  const groups = groupTrips([home, OUT, cnx]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].flights.map(f => f.key), ['kl875', 'tg102', 'tg103']);
  assert.equal(groups[0].startDate, '2027-03-14');
  assert.equal(groups[0].endDate, '2027-03-21');
});

test('two flights on the same day to different places are separate trips', () => {
  const bkk = leg({
    key: 'kl875', origin: 'AMS', destination: 'BKK', destCity: 'Bangkok',
    dep: '2027-03-14T14:05:00Z', arr: '2027-03-15T06:20:00Z',
  });
  const lhr = leg({
    key: 'ba431', origin: 'AMS', destination: 'LHR', destCity: 'London',
    dep: '2027-03-14T09:00:00Z', arr: '2027-03-14T09:20:00Z',
  });
  const groups = groupTrips([bkk, lhr]);
  assert.equal(groups.length, 2, 'sharing only the departure airport is not a journey');
  assert.deepEqual(groups.map(g => g.name), ['London', 'Bangkok']);
});

test('the gap is what separates two trips to the same place', () => {
  const near = leg({
    key: 'tg921', origin: 'BKK', destination: 'AMS', destCity: 'Amsterdam',
    dep: '2027-04-01T23:30:00Z', arr: '2027-04-02T07:10:00Z',
  });
  // 18 days after landing: still the same journey.
  assert.equal(groupTrips([OUT, near]).length, 1);

  const far = leg({
    key: 'tg921', origin: 'BKK', destination: 'AMS', destCity: 'Amsterdam',
    dep: '2027-04-20T23:30:00Z', arr: '2027-04-21T07:10:00Z',
  });
  // 36 days after landing: two trips, even though they meet at BKK.
  assert.equal(groupTrips([OUT, far]).length, 2);
});

test('a flight with no usable clock is its own group rather than swallowing another', () => {
  const noClock: TripFlight = { key: 'xx999', flight: { origin: 'BKK', destination: 'AMS' } };
  const groups = groupTrips([OUT, noClock]);
  assert.equal(groups.length, 2);
});

test('extrasForGroup: the latest check-in wins, the fullest booking wins for the rest', () => {
  const early: TripFlight = {
    ...OUT,
    tripExtras: {
      hotel: { name: 'Airport Inn', checkIn: '2027-03-15' },
      carRental: { company: 'Sixt' },
      excursion: { name: 'Grand Palace tour' },
    },
  };
  const late: TripFlight = {
    ...BACK,
    tripExtras: {
      hotel: { name: 'Riva Surya', checkIn: '2027-03-18' },
      carRental: {
        company: 'Hertz',
        pickupLocation: 'BKK Airport',
        pickupTime: '2027-03-18T10:00:00',
        confirmationRef: 'HZ112233',
      },
      restaurant: { name: 'Nobu', dateTime: '2027-03-19T19:30:00' },
    },
  };
  const group = groupTrips([early, late])[0];
  assert.equal(group.flights.length, 2, 'both legs are one trip');
  assert.equal(group.extras.hotel?.name, 'Riva Surya', 'latest check-in wins');
  assert.equal(group.extras.carRental?.company, 'Hertz', 'the fuller rental wins');
  assert.equal(group.extras.excursion?.name, 'Grand Palace tour', 'kept from the other leg');
  assert.equal(group.extras.restaurant?.name, 'Nobu');
  // Only the slots that are really set — no undefined placeholders.
  assert.deepEqual(Object.keys(group.extras).sort(), ['carRental', 'excursion', 'hotel', 'restaurant']);

  // Called on its own it answers the same thing.
  assert.deepEqual(extrasForGroup(group), group.extras);
});

test('extrasForGroup returns an empty set when no leg has a booking', () => {
  assert.deepEqual(groupTrips([OUT])[0].extras, {});
  assert.deepEqual(extrasForGroup({ key: 'k', name: 'n', startDate: '', endDate: '', flights: [], extras: {} }), {});
});

test('groupTrips is pure: it does not touch the array it is given', () => {
  const input = [BACK, OUT];
  const snapshot = input.map(f => f.key);
  groupTrips(input);
  assert.deepEqual(input.map(f => f.key), snapshot);
});
