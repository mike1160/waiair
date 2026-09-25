import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readClipboardImport } from './clipboardImport.ts';

test('a pasted booking is read as a flight', () => {
  const read = readClipboardImport('Your flight TG208 on 27 Sep 2026, BKK to HKT');
  assert.equal(read.kind, 'flight');
  // One flight number goes to the search field with the paste behind it; several open the import sheet.
  if (read.kind === 'flight') assert.equal(read.hit.kind, 'one');

  const two = readClipboardImport('TG208 on 27 Sep 2026 and TG209 on 4 Oct 2026');
  assert.equal(two.kind, 'flight');
  if (two.kind === 'flight') assert.equal(two.hit.kind, 'many');
});

test('an extra is not mistaken for the flight it names', () => {
  const read = readClipboardImport('Extra baggage confirmed for TG208');
  assert.equal(read.kind, 'ancillary');
  if (read.kind === 'ancillary') assert.match(read.text, /TG208/);
});

test('an empty or useless clipboard is nothing, never an empty flight', () => {
  assert.equal(readClipboardImport('').kind, 'none');
  assert.equal(readClipboardImport('   \n ').kind, 'none');
  assert.equal(readClipboardImport(null).kind, 'none');
  assert.equal(readClipboardImport(undefined).kind, 'none');
  assert.equal(readClipboardImport('https://example.com/shopping-cart').kind, 'none');
});
