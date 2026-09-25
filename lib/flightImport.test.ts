import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  commonEraYear,
  extractFlightNumbers,
  parseImportText,
  parseJsonLdFlight,
  parseTripExtras,
  scoreCandidate,
} from './flightImport.ts';
import { parseImportedMessages } from './gmailImport.ts';

/** A Trip.com NL hotel confirmation, in the shape those mails have (labels in Dutch, dates as 21-10-2026). */
const TRIPCOM_NL = `Bevestigd: Holiday Inn Bangkok Silom, 21 okt - 24 okt
Beste Mike,
Je boeking bij Holiday Inn Bangkok Silom is bevestigd.
Bevestigingsnummer hotel: HTL7781234
Boekingsnummer Trip.com: 9876543210
Inchecken: 21-10-2026 (vanaf 14:00)
Uitchecken: 24-10-2026 (tot 12:00)
Adres: 981 Silom Road, Bangrak, Bangkok, 10500, Thailand
Vragen? Ga naar trip.com`;

test('Trip.com NL hotel confirmation: name, dates, address and the hotel’s own number', () => {
  const { hotel } = parseTripExtras(TRIPCOM_NL);
  assert.equal(hotel?.name, 'Holiday Inn Bangkok Silom');
  assert.equal(hotel?.checkIn, '2026-10-21');
  assert.equal(hotel?.checkOut, '2026-10-24');
  assert.equal(hotel?.address, '981 Silom Road, Bangrak, Bangkok, 10500, Thailand');
  // The hotel's confirmation, not Trip.com's own booking number.
  assert.equal(hotel?.confirmationRef, 'HTL7781234');
});

test('a booking number on a "… hotel:" line is not mistaken for the hotel name', () => {
  // Only a label that starts the line names the hotel.
  const { hotel } = parseTripExtras('Bevestigingsnummer hotel: HTL7781234\nJe boeking bij Ibis Styles Bangkok is bevestigd.');
  assert.equal(hotel?.name, 'Ibis Styles Bangkok');
  assert.equal(hotel?.confirmationRef, 'HTL7781234');
});

test('Dutch month names and dashed dates are understood', () => {
  const dates = (line: string) => parseTripExtras(`Hotel: Holiday Inn Bangkok\n${line}`).hotel?.checkIn;
  assert.equal(dates('Check-in: 21-10-2026'), '2026-10-21');
  assert.equal(dates('Check-in: 21 okt 2026'), '2026-10-21');
  assert.equal(dates('Check-in: 21 mrt 2026'), '2026-03-21');
  assert.equal(dates('Check-in: 3 mei 2026'), '2026-05-03');
  // The formats that already worked keep working.
  assert.equal(dates('Check-in: 2026-09-21'), '2026-09-21');
  assert.equal(dates('Check-in: 21/10/2026'), '2026-10-21');
  assert.equal(dates('Check-in: Sep 21, 2026'), '2026-09-21');
});

test('the English wording still parses, and Trip.com is recognised as the brand', () => {
  const en = parseTripExtras([
    'Your booking is confirmed at The Siam Hotel',
    'Check-in: 2026-10-21',
    'Check-out: 2026-10-24',
    'Booking reference: ABC12345',
    'Booked on trip.com',
  ].join('\n'));
  assert.equal(en.hotel?.name, 'The Siam Hotel');
  assert.equal(en.hotel?.confirmationRef, 'ABC12345');

  // With no name in the text the brand stands in for it.
  const brandOnly = parseTripExtras('Your trip.com reservation\nCheck-in: 2026-10-21\nConfirmation: ABC12345');
  assert.equal(brandOnly.hotel?.name, 'Trip.com');
});

test('a mail with nothing hotel-like in it stays empty', () => {
  assert.deepEqual(parseTripExtras('Onze nieuwsbrief met de beste deals van deze week'), {});
});

