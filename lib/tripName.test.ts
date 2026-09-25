import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ROUNDTRIP_KM,
  isRoundtrip,
  tripDate,
  tripName,
  type TripNameCopy,
  type TripNameFlight,
} from './tripName.ts';

/** The English sentences; every language uses the same three shapes. */
const EN: TripNameCopy = {
  to: (d, date) => `${d} · ${date}`,
  roundtrip: (d, from, to) => `${d} · ${from}–${to}`,
  multi: (o, d, date) => `${o} → ${d} · ${date}`,
};

const LANGS = ['en', 'nl', 'zh', 'th', 'de', 'ru', 'ja', 'ko', 'vi', 'id', 'es'] as const;

function opts(locale: string) {
  return { locale, copy: EN };
}

const OUT: TripNameFlight = { origin: 'AMS', destination: 'BKK', departureIso: '2026-09-27T13:00' };
const BACK: TripNameFlight = { origin: 'BKK', destination: 'AMS', departureIso: '2026-10-05T23:30' };

test('one flight: where you are going, and when', () => {
  assert.equal(tripName([OUT], opts('nl')), 'Bangkok · 27 sep');
  assert.equal(tripName([OUT], opts('en')), 'Bangkok · Sep 27');
});

test('there and back: one destination, two dates', () => {
  assert.equal(tripName([OUT, BACK], opts('nl')), 'Bangkok · 27 sep–5 okt');
  assert.equal(tripName([OUT, BACK], opts('en')), 'Bangkok · Sep 27–Oct 5');
  // The order the flights arrive in does not matter; the dates decide which is the outbound leg.
  assert.equal(tripName([BACK, OUT], opts('nl')), 'Bangkok · 27 sep–5 okt');
});

test('multi-city: three legs, or two that do not come home', () => {
  const hkt: TripNameFlight = { origin: 'BKK', destination: 'HKT', departureIso: '2026-09-30T09:00' };
  const home: TripNameFlight = { origin: 'HKT', destination: 'AMS', departureIso: '2026-10-05T18:00' };
  assert.equal(tripName([OUT, hkt, home], opts('nl')), 'Bangkok → Amsterdam · 27 sep');

  // Two flights, but the second does not bring you back: an open jaw is multi-city too.
  const onward: TripNameFlight = { origin: 'BKK', destination: 'SIN', departureIso: '2026-10-02T08:00' };
  assert.equal(tripName([OUT, onward], opts('nl')), 'Bangkok → Singapore · 27 sep');
});

test('the date is written the way each language writes it', () => {
  const dates = Object.fromEntries(LANGS.map(l => [l, tripDate('2026-09-27T13:00', l)]));
  // Day and month, in that language's own short form.
  assert.equal(dates.nl, '27 sep');
  assert.equal(dates.en, 'Sep 27');
  // The abbreviation is ICU's, not ours: German CLDR says "Sept." where the spec's table wrote "Sep".
  assert.match(dates.de, /^27\. Sept?\.?$/);
  assert.equal(dates.id, '27 Sep');
  assert.equal(dates.ja, '9月27日');
  assert.equal(dates.zh, '9月27日');
  assert.equal(dates.ko, '9월 27일');
  assert.equal(dates.vi, '27 thg 9');
  assert.match(dates.th, /^27 ก\.ย\.?$/);
  assert.match(dates.ru, /^27 сент?\.?$/);
  assert.match(dates.es, /^27 sept?\.?$/);
  // Every language says something, and none of them leaks an ISO string.
  for (const l of LANGS) {
    assert.ok(dates[l], l);
    assert.doesNotMatch(dates[l], /2026-09-27/, l);
  }
});

