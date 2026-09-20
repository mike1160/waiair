import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_SEARCH_DAYS, searchWindowEnd } from './searchWindow.ts';

test('the search window is 30 days and ends at midnight of that day', () => {
  assert.equal(MAX_SEARCH_DAYS, 30);
  const from = new Date(2026, 8, 20, 14, 35, 12);
  const end = searchWindowEnd(from);
  assert.equal(end.getFullYear(), 2026);
  assert.equal(end.getMonth(), 9, 'October');
  assert.equal(end.getDate(), 20, '20 September + 30 days');
  assert.equal(end.getHours(), 0);
  assert.equal(end.getMinutes(), 0);
});

test('the window crosses months and years, and a shorter one can be asked for', () => {
  // A window that has to walk into the next year.
  const end = searchWindowEnd(new Date(2026, 11, 10), 30);
  assert.equal(end.getFullYear(), 2027);
  assert.equal(end.getMonth(), 0, 'January');
  assert.equal(end.getDate(), 9);
  // Ready for a shorter window for free users.
  assert.equal(searchWindowEnd(new Date(2026, 8, 20), 7).getDate(), 27);
  // Nonsense never moves the window backwards.
  assert.equal(searchWindowEnd(new Date(2026, 8, 20), -5).getDate(), 20);
});
