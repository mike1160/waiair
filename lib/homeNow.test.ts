import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkinHoursBeforeDeparture,
  formatHomeNowLine,
  homeModuleCardSection,
  homeModulesForPhase,
  homeRelativeDayLabel,
  homeRelativeDayOffset,
  HOME_HIDDEN_MODULES,
  homeSearchDelayClocks,
  homeSearchRowStatus,
  isDepartedSearchResult,
  mergeHubSearchFlights,
  partitionHomeSearchResults,
  pickFlightNumberHits,
  matchingAirlineFlights,
  matchingFlightNumber,
  searchDepartureClock,
  resolveHomeKind,
  resolveHomeNow,
  shouldShowHomeConsent,
  shouldShowTripConfirm,
  sortTrackedFlightsForHome,
  type HomeNowCopy,
  type HomeNowFlight,
} from './homeNow.ts';

/** Wednesday 9 Sep 2026, 12:00 in Phuket. */
const NOW = Date.parse('2026-09-09T12:00:00+07:00');

const COPY: HomeNowCopy = {
  homeNowCheckin: time => `Check-in opens at ${time}`,
  homeNowLeave: time => `Leave for the airport around ${time}`,
  homeNowAtAirport: "You're at the airport",
  homeNowGate: (gate, mins) => `Gate ${gate} · ${mins} min walk`,
  homeNowBoarding: gate => `Boarding · Gate ${gate}`,
  homeNowLandsIn: duration => `Lands in ${duration}`,
  homeNowBelt: belt => `Baggage belt ${belt}`,
  homeNowTransport: 'Transport to your hotel',
  homeGoodTrip: 'Have a good trip',
  gateTbdShort: 'Gate TBD',
};

const REL = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  homeRelativeInDays: (n: number) => `In ${n} days`,
};

function oz(over: Partial<HomeNowFlight> = {}): HomeNowFlight {
  return {
    number: 'OZ748',
    origin: 'HKT',
    originCountry: 'TH',
    destination: 'ICN',
    destCountry: 'KR',
    status: 'scheduled',
    scheduledTime: '2026-09-10T15:20:00+07:00',
    scheduledDeparture: '2026-09-10T15:20:00+07:00',
    departureTime: '2026-09-10T15:20:00+07:00',
    scheduledArrival: '2026-09-10T23:45:00+09:00',
    arrivalTime: '2026-09-10T23:45:00+09:00',
    ...over,
  };
}

function lineAt(f: HomeNowFlight, now: number): { phase: string; text: string } {
  const resolved = resolveHomeNow(f, now);
  return { phase: resolved.phase, text: formatHomeNowLine(resolved, COPY) };
}

test('home kind stays pending until the store is ready — no empty→tracked flash', () => {
  assert.equal(resolveHomeKind(false, 0), 'pending');
  assert.equal(resolveHomeKind(false, 4), 'pending');
  const firstPaint = [resolveHomeKind(false, 0), resolveHomeKind(true, 2)];
  assert.deepEqual(firstPaint, ['pending', 'tracked']);
  assert.equal(firstPaint.includes('empty'), false);
  assert.equal(resolveHomeKind(true, 0), 'empty');
});

