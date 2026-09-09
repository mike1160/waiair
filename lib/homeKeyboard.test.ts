import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  boardingPassCardVisible,
  homeSearchCollapsed,
  homeSearchKeyboardFromEvent,
  keyboardDurationMs,
  keyboardHeightFromEvent,
} from './homeKeyboard.ts';

test('mocked keyboardWillShow with height > 0 collapses; hide height 0 expands', () => {
  const show = homeSearchKeyboardFromEvent({ height: 336, duration: 0.25 });
  assert.equal(show.collapsed, true);
  assert.equal(show.height, 336);
  assert.equal(show.durationMs, 250);

  const hide = homeSearchKeyboardFromEvent({ height: 0, duration: 0.25 });
  assert.equal(hide.collapsed, false);
  assert.equal(hide.height, 0);
  assert.equal(hide.durationMs, 250);
});

test('focus-only (hardware keyboard / simulator) keeps the sky expanded', () => {
  assert.equal(homeSearchCollapsed(0), false);
  assert.equal(keyboardHeightFromEvent({ height: 0 }), 0);
  assert.equal(keyboardHeightFromEvent({ height: null }), 0);
  assert.equal(boardingPassCardVisible(homeSearchCollapsed(0)), true);
  assert.equal(boardingPassCardVisible(true), false);
});

test('keyboard duration: seconds vs milliseconds', () => {
  assert.equal(keyboardDurationMs(undefined), 250);
  assert.equal(keyboardDurationMs(0), 250);
  assert.equal(keyboardDurationMs(0.35), 350);
  assert.equal(keyboardDurationMs(280), 280);
});
