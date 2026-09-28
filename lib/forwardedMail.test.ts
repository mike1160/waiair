import test from 'node:test';
import assert from 'node:assert/strict';

import {
  forwardedBlockStart, forwardedHeaders, isForwardedSubject, originalSender, stripForwardPrefix,
} from './forwardedMail.ts';

/*
 * [V/1d] Real forward blocks, in the languages a WaiAir traveller's mail client is actually set to. None of
 * these is matched by reading a label: the separator and the address are what carry the meaning.
 */
const BLOCKS: Array<[string, string, string]> = [
  ['nl (Gmail)', 'thaiairways.com', [
    '---------- Doorgestuurd bericht ---------',
    'Van: Thai Airways <eticket@thaiairways.com>',
    'Datum: vr 26 sep 2026 om 09:14',
    'Onderwerp: Thai Airways | Booking Confirmed',
    'Aan: <waiairapp@gmail.com>',
  ].join('\n')],
  ['de (Gmail)', 'lufthansa.com', [
    '---------- Weitergeleitete Nachricht ---------',
    'Von: Lufthansa <noreply@lufthansa.com>',
    'Datum: Fr., 26. Sept. 2026 um 09:14',
    'Betreff: Ihre Buchungsbestätigung',
    'An: <traveller@example.com>',
  ].join('\n')],
  ['fr (Gmail)', 'airfrance.fr', [
    '---------- Message transféré ---------',
    'De : Air France <noreply@airfrance.fr>',
    'Date : ven. 26 sept. 2026 à 09:14',
    'Objet : Confirmation de réservation',
    'À : <traveller@example.com>',
  ].join('\n')],
  ['ja (Gmail)', 'jal.com', [
    '---------- 転送されたメッセージ ---------',
    'From: 日本航空 <noreply@jal.com>',
    'Date: 2026年9月26日(金) 9:14',
    '件名: ご予約確認',
    'To: <traveller@example.com>',
  ].join('\n')],
  ['th (Gmail)', 'thaiairways.com', [
    '---------- ข้อความที่ส่งต่อ ---------',
    'จาก: การบินไทย <eticket@thaiairways.com>',
    'วันที่: 26 ก.ย. 2026 09:14',
    'เรื่อง: ยืนยันการจอง',
    'ถึง: <traveller@example.com>',
  ].join('\n')],
  ['em dashes, no label at all', 'klm.com', [
    '————————— ✉️ —————————',
    'KLM <noreply@klm.com>',
    '26 Sep 2026',
  ].join('\n')],
];

test('[V/1d] the original sender is found in every interface language', () => {
  for (const [label, domain, block] of BLOCKS) {
    const from = originalSender(block);
    assert.ok(from.endsWith(domain), `${label}: expected ${domain}, got "${from}"`);
  }
});

test('[V/1d] the separator is found however it is drawn', () => {
  for (const [label, , block] of BLOCKS) {
    assert.ok(forwardedBlockStart(block) > 0, `${label}: no separator found`);
  }
});

test('[V/1d] the forwarder is never mistaken for the sender', () => {
  // The recipient line holds an address too; the sender's comes first and wins.
  const nl = BLOCKS[0][2];
  assert.ok(!originalSender(nl).includes('waiairapp'), 'the person forwarding is not the sender');
});

test('a hand-written forward with no separator still gives up its address', () => {
  const pasted = 'Hoi, zie hieronder mijn boeking.\n\nNH Hotels <noreply@nh-hotels.example>\nBevestiging';
  assert.equal(originalSender(pasted), 'noreply@nh-hotels.example');
});

test('a body with no address at all invents nothing', () => {
  assert.equal(originalSender('Hoi, zie hieronder mijn boeking.'), '');
  assert.equal(originalSender(''), '');
  assert.deepEqual(forwardedHeaders(''), { from: '' });
});

test('the prefix comes off, in the languages the app runs in', () => {
  assert.equal(stripForwardPrefix('Fwd: Your e-ticket'), 'Your e-ticket');
  assert.equal(stripForwardPrefix('FW: Your e-ticket'), 'Your e-ticket');
  assert.equal(stripForwardPrefix('Fwd: Re: Fwd: Your e-ticket'), 'Your e-ticket');
  assert.equal(stripForwardPrefix('Doorgestuurd: Bevestiging'), 'Bevestiging');
  assert.equal(stripForwardPrefix('WG: Ihre Buchung'), 'Ihre Buchung');
  assert.equal(stripForwardPrefix('TR: Confirmation'), 'Confirmation');
});

test('a word that merely begins with a prefix is not a prefix', () => {
  assert.equal(stripForwardPrefix('Reservation confirmed'), 'Reservation confirmed');
  assert.equal(stripForwardPrefix('Forwarding address changed'), 'Forwarding address changed');
  assert.equal(isForwardedSubject('Uw reservering is bevestigd'), false);
  assert.equal(isForwardedSubject('Fwd: Uw reservering is bevestigd'), true);
});
