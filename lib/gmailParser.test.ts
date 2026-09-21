/**
 * Phase A: the excursion and restaurant fields, from the mail text through to the data model.
 * Same style as the other lib tests: node:test, no jest.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTripExtras } from './flightImport.ts';
import { classifyKind, matchesTravel } from './gmailInboxScan.ts';
import { cleanTripExtras } from './tripExtrasModel.ts';

test('GetYourGuide: the activity, when it starts and where you are collected', () => {
  const e = parseTripExtras([
    'Your booking is confirmed',
    'GetYourGuide',
    'Activity: Grand Palace and Wat Pho guided tour',
    'Date and time: 14 Mar 2027 09:00',
    'Meeting point: hotel lobby, Riva Surya Bangkok',
    'Booking reference: GYG7781234',
  ].join('\n'));
  assert.equal(e.excursion?.name, 'Grand Palace and Wat Pho guided tour');
  assert.equal(e.excursion?.dateTime, '2027-03-14T09:00:00');
  assert.equal(e.excursion?.pickupLocation, 'hotel lobby, Riva Surya Bangkok');
  assert.equal(e.excursion?.confirmationRef, 'GYG7781234');
  assert.equal(e.excursion?.operator, 'GetYourGuide');
  assert.equal(e.excursion?.source, 'parsed');
  // The shared "booking is confirmed" wording must not also invent a hotel.
  assert.equal(e.hotel, undefined);
});

test('Viator: name, date and reference, without a pickup point', () => {
  const e = parseTripExtras([
    'Viator — your tour is confirmed',
    'Tour: Chiang Mai Elephant Sanctuary Day Trip',
    'Date: 2 Apr 2027 07:30',
    'Confirmation number: VIA556677',
  ].join('\n'));
  assert.equal(e.excursion?.name, 'Chiang Mai Elephant Sanctuary Day Trip');
  assert.equal(e.excursion?.dateTime, '2027-04-02T07:30:00');
  assert.equal(e.excursion?.confirmationRef, 'VIA556677');
  assert.equal(e.excursion?.operator, 'Viator');
  assert.equal(e.excursion?.pickupLocation, undefined);
});

test('Klook with a Thai subject: the operator and the reference carry it, the Thai name does not parse', () => {
  const e = parseTripExtras([
    'ยืนยันการจองทัวร์ของคุณ',
    'Klook',
    'Date and time: 5 May 2027 08:00',
    'Booking reference: KLK334455',
  ].join('\n'));
  assert.equal(e.excursion?.operator, 'Klook');
  assert.equal(e.excursion?.confirmationRef, 'KLK334455');
  assert.equal(e.excursion?.dateTime, '2027-05-05T08:00:00');
  // Documented limit: there is no labelled line, and Thai free text is not parsed into a name.
  assert.equal(e.excursion?.name, undefined);
});

test('the platform name alone is not an excursion', () => {
  const e = parseTripExtras([
    'GetYourGuide',
    'Top things to do in Bangkok this spring — save 15%',
  ].join('\n'));
  assert.equal(e.excursion, undefined);
});

test('OpenTable: the restaurant, the party size, and what a yearless date can and cannot give', () => {
  const e = parseTripExtras('OpenTable\nReservation at Nobu for 2 on March 15 at 19:30');
  assert.equal(e.restaurant?.name, 'Nobu');
  assert.equal(e.restaurant?.partySize, 2);
  assert.equal(e.restaurant?.platform, 'opentable');
  // Documented limit: "March 15" carries no year, so there is no ISO date to store.
  assert.equal(e.restaurant?.dateTime, undefined);

  // The same mail with a year does give the sitting.
  const dated = parseTripExtras('OpenTable\nReservation at Nobu for 2\nDate: 15 Mar 2027 19:30');
  assert.equal(dated.restaurant?.dateTime, '2027-03-15T19:30:00');
});

test('TheFork in Dutch: the table, the restaurant and how many of you', () => {
  const e = parseTripExtras([
    'TheFork',
    'Tafelreservering bevestigd: De Librije, 4 personen',
    'Datum: 20 Jun 2027 19:00',
    'Bevestigingsnummer: TF889900',
  ].join('\n'));
  assert.equal(e.restaurant?.name, 'De Librije');
  assert.equal(e.restaurant?.partySize, 4);
  assert.equal(e.restaurant?.platform, 'thefork');
  assert.equal(e.restaurant?.dateTime, '2027-06-20T19:00:00');
  assert.equal(e.restaurant?.confirmationRef, 'TF889900');
});

test('Iens is TheFork in Dutch, so its mails carry the TheFork platform', () => {
  const e = parseTripExtras([
    'Iens',
    'Tafel bij Restaurant Vermeer',
    '2 personen',
    'Datum: 3 Jul 2027 18:30',
  ].join('\n'));
  assert.equal(e.restaurant?.name, 'Restaurant Vermeer');
  assert.equal(e.restaurant?.partySize, 2);
  assert.equal(e.restaurant?.platform, 'thefork');
});

test('a restaurant mail does not also become a hotel', () => {
  const e = parseTripExtras('OpenTable\nReservation at Nobu for 2\nDate: 15 Mar 2027 19:30');
  assert.equal(e.hotel, undefined);
  // ... and a real stay still parses when the mail says so.
  const stay = parseTripExtras('Booking confirmed at Riva Surya\nCheck-in: 14 Mar 2027\nbooking.com');
  assert.equal(stay.hotel?.checkIn, '2027-03-14');
});

test('classifyKind: the table-booking platforms land in the restaurant group', () => {
  for (const sender of [
    'x@opentable.com', 'x@thefork.com', 'x@iens.nl', 'x@lafourchette.com',
    'x@resy.com', 'x@quandoo.com', 'x@bookatable.com', 'x@zomato.com',
  ]) {
    assert.equal(matchesTravel(sender, 'Anything'), true, sender);
    assert.equal(classifyKind(sender, 'Anything'), 'restaurant', sender);
  }
  // A country domain of a brand we know reaches the same group through its subject.
  assert.equal(classifyKind('TheFork <no-reply@thefork.nl>', 'Je boeking'), 'restaurant');
});

test('cleanTripExtras keeps a full excursion and a full restaurant, and drops an empty one', () => {
  const kept = cleanTripExtras({
    excursion: {
      name: 'Grand Palace tour',
      dateTime: '2027-03-14T09:00:00',
      pickupLocation: 'hotel lobby',
      dropoffLocation: 'Khao San Road',
      confirmationRef: 'GYG7781234',
      operator: 'GetYourGuide',
      source: 'gmail',
    },
    restaurant: {
      name: 'Nobu',
      dateTime: '2027-03-15T19:30:00',
      partySize: 2,
      confirmationRef: 'OT445566',
      platform: 'opentable',
      address: '56 Sukhumvit Soi 11, Bangkok',
      source: 'gmail',
    },
  });
  assert.deepEqual(kept?.excursion, {
    name: 'Grand Palace tour',
    dateTime: '2027-03-14T09:00:00',
    pickupLocation: 'hotel lobby',
    dropoffLocation: 'Khao San Road',
    confirmationRef: 'GYG7781234',
    operator: 'GetYourGuide',
    source: 'gmail',
  });
  assert.equal(kept?.restaurant?.partySize, 2);
  assert.equal(kept?.restaurant?.platform, 'opentable');

  // Nothing worth keeping: an operator with no booking in it is not an excursion.
  assert.equal(cleanTripExtras({ excursion: { operator: 'Viator' } }), undefined);
  assert.equal(cleanTripExtras({ excursion: {} }), undefined);
  assert.equal(cleanTripExtras({ restaurant: { partySize: 4 } }), undefined);
  // A party size that is not a number is dropped rather than stored.
  assert.equal(
    cleanTripExtras({ restaurant: { name: 'Nobu', partySize: Number('x') } })?.restaurant?.partySize,
    undefined,
  );
});
