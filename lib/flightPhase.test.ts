import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ARRIVED_WINDOW_MS,
  DAY_MS,
  checkinOpensMs,
  checkinUrlFor,
  departureMs,
  formatDuration,
  formatFxLine,
  getFlightPhase,
  hasKnownDeparture,
  hotelDismissKey,
  hotelSuggestionFor,
  packingTip,
} from './flightPhase.ts';
import type { HomeNowFlight } from './homeNow.ts';

/** BR75 boarding in Bangkok: Thursday 15 Oct 2026, 23:40 local (16:40 UTC), landing in Amsterdam at 06:55. */
const DEP_ISO = '2026-10-15T23:40:00+07:00';
const ARR_ISO = '2026-10-16T06:55:00+02:00';
const DEP = Date.parse(DEP_ISO);
const ARR = Date.parse(ARR_ISO);
const HOUR = 3_600_000;

function br75(over: Partial<HomeNowFlight> = {}): HomeNowFlight {
  return {
    number: 'BR75',
    airlineCode: 'BR',
    origin: 'BKK',
    originCountry: 'TH',
    destination: 'AMS',
    destCountry: 'NL',
    status: 'scheduled',
    scheduledTime: DEP_ISO,
    scheduledDeparture: DEP_ISO,
    departureTime: DEP_ISO,
    scheduledArrival: ARR_ISO,
    arrivalTime: ARR_ISO,
    ...over,
  };
}

test('before departure the time left decides: PREP, PRACTICAL, FINAL, EVE, DEPARTURE', () => {
  assert.equal(getFlightPhase(br75(), DEP - 30 * DAY_MS), 'PREP');
  assert.equal(getFlightPhase(br75(), DEP - 10 * DAY_MS), 'PRACTICAL');
  assert.equal(getFlightPhase(br75(), DEP - 5 * DAY_MS), 'FINAL');
  assert.equal(getFlightPhase(br75(), DEP - 2 * DAY_MS), 'EVE');
  assert.equal(getFlightPhase(br75(), DEP - 6 * HOUR), 'DEPARTURE');
});

test('the edges between the pre-flight phases', () => {
  assert.equal(getFlightPhase(br75(), DEP - 14 * DAY_MS - 1), 'PREP', 'just over 14 days');
  assert.equal(getFlightPhase(br75(), DEP - 14 * DAY_MS), 'PRACTICAL', 'exactly 14 days');
  assert.equal(getFlightPhase(br75(), DEP - 7 * DAY_MS), 'FINAL', 'exactly 7 days');
  assert.equal(getFlightPhase(br75(), DEP - 3 * DAY_MS), 'EVE', 'exactly 3 days');
  assert.equal(getFlightPhase(br75(), DEP - DAY_MS), 'DEPARTURE', 'exactly 24 hours');
});

test('INFLIGHT once it has departed, and a late flight still on the ground stays DEPARTURE', () => {
  assert.equal(getFlightPhase(br75({ status: 'en-route' }), DEP + 3 * HOUR), 'INFLIGHT');
  // Past the planned time but delayed to 00:40: still on the ground, still departure day.
  const late = '2026-10-16T00:40:00+07:00';
  assert.equal(
    getFlightPhase(br75({ status: 'delayed', estimatedDeparture: late, revisedTime: late }), DEP + 20 * 60_000),
    'DEPARTURE',
  );
  // A stale "landed" from yesterday's rotation must not skip ahead while this one has not left.
  assert.equal(getFlightPhase(br75({ status: 'landed' }), DEP - 5 * HOUR), 'DEPARTURE');
});

test('ARRIVED within four hours of landing, COMPLETED after', () => {
  const landed = br75({ status: 'landed', actualArrival: ARR_ISO, landedAtMs: ARR });
  assert.equal(getFlightPhase(landed, ARR + 30 * 60_000), 'ARRIVED');
  assert.equal(getFlightPhase(landed, ARR + ARRIVED_WINDOW_MS - 60_000), 'ARRIVED');
  assert.equal(getFlightPhase(landed, ARR + ARRIVED_WINDOW_MS + 60_000), 'COMPLETED');
  assert.equal(getFlightPhase(landed, ARR + 3 * DAY_MS), 'COMPLETED');
});