test('Expedia, Airbnb and Priceline each have their own word for the booking number', () => {
  const expedia = parseTripExtras([
    'Your hotel booking is confirmed at Novotel Bangkok Ploenchit',
    'Itinerary number: 72618334455',
    'Check-in: 12 Nov 2026',
    'Check-out: 15 Nov 2026',
    'Questions? expedia.com',
  ].join('\n'));
  assert.equal(expedia.hotel?.confirmationRef, '72618334455');
  assert.equal(expedia.hotel?.checkIn, '2026-11-12');

  const airbnb = parseTripExtras([
    'Your reservation at Riverside Loft',
    'Reservation code: HMABCD1234',
    'Check-in: 3 Dec 2026',
    'Checkout: 8 Dec 2026',
    'airbnb.com',
  ].join('\n'));
  assert.equal(airbnb.hotel?.confirmationRef, 'HMABCD1234');
  assert.equal(airbnb.hotel?.checkOut, '2026-12-08');

  const priceline = parseTripExtras([
    'Hotel: Sukhumvit Suites',
    'Trip number: 8899001122',
    'Check-in: 1 Feb 2027',
    'priceline.com',
  ].join('\n'));
  assert.equal(priceline.hotel?.confirmationRef, '8899001122');
  assert.equal(priceline.hotel?.name, 'Sukhumvit Suites');
});

test('an airline or OTA flight mail does not become a hotel just because the brand is in the footer', () => {
  const flightMail = parseTripExtras([
    'Your flight to Bangkok is booked',
    'TG 922 on 21 Oct 2026, Frankfurt (FRA) to Bangkok (BKK)',
    'Online check-in opens 24 hours before departure',
    'Manage your trip at expedia.com',
  ].join('\n'));
  assert.equal(flightMail.hotel, undefined, 'no hotel named "Expedia"');

  // With a stay in it, the brand does become the hotel it stands for.
  const stay = parseTripExtras('Booking confirmed at Vrbo\nCheck-in: 4 Jan 2027\nvrbo.com');
  assert.equal(stay.hotel?.checkIn, '2027-01-04');
});

test('car rental confirmations from Enterprise, Turo and Goldcar', () => {
  const enterprise = parseTripExtras([
    'Your Enterprise rental is confirmed',
    'Confirmation number: 1234567890',
    'Pick-up location: Bangkok Suvarnabhumi Airport',
    'Pick-up date and time: 12 Nov 2026 10:00',
    'Return date and time: 15 Nov 2026 10:00',
  ].join('\n'));
  assert.equal(enterprise.carRental?.company, 'Enterprise');
  assert.equal(enterprise.carRental?.confirmationRef, '1234567890');
  assert.equal(enterprise.carRental?.pickupTime, '2026-11-12T10:00:00');
  assert.equal(enterprise.carRental?.dropoffTime, '2026-11-15T10:00:00');

  const turo = parseTripExtras([
    'Your Turo trip is booked',
    'Trip ID: TR889900',
    'Trip starts: 3 Dec 2026 09:30',
    'Trip ends: 6 Dec 2026 09:30',
  ].join('\n'));
  assert.equal(turo.carRental?.company, 'Turo');
  assert.equal(turo.carRental?.confirmationRef, 'TR889900');
  assert.equal(turo.carRental?.pickupTime, '2026-12-03T09:30:00');

  // A named company beats any brand found in the body.
  const goldcar = parseTripExtras([
    'Rental company: Goldcar',
    'Collection point: Malaga Airport',
    'Booking reference: GC556677',
  ].join('\n'));
  assert.equal(goldcar.carRental?.company, 'Goldcar');
  assert.equal(goldcar.carRental?.pickupLocation, 'Malaga Airport');
});

test('a car brand in passing does not become a rental booking', () => {
  // "budget airline" used to be enough to invent a Budget car rental.
  const flightMail = parseTripExtras([
    'Your flight is confirmed',
    'This budget airline charges for cabin bags.',
    'Booking reference: AB12CD',
  ].join('\n'));
  assert.equal(flightMail.carRental, undefined);
  // The same brand with a pick-up in the mail is a real rental.
  const real = parseTripExtras('Budget\nPick-up date: 4 Jan 2027 08:00\nBooking reference: BG9988');
  assert.equal(real.carRental?.company, 'Budget');
  assert.equal(real.carRental?.pickupTime, '2027-01-04T08:00:00');
});

// ── confidence ───────────────────────────────────────────────────────────────
// How sure we are a candidate is a real flight: 85+ is tracked without asking, below that it is reviewed.

const NOW = Date.UTC(2026, 8, 21); // 2026-09-21
const FUTURE = '2026-09-27';
const PAST = '2026-09-01';

