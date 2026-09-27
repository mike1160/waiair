import test from 'node:test';
import assert from 'node:assert/strict';

import {
  forwardedHeaders, isForwardedSubject, originalSender, originalSubject, stripForwardPrefix,
} from './forwardedMail.ts';

const GMAIL_FWD = [
  '---------- Forwarded message ---------',
  'From: Thai Airways <eticket@thaiairways.com>',
  'Date: Fri, 26 Sep 2026 at 09:14',
  'Subject: Your e-ticket / Itinerary Receipt',
  'To: <traveller@example.com>',
  '',
  'Dear Customer, your e-ticket is attached.',
].join('\n');

test('the prefix comes off, however many there are', () => {
  assert.equal(stripForwardPrefix('Fwd: Your e-ticket'), 'Your e-ticket');
  assert.equal(stripForwardPrefix('FW: Your e-ticket'), 'Your e-ticket');
  assert.equal(stripForwardPrefix('Fwd: Re: Fwd: Your e-ticket'), 'Your e-ticket');
  assert.equal(stripForwardPrefix('Doorgestuurd: Bevestiging'), 'Bevestiging');
  assert.equal(stripForwardPrefix('  fwd :  Booking confirmation'), 'Booking confirmation');
});

test('a subject that was never forwarded is left alone', () => {
  assert.equal(stripForwardPrefix('Your reservation is confirmed'), 'Your reservation is confirmed');
  assert.equal(isForwardedSubject('Your reservation is confirmed'), false);
  assert.equal(isForwardedSubject('Fwd: Your reservation is confirmed'), true);
});

test('a word that merely starts with the prefix is not a prefix', () => {
  // "Reservation" begins with "re" but is not "Re:".
  assert.equal(stripForwardPrefix('Reservation confirmed'), 'Reservation confirmed');
  assert.equal(stripForwardPrefix('Forwarding address changed'), 'Forwarding address changed');
});

test('the original sender and subject come out of the forwarded body', () => {
  assert.equal(originalSender(GMAIL_FWD), 'Thai Airways <eticket@thaiairways.com>');
  assert.equal(originalSubject(GMAIL_FWD), 'Your e-ticket / Itinerary Receipt');
  assert.deepEqual(forwardedHeaders(GMAIL_FWD), {
    from: 'Thai Airways <eticket@thaiairways.com>',
    subject: 'Your e-ticket / Itinerary Receipt',
  });
});

test('quoted forwards are read too', () => {
  const quoted = '> From: NH Hotels <reservations@nh-hotels.com>\n> Subject: Fwd: Booking confirmation';
  assert.equal(originalSender(quoted), 'NH Hotels <reservations@nh-hotels.com>');
  assert.equal(originalSubject(quoted), 'Booking confirmation', 'its own prefix comes off as well');
});

test('the outermost forward wins when a mail went round twice', () => {
  const twice = [
    'From: Thai Airways <eticket@thaiairways.com>',
    'Subject: e-ticket',
    'From: Someone Else <other@example.com>',
    'Subject: something else',
  ].join('\n');
  assert.equal(originalSender(twice), 'Thai Airways <eticket@thaiairways.com>');
});

test('a hand-written forward carries nothing, and nothing is invented', () => {
  assert.deepEqual(forwardedHeaders('Hi, see below for my booking'), { from: '', subject: '' });
  assert.deepEqual(forwardedHeaders(''), { from: '', subject: '' });
});
