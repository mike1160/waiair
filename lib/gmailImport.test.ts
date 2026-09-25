import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bookingRefKeys,
  dedupeByBookingRef,
  extrasFieldCount,
  isEmptyOutcome,
  summarizeImport,
  extrasAnchorYmd,
  gmailItemFromExtras,
  resettleWaiting,
  tripFromFlight,
  parseImportedMessages,
  AUTO_IMPORT_THRESHOLD,
  planImports,
} from './gmailImport.ts';
import { matchScore, scoreBreakdown } from './matchScore.ts';

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

test('a parsed booking becomes a scoreable item: kind, day and the place its text names', () => {
  const [hotel] = parseImportedMessages([HOTEL_MAIL]);
  assert.equal(extrasAnchorYmd(hotel.extras), '2026-09-21');
  const item = gmailItemFromExtras('m-hotel', hotel.extras);
  assert.equal(item.kind, 'hotel');
  assert.equal(item.date, '2026-09-21');
  // TripExtras has no city field: Bangkok is read out of the address (lib/placeText.ts).
  assert.equal(item.city, 'Bangkok');
  assert.equal(item.country, 'TH');

  // A booking whose text names no place we know says so, rather than guessing.
  const vague = gmailItemFromExtras('m-x', { hotel: { name: 'Hotel Zonnebloem', checkIn: '2026-09-21' } });
  assert.equal(vague.city, undefined);
  assert.equal(vague.country, undefined);
});

test('a tracked flight becomes a trip, or nothing when it has no day to anchor on', () => {
  assert.deepEqual(
    tripFromFlight({
      key: 'TG922|match',
      arrivalYmd: '2026-09-21',
      endYmd: '2026-09-28',
      destinationIata: 'BKK',
      destinationCity: 'Bangkok',
      destinationCountry: 'TH',
    }),
    {
      key: 'TG922|match',
      startDate: '2026-09-21',
      endDate: '2026-09-28',
      destinationCity: 'Bangkok',
      destinationCountry: 'TH',
      destinationIata: 'BKK',
    },
  );
  // No arrival: the departure day stands in. No day at all: no trip.
  assert.equal(tripFromFlight({ key: 'dep', departureYmd: '2026-09-22' })?.startDate, '2026-09-22');
  assert.equal(tripFromFlight({ key: 'nothing' }), null);
});

test('the booking goes to the trip it fits, and a hotel in another city does not', () => {
  const [hotel] = parseImportedMessages([HOTEL_MAIL]);
  const item = gmailItemFromExtras('m-hotel', hotel.extras);
  const bangkok = tripFromFlight({
    key: 'TG922|match', arrivalYmd: '2026-09-21', endYmd: '2026-09-24',
    destinationIata: 'BKK', destinationCity: 'Bangkok', destinationCountry: 'TH',
  })!;
  const frankfurt = tripFromFlight({
    key: 'LH|other', arrivalYmd: '2026-09-21', endYmd: '2026-09-24',
    destinationIata: 'FRA', destinationCity: 'Frankfurt', destinationCountry: 'DE',
  })!;
  assert.deepEqual(scoreBreakdown(item, bangkok), { date: 40, location: 40, type: 20, total: 100 });
  // Same day, wrong country: the date alone is not enough to link it.
  assert.equal(matchScore(item, frankfurt), 40);
});

test('a flight tracked by number alone still attaches its booking', () => {
  // The trip knows no destination, so the place cannot speak either way — the day and the kind decide.
  const [hotel] = parseImportedMessages([HOTEL_MAIL]);
  const plan = planImports([hotel], [{ key: 'TG922|match', arrivalYmd: '2026-09-21' }]);
  assert.deepEqual(plan.attach.map(a => [a.flightKey, a.matchScore, a.linkedBy]), [['TG922|match', 80, 'auto']]);
  assert.deepEqual(plan.suggest, []);
});

