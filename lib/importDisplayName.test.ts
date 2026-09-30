import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressDomain, importDisplayName, isPersonalMailbox, nameFromSubject } from './importDisplayName.ts';

/** The real mail behind this bug: forwarded by the traveller, listed under the traveller's own name. */
const SOLARIA = {
  outerFrom: '"Mike Kleinjans" <kleinjansmike@gmail.com>',
  subject: 'Fwd: [Boekingsbevestiging] Uw boeking bij Solaria Nishitetsu Hotel Bangkok',
};

test('[W/9] a forwarded hotel booking is never listed under the forwarder', () => {
  const name = importDisplayName(SOLARIA);
  assert.ok(!name.includes('Kleinjans'), `the forwarder must never be the title, got "${name}"`);
  assert.ok(!name.includes('gmail'), 'nor their mail provider');
  assert.equal(name, 'Uw boeking bij Solaria Nishitetsu Hotel Bangkok');
  assert.ok(name.includes('Solaria'), 'and it names the hotel');
});

test('[W/9] a recovered original sender wins, as it already did for Thai Airways', () => {
  assert.equal(importDisplayName({
    outerFrom: '"Mike Kleinjans" <kleinjansmike@gmail.com>',
    subject: 'Fwd: Thai Airways | Booking Confirmed',
    recoveredFrom: 'eticket@thaiairways.com',
  }), 'thaiairways.com');
  // With a display name of its own, that is used instead of the bare domain.
  assert.equal(importDisplayName({
    outerFrom: '"Mike" <m@gmail.com>',
    subject: 'Fwd: Booking Confirmed',
    recoveredFrom: '"Thai Airways" <eticket@thaiairways.com>',
  }), 'Thai Airways');
});

test('[W/9] a forward chain between two people falls back to the subject, not to either of them', () => {
  const name = importDisplayName({
    outerFrom: '"Mike Kleinjans" <kleinjansmike@gmail.com>',
    subject: 'Fwd: [Boekingsbevestiging] Uw boeking bij Solaria Nishitetsu Hotel Bangkok',
    recoveredFrom: '"Zus" <sister@hotmail.com>',
  });
  assert.ok(!name.includes('Zus') && !name.includes('hotmail'), `got "${name}"`);
  assert.ok(name.includes('Solaria'));
});

test('[W/9] an ordinary mail nobody forwarded is unchanged', () => {
  assert.equal(importDisplayName({
    outerFrom: '"Booking.com" <noreply@booking.com>',
    subject: 'Your booking is confirmed',
  }), 'Booking.com');
  assert.equal(importDisplayName({
    outerFrom: 'noreply@agoda.com',
    subject: 'Booking confirmation',
  }), 'agoda.com');
});

test('[W/9] a subject-derived name drops the tag and the reference number', () => {
  assert.equal(nameFromSubject('Fwd: 📅 NH Bangkok Asoke: Booking Confirmation #100853623424'),
    '📅 NH Bangkok Asoke: Booking Confirmation');
  assert.equal(nameFromSubject('[Boekingsbevestiging] Uw boeking bij Solaria'), 'Uw boeking bij Solaria');
  assert.equal(nameFromSubject('(Confirmation) Hotel Okura - 4821'), 'Hotel Okura');
  assert.equal(nameFromSubject('Fwd: Re: Your e-ticket'), 'Your e-ticket', 'prefixes go first');
});

test('[W/9] a very long subject is cut rather than filling the card', () => {
  const long = nameFromSubject(`Fwd: ${'Grand Hyatt Erawan Bangkok Booking Confirmation '.repeat(4)}`);
  assert.ok(long.length <= 60, `got ${long.length}`);
  assert.ok(long.endsWith('…'));
});

test('[W/9] personal mailboxes are recognised, company ones are not', () => {
  for (const a of ['x@gmail.com', 'X@GMAIL.COM', '"A B" <a@hotmail.co.uk>', 'y@icloud.com', 'z@qq.com']) {
    assert.equal(isPersonalMailbox(a), true, a);
  }
  for (const a of ['eticket@thaiairways.com', 'noreply@booking.com', 'x@nhhotels.com', '']) {
    assert.equal(isPersonalMailbox(a), false, a);
  }
  assert.equal(addressDomain('"A" <a@Example.COM>'), 'example.com');
  assert.equal(addressDomain('not an address'), '');
});

test('[W/9] nothing to go on yields something harmless, never a crash', () => {
  assert.equal(importDisplayName({}), '');
  assert.equal(importDisplayName({ subject: 'Fwd: ' }), '');
  assert.equal(importDisplayName({ outerFrom: 'x@booking.com', subject: 'Fwd:' }), 'booking.com');
});