test('phase → Now text with frozen clock', () => {
  const f = oz();

  const checkin = lineAt(f, NOW);
  assert.equal(checkin.phase, 'checkin');
  assert.equal(checkin.text, 'Check-in opens at 15:20');

  const todayEve = oz({
    scheduledTime: '2026-09-09T22:45:00+07:00',
    scheduledDeparture: '2026-09-09T22:45:00+07:00',
    departureTime: '2026-09-09T22:45:00+07:00',
  });
  const at1054 = lineAt(todayEve, Date.parse('2026-09-09T10:54:00+07:00'));
  assert.equal(at1054.phase, 'leave');
  assert.equal(at1054.text, 'Leave for the airport around 22:00');
  assert.notEqual(at1054.text.includes('22:45'), true);

  const unknownAirline = oz({
    number: '1234',
    airlineCode: '',
    scheduledTime: '2026-09-09T22:45:00+07:00',
    scheduledDeparture: '2026-09-09T22:45:00+07:00',
    departureTime: '2026-09-09T22:45:00+07:00',
  });
  const airportCheckin = lineAt(unknownAirline, Date.parse('2026-09-09T10:54:00+07:00'));
  assert.equal(airportCheckin.phase, 'checkin');
  assert.equal(airportCheckin.text, 'Check-in opens at 19:45');

  const leave = lineAt(f, Date.parse('2026-09-10T13:00:00+07:00'));
  assert.equal(leave.phase, 'leave');
  assert.equal(leave.text, 'Leave for the airport around 14:35');

  const atAirport = lineAt(f, Date.parse('2026-09-10T14:50:00+07:00'));
  assert.equal(atAirport.phase, 'at_airport');
  assert.equal(atAirport.text, "You're at the airport");

  const gate = lineAt(oz({ gate: 'C12' }), Date.parse('2026-09-10T14:50:00+07:00'));
  assert.equal(gate.phase, 'gate');
  assert.equal(gate.text, 'Gate C12 · 15 min walk');

  const boarding = lineAt(oz({ gate: 'C12', status: 'boarding' }), Date.parse('2026-09-10T14:50:00+07:00'));
  assert.equal(boarding.phase, 'boarding');
  assert.equal(boarding.text, 'Boarding · Gate C12');

  const inFlight = lineAt(
    oz({ status: 'en-route' }),
    Date.parse('2026-09-10T18:00:00+07:00'),
  );
  assert.equal(inFlight.phase, 'in_flight');
  assert.equal(inFlight.text, 'Lands in 3h 45m');

  const baggageNow = Date.parse('2026-09-10T23:50:00+09:00');
  const baggage = lineAt(oz({
    status: 'landed',
    baggage: '7',
    landedAtMs: baggageNow - 60_000,
    actualArrival: '2026-09-10T23:48:00+09:00',
  }), baggageNow);
  assert.equal(baggage.phase, 'baggage');
  assert.equal(baggage.text, 'Baggage belt 7');

  const transportNow = Date.parse('2026-09-10T23:56:00+09:00');
  const transport = lineAt(oz({
    status: 'landed',
    baggage: '7',
    landedAtMs: transportNow - 6 * 60_000,
    actualArrival: '2026-09-10T23:48:00+09:00',
  }), transportNow);
  assert.equal(transport.phase, 'transport');
  assert.equal(transport.text, 'Transport to your hotel');

  const doneNow = Date.parse('2026-09-12T00:00:00+09:00');
  const done = lineAt(oz({
    status: 'landed',
    landedAtMs: Date.parse('2026-09-10T23:48:00+09:00'),
    actualArrival: '2026-09-10T23:48:00+09:00',
  }), doneNow);
  assert.equal(done.phase, 'done');
  assert.equal(done.text, 'Have a good trip');
});

test('phase → visible module ids (2–4, never radar/fids/miles)', () => {
  const checkin = homeModulesForPhase('checkin', { international: true });
  assert.deepEqual(checkin, ['weather', 'morning_briefing', 'immigration', 'transport']);
  assert.ok(checkin.length >= 2 && checkin.length <= 4);

  const domestic = homeModulesForPhase('checkin', { international: false });
  assert.deepEqual(domestic, ['weather', 'morning_briefing', 'transport']);
  assert.equal(domestic.includes('immigration'), false);

  const gate = homeModulesForPhase('gate');
  assert.deepEqual(gate, ['lounge', 'transport', 'connection_risk', 'inbound_tracking']);

  const air = homeModulesForPhase('in_flight', { international: true });
  assert.deepEqual(air, ['weather', 'turbulence', 'immigration']);

  const bag = homeModulesForPhase('baggage', { international: true });
  assert.deepEqual(bag, ['transport', 'weather', 'immigration']);

  for (const phase of ['checkin', 'leave', 'at_airport', 'gate', 'boarding', 'in_flight', 'baggage', 'transport', 'done'] as const) {
    const ids = homeModulesForPhase(phase, { international: true });
    assert.ok(ids.length >= 2 && ids.length <= 4, phase);
    for (const hidden of HOME_HIDDEN_MODULES) {
      assert.equal(ids.includes(hidden), false, `${phase} ${hidden}`);
    }
    assert.equal(ids.includes('journey_phase'), false);
  }
});

test('home modules map onto detail card sections', () => {
  assert.equal(homeModuleCardSection('lounge'), 'beforeDeparture');
  assert.equal(homeModuleCardSection('turbulence'), 'beforeDeparture');
  assert.equal(homeModuleCardSection('radar'), 'extras');
});

test('confirmation shows once when going from zero to a tracked flight', () => {
  assert.equal(shouldShowTripConfirm({ previousCount: null, nextCount: 2 }), false);
  assert.equal(shouldShowTripConfirm({ previousCount: 0, nextCount: 1 }), true);
  assert.equal(shouldShowTripConfirm({ previousCount: 1, nextCount: 2 }), false);
  assert.equal(shouldShowTripConfirm({ previousCount: 2, nextCount: 2 }), false);
});