test('STOPOVER: the leg before landed at this origin, and this one leaves within a day', () => {
  const inbound = { destination: 'BKK', landed: true, arrMs: DEP - 5 * HOUR };
  assert.equal(getFlightPhase(br75(), DEP - 2 * HOUR, inbound), 'STOPOVER');
  // Not a stopover: the previous leg has not landed yet.
  assert.equal(getFlightPhase(br75(), DEP - 2 * HOUR, { ...inbound, landed: false }), 'DEPARTURE');
  // Not a stopover: it landed somewhere else.
  assert.equal(getFlightPhase(br75(), DEP - 2 * HOUR, { ...inbound, destination: 'HKT' }), 'DEPARTURE');
  // Not a stopover: more than a day between the legs is a new trip.
  assert.equal(
    getFlightPhase(br75(), DEP - 2 * HOUR, { ...inbound, arrMs: DEP - 2 * DAY_MS }),
    'DEPARTURE',
  );
  // Once this leg has departed it is simply in flight.
  assert.equal(getFlightPhase(br75({ status: 'en-route' }), DEP + HOUR, inbound), 'INFLIGHT');
});

test('without a departure time there is nothing to count down to: PREP', () => {
  const unknown = br75({
    scheduledTime: '', scheduledDeparture: '', departureTime: '', scheduledArrival: '', arrivalTime: '',
  });
  assert.equal(departureMs(unknown), null);
  assert.equal(getFlightPhase(unknown, DEP), 'PREP');
});

test('a flight known only from an arrivals board has no departure, so the hub stays out', () => {
  // The record the simulator stored for TG208 from Phuket's arrivals board: arrival times only.
  const arrivalOnly = br75({
    number: 'TG208', airlineCode: 'TG', origin: 'HKT', destination: 'BKK', destCountry: '', boardSide: 'arrival',
    scheduledTime: '2026-09-22T14:35:00+07:00', revisedTime: '2026-09-22T14:35:00+07:00',
    departureTime: '', scheduledDeparture: '', estimatedDeparture: '', actualDeparture: '',
    arrivalTime: '2026-09-22T14:35:00+07:00', scheduledArrival: '2026-09-22T14:35:00+07:00', estimatedArrival: '',
  });
  assert.equal(hasKnownDeparture(arrivalOnly), false);
  assert.equal(hasKnownDeparture(br75()), true);
});

test('check-in opens 24 or 48 hours out for known airlines, 3 hours for the airport desk otherwise', () => {
  const opens = checkinOpensMs(br75());
  assert.ok(opens != null && (DEP - opens === 24 * HOUR || DEP - opens === 48 * HOUR));
  assert.equal(DEP - (checkinOpensMs(br75({ airlineCode: '', number: '' })) ?? 0), 3 * HOUR);
});