test('all three shapes work in all eleven languages', () => {
  for (const locale of LANGS) {
    const date = tripDate('2026-09-27T13:00', locale);
    const back = tripDate('2026-10-05T23:30', locale);
    const one = tripName([OUT], opts(locale));
    const round = tripName([OUT, BACK], opts(locale));
    const multi = tripName([OUT, { origin: 'BKK', destination: 'SIN', departureIso: '2026-10-02T08:00' }], opts(locale));
    assert.equal(one, `Bangkok · ${date}`, locale);
    assert.equal(round, `Bangkok · ${date}–${back}`, locale);
    assert.equal(multi, `Bangkok → Singapore · ${date}`, locale);
  }
});

test('the city name comes from the caller, so the header and the name agree', () => {
  const thai = tripName([OUT], {
    locale: 'th',
    copy: EN,
    cityFor: (code, fallback) => (code === 'BKK' ? 'กรุงเทพ' : fallback),
  });
  assert.equal(thai, `กรุงเทพ · ${tripDate('2026-09-27T13:00', 'th')}`);
  // A resolver that knows nothing falls back to the catalogue's own city.
  assert.equal(tripName([OUT], { locale: 'nl', copy: EN, cityFor: () => '' }), 'Bangkok · 27 sep');
});

test('coming home counts by distance, not by airport code', () => {
  assert.equal(ROUNDTRIP_KM, 50);
  // Out of Heathrow, back into Gatwick: still the same trip home (~40 km apart).
  assert.equal(isRoundtrip([
    { origin: 'LHR', destination: 'BKK', departureIso: '2026-09-27T13:00' },
    { origin: 'BKK', destination: 'LGW', departureIso: '2026-10-05T23:30' },
  ]), true);
  // Amsterdam and Brussels are not the same place.
  assert.equal(isRoundtrip([
    { origin: 'AMS', destination: 'BKK', departureIso: '2026-09-27T13:00' },
    { origin: 'BKK', destination: 'BRU', departureIso: '2026-10-05T23:30' },
  ]), false);
  // The same airport, obviously.
  assert.equal(isRoundtrip([OUT, BACK]), true);
  // One flight is never a return.
  assert.equal(isRoundtrip([OUT]), false);
  assert.equal(isRoundtrip([]), false);

  // And the name follows: a landing in Gatwick names the trip after where it went.
  const lhr = tripName([
    { origin: 'LHR', destination: 'BKK', departureIso: '2026-09-27T13:00' },
    { origin: 'BKK', destination: 'LGW', departureIso: '2026-10-05T23:30' },
  ], opts('en'));
  assert.equal(lhr, 'Bangkok · Sep 27–Oct 5');
});

test('nothing to go on means no name at all, never half a name', () => {
  assert.equal(tripName([], opts('nl')), '');
  // No date: nothing to put after the dot.
  assert.equal(tripName([{ origin: 'AMS', destination: 'BKK' }], opts('nl')), '');
  assert.equal(tripName([{ origin: 'AMS', destination: 'BKK', departureIso: 'soon' }], opts('nl')), '');
  // No destination at all: an unnamed place is not worth a header.
  assert.equal(tripName([{ origin: 'AMS', departureIso: '2026-09-27T13:00' }], opts('nl')), '');
  // A flight with no date sits out; the ones that have one still name the trip.
  assert.equal(
    tripName([OUT, { origin: 'BKK', destination: 'SIN' }], opts('nl')),
    'Bangkok · 27 sep',
  );
});

test('a day return, and a trip that ends where it was already going', () => {
  // Out and back on the same day: one date, not "27 sep–27 sep".
  const sameDay = tripName([
    { origin: 'AMS', destination: 'LHR', departureIso: '2026-09-27T07:00' },
    { origin: 'LHR', destination: 'AMS', departureIso: '2026-09-27T20:00' },
  ], opts('nl'));
  assert.equal(sameDay, 'Londen · 27 sep');

  // Three legs that all end up in the same city do not need an arrow.
  const same = tripName([
    OUT,
    { origin: 'BKK', destination: 'HKT', departureIso: '2026-09-30T09:00' },
    { origin: 'HKT', destination: 'BKK', departureIso: '2026-10-02T09:00' },
  ], opts('nl'));
  assert.equal(same, 'Bangkok · 27 sep');
});
