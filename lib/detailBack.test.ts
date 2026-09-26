import test from 'node:test';
import assert from 'node:assert/strict';

import { detailBackAction } from './detailBack.ts';

test('back from a section returns to the flight card, not out of it', () => {
  // [B11] Transport, Weather, Briefing and Immigration jump into a section; back comes back.
  assert.equal(detailBackAction({ jumpedToSection: true }), 'backToCard');
});

test('back from the card itself closes it', () => {
  assert.equal(detailBackAction({ jumpedToSection: false }), 'close');
  assert.equal(detailBackAction({}), 'close');
});

test('coming back to the top makes the next back close, so nothing traps the traveller', () => {
  // The first back clears the flag; the second sees no jump and leaves.
  let jumped = true;
  const first = detailBackAction({ jumpedToSection: jumped });
  if (first === 'backToCard') jumped = false;
  assert.equal(first, 'backToCard');
  assert.equal(detailBackAction({ jumpedToSection: jumped }), 'close');
});