test('a KLM confirmation with everything scores high enough to import on its own', () => {
  const [c] = parseImportText(`KL1234 AMS - BKK ${FUTURE}`, undefined, {
    from: '"KLM" <info@klm.com>', source: 'gmail', now: NOW,
  });
  // 50 base +30 airline sender +20 flight shape +15 future +10 route +10 gmail = 100 (capped).
  assert.ok(c.confidence >= 85, `expected >= 85, got ${c.confidence}`);
  assert.equal(c.confidence, 100);
});

test('an unknown sender with no date scores too low to trust', () => {
  const [c] = parseImportText('Meeting about TG208 next week', undefined, {
    from: '"Bob" <bob@randomcorp.example>', now: NOW,
  });
  // 50 base +20 flight shape -15 no date -10 unknown sender = 45.
  assert.ok(c.confidence < 60, `expected < 60, got ${c.confidence}`);
  assert.equal(c.confidence, 45);
});

test('JSON-LD is authoritative, so it clears the bar by itself', () => {
  const ld = parseJsonLdFlight([{
    '@type': 'FlightReservation',
    reservationFor: {
      '@type': 'Flight',
      flightNumber: 'TG 502',
      departureTime: `${FUTURE}T10:30:00+07:00`,
      departureAirport: { iataCode: 'BKK' },
      arrivalAirport: { iataCode: 'AMS' },
    },
  }], { now: NOW });
  assert.ok(ld);
  assert.ok(ld.confidence >= 85, `expected >= 85, got ${ld.confidence}`);
  assert.equal(ld.confidence, 100); // 75 + 15 future + 10 route
  // Without a date or a route it stays at the JSON-LD floor rather than collapsing.
  const bare = parseJsonLdFlight([{
    '@type': 'FlightReservation',
    reservationFor: { '@type': 'Flight', flightNumber: 'TG502' },
  }], { now: NOW });
  assert.equal(bare?.confidence, 75);
});

test('the score stays inside 0–100 whatever the inputs', () => {
  // Everything positive at once cannot push it past 100.
  const [best] = parseImportText(`KL1234 AMS - BKK ${FUTURE}`, undefined, {
    from: '<info@klm.com>', source: 'gmail', jsonLd: true, now: NOW,
  });
  assert.equal(best.confidence, 100);

  // Everything negative at once cannot push it below 0.
  const low = scoreCandidate({ flightNumber: '', dateIso: undefined }, {
    from: '<nobody@nowhere.example>', subjectOnly: true, now: NOW,
  });
  assert.ok(low >= 0 && low <= 100, `out of range: ${low}`);
  assert.equal(low, 5);

  for (const c of parseImportText(`TG208 ${PAST}\nKL1234 AMS - BKK ${FUTURE}`, undefined, { now: NOW })) {
    assert.ok(c.confidence >= 0 && c.confidence <= 100, `${c.flightNumber}: ${c.confidence}`);
  }
});

test('a past date gets no future bonus, and a subject-only number is docked', () => {
  // No sender here: with an airline's own domain both would already be capped at 100 and the gap invisible.
  const [past] = parseImportText(`TG208 ${PAST}`, undefined, { now: NOW });
  const [future] = parseImportText(`TG208 ${FUTURE}`, undefined, { now: NOW });
  assert.equal(past.confidence, 70, 'base 50 + 20 flight shape, no date bonus');
  assert.equal(future.confidence, 85);
  assert.equal(future.confidence - past.confidence, 15, 'the future date is worth 15');

  const subject = 'Your TG208 is confirmed';
  const [only] = parseImportText(`${subject}\nNothing more to see`, undefined, {
    from: '<info@klm.com>', subjectChars: subject.length, now: NOW,
  });
  const [both] = parseImportText(`${subject}\nFlight TG208 departs at 10:30`, undefined, {
    from: '<info@klm.com>', subjectChars: subject.length, now: NOW,
  });
  assert.equal(both.confidence - only.confidence, 20, 'a number the body repeats is worth 20 more');
});

/* ── [M/2] Short flight numbers, sender context, Thai dates ──────────────────────────────────────── */

