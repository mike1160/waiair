import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrivalTzDeltaMinutes, formatSignedTzDelta } from './tzDelta.ts';

test('tz chip formats signed hours and half hours, hides same zone', () => {
  assert.equal(formatSignedTzDelta(0), null);
  assert.equal(formatSignedTzDelta(120), '+2 h');
  assert.equal(formatSignedTzDelta(-120), '-2 h');
  assert.equal(formatSignedTzDelta(330), '+5:30 h');
  assert.equal(formatSignedTzDelta(-90), '-1:30 h');
  assert.equal(formatSignedTzDelta(30), '+0:30 h');
});

test('BKK → HND is +2 h; same city hides', () => {
  const bkkHnd = arrivalTzDeltaMinutes('BKK', 'HND', 'TH', 'JP');
  assert.equal(formatSignedTzDelta(bkkHnd), '+2 h');
  assert.equal(arrivalTzDeltaMinutes('BKK', 'HKT', 'TH', 'TH'), 0);
  const bkkDel = arrivalTzDeltaMinutes('BKK', 'DEL', 'TH', 'IN');
  assert.equal(formatSignedTzDelta(bkkDel), '-1:30 h');
});
