import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MATCH_WINDOW_DAYS,
  bookingRefKeys,
  dedupeByBookingRef,
  extrasFieldCount,
  isEmptyOutcome,
  summarizeImport,
  extrasAnchorYmd,
  matchExtrasFlightKey,
  parseImportedMessages,
  AUTO_IMPORT_THRESHOLD,
  planImports,
} from './gmailImport.ts';

const HOTEL_MAIL = {
  id: 'm-hotel',
  subject: 'Your booking is confirmed',
  text: [
    'Hotel: Holiday Inn Bangkok',
    'Address: 123 Sukhumvit Road, Bangkok, 10110',
    'Check-in: 2026-09-21',
    'Check-out: 2026-09-24',
    'Booking reference: ABC12345',
  ].join('\n'),
};

const FLIGHT_MAIL = {
  id: 'm-flight',
  subject: 'Your e-ticket TG 922 on 21 Sep 2026',
  text: 'Bangkok (BKK) to Frankfurt (FRA)',
};

test('a flight mail becomes an import candidate — the subject is parsed too', () => {
  const [parsed] = parseImportedMessages([FLIGHT_MAIL]);
  assert.equal(parsed.empty, false);
  assert.equal(parsed.flights.length, 1);
  assert.equal(parsed.flights[0].flightNumber, 'TG922');
  assert.equal(parsed.flights[0].dateIso, '2026-09-21');
});

test('a hotel mail becomes trip extras', () => {
  const [parsed] = parseImportedMessages([HOTEL_MAIL]);
  assert.equal(parsed.empty, false);
  assert.equal(parsed.extras.hotel?.name, 'Holiday Inn Bangkok');
  assert.equal(parsed.extras.hotel?.checkIn, '2026-09-21');
  assert.equal(parsed.extras.hotel?.checkOut, '2026-09-24');
  assert.equal(parsed.extras.hotel?.confirmationRef, 'ABC12345');
});

test('a mail with nothing in it is marked empty, so it is not counted as imported', () => {
  const [parsed] = parseImportedMessages([{ id: 'x', subject: 'Newsletter', text: 'Deals for you this week' }]);
  assert.equal(parsed.empty, true);
  assert.deepEqual(parsed.flights, []);
  assert.deepEqual(parsed.extras, {});
});

test('flights in the past are left out', () => {
  const [parsed] = parseImportedMessages([FLIGHT_MAIL], { todayIso: '2026-10-01' });
  assert.deepEqual(parsed.flights, []);
  assert.equal(parsed.empty, true);
});

test('a booking goes to the flight that lands closest to its first day', () => {
  const [hotel] = parseImportedMessages([HOTEL_MAIL]);
  assert.equal(extrasAnchorYmd(hotel.extras), '2026-09-21');
  const flights = [
    { key: 'TG920|earlier', arrivalYmd: '2026-09-18' },
    { key: 'TG922|match', arrivalYmd: '2026-09-21' },
    { key: 'TG921|later', arrivalYmd: '2026-10-05' },
  ];
  assert.equal(matchExtrasFlightKey(hotel.extras, flights), 'TG922|match');
});

test('no flight near the booking: it is not attached to the wrong trip', () => {
  const [hotel] = parseImportedMessages([HOTEL_MAIL]);
  const faraway = [{ key: 'TG921|later', arrivalYmd: '2026-10-05' }];
  assert.equal(matchExtrasFlightKey(hotel.extras, faraway), null);
  // Just inside and just outside the window.
  assert.equal(matchExtrasFlightKey(hotel.extras, [{ key: 'in', arrivalYmd: '2026-09-24' }]), 'in');
  assert.equal(matchExtrasFlightKey(hotel.extras, [{ key: 'out', arrivalYmd: '2026-09-25' }]), null);
  assert.equal(MATCH_WINDOW_DAYS, 3);
  // A booking with no date at all cannot be placed.
  assert.equal(matchExtrasFlightKey({ hotel: { name: 'Somewhere' } }, [{ key: 'a', arrivalYmd: '2026-09-21' }]), null);
});

test('the departure day is used when a flight has no arrival time', () => {
  const [hotel] = parseImportedMessages([HOTEL_MAIL]);
  assert.equal(matchExtrasFlightKey(hotel.extras, [{ key: 'dep', departureYmd: '2026-09-22' }]), 'dep');
});