test('a day either side links, a fortnight out is only offered [M/1]', () => {
  /*
   * The old matcher attached anything within three days of the arrival, sight unseen. Now the place has to
   * agree too — and since [M/1] an exact city is evidence in its own right, so a check-in the day before
   * landing links, while the same booking a fortnight away is offered and waits for an answer.
   */
  const [hotel] = parseImportedMessages([HOTEL_MAIL]);
  const near = planImports([hotel], [{
    key: 'in', arrivalYmd: '2026-09-22', endYmd: '2026-09-29',
    destinationIata: 'BKK', destinationCity: 'Bangkok', destinationCountry: 'TH',
  }]);
  assert.deepEqual(
    near.attach.map(a => [a.flightKey, a.matchScore, a.linkedBy]),
    [['in', 85, 'auto']],
    'a day out with the city right: 25 + 40 + 20',
  );
  assert.deepEqual(near.suggest, []);

  const far = planImports([hotel], [{
    key: 'out', arrivalYmd: '2026-10-05',
    destinationIata: 'BKK', destinationCity: 'Bangkok', destinationCountry: 'TH',
  }]);
  assert.deepEqual(far.attach, [], 'a fortnight apart is never attached on its own');
  assert.deepEqual(
    far.suggest.map(a => [a.flightKey, a.matchScore, a.linkedBy]),
    [['out', 60, 'suggestion']],
    'the city still counts, the date does not: offered at 60',
  );
});

