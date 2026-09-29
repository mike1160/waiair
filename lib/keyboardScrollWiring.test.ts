import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/**
 * The keyboard fix, in the files it has to exist in [W/5]. Text-based: both files import react-native.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/5] the field reports its own position and focus', () => {
  const panel = read('components/BriefingPanel.tsx');
  assert.ok(panel.includes('ref={inputRef}'), 'the input is referenced');
  assert.ok(panel.includes('node.measureInWindow('), 'and measured in window coordinates');
  assert.ok(panel.includes('onFocus={() => onInputFocus?.(measureInputBottom)}'));
  assert.ok(panel.includes('onBlur={() => onInputBlur?.()}'));
  assert.ok(panel.includes('export type MeasureInputBottom'), 'the screen shares the measure type');
});

test('[W/5] the screen listens for the keyboard on both platforms', () => {
  const screen = read('screens/HomeTrackedScreen.tsx');
  assert.ok(screen.includes("Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'"));
  assert.ok(screen.includes("Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'"));
  assert.ok(screen.includes('show.remove(); hide.remove();'), 'and removes its listeners');
});

test('[W/5] the keyboard height makes room, and the field is scrolled clear', () => {
  const screen = read('screens/HomeTrackedScreen.tsx');
  assert.ok(
    screen.includes('paddingBottom: insets.bottom + 24 + keyboardHeight'),
    'without the padding there is nowhere for the field to scroll to',
  );
  assert.ok(screen.includes('keyboardScrollTarget({ inputBottomY: bottomY'), 'the arithmetic is the tested one');
  assert.ok(screen.includes('scrollRef.current?.scrollTo({ y: target, animated: true })'));
  assert.ok(screen.includes('scrollY.current = e.nativeEvent.contentOffset.y'), 'the offset is tracked');
});

test('[W/5] focus and the keyboard can arrive in either order', () => {
  const screen = read('screens/HomeTrackedScreen.tsx');
  assert.ok(screen.includes('measureFocused.current = measure;'), 'focus first: the measure is kept');
  assert.ok(
    screen.includes('if (!keyboardHeight || !measureFocused.current) return;'),
    'keyboard second: it re-measures and scrolls',
  );
  assert.ok(screen.includes('onBriefingInputBlur'), 'and blur clears it');
});

test('[W/5] a tap on a chip is not swallowed by the open keyboard', () => {
  assert.ok(read('screens/HomeTrackedScreen.tsx').includes('keyboardShouldPersistTaps="handled"'));
});
