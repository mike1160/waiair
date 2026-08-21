import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterAnomalousFares, type PricedFare } from './farePriceGuard.ts';

function fare(price: number, extra?: Partial<PricedFare>): PricedFare {
  return {
    origin: 'AMS',
    destination: 'LHR',
    departDate: '2026-08-21',
    price,
    ...extra,
  };
}

test('filters €14,853 outlier against ~€151 cluster on the same route and date', () => {
  const rows = [
    fare(151),
    fare(148),
    fare(155),
    fare(160),
    fare(149),
    fare(152),
    fare(147),
    fare(158),
    fare(14853),
  ];
  const kept = filterAnomalousFares(rows, {
    currency: 'eur',
    durationHours: () => 4,
  });
  const prices = kept.map(f => f.price);
  assert.equal(prices.includes(14853), false);
  assert.equal(prices.includes(151), true);
  assert.equal(kept.length, rows.length - 1);
});

test('hard-caps short-haul fares above €2,500 even without a cheap cluster', () => {
  const kept = filterAnomalousFares([fare(14853)], {
    currency: 'eur',
    durationHours: () => 2,
  });
  assert.deepEqual(kept, []);
});

test('keeps a lone long-haul fare that is not 5x a same-day median', () => {
  const rows = [fare(14853, { origin: 'AMS', destination: 'SIN' })];
  const kept = filterAnomalousFares(rows, {
    currency: 'eur',
    durationHours: () => 12,
  });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].price, 14853);
});
