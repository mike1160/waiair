/**
 * [W/19] The six KLM cards.
 *
 * One booking produced six cards on the discovery list. Measured against the real parse rather than
 * hand-written candidates, because the duplication comes from three separate places and only two of them
 * are fixed here:
 *
 *   the ticket mail arrived twice and names both legs padded (KL0843, KL0844) — fixed by the canonical form,
 *   the confirmation names the same two legs plain (KL843, KL844) — fixed by this dedupe,
 *   and the ticket and the confirmation disagree about the day by one, which is NOT fixed: nothing here
 *   knows which of the dates in a mail is the departure. Four cards is the honest result, not two.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dedupePendingReview, parseImportedMessages, planImports } from './gmailImport.ts';

const TODAY = '2026-10-01';

/**
 * The ticket mail, twice: the same body under two message ids, which is how it reached the device.
 *
 * City names rather than IATA codes, as the real mail has them — which is why these cards are on the
 * discovery list at all: without a parseable route autoTrackable refuses them, however sure the number is.
 */
const TICKET = [
  'Ticket voor uw reis',
  'KL0843  Amsterdam - Bangkok   04-11-2026',
  'KL0844  Bangkok - Amsterdam   07-07-2027',
].join('\n');

/** The confirmation: both legs named plain, and one date for the pair, at the top. */
const CONFIRMATION = [
  'Uw boeking is bevestigd',
  'Vertrekdatum: 03-11-2026',
  'KL843  Amsterdam - Bangkok',
  'KL844  Bangkok - Amsterdam',
].join('\n');

function parseThree() {
  return parseImportedMessages([
    { id: 'ticket-1', subject: 'Ticket voor uw reis', from: 'no-reply@infos-klm.com', text: TICKET },
    { id: 'ticket-2', subject: 'Ticket voor uw reis', from: 'no-reply@infos-klm.com', text: TICKET },
    { id: 'confirm', subject: 'Uw boeking is bevestigd', from: 'no-reply@klm.com', text: CONFIRMATION },
  ], { todayIso: TODAY });
}

/** What the parse hands over, before anything deduplicates it: the six cards as they were seen. */
function cardsFromMails() {
  return parseThree().flatMap(p => p.flights);
}

test('the three mails really do produce six cards', () => {
  const six = cardsFromMails();
  assert.equal(six.length, 6, 'the case this fixes: six cards off one booking');
  assert.deepEqual(
    six.map(c => `${c.flightNumber}@${c.dateIso}`),
    [
      'KL843@2026-11-04', 'KL844@2027-07-07',
      'KL843@2026-11-04', 'KL844@2027-07-07',
      'KL843@2026-11-03', 'KL844@2026-11-03',
    ],
    'padding already gone; the duplication left is the mail that arrived twice',
  );
});

test('six cards become four: the duplicate mail collapses, the two legs do not', () => {
  const kept = dedupePendingReview(cardsFromMails());
  assert.deepEqual(
    kept.map(c => `${c.flightNumber}@${c.dateIso}`),
    ['KL843@2026-11-04', 'KL844@2027-07-07', 'KL843@2026-11-03', 'KL844@2026-11-03'],
  );
});

test('two legs on the same day stay two cards', () => {
  const kept = dedupePendingReview(cardsFromMails());
  const sameDay = kept.filter(c => c.dateIso === '2026-11-03');
  assert.equal(sameDay.length, 2, 'KL843 and KL844 both leave on the 3rd and are two flights');
  assert.deepEqual(sameDay.map(c => c.flightNumber), ['KL843', 'KL844']);
});

test('the one-day gap is left standing, because nothing here knows which date is the departure', () => {
  const kept = dedupePendingReview(cardsFromMails());
  const kl843 = kept.filter(c => c.flightNumber === 'KL843');
  assert.equal(kl843.length, 2);
  assert.deepEqual(kl843.map(c => c.dateIso), ['2026-11-04', '2026-11-03']);
});

test('the padded and the plain spelling on one day are one card', () => {
  const parsed = parseImportedMessages([
    { id: 'a', from: 'no-reply@klm.com', text: 'KL0843 Amsterdam - Bangkok 04-11-2026' },
    { id: 'b', from: 'no-reply@klm.com', text: 'KL843 Amsterdam - Bangkok 04-11-2026' },
  ], { todayIso: TODAY });
  const kept = dedupePendingReview(parsed.flatMap(p => p.flights));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].flightNumber, 'KL843');
});

test('these six are on the discovery list, not auto-imported: the route never parsed', () => {
  const plan = planImports(parseThree(), []);
  assert.equal(plan.flightsAutoImport.length, 0, 'a card with nowhere to go is never tracked unasked');
  assert.equal(plan.flightsPendingReview.length, 6, 'all six reach savePendingReview, which is what dedupes');
});

test('two mails naming one trackable flight are looked up once, not twice', () => {
  // The other half of the dedupe: addTrackByNumber searches before it checks what is already tracked.
  const parsed = parseImportedMessages([
    { id: 'a', from: 'no-reply@klm.com', text: 'KL0843 AMS - BKK 04-11-2026' },
    { id: 'b', from: 'no-reply@klm.com', text: 'KL843 AMS - BKK 04-11-2026' },
  ], { todayIso: TODAY });
  const plan = planImports(parsed, []);
  assert.deepEqual(plan.flightsAutoImport.map(c => c.flightNumber), ['KL843']);
});

test('of two cards for one flight the fuller one is kept', () => {
  const bare = {
    id: 'x', flightNumber: 'KL843', dateIso: '2026-11-03', label: 'KL843', confidence: 95,
  };
  const routed = {
    id: 'y', flightNumber: 'KL0843', dateIso: '2026-11-03', origin: 'AMS', destination: 'BKK',
    label: 'KL843 · AMS → BKK', confidence: 60,
  };
  const kept = dedupePendingReview([bare, routed]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, 'y', 'a route beats a higher confidence with nowhere to go');
});

test('equal cards keep the first, and a card with no date is still one card', () => {
  const a = { id: 'a', flightNumber: 'KL843', label: 'KL843', confidence: 70 };
  const b = { id: 'b', flightNumber: 'KL0843', label: 'KL843', confidence: 70 };
  const kept = dedupePendingReview([a, b]);
  assert.deepEqual(kept.map(c => c.id), ['a']);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(dedupePendingReview([]), []);
});

test('savePendingReview is where it runs, so the daily sync dedupes too', () => {
  const store = readFileSync(new URL('./gmailInboxStore.ts', import.meta.url), 'utf8');
  assert.ok(
    store.includes("const list = dedupePendingReview((candidates || []).filter(c => c && c.flightNumber));"),
    'the discovery card reads what this writes; dedupe anywhere else would leave that path alone',
  );
});