test('consent waits for confirmation, then shows once after the first flight', () => {
  assert.equal(shouldShowHomeConsent(null, 0, false), false);
  assert.equal(shouldShowHomeConsent(null, 1, true), false);
  assert.equal(shouldShowHomeConsent(null, 1, false), true);
  assert.equal(shouldShowHomeConsent('granted', 1, false), false);
  assert.equal(shouldShowHomeConsent('denied', 2, false), false);
});

test('relative day uses origin calendar with a frozen clock', () => {
  const f = oz();
  const dep = Date.parse('2026-09-10T15:20:00+07:00');
  assert.equal(homeRelativeDayOffset(dep, NOW, 'HKT', 'TH'), 1);
  assert.equal(homeRelativeDayLabel(1, REL), 'Tomorrow');
  assert.equal(homeRelativeDayLabel(0, REL), 'Today');
  assert.equal(homeRelativeDayLabel(3, REL), 'In 3 days');
  assert.equal(homeRelativeDayOffset(dep, Date.parse('2026-09-10T08:00:00+07:00'), 'HKT', 'TH'), 0);
  void f;
});

test('next flight is on top; done flights go below', () => {
  const later = oz({ number: 'OZ750', scheduledTime: '2026-09-12T09:00:00+07:00', scheduledDeparture: '2026-09-12T09:00:00+07:00', departureTime: '2026-09-12T09:00:00+07:00' });
  const next = oz({ number: 'OZ748' });
  const done = oz({
    number: 'OZ100',
    status: 'landed',
    scheduledTime: '2026-09-01T10:00:00+07:00',
    scheduledDeparture: '2026-09-01T10:00:00+07:00',
    departureTime: '2026-09-01T10:00:00+07:00',
    landedAtMs: Date.parse('2026-09-01T18:00:00+09:00'),
    actualArrival: '2026-09-01T18:00:00+09:00',
  });
  const sorted = sortTrackedFlightsForHome([later, done, next], NOW);
  assert.deepEqual(sorted.map(x => x.number), ['OZ748', 'OZ750', 'OZ100']);
});

test('today search results keep departed below upcoming', () => {
  const upcoming = oz({ number: 'TW102', scheduledTime: '2026-09-09T18:00:00+07:00', scheduledDeparture: '2026-09-09T18:00:00+07:00', departureTime: '2026-09-09T18:00:00+07:00' });
  const departed = oz({
    number: 'TG910',
    status: 'departed',
    scheduledTime: '2026-09-09T08:00:00+07:00',
    scheduledDeparture: '2026-09-09T08:00:00+07:00',
    departureTime: '2026-09-09T08:00:00+07:00',
    actualDeparture: '2026-09-09T08:05:00+07:00',
  });
  const today = partitionHomeSearchResults([departed, upcoming], NOW);
  assert.deepEqual(today.upcoming.map(x => x.number), ['TW102']);
  assert.deepEqual(today.departed.map(x => x.number), ['TG910']);
  const tomorrow = partitionHomeSearchResults([departed, upcoming], NOW, { includeDeparted: false });
  assert.deepEqual(tomorrow.upcoming.map(x => x.number), ['TW102']);
  assert.deepEqual(tomorrow.departed.map(x => x.number), []);
  assert.equal(isDepartedSearchResult(departed, NOW), true);
  assert.equal(isDepartedSearchResult(upcoming, NOW), false);
});

test('cancelled search results sit with departed (grey bucket), not upcoming', () => {
  const live = oz({ number: 'VJ800', scheduledTime: '2026-09-09T18:00:00+07:00', scheduledDeparture: '2026-09-09T18:00:00+07:00', departureTime: '2026-09-09T18:00:00+07:00' });
  const cancelled = oz({
    number: 'VZ970',
    status: 'cancelled',
    scheduledTime: '2026-09-09T08:00:00+07:00',
    scheduledDeparture: '2026-09-09T08:00:00+07:00',
    departureTime: '2026-09-09T08:00:00+07:00',
  });
  const split = partitionHomeSearchResults([cancelled, live], NOW);
  assert.deepEqual(split.upcoming.map(x => x.number), ['VJ800']);
  assert.deepEqual(split.departed.map(x => x.number), ['VZ970']);
  assert.equal(homeSearchRowStatus(cancelled, NOW, true).kind, 'cancelled');
  const tomorrow = partitionHomeSearchResults([cancelled, live], NOW, { includeDeparted: false });
  assert.ok(tomorrow.departed.some(x => x.number === 'VZ970'));
});

