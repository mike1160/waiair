import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collapseAirlineName, normalizeAirlineName } from './airlineDisplay.ts';

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
