import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTripExtras } from './flightImport.ts';

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
