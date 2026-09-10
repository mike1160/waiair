import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTimeoutLike, searchTimeoutKind } from './searchTimeout.ts';
import { TimeoutError } from './net.ts';

test('health up + flights timeout is slow data, not the user connection', () => {
  assert.equal(searchTimeoutKind(true), 'slow');
  assert.equal(searchTimeoutKind(false), 'timeout');
});

test('timeout-like covers Abort/504/TimeoutError', () => {
  assert.equal(isTimeoutLike(new TimeoutError()), true);
  assert.equal(isTimeoutLike({ name: 'AbortError' }), true);
  assert.equal(isTimeoutLike({ status: 504, code: 'UPSTREAM_TIMEOUT' }), true);
  assert.equal(isTimeoutLike(new Error('nope')), false);
});
