/**
 * [W/19] One spelling per flight.
 *
 * A KLM e-ticket writes the number padded to four digits and the booking confirmation writes it plain, so
 * the same seat on the same aircraft arrived as "KL0843" and "KL843" — two cards on the discovery list, two
 * lookups, and nothing to say they were one flight.
 *
 * The counter-example is the point of the narrow rule: W20 is Wizz Air's own number, not a padded one, and
 * a single letter in front of the digits must come back untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canonicalFlightIdent, identsMatch } from './flightIdent.ts';
import { extractFlightNumbers, parseImportText } from './flightImport.ts';

test('a padded e-ticket number is the plain one', () => {
  assert.equal(canonicalFlightIdent('KL0843'), 'KL843');
  assert.equal(canonicalFlightIdent('TG0920'), 'TG920');
  assert.equal(canonicalFlightIdent('BA0007'), 'BA7');
});

test('an already-plain number is left exactly as it is', () => {
  assert.equal(canonicalFlightIdent('KL843'), 'KL843');
  assert.equal(canonicalFlightIdent('TG920'), 'TG920');
  assert.equal(canonicalFlightIdent('BR75'), 'BR75');
});

test('only leading zeros behind a two-letter code: W20 keeps its zero', () => {
  // One letter, not two: the 0 here is part of the number, and stripping it would invent W2.
  assert.equal(canonicalFlightIdent('W20'), 'W20');
  assert.equal(canonicalFlightIdent('W2 0'), 'W20', 'whitespace still goes, the digits do not');
  // Three letters: this app cannot name the airline, so it does not guess at its padding either.
  assert.equal(canonicalFlightIdent('KLM0843'), 'KLM0843');
});

test('zeros that are not leading stay put', () => {
  assert.equal(canonicalFlightIdent('KL800'), 'KL800');
  assert.equal(canonicalFlightIdent('TG202'), 'TG202');
  assert.equal(canonicalFlightIdent('KL0'), 'KL0', 'nothing is left to strip to');
});

test('whitespace and separators collapse, everything else survives', () => {
  assert.equal(canonicalFlightIdent('kl 0843'), 'KL843');
  assert.equal(canonicalFlightIdent(''), '');
  assert.equal(canonicalFlightIdent(undefined), '');
  assert.equal(canonicalFlightIdent('Ticket voor uw reis'), 'TICKETVOORUWREIS', 'not a number, not rewritten');
});

test('the looser identsMatch is unchanged — this is a canonical form, not a comparison', () => {
  assert.equal(identsMatch('KL0843', 'KL843'), true);
  assert.equal(identsMatch('KLM0843', 'KLM843'), true, 'three letters still compare equal there');
  assert.equal(identsMatch('KL843', 'KL844'), false);
});

test('a parsed mail yields the canonical number, so the padded ticket and the plain confirmation agree', () => {
  const ticket = parseImportText('Ticket voor uw reis\nKL0843 AMS-BKK 2026-11-04');
  assert.deepEqual(ticket.map(c => c.flightNumber), ['KL843']);
  const confirmation = parseImportText('Uw boeking is bevestigd\nKL843 AMS-BKK 2026-11-04');
  assert.deepEqual(confirmation.map(c => c.flightNumber), ['KL843']);
  assert.equal(ticket[0].id, confirmation[0].id, 'same flight, same day: the candidate id matches too');
});

test('both spellings in one mail collapse to a single candidate', () => {
  const both = parseImportText('KL0843 AMS-BKK 2026-11-04\nKL843 AMS-BKK 2026-11-04');
  assert.deepEqual(both.map(c => c.flightNumber), ['KL843']);
});

test('extractFlightNumbers reports the same canonical form', () => {
  assert.deepEqual(extractFlightNumbers('Flights KL0843 and TG0920'), ['KL843', 'TG920']);
});

test('a one-letter code is not a flight number out of prose at all', () => {
  /*
   * Measured, not assumed: FLIGHT_RE demands two letters, so "W20" is never a candidate out of a mail. The
   * counter-example bites on the other path — isFlightNumberQuery accepts one letter, so a typed W20 does
   * reach the lookup, and canonicalFlightIdent leaving it alone is what keeps it W20 there.
   */
  assert.deepEqual(extractFlightNumbers('W20 to Budapest'), []);
  assert.equal(canonicalFlightIdent('W20'), 'W20');
});

test('a padded aircraft type is still not a flight', () => {
  // AN024 canonicalises to AN24, which is on the not-a-flight list; the order of the two checks matters.
  assert.deepEqual(extractFlightNumbers('Aircraft: AN024'), []);
});

test('the lookup in App.tsx goes through the canonical form', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.ok(
    app.includes('const clean=canonicalFlightIdent(q);'),
    'normalizeFlightNumberInput must canonicalise, or the padded number is looked up as its own flight',
  );
  assert.ok(
    app.includes('const clean=normalizeFlightNumberInput(flightNumber);'),
    'addTrackByNumber must keep going through that same gate',
  );
});
