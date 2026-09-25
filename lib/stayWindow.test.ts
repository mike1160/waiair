import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STAY_FALLBACK_DAYS,
  STAY_FROM_CHECKIN_DAYS,
  stayEndYmd,
  ymdPlusDays,
  type StayFlight,
} from './stayWindow.ts';

/** AMS → BKK, landing 10 Oct. */
const OUT: StayFlight = {
  key: 'TG921|2026-10-10',
  scheduledTime: '2026-10-09T23:30:00+02:00',
  flight: {
    origin: 'AMS',
    destination: 'BKK',
    scheduledDeparture: '2026-10-09T23:30:00+02:00',
    scheduledArrival: '2026-10-10T16:05:00+07:00',
  },
};

/** The flight home, a fortnight later. */
const BACK: StayFlight = {
  key: 'TG922|2026-10-24',
  scheduledTime: '2026-10-24T09:00:00+07:00',
  flight: {
    origin: 'BKK',
    destination: 'AMS',
    scheduledDeparture: '2026-10-24T09:00:00+07:00',
    scheduledArrival: '2026-10-24T16:30:00+02:00',
  },
};

test('a tracked flight home is the end of the stay, and beats every fallback', () => {
  assert.equal(stayEndYmd(OUT, [OUT, BACK]), '2026-10-24');
  // Even with a hotel that says otherwise: a booked flight home is the better answer.
  const withHotel: StayFlight = { ...OUT, tripExtras: { hotel: { checkIn: '2026-10-10', checkOut: '2026-10-13' } } };
  assert.equal(stayEndYmd(withHotel, [withHotel, BACK]), '2026-10-24');
  // The earliest flight home wins when there are several.
  const later: StayFlight = { ...BACK, key: 'x', flight: { ...BACK.flight, scheduledDeparture: '2026-11-02T09:00:00+07:00' } };
  assert.equal(stayEndYmd(OUT, [OUT, later, BACK]), '2026-10-24');
});

test('no flight home: the trip\'s own hotel checkout ends the stay', () => {
  const t: StayFlight = { ...OUT, tripExtras: { hotel: { checkIn: '2026-10-10', checkOut: '2026-10-17' } } };
  assert.equal(stayEndYmd(t, [t]), '2026-10-17');
  // A checkout with a clock on it is still read as its day.
  const withTime: StayFlight = { ...OUT, tripExtras: { hotel: { checkOut: '2026-10-17T11:00' } } };
  assert.equal(stayEndYmd(withTime, [withTime]), '2026-10-17');
  // A checkout before the landing belongs to something else and is ignored.
  const stale: StayFlight = { ...OUT, tripExtras: { hotel: { checkOut: '2026-09-01' } } };
  assert.equal(stayEndYmd(stale, [stale]), ymdPlusDays('2026-10-10', STAY_FALLBACK_DAYS));
});

test('no checkout: a week from the check-in', () => {
  const t: StayFlight = { ...OUT, tripExtras: { hotel: { checkIn: '2026-10-11' } } };
  assert.equal(stayEndYmd(t, [t]), '2026-10-18');
  assert.equal(STAY_FROM_CHECKIN_DAYS, 7);
});

test('nothing but the flight: a fortnight from the landing', () => {
  assert.equal(stayEndYmd(OUT, [OUT]), '2026-10-24');
  assert.equal(STAY_FALLBACK_DAYS, 14);
  // And the single flight on its own, which is the case the whole fix exists for.
  assert.equal(stayEndYmd(OUT, []), '2026-10-24');
});

test('a flight that says too little cannot place a stay at all', () => {
  assert.equal(stayEndYmd({ key: 'a' }, []), undefined);
  assert.equal(stayEndYmd({ key: 'a', flight: { destination: 'BKK' } }, []), undefined, 'no arrival');
  assert.equal(
    stayEndYmd({ key: 'a', flight: { scheduledArrival: '2026-10-10T16:05:00+07:00' } }, []),
    undefined,
    'no destination',
  );
  // A placeholder destination is not a destination.
  assert.equal(
    stayEndYmd({ key: 'a', flight: { destination: 'UNK', scheduledArrival: '2026-10-10T16:05:00+07:00' } }, []),
    undefined,
  );
});

test('adding days crosses months and years', () => {
  assert.equal(ymdPlusDays('2026-10-10', 14), '2026-10-24');
  assert.equal(ymdPlusDays('2026-12-28', 7), '2027-01-04');
  assert.equal(ymdPlusDays('2028-02-28', 1), '2028-02-29', 'leap year');
  assert.equal(ymdPlusDays('2026-10-10', 0), '2026-10-10');
  assert.equal(ymdPlusDays('not a date', 7), '');
  assert.equal(ymdPlusDays('', 7), '');
});
