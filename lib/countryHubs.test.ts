import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AIRPORTS, COUNTRY_META } from './airportsDb.ts';
import { COUNTRY_HUBS } from './countryHubs.ts';

test('every catalogue country has a COUNTRY_HUBS entry', () => {
  const missing = [...new Set(AIRPORTS.map(a => a.country))]
    .filter(cc => !COUNTRY_HUBS[cc]?.length)
    .sort();
  assert.deepEqual(missing, [], `no hub for ${missing.join(' ')}`);
});

test('every catalogue country has COUNTRY_META aliases', () => {
  const missing = [...new Set(AIRPORTS.map(a => a.country))]
    .filter(cc => !COUNTRY_META[cc]?.aliases?.length)
    .sort();
  assert.deepEqual(missing, [], `no aliases for ${missing.join(' ')}`);
});

test('COUNTRY_HUBS codes exist in that country catalogue', () => {
  const byCountry = new Map<string, Set<string>>();
  for (const a of AIRPORTS) {
    if (!byCountry.has(a.country)) byCountry.set(a.country, new Set());
    byCountry.get(a.country)!.add(a.iata);
  }
  const bad: string[] = [];
  for (const [cc, hubs] of Object.entries(COUNTRY_HUBS)) {
    const iatas = byCountry.get(cc);
    if (!iatas) {
      bad.push(`${cc}: unknown country`);
      continue;
    }
    for (const iata of hubs) {
      if (!iatas.has(iata)) bad.push(`${cc}:${iata}`);
    }
  }
  assert.deepEqual(bad, [], bad.join(' '));
});
