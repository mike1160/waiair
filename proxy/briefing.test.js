const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  MODEL,
  MAX_TOKENS_DEFAULT,
  MAX_TOKENS_LIMIT,
  TEMPERATURE,
  safeContext,
  systemPrompt,
  answerFrom,
  airportLabel,
  createBriefing,
} = require('./briefing');

const QUIET = { warn() {}, error() {}, log() {} };

const BODY = {
  flight: {
    number: 'TG208',
    origin: 'HKT',
    destination: 'BKK',
    departureTime: '2026-09-27T13:00:00+07:00',
    arrivalTime: '2026-09-27T14:47:00+07:00',
    status: 'scheduled',
    delayMinutes: 0,
  },
  phase: 'DEPARTURE',
  weather: { temp: 26, condition: 'Rain' },
  destinationCity: 'Bangkok',
  language: 'nl',
  question: 'Hoe druk is het verkeer naar het vliegveld?',
};

function okFetch(text, capture) {
  return async (url, init) => {
    if (capture) capture.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }] }) };
  };
}

test('a question is answered, and says it came from the model', async () => {
  const calls = [];
  const briefing = createBriefing({ apiKey: 'k', fetchImpl: okFetch('Het is druk op de Rama IX.', calls), log: QUIET });
  const out = await briefing.ask(BODY);
  assert.deepEqual(out, { answer: 'Het is druk op de Rama IX.', source: 'ai' });
  assert.equal(calls.length, 1);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.model, MODEL);
  assert.equal(sent.temperature, TEMPERATURE);
  assert.equal(sent.max_tokens, MAX_TOKENS_DEFAULT);
  assert.deepEqual(sent.messages, [{ role: 'user', content: BODY.question }]);
});

test('the key is sent as a header and never in the body', async () => {
  const calls = [];
  const briefing = createBriefing({ apiKey: 'secret-key', fetchImpl: okFetch('ok', calls), log: QUIET });
  await briefing.ask(BODY);
  assert.equal(calls[0].init.headers['x-api-key'], 'secret-key');
  assert.equal(calls[0].init.headers['anthropic-version'], '2023-06-01');
  assert.ok(!calls[0].init.body.includes('secret-key'));
});

test('the prompt carries the journey and nothing else', () => {
  const prompt = systemPrompt(safeContext(BODY));
  for (const wanted of ['TG208', 'HKT → BKK', 'Status: scheduled', 'Delay: 0 minutes', '26°, Rain', 'Bangkok', 'DEPARTURE']) {
    assert.ok(prompt.includes(wanted), `prompt should carry ${wanted}`);
  }
  assert.ok(prompt.includes('Dutch'), 'the answer is asked for in the traveller\'s language');
});

test('[privacy] nothing a caller adds can reach the prompt', async () => {
  // The whole point: a request may carry anything; the prompt is built from a fixed list.
  const calls = [];
  const briefing = createBriefing({ apiKey: 'k', fetchImpl: okFetch('ok', calls), log: QUIET });
  await briefing.ask({
    ...BODY,
    gmailBody: 'Dear Mike Kleinjans, your e-ticket EPDC6Y is attached',
    hotelAddress: '123 Sukhumvit Road, Bangkok',
    passengerName: 'M. Kleinjans',
    email: 'someone@example.com',
    flight: { ...BODY.flight, bookingRef: 'EPDC6Y', passenger: 'M. Kleinjans' },
  });
  const sent = calls[0].init.body;
  for (const leaked of ['Kleinjans', 'EPDC6Y', 'Sukhumvit', 'someone@example.com', 'gmailBody', 'hotelAddress']) {
    assert.ok(!sent.includes(leaked), `${leaked} must never leave the proxy`);
  }
});

test('[privacy] nothing is logged — not the question, not the answer', async () => {
  const lines = [];
  const log = { warn: (...a) => lines.push(a.join(' ')), error: () => {}, log: () => {} };
  const briefing = createBriefing({
    apiKey: 'k',
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    log,
  });
  await briefing.ask(BODY);
  assert.deepEqual(lines, ['[briefing] HTTP 500'], 'a status code, and nothing else');
  for (const l of lines) {
    assert.ok(!l.includes('verkeer'), 'the question must not be logged');
    assert.ok(!l.includes('TG208'), 'the flight must not be logged');
  }
});

test('without a key the endpoint says so instead of pretending', async () => {
  let called = false;
  const briefing = createBriefing({ apiKey: '', fetchImpl: async () => { called = true; }, log: QUIET });
  assert.deepEqual(await briefing.ask(BODY), { error: 'unavailable' });
  assert.equal(called, false, 'and does not call anything');
});

