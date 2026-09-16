import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isExpoPushToken,
  pushRegisterPayload,
  pushUnregisterPayload,
  registerPushForFlight,
  slugPushFlight,
  syncPushForTrackedFlights,
  unregisterPushForFlight,
} from './remotePush.ts';

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

test('syncPushForTrackedFlights registers every tracked number', async () => {
  const flights: string[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    flights.push(body.flightNumber);
    return { ok: true, status: 200 } as Response;
  }) as typeof fetch;
  const n = await syncPushForTrackedFlights({
    proxy: 'https://example.test',
    token: 'ExponentPushToken[abc]',
    flightNumbers: ['KL644', 'tg403'],
    fetchImpl,
  });
  assert.equal(n, 2);
  assert.deepEqual(flights, ['KL644', 'TG403']);
});
