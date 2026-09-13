const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  HOUR_MS,
  USER_CALLS_PER_HOUR,
  GLOBAL_CALLS_PER_HOUR,
  createCostGuard,
  createResponseStore,
  isLimitError,
  limitError,
} = require('./costGuard.js');

function clock(start) {
  let t = start;
  return { now: () => t, advance: ms => { t += ms; } };
}

test('defaults match the budget: 10 per caller per hour, 500 per clock hour', () => {
  assert.equal(USER_CALLS_PER_HOUR, 10);
  assert.equal(GLOBAL_CALLS_PER_HOUR, 500);
});

test('per-caller limit: 10 calls in a rolling hour, then a friendly 429 with minutes to wait', () => {
  const c = clock(Date.UTC(2026, 8, 14, 10, 0));
  const guard = createCostGuard({ now: c.now });
  for (let i = 0; i < 10; i++) {
    guard.acquire('203.0.113.5');
    c.advance(60 * 1000);
  }
  // First call was 10 min ago → the oldest slot frees up in 50 minutes.
  assert.throws(() => guard.acquire('203.0.113.5'), err => {
    assert.equal(err.code, 'rate_limited');
    assert.equal(err.status, 429);
    assert.equal(err.retryAfterMin, 50);
    assert.equal(err.message, 'Try again in 50 minutes.');
    return true;
  });
  // Other callers are unaffected.
  guard.acquire('198.51.100.7');

  c.advance(50 * 60 * 1000);
  guard.acquire('203.0.113.5');
});

test('rejected calls do not use budget', () => {
  const c = clock(Date.UTC(2026, 8, 14, 10, 0));
  const guard = createCostGuard({ now: c.now, userLimit: 2 });
  guard.acquire('a');
  guard.acquire('a');
  assert.throws(() => guard.acquire('a'));
  assert.throws(() => guard.acquire('a'));
  assert.equal(guard.stats().hourCalls, 2);
});

test('global cost guard: pauses after 500 calls this clock hour, warns once, resets next hour', () => {
  const c = clock(Date.UTC(2026, 8, 14, 10, 45));
  const warnings = [];
  const guard = createCostGuard({ now: c.now, userLimit: 1000, globalLimit: 5, onGuardTripped: w => warnings.push(w) });
  for (let i = 0; i < 5; i++) guard.acquire(i % 2 ? 'a' : '');

  assert.throws(() => guard.acquire('b'), err => {
    assert.equal(err.code, 'cost_guard');
    assert.equal(err.status, 503);
    assert.equal(err.retryAfterMin, 15);
    assert.match(err.message, /Try again in 15 minutes\./);
    return true;
  });
  assert.throws(() => guard.acquire(''));
  assert.deepEqual(warnings, [{ calls: 5, limit: 5 }]);
  assert.equal(guard.stats().paused, true);

  c.advance(15 * 60 * 1000);
  guard.acquire('b');
  assert.equal(guard.stats().hourCalls, 1);
});

test('limit error helpers', () => {
  assert.equal(isLimitError(limitError('rate_limited', 0.2)), true);
  assert.equal(limitError('rate_limited', 0.2).message, 'Try again in 1 minute.');
  assert.equal(isLimitError(new Error('upstream')), false);
  assert.equal(isLimitError(null), false);
});

test('prune drops callers with no calls in the last hour', () => {
  const c = clock(Date.UTC(2026, 8, 14, 10, 0));
  const guard = createCostGuard({ now: c.now });
  guard.acquire('a');
  guard.acquire('b');
  c.advance(HOUR_MS);
  guard.prune();
  assert.equal(guard.stats().callers, 0);
});

test('response store keeps last good responses within age and size limits', () => {
  const c = clock(1_000_000);
  const store = createResponseStore({ now: c.now, maxAgeMs: 1000, maxBytes: 10 });
  store.remember('a', { at: c.now(), status: 200, text: 'aaaa' });
  store.remember('b', { at: c.now(), status: 200, text: 'bbbb' });
  assert.equal(store.get('a').text, 'aaaa');

  store.remember('c', { at: c.now(), status: 200, text: 'cccc' });
  assert.equal(store.get('a'), null);
  assert.equal(store.bytes(), 8);

  store.remember('b', { at: c.now(), status: 200, text: 'bb' });
  assert.equal(store.bytes(), 6);

  c.advance(1001);
  assert.equal(store.get('b'), null);
  store.prune();
  assert.equal(store.size(), 0);
  assert.equal(store.bytes(), 0);
});
