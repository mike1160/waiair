import test from 'node:test';
import assert from 'node:assert/strict';

import {
  airlineCodeFromSender,
  bookingRefFromText,
  hasPdfAttachment,
  pdfOnlyBooking,
  senderHost,
} from './pdfOnlyBooking.ts';

const TG = 'Thai Airways <eticket@thaiairways.com>';
const PDF = ['2172350446701.pdf'];

test('the airline comes from the sender, subdomains included', () => {
  assert.equal(airlineCodeFromSender(TG), 'TG');
  assert.equal(airlineCodeFromSender('noreply@eticket.thaiairways.com'), 'TG');
  assert.equal(airlineCodeFromSender('"KLM" <info@klm.com>'), 'KL');
  assert.equal(airlineCodeFromSender('x@SingaporeAir.com'), 'SQ');
});

test('an unknown sender yields no airline rather than a wrong one', () => {
  assert.equal(airlineCodeFromSender('someone@gmail.com'), '');
  assert.equal(airlineCodeFromSender('notthaiairways.com.evil.example'), '');
  assert.equal(airlineCodeFromSender(''), '');
  // A domain that merely ends in the same letters is not the airline.
  assert.equal(airlineCodeFromSender('x@fakeklm.com'), '');
});

test('senderHost reads the host out of a From header', () => {
  assert.equal(senderHost('Thai Airways <eticket@thaiairways.com>'), 'thaiairways.com');
  assert.equal(senderHost('x@EXAMPLE.COM.'), 'example.com');
  assert.equal(senderHost('no-at-sign'), '');
});

test('the booking reference comes out of the manage-booking link', () => {
  assert.equal(
    bookingRefFromText('Manage: https://www.thaiairways.com/pss_router/managebooking?booking_no=EPDC6Y&lastname=Smith'),
    'EPDC6Y',
  );
  assert.equal(bookingRefFromText('...?pnr=ABC123&x=1'), 'ABC123');
  assert.equal(bookingRefFromText('...?recordLocator=XY12Z9'), 'XY12Z9');
});

test('what is not a PNR is not taken for one', () => {
  // All digits is a ticket number, not a record locator.
  assert.equal(bookingRefFromText('...?booking_no=123456'), '');
  // Wrong length.
  assert.equal(bookingRefFromText('...?booking_no=AB12'), '');
  assert.equal(bookingRefFromText('...?booking_no=ABCDEFGH'), '');
  assert.equal(bookingRefFromText('no link here at all'), '');
  assert.equal(bookingRefFromText(''), '');
});

test('a PDF is recognised by its extension, whatever the case', () => {
  assert.equal(hasPdfAttachment(['ticket.PDF']), true);
  assert.equal(hasPdfAttachment(['2172350446701.pdf']), true);
  assert.equal(hasPdfAttachment(['logo.png', 'itinerary.pdf']), true);
  assert.equal(hasPdfAttachment(['logo.png']), false);
  assert.equal(hasPdfAttachment([]), false);
  assert.equal(hasPdfAttachment(undefined), false);
  // A name that merely contains "pdf" is not a PDF.
  assert.equal(hasPdfAttachment(['pdf-instructions.txt']), false);
});

test('the Thai Airways case: recognised, nothing parsed, PDF attached', () => {
  const hit = pdfOnlyBooking({
    kind: 'flight',
    flightCount: 0,
    attachments: PDF,
    from: TG,
    text: 'Your e-ticket is attached.\nhttps://www.thaiairways.com/pss_router/managebooking?booking_no=EPDC6Y&lastname=Kleinjans',
  });
  assert.ok(hit);
  assert.equal(hit.airlineCode, 'TG');
  assert.equal(hit.bookingRef, 'EPDC6Y');
  assert.equal(hit.filename, '2172350446701.pdf');
});

test('a mail that did yield a flight needs no rescuing', () => {
  assert.equal(pdfOnlyBooking({ kind: 'flight', flightCount: 1, attachments: PDF, from: TG }), null);
});

test('no PDF is a different failure and is not blamed on one', () => {
  assert.equal(pdfOnlyBooking({ kind: 'flight', flightCount: 0, attachments: ['logo.png'], from: TG }), null);
  assert.equal(pdfOnlyBooking({ kind: 'flight', flightCount: 0, attachments: [], from: TG }), null);
  assert.equal(pdfOnlyBooking({ kind: 'flight', flightCount: 0, from: TG }), null);
});

test('a mail that is not a flight booking never opens an add-flight sheet', () => {
  // A hotel confirmation with a PDF attached must not be offered as a flight.
  assert.equal(pdfOnlyBooking({ kind: 'hotel', flightCount: 0, attachments: PDF, from: TG }), null);
  assert.equal(pdfOnlyBooking({ kind: '', flightCount: 0, attachments: PDF, from: TG }), null);
  assert.equal(pdfOnlyBooking({ flightCount: 0, attachments: PDF, from: TG }), null);
});

test('an unknown airline still gets the message, just without a code', () => {
  const hit = pdfOnlyBooking({
    kind: 'flight',
    flightCount: 0,
    attachments: ['eticket.pdf'],
    from: 'bookings@some-agency.example',
    text: 'no link',
  });
  assert.ok(hit, 'the traveller is told either way');
  assert.equal(hit.airlineCode, '');
  assert.equal(hit.bookingRef, '');
});