test('check-in links only for airlines whose page was verified; the rest get no link', () => {
  assert.match(checkinUrlFor('KL') || '', /^https:\/\/www\.klm\.com\//);
  assert.match(checkinUrlFor('br') || '', /evaair\.com/, 'case does not matter');
  assert.equal(checkinUrlFor('TG'), null, 'no confirmed Thai Airways check-in page');
  assert.equal(checkinUrlFor(''), null);
  assert.equal(checkinUrlFor(undefined), null);
});

test('packing tip: sun between the tropics, a coat in the local winter far from the equator', () => {
  assert.equal(packingTip(13.7, 9), 'sunscreen', 'Bangkok in October');
  assert.equal(packingTip(52.3, 11), 'coat', 'Amsterdam in December');
  assert.equal(packingTip(52.3, 6), null, 'Amsterdam in July: no clear tip');
  assert.equal(packingTip(-33.9, 6), null, 'Sydney is just short of 35° south');
  assert.equal(packingTip(-37.7, 6), 'coat', 'Melbourne in July is winter');
  assert.equal(packingTip(-37.7, 0), null, 'Melbourne in January is summer');
  assert.equal(packingTip(null, 5), null);
  assert.equal(packingTip(10, 12), null, 'no such month');
});

test('hotel suggestion: a waiting hotel within two days of arrival, the closest first', () => {
  const waiting = [
    { messageId: 'far', kind: 'hotel', title: 'Hotel Far', startYmd: '2026-10-25' },
    { messageId: 'car', kind: 'carRental', title: 'Sixt', startYmd: '2026-10-16' },
    { messageId: 'near', kind: 'hotel', title: 'Hotel Near', startYmd: '2026-10-17' },
    { messageId: 'exact', kind: 'hotel', title: 'Hotel Exact', startYmd: '2026-10-16' },
  ];
  assert.equal(hotelSuggestionFor(waiting, '2026-10-16')?.messageId, 'exact');
  assert.equal(hotelSuggestionFor(waiting.filter(w => w.messageId !== 'exact'), '2026-10-16')?.messageId, 'near');
  // Nothing within two days, or no arrival day to compare: no suggestion.
  assert.equal(hotelSuggestionFor(waiting, '2026-11-30'), null);
  assert.equal(hotelSuggestionFor(waiting, null), null);
  // A hotel without a name cannot be offered.
  assert.equal(hotelSuggestionFor([{ messageId: 'x', kind: 'hotel', title: '', startYmd: '2026-10-16' }], '2026-10-16'), null);
});

test('the dismiss key and the stopover duration', () => {
  assert.equal(hotelDismissKey('BR75|2026-10-15'), 'hub:hotel:dismissed:BR75|2026-10-15');
  assert.equal(formatDuration(3 * HOUR + 25 * 60_000), '3h 25m');
  assert.equal(formatDuration(45 * 60_000), '45m');
  assert.equal(formatDuration(-5), '0m');
});

test('exchange rate: always a number above one, two decimals', () => {
  assert.equal(formatFxLine({ from: 'THB', to: 'EUR', rate: 0.026 }), '1 EUR = 38.46 THB');
  assert.equal(formatFxLine({ from: 'EUR', to: 'THB', rate: 38.4615 }), '1 EUR = 38.46 THB');
  assert.equal(formatFxLine({ from: 'EUR', to: 'JPY', rate: 162.5 }), '1 EUR = 162.50 JPY');
  assert.equal(formatFxLine({ from: 'EUR', to: 'USD', rate: 1 }), '1 EUR = 1.00 USD');
  assert.equal(formatFxLine({ from: 'EUR', to: 'USD', rate: 0 }), null);
  assert.equal(formatFxLine({ from: 'EUR', to: 'USD', rate: Number.NaN }), null);
});

test('every app language has every hub line, with exactly the placeholders English uses', () => {
  const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8')) as Record<string, string>;
  const keys = Object.keys(en).filter(k => /^hub[A-Z]/.test(k));
  assert.ok(keys.length >= 48, `hub keys found: ${keys.length}`);
  const files: Record<string, string> = {
    nl: '../i18n/locales/nl.json', de: '../i18n/locales/de.json', es: '../i18n/locales/es.json',
    id: '../i18n/locales/id.json', ja: '../i18n/locales/ja.json', ko: '../i18n/locales/ko.json',
    ru: '../i18n/locales/ru.json', th: '../i18n/locales/th.json', vi: '../i18n/locales/vi.json',
    zh: '../zh_translations.json',
  };
  const holes = (v: string) => [...new Set(Array.from(v.matchAll(/\{(\w+)\}/g), m => m[1]))].sort();
  for (const [loc, file] of Object.entries(files)) {
    const table = JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8')) as Record<string, unknown>;
    for (const key of keys) {
      const value = table[key];
      assert.ok(typeof value === 'string' && value.trim(), `${loc}: ${key} is missing`);
      assert.deepEqual(holes(value as string), holes(en[key]), `${loc}: ${key} placeholders`);
      // A plural line has both forms, like English.
      assert.equal((value as string).includes(' | '), en[key].includes(' | '), `${loc}: ${key} plural forms`);
    }
  }
});
