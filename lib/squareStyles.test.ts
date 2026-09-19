import assert from 'node:assert/strict';
import { test } from 'node:test';
import { squareStyle, squareStyles } from './squareStyles.ts';

test('every kind of corner radius goes to 0, nothing else changes', () => {
  const sheet = {
    card: { borderRadius: 24, padding: 12, backgroundColor: '#111' },
    pill: { borderTopLeftRadius: 8, borderBottomRightRadius: 8, borderWidth: 1 },
    plain: { margin: 4 },
    logical: { borderTopStartRadius: 6, borderEndEndRadius: 6 },
  };
  const out = squareStyles(sheet);
  assert.deepEqual(out.card, { borderRadius: 0, padding: 12, backgroundColor: '#111' });
  assert.deepEqual(out.pill, { borderTopLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 1 });
  assert.equal(out.plain, sheet.plain, 'a style without radii is the same object');
  assert.deepEqual(out.logical, { borderTopStartRadius: 0, borderEndEndRadius: 0 });
});

test('the original stylesheet is never mutated (they are frozen in dev)', () => {
  const card = Object.freeze({ borderRadius: 16, padding: 8 });
  const sheet = Object.freeze({ card });
  const out = squareStyles(sheet);
  assert.equal(card.borderRadius, 16);
  assert.equal(out.card.borderRadius, 0);
});

test('odd values pass through untouched', () => {
  assert.equal(squareStyle(null), null);
  assert.equal(squareStyle(undefined), undefined);
  const arr = [{ borderRadius: 4 }];
  assert.equal(squareStyle(arr), arr, 'arrays are left to the caller');
  assert.deepEqual(squareStyle({ borderWidth: 2, borderColor: 'red' }), { borderWidth: 2, borderColor: 'red' }, 'borderWidth is not a radius');
});
