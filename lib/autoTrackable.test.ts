import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTO_IMPORT_THRESHOLD, planImports } from './gmailImport.ts';
import { autoTrackable, parseImportText } from './flightImport.ts';

const NOW = Date.parse('2026-09-30T09:00:00Z');

test('[W/16d] a route is required, whatever the confidence says', () => {
  assert.equal(autoTrackable({ origin: 'AMS', destination: 'BKK' }), true);
  assert.equal(autoTrackable({ origin: 'AMS' }), false);
  assert.equal(autoTrackable({ destination: 'BKK' }), false);
  assert.equal(autoTrackable({}), false);
  assert.equal(autoTrackable({ origin: '  ', destination: 'BKK' }), false);
});

test('[W/16d] the promo flight that was auto-tracked now waits for review', () => {
  // The real shape: a flight-number-shaped token and a date in advertising copy, no route.
  const promo = parseImportText(
    'Save up to 40% on Checked Baggage. Fly AK123 to Bangkok from MYR 99 before 12 Oct 2026.',
    undefined, { from: 'news@airasia.com', source: 'gmail', now: NOW },
  );
  assert.equal(promo.length, 1);
  assert.ok(promo[0].confidence >= AUTO_IMPORT_THRESHOLD, 'it still scores high — that was never the fix');
  assert.equal(autoTrackable(promo[0]), false, 'but it cannot say where it goes');

  const plan = planImports([{ id: 'm', flights: promo, extras: {}, empty: false }], []);
  assert.deepEqual(plan.flightsAutoImport, [], 'so nothing is tracked without asking');
  assert.equal(plan.flightsPendingReview.length, 1, 'and it is offered on the discovery card');
  assert.ok(plan.flights.includes(promo[0]), 'still part of the plan: visible, not discarded');
});

test('[W/16d] a confirmation with a route is still tracked without asking', () => {
  const real = [{
    id: 'c1', flightNumber: 'TG208', dateIso: '2026-10-05', origin: 'HKT', destination: 'BKK',
    label: 'TG208', source: 'gmail' as const, confidence: 95,
  }];
  const plan = planImports([{ id: 'm2', flights: real, extras: {}, empty: false }], []);
  assert.equal(plan.flightsAutoImport.length, 1, 'unchanged for a real itinerary');
  assert.deepEqual(plan.flightsPendingReview, []);
});

test('[W/16d] a low-confidence candidate with a route still waits, as before', () => {
  const shaky = [{
    id: 'c2', flightNumber: 'TG208', dateIso: '2026-10-05', origin: 'HKT', destination: 'BKK',
    label: 'TG208', confidence: 40,
  }];
  const plan = planImports([{ id: 'm3', flights: shaky, extras: {}, empty: false }], []);
  assert.deepEqual(plan.flightsAutoImport, []);
  assert.equal(plan.flightsPendingReview.length, 1);
});
