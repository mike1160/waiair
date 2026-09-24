import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUTO_LINK_MIN,
  LOC_COUNTRY,
  LOC_UNKNOWN,
  SUGGEST_MIN,
  autoLinkItems,
  bestTrip,
  linkDecision,
  matchScore,
  planLinks,
  scoreBreakdown,
  unlinkedItems,
  type GmailItem,
  type Trip,
} from './matchScore.ts';

/** A week in Bangkok, landing on the 10th. */
const BKK: Trip = {
  key: 'TG921-2026-10-10',
  startDate: '2026-10-10',
  endDate: '2026-10-17',
  destinationCity: 'Bangkok',
  destinationCountry: 'TH',
  destinationIata: 'BKK',
};

/** A second trip, later and elsewhere, to make "which trip" a real question. */
const AMS: Trip = {
  key: 'KL876-2026-12-02',
  startDate: '2026-12-02',
  endDate: '2026-12-09',
  destinationCity: 'Amsterdam',
  destinationCountry: 'NL',
  destinationIata: 'AMS',
};

function item(over: Partial<GmailItem>): GmailItem {
  return { id: 'm1', kind: 'hotel', ...over };
}

test('1 — hotel on the arrival day in the destination city links itself', () => {
  const hotel = item({ kind: 'hotel', date: '2026-10-10', city: 'Bangkok', country: 'TH' });
  const parts = scoreBreakdown(hotel, BKK);
  assert.deepEqual(parts, { date: 40, location: 40, type: 20, total: 100 });
  assert.equal(linkDecision(parts.total), 'auto');
});

test('2 — a day either side is still sure enough to link', () => {
  const after = item({ kind: 'hotel', date: '2026-10-11', city: 'Bangkok', country: 'TH' });
  assert.equal(matchScore(after, BKK), 85, '25 for the day + 40 for the city + 20 for the kind');
  assert.equal(linkDecision(85), 'auto');

  // The night before landing: the date still scores, but such a check-in falls outside the trip, so the
  // kind earns nothing and it is offered rather than linked.
  const before = item({ kind: 'hotel', date: '2026-10-09', city: 'Bangkok', country: 'TH' });
  assert.equal(matchScore(before, BKK), 65);
  assert.equal(linkDecision(65), 'suggest');
});

test('3 — a hotel in another country is left alone, even on the right day', () => {
  const wrong = item({ kind: 'hotel', date: '2026-10-10', city: 'Paris', country: 'FR' });
  assert.deepEqual(scoreBreakdown(wrong, BKK), { date: 40, location: 0, type: 0, total: 40 });
  assert.equal(linkDecision(40), 'inbox');
});

test('3b — same country, far-off city: offered, never linked on its own', () => {
  // Phuket on the day you land in Bangkok is a plausible onward hop, so it is worth asking about — but the
  // place does not match, so it must not link itself.
  const phuket = item({ kind: 'hotel', date: '2026-10-10', city: 'Phuket', country: 'TH' });
  const parts = scoreBreakdown(phuket, BKK);
  assert.equal(parts.location, LOC_COUNTRY, 'same country, well beyond one region');
  assert.equal(parts.total, 75);
  assert.equal(linkDecision(parts.total), 'suggest');
});

test('4 — same country, two days out: offered, on the nose of the suggest band', () => {
  // 15 (two days) + 15 (same country) + 20 (kind) = 50, the lowest score that still gets offered. This is
  // why "same country" is worth 15 and not 10: at 10 the case landed in the inbox at 45.
  const chiangMai = item({ kind: 'hotel', date: '2026-10-12', city: 'Chiang Mai', country: 'TH' });
  const parts = scoreBreakdown(chiangMai, BKK);
  assert.deepEqual(parts, { date: 15, location: 15, type: 20, total: 50 });
  assert.equal(linkDecision(parts.total), 'suggest');

  // Two days out but next door — Don Mueang is the same region as Suvarnabhumi — does reach 'suggest'.
  const dmk = item({ kind: 'hotel', date: '2026-10-12', city: 'Don Mueang', country: 'TH' });
  const near = scoreBreakdown(dmk, BKK);
  assert.equal(near.location, 20, 'within REGION_KM of the destination');
  assert.equal(near.total, 55);
  assert.equal(linkDecision(near.total), 'suggest');
});

