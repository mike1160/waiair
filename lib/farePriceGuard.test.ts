import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alignQuotedPrice, filterAnomalousFares, type PricedFare } from './farePriceGuard.ts';

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

test('drops cached teaser fares far below a realistic return cluster', () => {
  const rows = [
    fare(424, { departDate: '2026-08-23' }),
    fare(424, { departDate: '2026-08-24' }),
    fare(453, { departDate: '2026-08-23' }),
    fare(2045, { origin: 'AMS', destination: 'ICN', departDate: '2026-08-21' }),
  ];
  const kept = filterAnomalousFares(rows, { currency: 'eur', durationHours: () => 11 });
  const prices = kept.map(f => f.price);
  assert.equal(prices.includes(424), false);
  assert.equal(prices.includes(453), false);
  assert.equal(prices.includes(2045), true);
});

test('converts a THB quote that arrived labeled as euros', () => {
  const eur = alignQuotedPrice(81287, 'eur', 'thb');
  assert.ok(eur > 1500 && eur < 3500, String(eur));
});

test('leaves a real euro amount untouched', () => {
  assert.equal(alignQuotedPrice(2045, 'eur', 'thb'), 2045);
});