test('the plan says what to add, what to attach, what waits and what stays unimported', () => {
  const parsed = parseImportedMessages([FLIGHT_MAIL, HOTEL_MAIL, { id: 'junk', text: 'nothing here' }]);
  const plan = planImports(parsed, [{ key: 'TG922|match', arrivalYmd: '2026-09-21' }]);

  assert.deepEqual(plan.flights.map(f => f.flightNumber), ['TG922']);
  assert.deepEqual(plan.attach.map(a => [a.messageId, a.flightKey]), [['m-hotel', 'TG922|match']]);
  assert.deepEqual(plan.orphans, []);
  // Both real mails count as imported; the junk one stays pending for a later scan.
  assert.deepEqual(plan.importedIds.sort(), ['m-flight', 'm-hotel']);
  assert.deepEqual(plan.unparsedIds, ['junk']);
});

test('a booking with no trip yet waits instead of being dropped', () => {
  const plan = planImports(parseImportedMessages([HOTEL_MAIL]), []);
  assert.deepEqual(plan.attach, []);
  assert.equal(plan.orphans.length, 1);
  assert.equal(plan.orphans[0].messageId, 'm-hotel');
  // It still counts as imported: the booking is kept, so the mail need not be offered again.
  assert.deepEqual(plan.importedIds, ['m-hotel']);
});

test('the import is summarised honestly: added, waiting and failed are counted apart', () => {
  // A flight 30 days out: scoreCandidate() gives future flights +15, so a fixed date falls below the
  // auto-import threshold once it has passed and the flight would stop counting as added.
  const ahead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const month = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[ahead.getUTCMonth()];
  const upcoming = {
    ...FLIGHT_MAIL,
    subject: `Your e-ticket TG 922 on ${ahead.getUTCDate()} ${month} ${ahead.getUTCFullYear()}`,
  };
  const parsed = parseImportedMessages([upcoming, HOTEL_MAIL, { id: 'junk', text: 'nothing here' }]);
  const plan = planImports(parsed, [{ key: 'TG922|match', arrivalYmd: '2026-09-21' }]);
  assert.deepEqual(summarizeImport(plan), {
    flightsAdded: 1, bookingsAttached: 1, bookingsUpdated: 0, bookingsWaiting: 0, failed: 1,
  });

  // A booking with no trip counts as waiting, not as added.
  const waiting = planImports(parseImportedMessages([HOTEL_MAIL]), []);
  assert.deepEqual(summarizeImport(waiting), {
    flightsAdded: 0, bookingsAttached: 0, bookingsUpdated: 0, bookingsWaiting: 1, failed: 0,
  });

  // Mails that could not be fetched at all are failures too.
  assert.equal(summarizeImport(waiting, { unreadable: 2 }).failed, 2);
});

test('an import that produced nothing says so', () => {
  const nothing = planImports(parseImportedMessages([{ id: 'junk', text: 'newsletter' }]), []);
  const outcome = summarizeImport(nothing);
  assert.equal(isEmptyOutcome(outcome), false, 'a mail that failed is still something to report');
  assert.equal(outcome.failed, 1);
  assert.equal(isEmptyOutcome({ flightsAdded: 0, bookingsAttached: 0, bookingsUpdated: 0, bookingsWaiting: 0, failed: 0 }), true);
});

const HOTEL_REMINDER = {
  id: 'm-hotel-reminder',
  subject: 'Your stay is coming up',
  text: [
    'Hotel: Holiday Inn Bangkok',
    'Check-in: 2026-09-21',
    'Booking reference: abc-12345',
  ].join('\n'),
};

test('a booking reference identifies a booking however it is written', () => {
  assert.deepEqual(bookingRefKeys({ hotel: { confirmationRef: 'abc-123 45' } }), ['hotel:ABC12345']);
  // A hotel and a car with the same number stay two bookings.
  assert.deepEqual(
    bookingRefKeys({ hotel: { confirmationRef: 'ABC12345' }, carRental: { confirmationRef: 'ABC12345' } }),
    ['hotel:ABC12345', 'car:ABC12345'],
  );
  // Too short to be a reference: matching on it would merge unrelated bookings.
  assert.deepEqual(bookingRefKeys({ hotel: { confirmationRef: 'OK' } }), []);
  assert.deepEqual(bookingRefKeys(undefined), []);
});