test('5 — a restaurant mid-trip in the right city is offered', () => {
  const dinner = item({ kind: 'restaurant', date: '2026-10-14', city: 'Bangkok', country: 'TH' });
  const parts = scoreBreakdown(dinner, BKK);
  assert.deepEqual(parts, { date: 10, location: 40, type: 15, total: 65 });
  assert.equal(linkDecision(parts.total), 'suggest');
});

test('6 — an excursion on the arrival day links itself', () => {
  const tour = item({ kind: 'excursion', date: '2026-10-10', city: 'Bangkok', country: 'TH' });
  assert.equal(matchScore(tour, BKK), 95);
  assert.equal(linkDecision(95), 'auto');
});

test('7 — a car picked up at the arrival airport links itself', () => {
  const car = item({ kind: 'carRental', date: '2026-10-10', airportIata: 'BKK', country: 'TH' });
  const parts = scoreBreakdown(car, BKK);
  assert.deepEqual(parts, { date: 40, location: 40, type: 20, total: 100 });
  assert.equal(linkDecision(parts.total), 'auto');
});

test('8 — no date, no score: a booking with no day says nothing about which trip it is', () => {
  const dateless = item({ kind: 'hotel', city: 'Bangkok', country: 'TH' });
  assert.equal(matchScore(dateless, BKK), 0, 'not even the city counts without a date');
  assert.equal(linkDecision(0), 'inbox');
  assert.equal(matchScore(item({ kind: 'hotel', date: 'soon', city: 'Bangkok' }), BKK), 0);
});

test('9 — outside the trip it stays in the inbox, right city or not', () => {
  const later = item({ kind: 'hotel', date: '2026-11-20', city: 'Bangkok', country: 'TH' });
  const parts = scoreBreakdown(later, BKK);
  assert.deepEqual(parts, { date: 0, location: 40, type: 0, total: 40 });
  assert.equal(linkDecision(parts.total), 'inbox');
});

test('10 — with two trips the booking goes to the one it actually fits', () => {
  const dutch = item({ id: 'm-ams', kind: 'hotel', date: '2026-12-02', city: 'Amsterdam', country: 'NL' });
  const picked = bestTrip(dutch, [BKK, AMS]);
  assert.equal(picked.trip?.key, AMS.key);
  assert.equal(picked.score, 100);
  assert.equal(matchScore(dutch, BKK), 0, 'and nothing at all for the Bangkok trip');

  const result = planLinks([dutch], [BKK, AMS]);
  assert.equal(result.plans[0]?.tripKey, AMS.key);
  assert.equal(result.autoLinked, 1);
});

test('11 — re-matching: the flight is tracked later, and the waiting booking attaches itself', () => {
  const waiting = item({ id: 'm-wait', kind: 'hotel', date: '2026-10-10', city: 'Bangkok', country: 'TH' });

  // Before the flight is tracked there is nothing to match against: it sits in the inbox.
  const before = planLinks([waiting], []);
  assert.deepEqual(
    { auto: before.autoLinked, suggested: before.suggested, inbox: before.inbox },
    { auto: 0, suggested: 0, inbox: 1 },
  );
  assert.equal(before.plans[0]?.tripKey, null);

  // The traveller adds the flight by hand; the same booking is looked at again and links.
  const after = planLinks(unlinkedItems([waiting]), [BKK], { now: 1_777_000_000_000 });
  assert.equal(after.autoLinked, 1);
  assert.deepEqual(after.plans[0]?.record, {
    linkedToTripKey: BKK.key,
    linkedBy: 'auto',
    linkedAt: 1_777_000_000_000,
    matchScoreAtLink: 100,
  });

  // Once linked it is no longer waiting, so a later re-match leaves it alone.
  const linked: GmailItem = { ...waiting, linkedToTripKey: BKK.key, linkedBy: 'auto' };
  assert.deepEqual(unlinkedItems([linked]), []);
});

