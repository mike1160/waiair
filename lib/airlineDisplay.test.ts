import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AIRLINE_IATA_NAMES,
  collapseAirlineName,
  matchAirlineQuery,
  normalizeAirlineName,
  stripAirlineLegalSuffix,
} from './airlineDisplay.ts';

test('collapses double spaces in airline names', () => {
  assert.equal(collapseAirlineName('Thai  International'), 'Thai International');
  assert.equal(collapseAirlineName('  Thai   Airways  '), 'Thai Airways');
});

test('Thai International / TG display as Thai Airways', () => {
  assert.equal(normalizeAirlineName('Thai  International', 'TG'), 'Thai Airways');
  assert.equal(normalizeAirlineName('Thai International', 'TG'), 'Thai Airways');
  assert.equal(normalizeAirlineName('Thai Airways International', 'tg'), 'Thai Airways');
  assert.equal(normalizeAirlineName('', 'TG'), 'Thai Airways');
});

test('IATA table covers hub carriers with marketing names', () => {
  const expect: Record<string, string> = {
    JL: 'Japan Airlines',
    NH: 'ANA',
    ZG: 'ZIPAIR',
    MM: 'Peach',
    TR: 'Scoot',
    VJ: 'VietJet Air',
    VZ: 'Thai Vietjet Air',
    VN: 'Vietnam Airlines',
    VU: 'Vietravel Airlines',
    '9G': 'Sun PhuQuoc Airways',
    KE: 'Korean Air',
    BR: 'EVA Air',
    KL: 'KLM',
    TG: 'Thai Airways',
    CI: 'China Airlines',
    JX: 'STARLUX Airlines',
    OZ: 'Asiana Airlines',
  };
  for (const [code, name] of Object.entries(expect)) {
    assert.equal(AIRLINE_IATA_NAMES[code], name, code);
    assert.equal(normalizeAirlineName('Japan Airlines Co.Ltd.', code), name, code);
  }
});

test('delayHistory re-exports AIRLINE_IATA_NAMES from airlineDisplay', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('./delayHistory.ts', import.meta.url), 'utf8');
  assert.match(src, /import \{ AIRLINE_IATA_NAMES \} from '\.\/airlineDisplay'/);
  assert.match(src, /export \{ AIRLINE_IATA_NAMES \}/);
});

test('unknown carriers drop Co.Ltd. / Public Company Limited suffixes', () => {
  assert.equal(
    stripAirlineLegalSuffix('Japan Airlines Co.Ltd.'),
    'Japan Airlines',
  );
  assert.equal(
    stripAirlineLegalSuffix('Mystery Air Co., Ltd.'),
    'Mystery Air',
  );
  assert.equal(
    normalizeAirlineName('Obscure Air Public Company Limited', 'ZZ'),
    'Obscure Air',
  );
  assert.equal(normalizeAirlineName('Japan Airlines Co.Ltd.', 'JL'), 'Japan Airlines');
  assert.equal(normalizeAirlineName('All Nippon Airways Co., Ltd.', 'NH'), 'ANA');
});

test('matchAirlineQuery: IATA, ICAO, and marketing names', () => {
  assert.equal(matchAirlineQuery('kl')?.code, 'KL');
  assert.equal(matchAirlineQuery('KLM')?.code, 'KL');
  assert.equal(matchAirlineQuery('eva')?.code, 'BR');
  assert.equal(matchAirlineQuery('thai')?.code, 'TG');
  assert.equal(matchAirlineQuery('korean air')?.code, 'KE');
});
