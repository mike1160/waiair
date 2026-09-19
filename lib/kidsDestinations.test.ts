import test from 'node:test';
import assert from 'node:assert/strict';
import { kidsDestinations } from './kidsDestinations.ts';

test('kidsDestinations: Thailand gets Phuket, Singapore and Chiang Mai', () => {
  assert.deepEqual(kidsDestinations('TH'), { beach: 'HKT', city: 'SIN', adventure: 'CNX' });
  assert.deepEqual(kidsDestinations('th'), { beach: 'HKT', city: 'SIN', adventure: 'CNX' });
});

test('kidsDestinations: Europe and unknown homes get Mallorca, Paris and Iceland', () => {
  assert.deepEqual(kidsDestinations('NL'), { beach: 'PMI', city: 'CDG', adventure: 'KEF' });
  assert.deepEqual(kidsDestinations(null), { beach: 'PMI', city: 'CDG', adventure: 'KEF' });
});

test('kidsDestinations: other Asian homes share the Asia picks, and no pick is the home itself', () => {
  assert.equal(kidsDestinations('SG').beach, 'HKT');
  assert.notEqual(kidsDestinations('JP').city, 'NRT');
  assert.notEqual(kidsDestinations('KR').city, 'ICN');
});
