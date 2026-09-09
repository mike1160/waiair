import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatFlightNumber } from './flightIdent.ts';

test('8-character flight number stays one token without wrap', () => {
  const n = formatFlightNumber({ number: 'TG400707' });
  assert.equal(n, 'TG400707');
  assert.equal(n.length, 8);
  assert.equal(n.includes('\n'), false);
  assert.equal(n.includes(' '), false);
});

test('codeshare keeps a single-line slash form', () => {
  const n = formatFlightNumber({ number: 'OZ747', operatingNumber: 'KL645' });
  assert.equal(n, 'OZ747 / KL645');
  assert.equal(n.includes('\n'), false);
});