test('mergeHubSearchFlights sorts mixed hubs by departure clock', () => {
  const nrtLater = oz({
    number: 'JL708',
    destination: 'NRT',
    scheduledTime: '2026-09-09T16:00:00+07:00',
    scheduledDeparture: '2026-09-09T16:00:00+07:00',
    departureTime: '2026-09-09T16:00:00+07:00',
  });
  const hndSoon = oz({
    number: 'NH808',
    destination: 'HND',
    scheduledTime: '2026-09-09T14:00:00+07:00',
    scheduledDeparture: '2026-09-09T14:00:00+07:00',
    departureTime: '2026-09-09T14:00:00+07:00',
  });
  const merged = mergeHubSearchFlights([nrtLater, hndSoon]);
  assert.deepEqual(merged.map(x => x.number), ['NH808', 'JL708']);
});

test('today split uses estimated over scheduled for a delayed flight', () => {
  const at1224 = Date.parse('2026-09-09T12:24:00+07:00');
  const delayed = oz({
    number: 'KL844',
    origin: 'BKK',
    originCountry: 'TH',
    destination: 'AMS',
    destCountry: 'NL',
    status: 'delayed',
    scheduledTime: '2026-09-09T12:05:00+07:00',
    scheduledDeparture: '2026-09-09T12:05:00+07:00',
    estimatedDeparture: '2026-09-09T13:10:00+07:00',
    departureTime: '2026-09-09T12:05:00+07:00',
  });
  const assumed = oz({
    number: 'BR75',
    origin: 'BKK',
    originCountry: 'TH',
    destination: 'AMS',
    destCountry: 'NL',
    status: 'scheduled',
    scheduledTime: '2026-09-09T12:15:00+07:00',
    scheduledDeparture: '2026-09-09T12:15:00+07:00',
    departureTime: '2026-09-09T12:15:00+07:00',
  });
  const morning = oz({
    number: 'TG936',
    origin: 'BKK',
    originCountry: 'TH',
    destination: 'AMS',
    destCountry: 'NL',
    status: 'en-route',
    scheduledTime: '2026-09-09T05:35:00+07:00',
    scheduledDeparture: '2026-09-09T05:35:00+07:00',
    actualDeparture: '2026-09-09T05:48:00+07:00',
  });
  assert.equal(searchDepartureClock(delayed)?.kind, 'estimated');
  assert.equal(isDepartedSearchResult(delayed, at1224), false);
  assert.equal(isDepartedSearchResult(assumed, at1224), true);
  assert.equal(isDepartedSearchResult(morning, at1224), true);
  const split = partitionHomeSearchResults([morning, delayed, assumed], at1224);
  assert.deepEqual(split.upcoming.map(x => x.number), ['KL844']);
  assert.deepEqual(split.departed.map(x => x.number), ['TG936', 'BR75']);
  const delayClocks = homeSearchDelayClocks(delayed);
  assert.ok(delayClocks);
  assert.equal(homeSearchRowStatus(delayed, at1224, false).kind, 'delayed');
  const assumedStatus = homeSearchRowStatus(assumed, at1224, true);
  assert.equal(assumedStatus.kind, 'departed');
  if (assumedStatus.kind === 'departed') assert.equal(assumedStatus.assumedScheduled, true);
  const morningStatus = homeSearchRowStatus(morning, at1224, true);
  assert.equal(morningStatus.kind, 'enRoute');
  const boarding = oz({
    ...delayed,
    number: 'KL844',
    status: 'boarding',
  });
  assert.equal(isDepartedSearchResult(boarding, at1224), false);
  assert.equal(homeSearchRowStatus(boarding, at1224, false).kind, 'boarding');
  assert.ok(homeSearchDelayClocks(boarding));
});

