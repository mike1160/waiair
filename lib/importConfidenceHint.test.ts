import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandTokens, classifyKind, itemFromMetadata, kindFromBrand, matchesTravel } from './gmailInboxScan.ts';
import { hasConfirmationPhrase, hasPromoPhrase, importConfidenceHint } from './importConfidenceHint.ts';

/** Every mail in this file is one the user actually received. No invented fixtures. */
const hint = (subject: string, from: string, promo: { promotions?: boolean; unsubscribe?: boolean } = {}) =>
  importConfidenceHint({ subject, travelBrand: !!kindFromBrand(from), promo });

test('[W/16b] the real confirmations are ticked in advance', () => {
  assert.equal(hint('Thai Airways | Booking Confirmed', 'eticket@thaiairways.com'), 'strong');
  assert.equal(hint('Ticket voor uw reis', 'no-reply@infos-klm.com'), 'strong');
  assert.equal(hint('Dank u voor uw aankoop!', 'no-reply@infos-klm.com'), 'strong');
});

test('[W/16b] not one of the newsletters is ticked in advance', () => {
  const promos: [string, string][] = [
    ['Save up to 40% on Checked Baggage', 'news@airasia.com'],
    ['Japan Flight Deals', 'news@airasia.com'],
    ['Autumn Bliss in Japan', 'news@airasia.com'],
    ['Dining, elevated', 'news@singaporeair.com'],
    ['Inspiration by Cathay', 'news@cathaypacific.com'],
    ['Trip Coins-saldo gewijzigd', 'news@trip.com'],
    ['U bent nu Gold-lid!', 'news@trip.com'],
    ["Bespaar tot 20% op huurauto's", 'news@booking.com'],
    ['Bevestiging: je Netflix-huishouden is bijgewerkt', 'info@netflix.com'],
    ['KLM Highlights', 'no-reply@infos-klm.com'],
    ['Real Deal Dagen', 'no-reply@infos-klm.com'],
  ];
  for (const [subject, from] of promos) {
    assert.notEqual(hint(subject, from), 'strong', `"${subject}" must not be pre-ticked`);
  }
});

test('[W/16b] Netflix can never be strong, whatever its subject claims', () => {
  // "Bevestiging" is a confirmation word; the sender is not a travel brand, and that decides it.
  assert.equal(hint('Bevestiging: je boeking is bevestigd', 'info@netflix.com'), 'weak');
  assert.equal(kindFromBrand('info@netflix.com'), '');
});

test('[W/16b] a bare confirmation word is not a confirmation phrase', () => {
  assert.equal(hasConfirmationPhrase('Bevestiging: je Netflix-huishouden is bijgewerkt'), false);
  assert.equal(hasConfirmationPhrase('Ticket voor uw reis'), true);
  assert.equal(hasConfirmationPhrase('Thai Airways | Booking Confirmed'), true);
  assert.equal(hasConfirmationPhrase('Buchungsbestätigung'), true, 'accents are folded');
});

test('[W/16b] a real ticket beats the marketing signals, because airlines send both', () => {
  assert.equal(
    hint('Ticket voor uw reis', 'no-reply@infos-klm.com', { promotions: true, unsubscribe: true }),
    'strong',
  );
});

test('[W/16b] marketing is recognised by Gmail\'s label, by an unsubscribe link, or by its words', () => {
  assert.equal(hint('Autumn Bliss in Japan', 'news@airasia.com', { promotions: true }), 'promo');
  assert.equal(hint('Autumn Bliss in Japan', 'news@airasia.com', { unsubscribe: true }), 'promo');
  assert.equal(hasPromoPhrase('Save up to 40% on Checked Baggage'), true);
  assert.equal(hasPromoPhrase('Real Deal Dagen'), true);
  assert.equal(hasPromoPhrase('Ticket voor uw reis'), false);
});

test('[W/16b] travel-shaped but unproven stays weak — shown, not ticked', () => {
  assert.equal(hint('Trip Coins-saldo gewijzigd', 'news@trip.com'), 'weak');
  assert.equal(hint('U bent nu Gold-lid!', 'news@trip.com'), 'weak');
});

test('[W/16b] a bulk sending domain is recognised as its brand', () => {
  assert.deepEqual(brandTokens('infos-klm.com'), ['infos-klm', 'infos', 'klm']);
  assert.equal(kindFromBrand('no-reply@infos-klm.com'), 'flight');
  assert.equal(matchesTravel('no-reply@infos-klm.com', 'Ticket voor uw reis'), true);
  assert.equal(classifyKind('no-reply@infos-klm.com', 'Ticket voor uw reis'), 'flight');
  assert.ok(itemFromMetadata('m', [
    { name: 'From', value: 'no-reply@infos-klm.com' }, { name: 'Subject', value: 'Ticket voor uw reis' },
  ], '1'), 'and it finally produces an item');
});

test('[W/16b] a delimiter is required, so an unrelated domain is not swallowed', () => {
  assert.deepEqual(brandTokens('notklm.com'), ['notklm']);
  assert.equal(kindFromBrand('x@notklm.com'), '');
  assert.equal(matchesTravel('x@notklm.com', 'Ticket voor uw reis'), false);
  // Pieces under three characters are not brands.
  assert.deepEqual(brandTokens('go-nl.com'), ['go-nl']);
});

test('[W/16b] a KLM newsletter is travel-shaped but names no kind, so it is never pre-ticked', () => {
  assert.equal(matchesTravel('no-reply@infos-klm.com', 'KLM Highlights'), true, 'still visible');
  assert.equal(classifyKind('no-reply@infos-klm.com', 'KLM Highlights'), '');
  assert.equal(hint('KLM Highlights', 'no-reply@infos-klm.com'), 'promo');
});