test('an empty question is refused before any call is made', async () => {
  let called = false;
  const briefing = createBriefing({ apiKey: 'k', fetchImpl: async () => { called = true; }, log: QUIET });
  assert.deepEqual(await briefing.ask({ ...BODY, question: '   ' }), { error: 'no_question' });
  assert.deepEqual(await briefing.ask({}), { error: 'no_question' });
  assert.equal(called, false);
});

test('eight seconds and no longer', async () => {
  const briefing = createBriefing({
    apiKey: 'k',
    timeoutMs: 20,
    fetchImpl: (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    }),
    log: QUIET,
  });
  assert.deepEqual(await briefing.ask(BODY), { error: 'timeout' });
});

test('an upstream failure is an error, never a made-up answer', async () => {
  const bad = createBriefing({
    apiKey: 'k',
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
    log: QUIET,
  });
  assert.deepEqual(await bad.ask(BODY), { error: 'upstream' });

  const thrown = createBriefing({ apiKey: 'k', fetchImpl: async () => { throw new Error('socket'); }, log: QUIET });
  assert.deepEqual(await thrown.ask(BODY), { error: 'failed' });

  const empty = createBriefing({
    apiKey: 'k',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ content: [] }) }),
    log: QUIET,
  });
  assert.deepEqual(await empty.ask(BODY), { error: 'empty' });
});

test('the token ceiling cannot be raised from outside', async () => {
  const calls = [];
  const briefing = createBriefing({ apiKey: 'k', fetchImpl: okFetch('ok', calls), log: QUIET });
  await briefing.ask({ ...BODY, maxTokens: 999999 });
  assert.equal(JSON.parse(calls[0].init.body).max_tokens, MAX_TOKENS_LIMIT);
});

test('a question longer than the limit is cut, not refused', async () => {
  const calls = [];
  const briefing = createBriefing({ apiKey: 'k', fetchImpl: okFetch('ok', calls), log: QUIET });
  await briefing.ask({ ...BODY, question: 'x'.repeat(5000) });
  assert.equal(JSON.parse(calls[0].init.body).messages[0].content.length, 300);
});

test('an unknown language falls back to English rather than passing a code through', () => {
  assert.equal(safeContext({ language: 'xx' }).language, 'en');
  assert.equal(safeContext({ language: 'NL' }).language, 'nl');
  assert.equal(safeContext({}).language, 'en');
});

test('missing weather reads as unknown, not as zero degrees', () => {
  assert.ok(systemPrompt(safeContext({ ...BODY, weather: {} })).includes('Weather at destination: unknown'));
  assert.ok(systemPrompt(safeContext({ ...BODY, weather: { temp: 0, condition: 'Snow' } })).includes('0°, Snow'));
});

test('the answer is read out of the content blocks', () => {
  assert.equal(answerFrom({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }), 'a b');
  assert.equal(answerFrom({ content: [{ type: 'tool_use' }] }), '');
  assert.equal(answerFrom({}), '');
  assert.equal(answerFrom(null), '');
});

test('[T/1] the prompt says what WaiAir is, and is not', () => {
  const prompt = systemPrompt(safeContext(BODY));
  assert.ok(prompt.includes('flight tracking app'));
  assert.ok(prompt.includes('cannot book, rebook, cancel or contact airlines'));
  assert.ok(prompt.includes('contacts their airline or booking agent directly'));
  assert.ok(prompt.includes('none exist'), 'the invented service desk is named and forbidden');
});

test('[T/1] airports go in by name as well as by code', () => {
  const prompt = systemPrompt(safeContext({
    ...BODY,
    flight: { ...BODY.flight, originCity: 'Phuket', destinationAirport: 'Bangkok Suvarnabhumi', airline: 'Thai Airways' },
  }));
  assert.ok(prompt.includes('HKT (Phuket)'), 'HKT was read as Hong Kong when it went in alone');
  assert.ok(prompt.includes('BKK (Bangkok Suvarnabhumi)'));
  assert.ok(prompt.includes('TG208 (Thai Airways)'));
});

test('[T/1] rebooking is answered with the airline, never with a WaiAir service', () => {
  const withAirline = systemPrompt(safeContext({
    ...BODY, flight: { ...BODY.flight, airline: 'Thai Airways' },
  }));
  assert.ok(withAirline.includes('contact Thai Airways directly for rebooking options'));
  // No airline known: still the airline, just unnamed — never WaiAir.
  assert.ok(systemPrompt(safeContext(BODY)).includes('contact the airline directly for rebooking options'));
});

test('[T/1] a code with no name still reads as the code', () => {
  assert.equal(airportLabel('HKT', 'Phuket'), 'HKT (Phuket)');
  assert.equal(airportLabel('HKT', ''), 'HKT');
  assert.equal(airportLabel('', 'Phuket'), '?');
});
