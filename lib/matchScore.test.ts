import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tripFromFlight } from './gmailImport.ts';
import { stayEndYmd, type StayFlight } from './stayWindow.ts';
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

  // The night before landing, in the city the flight lands in [M/1]: an exact place is evidence on its own,
  // so the kind still counts and a booking a day either side of the trip links rather than waits.
  const before = item({ kind: 'hotel', date: '2026-10-09', city: 'Bangkok', country: 'TH' });
  assert.equal(matchScore(before, BKK), 85);
  assert.equal(linkDecision(85), 'auto');
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

test('9 — far outside the trip is offered, never linked on its own', () => {
  /*
   * A month after the return flight, in the right city. Before [M/1] the kind earned nothing outside the
   * trip and this landed in the inbox at 40. Now an exact city keeps its kind points, so it reaches 60 and
   * is offered — the date, which is what is actually wrong with it, is the thing that holds it back.
   */
  const later = item({ kind: 'hotel', date: '2026-11-20', city: 'Bangkok', country: 'TH' });
  const parts = scoreBreakdown(later, BKK);
  assert.deepEqual(parts, { date: 0, location: 40, type: 20, total: 60 });
  assert.equal(linkDecision(parts.total), 'suggest', 'offered, and well short of the 80 that links');

  // A place that is only probable still has to fall inside the trip before its kind counts for anything.
  const region = item({ kind: 'hotel', date: '2026-11-20', city: 'Don Mueang', country: 'TH' });
  const near = scoreBreakdown(region, BKK);
  assert.equal(near.type, 0, 'same region, months away: the kind proves nothing');
  assert.equal(linkDecision(near.total), 'inbox');
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

/* ── [M/1] Auto-link with a single tracked flight ──────────────────────────────────────────────────
 *
 * The whole chain, not the scorer alone: the stay window comes from stayEndYmd the way App.tsx builds it,
 * because the bug was never in the scoring — it was a trip one day long.
 */

const AMS_TO_BKK: StayFlight = {
  key: 'TG921|2026-10-10',
  scheduledTime: '2026-10-09T23:30:00+02:00',
  flight: {
    origin: 'AMS',
    destination: 'BKK',
    scheduledDeparture: '2026-10-09T23:30:00+02:00',
    scheduledArrival: '2026-10-10T16:05:00+07:00',
  },
};

const BKK_TO_AMS: StayFlight = {
  key: 'TG922|2026-10-17',
  scheduledTime: '2026-10-17T09:00:00+07:00',
  flight: {
    origin: 'BKK',
    destination: 'AMS',
    scheduledDeparture: '2026-10-17T09:00:00+07:00',
    scheduledArrival: '2026-10-17T16:30:00+02:00',
  },
};

/** The trip as the app builds it: matchableFlights() -> tripFromFlight(), stay window included. */
function tripFor(t: StayFlight, all: StayFlight[]): Trip {
  const trip = tripFromFlight({
    key: t.key,
    arrivalYmd: String(t.flight?.scheduledArrival || '').slice(0, 10),
    departureYmd: String(t.flight?.scheduledDeparture || '').slice(0, 10),
    destinationIata: 'BKK',
    destinationCity: 'Bangkok',
    destinationCountry: 'TH',
    endYmd: stayEndYmd(t, all),
  });
  assert.ok(trip);
  return trip!;
}

test('M/1 · 1 — one flight tracked, hotel checks in the day after landing: links itself', () => {
  const trip = tripFor(AMS_TO_BKK, [AMS_TO_BKK]);
  assert.equal(trip.endDate, '2026-10-24', 'a fortnight, where the trip used to be a single day');
  const hotel = item({ kind: 'hotel', date: '2026-10-11', city: 'Bangkok', country: 'TH' });
  const parts = scoreBreakdown(hotel, trip);
  assert.deepEqual(parts, { date: 25, location: 40, type: 20, total: 85 });
  assert.equal(linkDecision(parts.total), 'auto');
});

test('M/1 · 2 — one flight tracked, the hotel checkout ends the stay', () => {
  const withHotel: StayFlight = {
    ...AMS_TO_BKK,
    tripExtras: { hotel: { checkIn: '2026-10-10', checkOut: '2026-10-13' } },
  };
  const trip = tripFor(withHotel, [withHotel]);
  assert.equal(trip.endDate, '2026-10-13', 'the checkout, not the fortnight default');
  // Inside that window a mid-stay restaurant still reaches the offer band: two days out is 15 on the date.
  const dinner = item({ kind: 'restaurant', date: '2026-10-12', city: 'Bangkok', country: 'TH' });
  assert.deepEqual(scoreBreakdown(dinner, trip), { date: 15, location: 40, type: 15, total: 70 });
  assert.equal(linkDecision(70), 'suggest');
});

test('M/1 · 3 — one flight tracked, restaurant mid-trip in the right city: offered, not linked', () => {
  const trip = tripFor(AMS_TO_BKK, [AMS_TO_BKK]);
  const dinner = item({ kind: 'restaurant', date: '2026-10-14', city: 'Bangkok', country: 'TH' });
  const parts = scoreBreakdown(dinner, trip);
  assert.deepEqual(parts, { date: 10, location: 40, type: 15, total: 65 });
  assert.equal(linkDecision(parts.total), 'suggest');
  assert.ok(parts.total >= SUGGEST_MIN && parts.total < AUTO_LINK_MIN);
});

test('M/1 · 4 — the wrong city stays in the inbox, single flight or not', () => {
  const trip = tripFor(AMS_TO_BKK, [AMS_TO_BKK]);
  const paris = item({ kind: 'hotel', date: '2026-10-11', city: 'Paris', country: 'FR' });
  const parts = scoreBreakdown(paris, trip);
  assert.deepEqual(parts, { date: 25, location: 0, type: 0, total: 25 });
  assert.equal(linkDecision(parts.total), 'inbox');
});

test('M/1 · 5 — three months out in the right city is never linked', () => {
  const trip = tripFor(AMS_TO_BKK, [AMS_TO_BKK]);
  const far = item({ kind: 'hotel', date: '2027-01-11', city: 'Bangkok', country: 'TH' });
  const parts = scoreBreakdown(far, trip);
  // The kind counts on an exact city, but the date says nothing, so it is offered and never attached.
  assert.deepEqual(parts, { date: 0, location: 40, type: 20, total: 60 });
  assert.equal(linkDecision(parts.total), 'suggest');
  assert.ok(parts.total < AUTO_LINK_MIN, 'no auto-link, so a next winter’s hotel cannot attach itself');
});

test('M/1 · 6 — with the flight home tracked, nothing about the old behaviour changed', () => {
  const trip = tripFor(AMS_TO_BKK, [AMS_TO_BKK, BKK_TO_AMS]);
  assert.equal(trip.startDate, '2026-10-10');
  assert.equal(trip.endDate, '2026-10-17', 'the tracked return leg, exactly as before');
  // The same three bookings as the old suite: landing day, day after, mid-trip.
  assert.equal(matchScore(item({ kind: 'hotel', date: '2026-10-10', city: 'Bangkok', country: 'TH' }), trip), 100);
  assert.equal(matchScore(item({ kind: 'hotel', date: '2026-10-11', city: 'Bangkok', country: 'TH' }), trip), 85);
  assert.equal(matchScore(item({ kind: 'restaurant', date: '2026-10-14', city: 'Bangkok', country: 'TH' }), trip), 65);
  const car = item({ kind: 'carRental', date: '2026-10-10', airportIata: 'BKK', country: 'TH' });
  assert.equal(matchScore(car, trip), 100);
});
