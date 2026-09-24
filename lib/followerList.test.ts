import assert from 'node:assert/strict';
import { test } from 'node:test';
import { followerAge, sortFollowers } from './followerList.ts';

const NOW = Date.parse('2026-09-24T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

test('how long someone has been following', () => {
  assert.deepEqual(followerAge(NOW - 60_000, NOW), { kind: 'justNow' }, 'a minute ago is simply new');
  assert.deepEqual(followerAge(NOW - 59 * 60_000, NOW), { kind: 'justNow' });
  assert.deepEqual(followerAge(NOW - HOUR, NOW), { kind: 'hours', n: 1 });
  assert.deepEqual(followerAge(NOW - 5 * HOUR, NOW), { kind: 'hours', n: 5 });
  assert.deepEqual(followerAge(NOW - 23 * HOUR, NOW), { kind: 'hours', n: 23 });
  assert.deepEqual(followerAge(NOW - DAY, NOW), { kind: 'days', n: 1 });
  assert.deepEqual(followerAge(NOW - 2 * DAY - 3 * HOUR, NOW), { kind: 'days', n: 2 }, 'rounded down');
  assert.deepEqual(followerAge(NOW - 30 * DAY, NOW), { kind: 'days', n: 30 });
});

test('a missing or impossible timestamp never reads as a long time', () => {
  assert.deepEqual(followerAge(0, NOW), { kind: 'justNow' }, 'no timestamp is not 20,000 days');
  assert.deepEqual(followerAge(NOW + HOUR, NOW), { kind: 'justNow' }, 'a clock ahead of ours is not negative days');
  assert.deepEqual(followerAge(Number.NaN, NOW), { kind: 'justNow' });
});

test('followers are listed oldest first', () => {
  const list = [
    { id: 'c', name: 'Pim', since: NOW - HOUR },
    { id: 'a', name: 'Mama', since: NOW - 3 * DAY },
    { id: 'b', name: null, since: NOW - DAY },
  ];
  assert.deepEqual(sortFollowers(list).map(f => f.id), ['a', 'b', 'c']);
  // The input is left alone: the sheet keeps its own copy while a revoke is in flight.
  assert.deepEqual(list.map(f => f.id), ['c', 'a', 'b']);
  assert.deepEqual(sortFollowers([]), []);
});