test('the confirmation, the reminder and the change mail become one booking — the fullest one', () => {
  const [confirmation, reminder] = parseImportedMessages([HOTEL_MAIL, HOTEL_REMINDER]);
  const { kept, droppedIds } = dedupeByBookingRef([
    { messageId: reminder.id, extras: reminder.extras },
    { messageId: confirmation.id, extras: confirmation.extras },
  ]);
  assert.equal(kept.length, 1);
  // The confirmation has the address and the check-out date, so it wins even though it came second.
  assert.equal(kept[0].messageId, 'm-hotel');
  assert.deepEqual(droppedIds, ['m-hotel-reminder']);
  assert.ok(extrasFieldCount(confirmation.extras) > extrasFieldCount(reminder.extras));
});

test('bookings without a usable reference are all kept: there is no safe way to tell them apart', () => {
  const a = { messageId: 'a', extras: { hotel: { name: 'Hotel One', checkIn: '2026-09-21' } } };
  const b = { messageId: 'b', extras: { hotel: { name: 'Hotel Two', checkIn: '2026-10-02' } } };
  const { kept, droppedIds } = dedupeByBookingRef([a, b]);
  assert.deepEqual(kept.map(k => k.messageId), ['a', 'b']);
  assert.deepEqual(droppedIds, []);
});

test('two mails about one booking attach once, and count once', () => {
  const parsed = parseImportedMessages([HOTEL_MAIL, HOTEL_REMINDER]);
  const plan = planImports(parsed, [{ key: 'TG922|match', arrivalYmd: '2026-09-21' }]);
  assert.deepEqual(plan.attach.map(a => a.messageId), ['m-hotel']);
  // Both mails are done with: the duplicate must not be offered again on the next scan.
  assert.deepEqual(plan.importedIds.sort(), ['m-hotel', 'm-hotel-reminder']);
  assert.equal(summarizeImport(plan).bookingsAttached, 1);
});

test('a booking the trip already has is an update, not a second booking', () => {
  const parsed = parseImportedMessages([HOTEL_REMINDER]);
  const trip = { key: 'TG922|match', arrivalYmd: '2026-01-01', refs: ['hotel:ABC12345'] };
  const plan = planImports(parsed, [trip]);
  // The reference wins over the dates: the changed booking goes back to its own trip.
  assert.deepEqual(plan.attach.map(a => [a.flightKey, a.update]), [['TG922|match', true]]);
  const outcome = summarizeImport(plan);
  assert.equal(outcome.bookingsAttached, 0);
  assert.equal(outcome.bookingsUpdated, 1);
  assert.equal(isEmptyOutcome(outcome), false);
});

// ── auto-import split ────────────────────────────────────────────────────────
// A flight the parser is sure about is tracked without asking; a shaky one waits for the user.

function candidate(flightNumber: string, confidence: number, dateIso = '2026-10-05') {
  return { id: `${flightNumber}|${dateIso}`, flightNumber, dateIso, label: flightNumber, confidence };
}

function parsedWith(id: string, flights: ReturnType<typeof candidate>[]) {
  return { id, flights, extras: {}, empty: false };
}

test('a confident flight goes straight to auto-import', () => {
  const plan = planImports([parsedWith('m1', [candidate('KL1234', 100)])], []);
  assert.deepEqual(plan.flightsAutoImport.map(c => c.flightNumber), ['KL1234']);
  assert.deepEqual(plan.flightsPendingReview, []);
  assert.deepEqual(plan.flights.map(c => c.flightNumber), ['KL1234'], 'flights still holds everything');
});

test('a shaky flight waits for review instead', () => {
  const plan = planImports([parsedWith('m1', [candidate('TG208', 45)])], []);
  assert.deepEqual(plan.flightsAutoImport, []);
  assert.deepEqual(plan.flightsPendingReview.map(c => c.flightNumber), ['TG208']);
  assert.equal(plan.importedIds.length, 1, 'the mail still counts as read');
});

test('a mixed batch is split, and flights lists the trusted ones first', () => {
  const plan = planImports([
    parsedWith('m1', [candidate('TG208', 45), candidate('KL1234', 90)]),
    parsedWith('m2', [candidate('BR75', AUTO_IMPORT_THRESHOLD), candidate('EK373', 84)]),
  ], []);
  assert.deepEqual(plan.flightsAutoImport.map(c => c.flightNumber), ['KL1234', 'BR75'], 'exactly 85 counts as trusted');
  assert.deepEqual(plan.flightsPendingReview.map(c => c.flightNumber), ['TG208', 'EK373']);
  assert.deepEqual(plan.flights.map(c => c.flightNumber), ['KL1234', 'BR75', 'TG208', 'EK373']);
  assert.equal(plan.flights.length, plan.flightsAutoImport.length + plan.flightsPendingReview.length);
});
