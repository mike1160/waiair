import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyLookupError, isTimeoutLike, searchTimeoutKind } from './searchTimeout.ts';
import { RateLimitError, TimeoutError } from './net.ts';

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

test('lookup errors: a budget limit keeps its minutes, timeouts get classified, anything else is a failure', () => {
  assert.deepEqual(classifyLookupError(new RateLimitError(429, 59)), { kind: 'rateLimited', retryAfterMin: 59 });
  assert.deepEqual(classifyLookupError(new RateLimitError(503, null)), { kind: 'rateLimited', retryAfterMin: null });
  assert.deepEqual(classifyLookupError(new TimeoutError()), { kind: 'timeout' });
  assert.deepEqual(classifyLookupError(new Error('HTTP 502')), { kind: 'failed' });
});