test('M/2 · a flight number may be one or two digits', () => {
  // The bug: TG92, BR75 and KL75 are real flights that the parser could not see at all, so a Thai Airways
  // or EVA confirmation produced nothing and the mail was written off as unreadable.
  assert.deepEqual(extractFlightNumbers('Flight TG92 Bangkok - London'), ['TG92']);
  assert.deepEqual(extractFlightNumbers('Your flight BR75 departs at 12:15'), ['BR75']);
  assert.deepEqual(extractFlightNumbers('KL75 Amsterdam'), ['KL75']);
  assert.deepEqual(extractFlightNumbers('TG2 is the shortest of them all'), ['TG2']);
  // And the long ones still work.
  assert.deepEqual(extractFlightNumbers('TG208 and EK3891'), ['TG208', 'EK3891']);
});

test('M/2 · what looks like a flight number but never is', () => {
  // A made-up flight is worse than a missed one: these all match the shape and none of them is a flight.
  assert.deepEqual(extractFlightNumbers('Estimated 320 kg CO2 for this trip'), []);
  assert.deepEqual(extractFlightNumbers('Your rights under EU261 may apply'), []);
  assert.deepEqual(extractFlightNumbers('Aircraft: MD11'), []);
  // Times written without a space, which is what the AM/PM guard is for.
  assert.deepEqual(extractFlightNumbers('Boarding at PM30'), []);
  assert.deepEqual(extractFlightNumbers('Departure AM10'), []);
  assert.deepEqual(extractFlightNumbers('Booked in AM2026'), []);
  // Gates and terminals: a single letter, or no letters at all.
  assert.deepEqual(extractFlightNumbers('Gate B4, Terminal 2'), []);
  assert.deepEqual(extractFlightNumbers('Gate 12, seat 14A'), []);
  assert.deepEqual(extractFlightNumbers('Aircraft A320 / B737'), []);
  // Mid-word matches are impossible: the letters have to start a word.
  assert.deepEqual(extractFlightNumbers('TERMINAL2 and CONCOURSE3'), []);
});

test('M/2 · the sender decides how far a flight number is trusted', () => {
  const body = 'Flight TG208\nBangkok (BKK) - Phuket (HKT)\nSun 27 Sep 2026';
  const now = Date.UTC(2026, 8, 1);

  const airline = parseImportedMessages(
    [{ id: 'm1', subject: 'Thai Airways | Booking Confirmed', from: 'Thai Airways <no-reply@thaiairways.com>', text: body }],
    { todayIso: '2026-09-01' },
  );
  assert.equal(airline[0].flights[0]?.flightNumber, 'TG208');
  assert.equal(airline[0].flights[0]?.confidence, 100, 'the airline wrote it: nothing is more certain');

  const stranger = parseImportedMessages(
    [{ id: 'm2', subject: 'Booking Confirmed', from: 'someone@unknown.example', text: body }],
    { todayIso: '2026-09-01' },
  );
  assert.equal(stranger[0].flights[0]?.confidence, 85, 'an unknown sender scores what it used to');

  // No sender at all — a paste, or a mail whose header could not be read — is unchanged too.
  const none = parseImportedMessages([{ id: 'm3', text: body }], { todayIso: '2026-09-01' });
  assert.equal(none[0].flights[0]?.confidence, 95);

  // And the score still reflects the sender directly.
  assert.equal(
    scoreCandidate({ flightNumber: 'TG208', dateIso: '2026-09-27', origin: 'BKK', destination: 'HKT' },
      { from: 'no-reply@thaiairways.com', source: 'gmail', now }),
    100,
  );
});

test('M/2 · Thai dates: Buddhist years and Thai month names', () => {
  const iso = (text: string) => parseImportText(`Flight TG208\n${text}`)[0]?.dateIso;
  // A Thai month abbreviation, with the year in the Buddhist Era and in the Common Era.
  assert.equal(iso('27 ก.ย. 2569'), '2026-09-27');
  assert.equal(iso('27 ก.ย. 2026'), '2026-09-27');
  // An ISO date written with a Buddhist year.
  assert.equal(iso('2569-09-27'), '2026-09-27');
  // A Latin month with a Buddhist year, which Thai senders also do.
  assert.equal(iso('27 Sep 2569'), '2026-09-27');
  // Every month name the Thai carriers use.
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  months.forEach((month, i) => {
    assert.equal(iso(`15 ${month} 2569`), `2026-${String(i + 1).padStart(2, '0')}-15`, month);
  });
  // A Common Era year is left exactly as it is.
  assert.equal(commonEraYear(2026), 2026);
  assert.equal(commonEraYear(2569), 2026);
  assert.equal(commonEraYear(1999), 1999);
});