test('today FIDS evening flights stay upcoming even if stamped en-route', () => {
  const evening = oz({
    number: 'OZ741',
    origin: 'BKK',
    originCountry: '',
    destination: 'ICN',
    destCountry: 'KR',
    status: 'en-route',
    progress: 1,
    boardSide: 'departure',
    scheduledTime: '2026-09-09 23:00+07:00',
    scheduledDeparture: '2026-09-09 23:00+07:00',
    departureTime: '2026-09-09 23:00+07:00',
    revisedTime: '2026-09-09 23:00+07:00',
    actualTime: '2026-09-09 23:00+07:00',
  });
  const morningGone = oz({
    number: 'KE659',
    origin: 'BKK',
    originCountry: '',
    destination: 'ICN',
    destCountry: 'KR',
    status: 'scheduled',
    boardSide: 'departure',
    scheduledTime: '2026-09-09 08:10+07:00',
    scheduledDeparture: '2026-09-09 08:10+07:00',
    departureTime: '2026-09-09 08:10+07:00',
  });
  const split = partitionHomeSearchResults([morningGone, evening], NOW);
  assert.ok(split.upcoming.length > 0, 'evening ICN from BKK at noon must stay upcoming');
  assert.deepEqual(split.upcoming.map(x => x.number), ['OZ741']);
  assert.equal(isDepartedSearchResult(evening, NOW), false);
  assert.equal(isDepartedSearchResult(morningGone, NOW), true);
});

test('check-in window is 48h / 24h / T−3h from the airline', () => {
  assert.equal(checkinHoursBeforeDeparture(oz()), 24);
  assert.equal(checkinHoursBeforeDeparture(oz({ number: 'FR1234' })), 48);
  assert.equal(checkinHoursBeforeDeparture(oz({ number: '1234', airlineCode: '' })), 3);
});

test('flight-number hits: selected day and origin only', () => {
  const yesterday = oz({
    number: 'OZ748',
    scheduledTime: '2026-09-08T22:45:00+07:00',
    scheduledDeparture: '2026-09-08T22:45:00+07:00',
    departureTime: '2026-09-08T22:45:00+07:00',
  });
  const today = oz({
    number: 'OZ748',
    scheduledTime: '2026-09-09T22:45:00+07:00',
    scheduledDeparture: '2026-09-09T22:45:00+07:00',
    departureTime: '2026-09-09T22:45:00+07:00',
  });
  const tomorrow = oz({
    number: 'OZ748',
    scheduledTime: '2026-09-10T22:45:00+07:00',
    scheduledDeparture: '2026-09-10T22:45:00+07:00',
    departureTime: '2026-09-10T22:45:00+07:00',
  });
  const next = oz({
    number: 'OZ748',
    scheduledTime: '2026-09-11T22:45:00+07:00',
    scheduledDeparture: '2026-09-11T22:45:00+07:00',
    departureTime: '2026-09-11T22:45:00+07:00',
  });
  const departedMorning = oz({
    number: 'OZ748',
    status: 'departed',
    scheduledTime: '2026-09-09T08:00:00+07:00',
    scheduledDeparture: '2026-09-09T08:00:00+07:00',
    departureTime: '2026-09-09T08:00:00+07:00',
  });
  const hits = [yesterday, departedMorning, today, tomorrow, next];
  assert.deepEqual(
    pickFlightNumberHits(hits, NOW, { dayOffset: 0 }).map(x => x.scheduledTime),
    ['2026-09-09T08:00:00+07:00', '2026-09-09T22:45:00+07:00'],
  );
  assert.deepEqual(
    pickFlightNumberHits(hits, NOW, { dayOffset: 1 }).map(x => x.scheduledTime),
    ['2026-09-10T22:45:00+07:00'],
  );
  assert.deepEqual(
    pickFlightNumberHits(hits, NOW, { dayOffset: -1 }).map(x => x.scheduledTime),
    ['2026-09-08T22:45:00+07:00'],
  );
  const klBkk = oz({
    number: 'KL844',
    origin: 'BKK',
    originCountry: 'TH',
    destination: 'AMS',
    scheduledTime: '2026-09-10T12:05:00+07:00',
    scheduledDeparture: '2026-09-10T12:05:00+07:00',
    departureTime: '2026-09-10T12:05:00+07:00',
  });
  const klAms = oz({
    number: 'KL844',
    origin: 'AMS',
    originCountry: 'NL',
    destination: 'BKK',
    scheduledTime: '2026-09-10T12:05:00+02:00',
    scheduledDeparture: '2026-09-10T12:05:00+02:00',
    departureTime: '2026-09-10T12:05:00+02:00',
  });
  assert.deepEqual(
    pickFlightNumberHits([klAms, klBkk], NOW, { dayOffset: 1, originIata: 'BKK' }).map(x => x.origin),
    ['BKK'],
  );
  assert.equal(matchingFlightNumber([klBkk, oz()], 'kl844').length, 1);
  assert.equal(matchingAirlineFlights([klBkk, oz({ airlineCode: 'OZ' })], 'KL').length, 1);
});