test('a booking with no date is never placed, however well the city matches', () => {
  const plan = planImports(
    [{ id: 'm-nodate', flights: [], extras: { hotel: { name: 'Holiday Inn Bangkok' } }, empty: false }],
    [{
      key: 'TG922|match', arrivalYmd: '2026-09-21',
      destinationIata: 'BKK', destinationCity: 'Bangkok', destinationCountry: 'TH',
    }],
  );
  assert.deepEqual(plan.attach, []);
  assert.deepEqual(plan.suggest, []);
  assert.equal(plan.orphans.length, 1);
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

const BANGKOK_FLIGHT = {
  key: 'TG922|bkk',
  arrivalYmd: '2026-09-21',
  endYmd: '2026-09-28',
  destinationIata: 'BKK',
  destinationCity: 'Bangkok',
  destinationCountry: 'TH',
};

/** The hotel mail as it sits in the queue: parsed weeks ago, still waiting for its flight. */
function waitingHotel(savedMs = 1_700_000_000_000) {
  const [hotel] = parseImportedMessages([HOTEL_MAIL]);
  return { messageId: 'm-hotel', extras: hotel.extras, savedMs };
}

test('re-match: a flight is added and the booking that was waiting for it attaches itself', () => {
  const queue = [waitingHotel()];

  // Nothing tracked: it waits, as it has been.
  const idle = resettleWaiting(queue, []);
  assert.deepEqual(idle.attach, []);
  assert.equal(idle.waiting, 1);
  assert.equal(idle.queue[0]?.savedMs, 1_700_000_000_000, 'it keeps its place in the queue');

  // The traveller adds the Bangkok flight: check-in on the arrival day in the right city, so it links.
  const settled = resettleWaiting(queue, [BANGKOK_FLIGHT]);
  assert.deepEqual(
    settled.attach.map(a => [a.messageId, a.flightKey, a.matchScore, a.linkedBy]),
    [['m-hotel', 'TG922|bkk', 100, 'auto']],
  );
  assert.deepEqual(settled.queue, [], 'and it leaves the queue');
  assert.deepEqual(
    { auto: settled.autoLinked, suggested: settled.suggested, waiting: settled.waiting },
    { auto: 1, suggested: 0, waiting: 0 },
  );
});

test('re-match: landing a day off the check-in, same city, links [M/1]', () => {
  /*
   * Landing the day after the check-in, in the same city. This used to be offered rather than decided; since
   * [M/1] an exact city keeps the kind's points, so 25 + 40 + 20 reaches the link threshold. A day of slack
   * between a hotel and a flight is ordinary — an evening arrival, a night booked from the day before.
   */
  const settled = resettleWaiting([waitingHotel()], [{ ...BANGKOK_FLIGHT, key: 'day-after', arrivalYmd: '2026-09-22' }]);
  assert.deepEqual(
    settled.attach.map(a => [a.messageId, a.flightKey, a.matchScore, a.linkedBy]),
    [['m-hotel', 'day-after', 85, 'auto']],
  );
  assert.equal(settled.autoLinked, 1);
  assert.equal(settled.suggested, 0);
  assert.deepEqual(settled.queue, [], 'linked, so it leaves the queue');
});

test('re-match: a place that is only probable still needs the day to fall inside the trip', () => {
  // Same country, well away from Bangkok, and the check-in outside a one-day trip: nothing but a wait.
  const settled = resettleWaiting([waitingHotel()], [{
    key: 'phuket', arrivalYmd: '2026-09-25',
    destinationIata: 'HKT', destinationCity: 'Phuket', destinationCountry: 'TH',
  }]);
  assert.deepEqual(settled.attach, []);
  assert.equal(settled.waiting, 1);
  assert.equal(settled.queue[0]?.savedMs, 1_700_000_000_000, 'still queued with its original date');
});

test('re-match: a flight somewhere else entirely leaves the queue untouched', () => {
  const settled = resettleWaiting([waitingHotel()], [{
    key: 'FRA|other', arrivalYmd: '2026-09-21', endYmd: '2026-09-28',
    destinationIata: 'FRA', destinationCity: 'Frankfurt', destinationCountry: 'DE',
  }]);
  assert.deepEqual(settled.attach, []);
  assert.equal(settled.suggested, 0);
  assert.equal(settled.waiting, 1);
  assert.equal(settled.queue[0]?.suggestedFlightKey, undefined);
});

test('re-match: yesterday\'s suggestion is re-read, and a better flight makes it a link', () => {
  // It was offered against the day-after flight; now the real one is tracked.
  const suggested = [{ ...waitingHotel(), suggestedFlightKey: 'day-after', matchScore: 65 }];
  const settled = resettleWaiting(suggested, [BANGKOK_FLIGHT]);
  assert.deepEqual(settled.attach.map(a => [a.flightKey, a.matchScore]), [['TG922|bkk', 100]]);
  assert.deepEqual(settled.queue, []);

  // And the other way round: the flight it was suggested against is gone, so it drops back to waiting.
  const withoutFlight = resettleWaiting(suggested, []);
  assert.equal(withoutFlight.suggested, 0);
  assert.equal(withoutFlight.waiting, 1);
  assert.equal(withoutFlight.queue[0]?.suggestedFlightKey, undefined, 'a stale suggestion is not kept');
});

test('re-match: one booking in several mails is settled once', () => {
  const [hotel] = parseImportedMessages([HOTEL_MAIL]);
  const reminder = parseImportedMessages([{ ...HOTEL_MAIL, id: 'm-reminder' }])[0];
  const settled = resettleWaiting(
    [
      { messageId: 'm-hotel', extras: hotel.extras, savedMs: 1_700_000_000_000 },
      { messageId: 'm-reminder', extras: reminder.extras, savedMs: 1_700_000_100_000 },
    ],
    [BANGKOK_FLIGHT],
  );
  assert.equal(settled.attach.length, 1, 'the same booking reference attaches once');
  assert.deepEqual(settled.queue, []);
});

test('re-match: rubbish in the queue is ignored rather than crashing the run', () => {
  const settled = resettleWaiting(
    [
      { messageId: '', extras: {} },
      { messageId: 'no-extras' } as unknown as { messageId: string; extras: Record<string, never> },
      waitingHotel(),
    ],
    [BANGKOK_FLIGHT],
  );
  assert.equal(settled.attach.length, 1);
  assert.deepEqual(resettleWaiting([], [BANGKOK_FLIGHT]), {
    attach: [], queue: [], autoLinked: 0, suggested: 0, waiting: 0,
  });
});
