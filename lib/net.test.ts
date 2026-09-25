import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FLIGHT_SEARCH_TIMEOUT_MS,
  HOME_FIDS_TIMEOUT_MS,
  RateLimitError,
  TimeoutError,
  fetchJsonRetry,
  isRateLimitError,
  rateLimitFromResponse,
  withTimeout,
} from './net.ts';

test('home FIDS lookups share a 20s budget including body read', async () => {
  assert.equal(HOME_FIDS_TIMEOUT_MS, 20000);
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 20),
    (e: unknown) => e instanceof TimeoutError || (e as { name?: string })?.name === 'TimeoutError',
  );
});

test('a flight-number search gives up even when its fetch never settles', async () => {
  // Longer than everything it wraps: 3 attempts of 8s plus backoff is 25.2s, 28.5s when asked to wait.
  // A deadline under that stops searches a few seconds before they would have answered.
  assert.equal(FLIGHT_SEARCH_TIMEOUT_MS, 30000);
  assert.ok(FLIGHT_SEARCH_TIMEOUT_MS > 28_500, 'the deadline must outlast the retry chain it guards');
  // The real failure this guards: a network task that vanishes without calling back. Aborting it rejects
  // nothing, so only a race around the lookup can end the spinner.
  const orphaned = new Promise<never>(() => {});
  const started = Date.now();
  await assert.rejects(
    () => withTimeout(orphaned, 30),
    (e: unknown) => e instanceof TimeoutError,
  );
  assert.ok(Date.now() - started < 3000, 'the caller is free at once, not after the retries it never gets');
});

/** Replaces global fetch with a queue of { status, body } answers; returns the URLs requested. */
function stubFetch(answers: { status: number; body: unknown }[]) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    const a = answers.shift() ?? { status: 500, body: {} };
    const text = typeof a.body === 'string' ? a.body : JSON.stringify(a.body);
    return { status: a.status, ok: a.status >= 200 && a.status < 300, text: async () => text } as Response;
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('rateLimitFromResponse: proxy 429 and cost-guard 503 carry retryAfterMin; other statuses are not limits', () => {
  const perCaller = rateLimitFromResponse(429, JSON.stringify({ error: 'rate_limited', retryAfterMin: 59 }));
  assert.ok(perCaller instanceof RateLimitError);
  assert.equal(perCaller?.retryAfterMin, 59);
  assert.equal(perCaller?.status, 429);
  assert.equal(rateLimitFromResponse(503, JSON.stringify({ error: 'cost_guard', retryAfterMin: 12.2 }))?.retryAfterMin, 13);
  assert.equal(rateLimitFromResponse(429, 'Too Many Requests')?.retryAfterMin, null);
  assert.equal(rateLimitFromResponse(503, JSON.stringify({ error: 'aerodatabox_unconfigured' })), null);
  assert.equal(rateLimitFromResponse(502, JSON.stringify({ error: 'upstream_failed' })), null);
  assert.equal(rateLimitFromResponse(200, '[]'), null);
});

test('fetchJsonRetry: a proxy budget limit of minutes throws RateLimitError after one request, no retries', async () => {
  const { calls, restore } = stubFetch([
    { status: 429, body: { error: 'rate_limited', message: 'Try again in 59 minutes.', retryAfterMin: 59 } },
    { status: 200, body: [] },
  ]);
  try {
    await assert.rejects(fetchJsonRetry('https://proxy/fids/HKG/arrival?date=2026-09-14'), (e: unknown) => (
      isRateLimitError(e) && e.retryAfterMin === 59 && e.status === 429
    ));
    assert.equal(calls.length, 1);
  } finally {
    restore();
  }
});

test('fetchJsonRetry: cost-guard 503 also stops at once', async () => {
  const { calls, restore } = stubFetch([{ status: 503, body: { error: 'cost_guard', retryAfterMin: 20 } }]);
  try {
    await assert.rejects(fetchJsonRetry('https://proxy/fids/HKT/departure'), (e: unknown) => isRateLimitError(e) && e.status === 503);
    assert.equal(calls.length, 1);
  } finally {
    restore();
  }
});

test('fetchJsonRetry: ordinary failures still retry, and a later success is returned', async () => {
  const { calls, restore } = stubFetch([
    { status: 502, body: { error: 'upstream_failed' } },
    { status: 200, body: { departures: [{ number: 'TG 603' }] } },
  ]);
  try {
    const json = await fetchJsonRetry('https://proxy/fids/HKT/departure');
    assert.deepEqual(json, { departures: [{ number: 'TG 603' }] });
    assert.equal(calls.length, 2);
  } finally {
    restore();
  }
});

test('the loser of a race never becomes an unhandled rejection', async () => {
  // The deadline wins, and the fetch it outran rejects seconds later with nobody waiting on it. Unhandled,
  // that is a crash on a release build rather than a warning — which is how a search took the app down.
  const seen: unknown[] = [];
  const onUnhandled = (reason: unknown) => seen.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    let boom: (e: Error) => void = () => {};
    const slow = new Promise<never>((_, reject) => { boom = reject; });
    await assert.rejects(() => withTimeout(slow, 10), (e: unknown) => e instanceof TimeoutError);
    // The loser arrives late, as the retry chain does.
    boom(new Error('HTTP 500'));
    await new Promise(r => setTimeout(r, 50));
    assert.deepEqual(seen, [], 'the late rejection was handled');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('a race the promise wins still answers with its value', async () => {
  assert.equal(await withTimeout(Promise.resolve('ok'), 1000), 'ok');
  await assert.rejects(() => withTimeout(Promise.reject(new Error('nope')), 1000), /nope/);
});
