const test = require('node:test');
const assert = require('node:assert/strict');
const { createCountryFacts, searchNames, toFacts } = require('./countryFacts');

// Country info tests — REST Countries v5 responses are faked (shape copied from a live Thailand response).

const THAILAND = {
  names: {
    common: 'Thailand',
    official: 'Kingdom of Thailand',
    native: { tha: { common: 'ประเทศไทย', official: 'ราชอาณาจักรไทย' } },
  },
  codes: { alpha_2: 'TH', alpha_3: 'THA' },
  capitals: [{ attributes: { primary: true }, name: 'Bangkok' }],
  region: 'Asia',
  subregion: 'South-Eastern Asia',
  population: 70250751,
  languages: [{ name: 'Thai', native_name: 'ไทย' }],
  currencies: [{ code: 'THB', name: 'Thai baht', symbol: '฿' }],
  calling_codes: ['66'],
  timezones: ['UTC+07:00'],
  cars: { driving_side: 'left' },
  date: { start_of_week: 'monday' },
  units: { temperature_scale: 'Celsius' },
  flag: { emoji: '🇹🇭' },
  descriptions: {
    short: 'Thailand is a Southeast Asian kingdom on the Indochinese and Malay peninsulas, facing two seas.',
    long: 'Thailand is a constitutional monarchy with Bangkok as its capital and Thai as its official language, and it was never colonised. The baht is the currency, and electronics, vehicles, rice, rubber and tourism lead foreign earnings.',
  },
};

function page(objects) {
  return { data: { meta: { total: objects.length }, objects } };
}

test('searchNames: English name, cleaned, plus first word fallback', () => {
  assert.deepEqual(searchNames('TH'), ['Thailand']);
  assert.deepEqual(searchNames('HK'), ['Hong Kong', 'Hong']);
  assert.deepEqual(searchNames('MM'), ['Myanmar']);
  assert.deepEqual(searchNames('AE'), ['United Arab Emirates', 'United']);
});

test('toFacts keeps full text (long description, all timezones)', () => {
  const f = toFacts(THAILAND);
  assert.equal(f.code, 'TH');
  assert.equal(f.capital, 'Bangkok');
  assert.equal(f.nativeName, 'ประเทศไทย');
  assert.deepEqual(f.languages, ['Thai']);
  assert.deepEqual(f.currencies, [{ code: 'THB', name: 'Thai baht', symbol: '฿' }]);
  assert.deepEqual(f.callingCodes, ['66']);
  assert.equal(f.drivingSide, 'left');
  assert.equal(f.description, THAILAND.descriptions.long);
});

test('get: bearer auth, q = country name, picks the exact alpha_2, caches', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => page([{ ...THAILAND, codes: { alpha_2: 'XX' } }, THAILAND]) };
  };
  const facts = createCountryFacts({ apiKey: 'rc_test', fetchImpl });
  const f = await facts.get('th');
  assert.equal(f.name, 'Thailand');
  assert.equal(calls[0].url, 'https://api.restcountries.com/countries/v5?q=Thailand');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer rc_test');
  await facts.get('TH');
  assert.equal(calls.length, 1);
});

test('get: tries the fallback name, null without match / key / valid code', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(decodeURIComponent(url.split('q=')[1]));
    return { ok: true, status: 200, json: async () => page([]) };
  };
  const facts = createCountryFacts({ apiKey: 'k', fetchImpl });
  assert.equal(await facts.get('AE'), null);
  assert.deepEqual(seen, ['United Arab Emirates', 'United']);
  assert.equal(await createCountryFacts({ apiKey: '', fetchImpl }).get('TH'), null);
  assert.equal(await facts.get('THA'), null);
});

test('get: API error → null, logged', async () => {
  const warned = [];
  const facts = createCountryFacts({
    apiKey: 'k',
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }),
    log: { warn: (...a) => warned.push(a.join(' ')) },
  });
  assert.equal(await facts.get('TH'), null);
  assert.match(warned[0], /HTTP 401/);
});
