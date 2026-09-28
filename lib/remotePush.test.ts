import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isExpoPushToken,
  PUSH_RETRY_ATTEMPTS,
  pushRegisterPayload,
  pushSyncPayload,
  pushUnregisterPayload,
  registerPushForFlight,
  slugPushFlight,
  syncPushForTrackedFlights,
  unregisterPushForFlight,
} from './remotePush.ts';

/** Nothing in these tests waits for a real backoff. */
const NO_WAIT = { delayMs: 0, sleep: async () => {} };

test('slug and Expo token checks', () => {
  assert.equal(slugPushFlight('tg 403'), 'TG403');
  assert.equal(isExpoPushToken('ExponentPushToken[abc]'), true);
  assert.equal(isExpoPushToken('not-a-token'), false);
});

test('register payload includes token + flightNumber + platform', () => {
  assert.deepEqual(pushRegisterPayload('ExponentPushToken[abc]', 'kl 644', 'ios'), {
    token: 'ExponentPushToken[abc]',
    flightNumber: 'KL644',
    platform: 'ios',
  });
  assert.deepEqual(pushUnregisterPayload('ExponentPushToken[abc]', 'KL644'), {
    token: 'ExponentPushToken[abc]',
    flightNumber: 'KL644',
  });
});

test('registerPushForFlight POSTs to /push/register', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init: init || {} });
    return { ok: true, status: 200 } as Response;
  }) as typeof fetch;
  const ok = await registerPushForFlight({
    proxy: 'https://waiair-production.up.railway.app/',
    token: 'ExponentPushToken[abc]',
    flightNumber: 'BR 75',
    platform: 'ios',
    fetchImpl,
  });
  assert.equal(ok, true);
  assert.equal(calls[0].url, 'https://waiair-production.up.railway.app/push/register');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    token: 'ExponentPushToken[abc]',
    flightNumber: 'BR75',
    platform: 'ios',
  });
});

test('unregisterPushForFlight DELETEs token for that flight', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init: init || {} });
    return { ok: true, status: 200 } as Response;
  }) as typeof fetch;
  const ok = await unregisterPushForFlight({
    proxy: 'https://example.test',
    token: 'ExponentPushToken[abc]',
    flightNumber: 'BR75',
    fetchImpl,
  });
  assert.equal(ok, true);
  assert.equal(calls[0].init.method, 'DELETE');
});

/** A fetch that fails `failures` times and then succeeds, recording every call. */
function flakyFetch(failures: number, calls: { url: string; init: RequestInit }[]) {
  let seen = 0;
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init: init || {} });
    seen += 1;
    return { ok: seen > failures, status: seen > failures ? 200 : 503 } as Response;
  }) as typeof fetch;
}

test('[W/1] the sync sends the whole tracked set in one authoritative request', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = await syncPushForTrackedFlights({
    proxy: 'https://example.test/',
    token: 'ExponentPushToken[abc]',
    flightNumbers: ['KL644', 'tg403', 'KL 644'],
    platform: 'ios',
    fetchImpl: flakyFetch(0, calls),
  });
  assert.equal(ok, true);
  assert.equal(calls.length, 1, 'one request, not one per flight');
  assert.equal(calls[0].url, 'https://example.test/push/sync');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    token: 'ExponentPushToken[abc]',
    flightNumbers: ['KL644', 'TG403'],
    platform: 'ios',
  });
});

test('[W/1] an empty tracked set is still sent: it is how the last unfollow is honoured', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = await syncPushForTrackedFlights({
    proxy: 'https://example.test',
    token: 'ExponentPushToken[abc]',
    flightNumbers: [],
    fetchImpl: flakyFetch(0, calls),
  });
  assert.equal(ok, true);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)).flightNumbers, []);
});

test('[W/1] the payload dedupes and normalises, and omits an absent platform', () => {
  assert.deepEqual(pushSyncPayload(' ExponentPushToken[abc] ', ['br 75', 'BR-75', '', 'tg403']), {
    token: 'ExponentPushToken[abc]',
    flightNumbers: ['BR75', 'TG403'],
  });
});

test('[W/1] a failed unregister is retried rather than dropped', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = await unregisterPushForFlight({
    proxy: 'https://example.test',
    token: 'ExponentPushToken[abc]',
    flightNumber: 'TG208',
    fetchImpl: flakyFetch(2, calls),
    retry: NO_WAIT,
  });
  assert.equal(ok, true, 'the third attempt landed');
  assert.equal(calls.length, 3);
  for (const c of calls) assert.equal(c.init.method, 'DELETE');
});

test('[W/1] retries are bounded, and a thrown fetch is a failure like any other', async () => {
  let attempts = 0;
  const throwing = (async () => { attempts += 1; throw new Error('offline'); }) as unknown as typeof fetch;
  const ok = await unregisterPushForFlight({
    proxy: 'https://example.test',
    token: 'ExponentPushToken[abc]',
    flightNumber: 'TG208',
    fetchImpl: throwing,
    retry: NO_WAIT,
  });
  assert.equal(ok, false);
  assert.equal(attempts, PUSH_RETRY_ATTEMPTS);
});

test('[W/1] the backoff grows, and is waited on between attempts only', async () => {
  const waits: number[] = [];
  await unregisterPushForFlight({
    proxy: 'https://example.test',
    token: 'ExponentPushToken[abc]',
    flightNumber: 'TG208',
    fetchImpl: (async () => ({ ok: false, status: 500 }) as Response) as typeof fetch,
    retry: { attempts: 3, delayMs: 10, sleep: async ms => { waits.push(ms); } },
  });
  assert.deepEqual(waits, [10, 20], 'no wait after the final attempt');
});

test('[W/1] nothing is sent without a usable token or proxy', async () => {
  let called = false;
  const fetchImpl = (async () => { called = true; return { ok: true, status: 200 } as Response; }) as typeof fetch;
  assert.equal(await syncPushForTrackedFlights({
    proxy: 'https://example.test', token: 'nope', flightNumbers: ['KL644'], fetchImpl,
  }), false);
  assert.equal(await syncPushForTrackedFlights({
    proxy: '', token: 'ExponentPushToken[abc]', flightNumbers: ['KL644'], fetchImpl,
  }), false);
  assert.equal(called, false);
});
