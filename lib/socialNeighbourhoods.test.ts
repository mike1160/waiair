import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { curatedCities } from './neighbourhoods.ts';

test('proxy/data/neighbourhoods.json matches lib/neighbourhoods.ts (run scripts/syncSocialNeighbourhoods.ts)', () => {
  const copy = JSON.parse(readFileSync(new URL('../proxy/data/neighbourhoods.json', import.meta.url), 'utf8'));
  assert.deepEqual(copy, curatedCities());
});

test('curatedCities: every city has an airport and at least three areas for the Thursday post', () => {
  for (const city of curatedCities()) {
    assert.ok(city.iatas.length >= 1, `${city.name} has no airport`);
    assert.ok(city.areas.length >= 3, `${city.name} has fewer than 3 areas`);
  }
});