test('12 — the thresholds are exactly where the rule says they are', () => {
  assert.equal(AUTO_LINK_MIN, 80);
  assert.equal(SUGGEST_MIN, 50);
  assert.equal(linkDecision(80), 'auto');
  assert.equal(linkDecision(79), 'suggest');
  assert.equal(linkDecision(50), 'suggest');
  assert.equal(linkDecision(49), 'inbox');
  assert.equal(linkDecision(100), 'auto');
  assert.equal(linkDecision(0), 'inbox');
  // Nonsense never links anything.
  assert.equal(linkDecision(Number.NaN), 'inbox');
});

test('a place nobody named is unknown, not wrong — on either side', () => {
  assert.equal(LOC_UNKNOWN, 20);
  // The booking says nothing about where it is: the day and the kind decide, and a same-day hotel still
  // reaches 'auto' — which is what keeps the bookings the old date-only matcher attached working.
  const vague = item({ kind: 'hotel', date: '2026-10-10' });
  assert.deepEqual(scoreBreakdown(vague, BKK), { date: 40, location: 20, type: 20, total: 80 });
  assert.equal(linkDecision(80), 'auto');

  // The trip says nothing about where it goes (a flight tracked by number alone): same reasoning.
  const noDest: Trip = { ...BKK, destinationCity: '', destinationCountry: '', destinationIata: '' };
  const hotel = item({ kind: 'hotel', date: '2026-10-10', city: 'Bangkok', country: 'TH' });
  assert.equal(scoreBreakdown(hotel, noDest).location, LOC_UNKNOWN);
  assert.equal(matchScore(hotel, noDest), 80);

  // But a booking that names a place we can read, somewhere else entirely, is wrong and stays wrong.
  const paris = item({ kind: 'hotel', date: '2026-10-10', city: 'Paris', country: 'FR' });
  assert.equal(scoreBreakdown(paris, BKK).location, 0);
});

test('the place names a booking can use: code, airport name, metro area, accents', () => {
  const day = { kind: 'hotel' as const, date: '2026-10-10', country: 'TH' };
  for (const city of ['Bangkok', 'BANGKOK', 'bangkok', 'Suvarnabhumi', 'Bangkok Metropolitan', 'Krung Thep']) {
    assert.equal(scoreBreakdown(item({ ...day, city }), BKK).location, 40, city);
  }
  // Accents are folded, so a French spelling of the destination still matches.
  const zrh: Trip = { ...BKK, destinationCity: 'Zürich', destinationIata: 'ZRH', destinationCountry: 'CH' };
  assert.equal(scoreBreakdown(item({ ...day, city: 'Zurich', country: 'CH' }), zrh).location, 40);
});

test('the counts a scan reports, and nothing is linked without a trip', async () => {
  const items: GmailItem[] = [
    item({ id: 'a', kind: 'hotel', date: '2026-10-10', city: 'Bangkok', country: 'TH' }),      // auto
    item({ id: 'b', kind: 'restaurant', date: '2026-10-14', city: 'Bangkok', country: 'TH' }), // suggest
    item({ id: 'c', kind: 'hotel', date: '2026-10-10', city: 'Paris', country: 'FR' }),        // inbox
    item({ id: 'd', kind: 'hotel', city: 'Bangkok', country: 'TH' }),                          // inbox, no date
  ];
  const result = await autoLinkItems(items, [BKK, AMS]);
  assert.deepEqual(
    { auto: result.autoLinked, suggested: result.suggested, inbox: result.inbox },
    { auto: 1, suggested: 1, inbox: 2 },
  );
  assert.equal(result.plans.length, 4);
  assert.equal(result.plans[1]?.record?.linkedBy, 'suggestion', 'a suggestion records how it was linked');
  assert.equal(result.plans[2]?.record, undefined, 'nothing is recorded for an inbox item');
  assert.deepEqual(planLinks([], []), { autoLinked: 0, suggested: 0, inbox: 0, plans: [] });
});
