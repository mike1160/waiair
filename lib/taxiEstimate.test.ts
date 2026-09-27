import test from 'node:test';
import assert from 'node:assert/strict';

import { answerTaxiEstimate, formatTaxiRange, taxiRangeFor } from './taxiEstimate.ts';

const COPY = { taxiEstimate: (amount: string) => `Expect around ${amount} for a taxi` };

test('the airports this app lands at have a fare', () => {
  assert.deepEqual(taxiRangeFor('BKK'), { low: 300, high: 500, currency: 'THB' });
  assert.deepEqual(taxiRangeFor('NRT'), { low: 15000, high: 25000, currency: 'JPY' });
  assert.deepEqual(taxiRangeFor('dxb'), { low: 50, high: 80, currency: 'AED' });
  assert.deepEqual(taxiRangeFor(' ams '), { low: 40, high: 60, currency: 'EUR' });
});

test('every fare is a real range in a real currency', () => {
  for (const code of ['BKK', 'HKT', 'CNX', 'AMS', 'SIN', 'KUL', 'HKG', 'NRT', 'ICN', 'DXB']) {
    const r = taxiRangeFor(code);
    assert.ok(r, `${code} missing`);
    assert.ok(r.low > 0 && r.high > r.low, `${code} is not a range`);
    assert.match(r.currency, /^[A-Z]{3}$/, `${code} currency`);
  }
});

test('an airport we do not know says nothing rather than guessing', () => {
  // The question then goes out to be answered generally — never a made-up amount in cash.
  assert.equal(taxiRangeFor('LHR'), null);
  assert.equal(taxiRangeFor(''), null);
  assert.equal(taxiRangeFor(undefined), null);
  assert.equal(answerTaxiEstimate(COPY, 'LHR'), null);
});

test('the range reads as a range', () => {
  assert.equal(formatTaxiRange({ low: 300, high: 500, currency: 'THB' }), '300–500 THB');
  assert.equal(formatTaxiRange(null), '');
  assert.equal(formatTaxiRange({ low: NaN, high: 5, currency: 'EUR' }), '');
});

test('the sentence carries the range', () => {
  assert.equal(answerTaxiEstimate(COPY, 'BKK'), 'Expect around 300–500 THB for a taxi');
});
