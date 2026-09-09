import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clipboardTrackableIdent } from './clipboardTrackable.ts';

test('clipboard hit prefers a flight number, then a labeled PNR', () => {
  assert.equal(clipboardTrackableIdent('Your flight TG676 to HND'), 'TG676');
  assert.equal(clipboardTrackableIdent('Booking ref: ABC12E'), 'ABC12E');
  assert.equal(clipboardTrackableIdent('PNR: X7K9QM'), 'X7K9QM');
  assert.equal(clipboardTrackableIdent('Record locator KL4MP2'), 'KL4MP2');
  assert.equal(clipboardTrackableIdent('hello there'), null);
  assert.equal(clipboardTrackableIdent(''), null);
});
