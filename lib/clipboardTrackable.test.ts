import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clipboardImportHit } from './clipboardTrackable.ts';

test('clipboard import: none / one flight number / several', () => {
  assert.deepEqual(clipboardImportHit([]), { kind: 'none' });
  assert.deepEqual(
    clipboardImportHit([{ flightNumber: 'TG676' }], 'TG676 tomorrow'),
    { kind: 'one', query: 'TG676 tomorrow' },
  );
  assert.deepEqual(
    clipboardImportHit([{ flightNumber: 'TG676', dateIso: '2026-09-12' }], ''),
    { kind: 'one', query: 'TG676' },
  );
  const twoSame = clipboardImportHit([
    { flightNumber: 'TG676', dateIso: '2026-09-12' },
    { flightNumber: 'TG676', dateIso: '2026-09-19' },
  ], 'TG676 12 Sep and 19 Sep');
  assert.equal(twoSame.kind, 'one');
  if (twoSame.kind === 'one') assert.equal(twoSame.query, 'TG676 12 Sep and 19 Sep');

  const many = clipboardImportHit([
    { flightNumber: 'TG676' },
    { flightNumber: 'OZ747' },
  ], 'TG676 and OZ747');
  assert.equal(many.kind, 'many');
  if (many.kind === 'many') {
    assert.equal(many.candidates.length, 2);
    assert.equal(many.candidates[0].flightNumber, 'TG676');
    assert.equal(many.candidates[1].flightNumber, 'OZ747');
  }
});
