import assert from 'node:assert/strict';
import { test } from 'node:test';
import { luminance, readableOn, tripExtrasPalette } from './tripExtrasPalette.ts';
import type { ThemeColors } from './themes.ts';

const INK = '#10151F';
const WHITE = '#FFFFFF';

test('text on an accent button is whichever of white or ink reads better', () => {
  assert.equal(readableOn('#C9A84C'), INK, 'Classic gold: dark text, as before');
  assert.equal(readableOn('#FFC600'), INK, 'Airport yellow');
  assert.equal(readableOn('#0D1B2E'), WHITE, 'navy');
  assert.equal(readableOn('#1565C0'), WHITE, 'a deep blue');
  assert.equal(readableOn('#FF6B6B'), INK, 'Kids coral: ink reads better than white (7:1 vs 2.8:1)');
  assert.equal(readableOn('rgba(0,0,0,0.5)'), WHITE, 'not a plain hex: white');
  assert.equal(luminance('#FFFFFF'), 1);
  assert.equal(luminance('#000000'), 0);
});

function theme(over: Partial<ThemeColors>): ThemeColors {
  return {
    bg: '#FFFFFF', card: '#FFFFFF', list: '#F3F1EC', border: 'rgba(13,27,46,0.10)', text: '#0D1B2E',
    secondary: '#4A5568', muted: '#6B7280', accent: '#C9A84C', accentDim: '#F3EBD0', tabOn: '#0D1B2E',
    field: '#FFFFFF', fieldBorder: '#D5D0C6', gold: '#C9A84C', icon: '#0D1B2E', isDark: false,
    ...over,
  } as ThemeColors;
}

test('the sheet takes the theme: light surfaces in a light theme, dark in a dark one', () => {
  const light = tripExtrasPalette(theme({}));
  assert.equal(light.surface, '#FFFFFF');
  assert.equal(light.text, '#0D1B2E');
  assert.equal(light.dark, false);
  assert.match(light.scrim, /^rgba\(13, 27, 46/);

  const kids = tripExtrasPalette(theme({ card: '#FFFFFF', accent: '#FF6B6B', accentDim: '#FFE3E3', border: '#B8DFF5' }));
  assert.equal(kids.accent, '#FF6B6B');
  assert.equal(kids.tint, '#FFE3E3');
  assert.equal(kids.line, '#B8DFF5');

  const night = tripExtrasPalette(theme({ card: '#12233C', text: '#F5F0E8', field: '#0D1B2E', isDark: true }));
  assert.equal(night.surface, '#12233C');
  assert.equal(night.dark, true);
  assert.match(night.scrim, /^rgba\(0, 0, 0/);
});
