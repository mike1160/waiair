import test from 'node:test';
import assert from 'node:assert/strict';

import { askBriefing, briefingPayload } from './briefingClient.ts';

const FACTS = {
  number: 'TG208', origin: 'hkt', destination: 'bkk',
  departureTime: '2026-09-27T13:00:00+07:00', arrivalTime: '2026-09-27T14:47:00+07:00',
  status: 'scheduled', delayMinutes: 0, phase: 'departure',
  temp: 26, condition: 'Rain', destinationCity: 'Bangkok', language: 'NL',
};

test('the payload is the journey, normalised', () => {
  const p = briefingPayload(FACTS, 'Hoe druk is het verkeer?');
  assert.equal(p.flight.number, 'TG208');
  assert.equal(p.flight.origin, 'HKT');
  assert.equal(p.flight.destination, 'BKK');
  assert.equal(p.phase, 'DEPARTURE');
  assert.equal(p.language, 'nl');
  assert.deepEqual(p.weather, { temp: 26, condition: 'Rain' });
  assert.equal(p.question, 'Hoe druk is het verkeer?');
});

test('[privacy] the payload has exactly these fields and no others', () => {
  const p = briefingPayload(FACTS, 'q') as Record<string, unknown>;
  assert.deepEqual(Object.keys(p).sort(),
    ['destinationCity', 'flight', 'language', 'phase', 'question', 'weather']);
  assert.deepEqual(Object.keys(p.flight as object).sort(),
    ['arrivalTime', 'delayMinutes', 'departureTime', 'destination', 'number', 'origin', 'status']);
});

test('[privacy] extra facts handed in are dropped, not forwarded', () => {
  const p = briefingPayload({
    ...FACTS,
    // Nothing here is on the list, so none of it can survive.
    hotelAddress: '123 Sukhumvit Road',
    passengerName: 'M. Kleinjans',
    gmailBody: 'your e-ticket EPDC6Y',
  } as never, 'q');
  const json = JSON.stringify(p);
  for (const leaked of ['Sukhumvit', 'Kleinjans', 'EPDC6Y', 'hotelAddress', 'gmailBody']) {
    assert.ok(!json.includes(leaked), `${leaked} must never be sent`);
  }
});

test('missing weather is null, not zero', () => {
  assert.deepEqual(briefingPayload({ ...FACTS, temp: undefined }, 'q').weather, { temp: null, condition: 'Rain' });
  assert.equal(briefingPayload({ ...FACTS, temp: 0 }, 'q').weather.temp, 0);
});

test('a long question is cut to the limit', () => {
  assert.equal(briefingPayload(FACTS, 'x'.repeat(5000)).question.length, 300);
});

test('an answer comes back as the answer', async () => {
  const out = await askBriefing(FACTS, 'q', {
    base: 'https://x.test',
    fetchImpl: (async () => ({ ok: true, status: 200, json: async () => ({ answer: 'Het is rustig.' }) })) as never,
  });
  assert.deepEqual(out, { ok: true, answer: 'Het is rustig.' });
});

test('no key on the proxy reads as unavailable, not as a failure', async () => {
  const out = await askBriefing(FACTS, 'q', {
    base: 'https://x.test',
    fetchImpl: (async () => ({ ok: false, status: 503, json: async () => ({}) })) as never,
  });
  assert.deepEqual(out, { ok: false, reason: 'unavailable' });
});

test('anything else is an error, and never an invented answer', async () => {
  for (const impl of [
    async () => ({ ok: false, status: 502, json: async () => ({}) }),
    async () => ({ ok: true, status: 200, json: async () => ({ answer: '' }) }),
    async () => { throw new Error('offline'); },
  ]) {
    const out = await askBriefing(FACTS, 'q', { base: 'https://x.test', fetchImpl: impl as never });
    assert.deepEqual(out, { ok: false, reason: 'error' });
  }
});

test('an empty question never reaches the network', async () => {
  let called = false;
  const out = await askBriefing(FACTS, '  ', {
    base: 'https://x.test',
    fetchImpl: (async () => { called = true; }) as never,
  });
  assert.deepEqual(out, { ok: false, reason: 'error' });
  assert.equal(called, false);
});

test('it gives up rather than hanging', async () => {
  const out = await askBriefing(FACTS, 'q', {
    base: 'https://x.test',
    timeoutMs: 20,
    fetchImpl: ((_u: string, init: { signal: AbortSignal }) => new Promise((_res, rej) => {
      init.signal.addEventListener('abort', () => rej(new Error('aborted')));
    })) as never,
  });
  assert.deepEqual(out, { ok: false, reason: 'error' });
});
