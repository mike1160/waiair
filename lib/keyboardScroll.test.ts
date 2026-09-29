import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KEYBOARD_REVEAL_MARGIN, keyboardScrollTarget, keyboardTopY } from './keyboardScroll.ts';

// A Pixel-ish window with a typical Android keyboard: 915 tall, 320 of keyboard.
const WINDOW = 915;
const KEYBOARD = 320;
const TOP = keyboardTopY(WINDOW, KEYBOARD); // 595

test('[W/5] a field the keyboard covers is scrolled exactly clear of it', () => {
  // The input's bottom edge is at 700 — 105px behind the keyboard.
  const target = keyboardScrollTarget({ inputBottomY: 700, keyboardTopY: TOP, scrollY: 400 });
  assert.equal(target, 400 + (700 + KEYBOARD_REVEAL_MARGIN - TOP));
  assert.equal(target, 517);
  // And at that offset it now clears: re-running finds nothing left to do.
  const settled = keyboardScrollTarget({ inputBottomY: 700 - (target! - 400), keyboardTopY: TOP, scrollY: target! });
  assert.equal(settled, null);
});

test('[W/5] a field already above the keyboard is left alone', () => {
  assert.equal(keyboardScrollTarget({ inputBottomY: 300, keyboardTopY: TOP, scrollY: 0 }), null);
  // Exactly at the boundary, the margin still counts as covered.
  assert.equal(keyboardScrollTarget({ inputBottomY: TOP, keyboardTopY: TOP, scrollY: 0 }), KEYBOARD_REVEAL_MARGIN);
  assert.equal(keyboardScrollTarget({ inputBottomY: TOP - KEYBOARD_REVEAL_MARGIN, keyboardTopY: TOP, scrollY: 0 }), null);
});

test('[W/5] no keyboard means no scrolling', () => {
  assert.equal(keyboardScrollTarget({ inputBottomY: 700, keyboardTopY: 0, scrollY: 100 }), null);
  assert.equal(keyboardTopY(WINDOW, 0), 0);
  assert.equal(keyboardTopY(WINDOW, -10), 0);
});

test('[W/5] the target never goes negative', () => {
  assert.equal(keyboardScrollTarget({ inputBottomY: 700, keyboardTopY: TOP, scrollY: -1000 }), 0);
});

test('[W/5] missing measurements are ignored rather than guessed at', () => {
  assert.equal(keyboardScrollTarget({ inputBottomY: NaN, keyboardTopY: TOP, scrollY: 0 }), null);
  assert.equal(keyboardScrollTarget({ inputBottomY: 700, keyboardTopY: NaN, scrollY: 0 }), null);
  assert.equal(keyboardScrollTarget({ inputBottomY: 700, keyboardTopY: TOP, scrollY: NaN }), null);
  assert.equal(keyboardTopY(NaN, KEYBOARD), 0);
});

test('[W/5] the keyboard top is the window minus the keyboard, never off-screen', () => {
  assert.equal(TOP, 595);
  assert.equal(keyboardTopY(400, 900), 0, 'a keyboard taller than the window clamps to the top');
});

test('[W/5] an iPhone-sized window behaves the same', () => {
  // 852pt window, 336pt keyboard with the suggestion bar: the field's bottom at 800 is well behind it.
  const top = keyboardTopY(852, 336);
  assert.equal(top, 516);
  assert.equal(keyboardScrollTarget({ inputBottomY: 800, keyboardTopY: top, scrollY: 0 }), 800 + 12 - 516);
});
