import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  currencyChipLabel,
  destinationChips,
  tempChipLabel,
  visaChipLabel,
  type DestinationChipsCopy,
} from './destinationChips.ts';

const COPY: DestinationChipsCopy = {
  visaFreeShort: 'No visa',
  visaEvisaShort: 'eVisa',
  visaEtaShort: 'ETA',
  visaRequiredShort: 'Visa needed',
};

test('the temperature chip uses the app formatter and disappears without a reading', () => {
  const fmt = (c: number) => `${Math.round(c)}°C`;
  assert.equal(tempChipLabel(29.4, fmt), '29°C');
  assert.equal(tempChipLabel(0, fmt), '0°C', 'freezing is still a reading');
  assert.equal(tempChipLabel(null, fmt), '');
  assert.equal(tempChipLabel(undefined, fmt), '');
  assert.equal(tempChipLabel(Number.NaN, fmt), '');
});

test('the currency chip only shows a real ISO code', () => {
  assert.equal(currencyChipLabel('thb'), 'THB');
  assert.equal(currencyChipLabel(' EUR '), 'EUR');
  assert.equal(currencyChipLabel('EURO'), '');
  assert.equal(currencyChipLabel(''), '');
  assert.equal(currencyChipLabel(null), '');
});

test('the visa chip says the outcome in a couple of words', () => {
  assert.equal(visaChipLabel('free', COPY), 'No visa');
  assert.equal(visaChipLabel('evisa', COPY), 'eVisa');
  assert.equal(visaChipLabel('eta', COPY), 'ETA');
  assert.equal(visaChipLabel('required', COPY), 'Visa needed');
  assert.equal(visaChipLabel(null, COPY), '');
});

test('chips keep their order and a chip without a value is left out', () => {
  assert.deepEqual(destinationChips({ temp: '29°C', currency: 'THB', visa: 'No visa' }).map(c => c.id), ['temp', 'currency', 'visa']);
  assert.deepEqual(destinationChips({ temp: '', currency: 'THB', visa: '' }).map(c => c.id), ['currency']);
  assert.deepEqual(destinationChips({ temp: '', currency: '', visa: '' }), []);
  assert.deepEqual(
    destinationChips({ temp: '29°C', currency: 'THB', visa: 'No visa' }).map(c => c.icon),
    ['🌡️', '💱', '🛂'],
  );
});
