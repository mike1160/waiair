/**
 * [W/19] What date a confirmation's flight actually gets, per layout — characterised, not changed.
 *
 * The rule in one sentence: a flight number takes the date whose first character is fewest characters away
 * in the flattened text, preferring the dates on its own line (lib/flightImport.ts nearestSameLine).
 *
 * That is the whole of it. Nothing distinguishes a departure from an arrival, a booking date, a check-in or
 * a "book before" deadline, and "nearest in characters" is not "nearest on the page" once an HTML mail has
 * been flattened. Two layouts of the same KLM booking therefore disagree by a day, and that is the behaviour
 * recorded here rather than the behaviour wanted.
 *
 * Every expectation below was measured against the real parse before it was written down. Changing the rule
 * is a separate job (per-leg departure dates), and this file is what it will be measured against.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseImportText } from './flightImport.ts';

const NOW = Date.parse('2026-10-01');

function dated(text: string): string[] {
  return parseImportText(text, undefined, { now: NOW }).map(c => `${c.flightNumber}=${c.dateIso ?? 'none'}`);
}

test('a date on the flight number\'s own line wins, whichever side of it', () => {
  assert.deepEqual(dated('KL843 AMS - BKK 04-11-2026'), ['KL843=2026-11-04']);
  assert.deepEqual(dated('04-11-2026 KL843 AMS - BKK'), ['KL843=2026-11-04']);
});

test('two dates on the line: the nearer one, which is usually the departure', () => {
  assert.deepEqual(dated('KL843 vertrek 04-11-2026 aankomst 05-11-2026'), ['KL843=2026-11-04']);
});

test('no date on the line: the nearest anywhere, above or below', () => {
  assert.deepEqual(dated('Vertrekdatum: 03-11-2026\nKL843 AMS - BKK'), ['KL843=2026-11-03']);
  assert.deepEqual(dated('KL843 AMS - BKK\nVertrekdatum: 03-11-2026'), ['KL843=2026-11-03']);
});

test('the ticket layout: each leg has its date on its own line, and gets it', () => {
  assert.deepEqual(
    dated('Ticket voor uw reis\nKL0843 Amsterdam - Bangkok 04-11-2026\nKL0844 Bangkok - Amsterdam 07-07-2027'),
    ['KL843=2026-11-04', 'KL844=2027-07-07'],
  );
});

test('the confirmation layout: one date above two legs, and both take it', () => {
  // Which is how the same booking comes out a day apart from the ticket mail above. Not a bug in this rule
  // so much as the absence of one: there is nothing here that could know the second leg leaves months later.
  assert.deepEqual(
    dated('Uw boeking is bevestigd\nVertrekdatum: 03-11-2026\nKL843 Amsterdam - Bangkok\nKL844 Bangkok - Amsterdam'),
    ['KL843=2026-11-03', 'KL844=2026-11-03'],
  );
});

test('an arrival date nearer than the departure wins, and is taken as the flight date', () => {
  assert.deepEqual(
    dated('KL843 AMS - BKK\naankomst 05-11-2026\nvertrek 04-11-2026'),
    ['KL843=2026-11-05'],
    'the word beside the date is read by nothing',
  );
});

test('nearest in characters, not nearest on the page: a booking date can beat the departure', () => {
  /*
   * Measured, and the most surprising of these. The booking date is ten blank lines above the flight and the
   * departure is on the line right below it, and the booking date still wins: twenty characters against
   * twenty-four. In a flattened HTML mail this is the normal case, not a contrived one.
   */
  assert.deepEqual(
    dated('Geboekt op 01-10-2026\n\n\n\n\n\n\n\n\n\nKL843 AMS - BKK\nVertrek 04-11-2026'),
    ['KL843=2026-10-01'],
  );
});

test('no date anywhere stays no date, and is never read as today', () => {
  // [W/11] The absence of a fact is not a fact. importDateVerdict turns this into 'unclear'.
  assert.deepEqual(dated('KL843 AMS - BKK'), ['KL843=none']);
});

test('a fallback date is used only when the text gives none', () => {
  const withText = parseImportText('KL843 AMS - BKK 04-11-2026', '2026-12-25', { now: NOW });
  assert.equal(withText[0].dateIso, '2026-11-04', 'the mail outranks the fallback');
  const withoutText = parseImportText('KL843 AMS - BKK', '2026-12-25', { now: NOW });
  assert.equal(withoutText[0].dateIso, '2026-12-25');
});
