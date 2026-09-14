import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fidsBoardAllPast, fidsBoardStart } from './fidsBoardWindow.ts';

test('board starts at the first flight from "now − 2 h" when there is one', () => {
  assert.equal(fidsBoardStart(0, 229, 40), 0);
  assert.equal(fidsBoardStart(118, 229, 40), 118);
  assert.equal(fidsBoardStart(228, 229, 40), 228);
  assert.equal(fidsBoardAllPast(118, 229), false);
});

test('every flight older than 2 h: the newest page instead of an empty board (was afterTimeFilter 0 + spinner)', () => {
  assert.equal(fidsBoardAllPast(229, 229), true);
  assert.equal(fidsBoardStart(229, 229, 40), 189);
  assert.equal(229 - fidsBoardStart(229, 229, 40), 40);
  // Fewer flights than a page: all of them.
  assert.equal(fidsBoardStart(55, 55, 80), 0);
  assert.equal(fidsBoardStart(55, 55, 0), 54);
});

test('empty board stays empty', () => {
  assert.equal(fidsBoardStart(0, 0, 40), 0);
  assert.equal(fidsBoardAllPast(0, 0), false);
});
