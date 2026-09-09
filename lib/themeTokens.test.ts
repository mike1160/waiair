import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PALETTE_TOKENS,
  SYSTEM_DARK_THEME,
  SYSTEM_LIGHT_THEME,
  paletteTokens,
  resolveThemeSelection,
  themeIdForSystemScheme,
} from './themeTokens.ts';

const KNOWN = ['classic', 'day', 'blossom', 'midnight'] as const;

test('theme tokens: light uses navy text on a light background; dark keeps navy as background', () => {
  const light = paletteTokens('light');
  const dark = paletteTokens('dark');
  assert.equal(light.navy, '#0D1B2E');
  assert.equal(light.gold, '#C9A84C');
  assert.equal(light.text, light.navy);
  assert.notEqual(light.bg, dark.bg);
  assert.equal(dark.bg, dark.navy);
  assert.equal(dark.gold, light.gold);
  assert.equal(PALETTE_TOKENS.light.gold, PALETTE_TOKENS.dark.gold);
});

test('no saved theme follows the system; light is the default when scheme is unset', () => {
  assert.equal(themeIdForSystemScheme('light'), SYSTEM_LIGHT_THEME);
  assert.equal(themeIdForSystemScheme(null), SYSTEM_LIGHT_THEME);
  assert.equal(themeIdForSystemScheme('dark'), SYSTEM_DARK_THEME);
  assert.deepEqual(
    resolveThemeSelection({ systemScheme: 'light', knownIds: KNOWN }),
    { id: 'day', followsSystem: true },
  );
  assert.deepEqual(
    resolveThemeSelection({ systemScheme: 'dark', knownIds: KNOWN }),
    { id: 'classic', followsSystem: true },
  );
});

test('explicitly saved theme is kept, including legacy light/dark strings', () => {
  assert.deepEqual(
    resolveThemeSelection({ saved: 'blossom', systemScheme: 'dark', knownIds: KNOWN }),
    { id: 'blossom', followsSystem: false },
  );
  assert.deepEqual(
    resolveThemeSelection({ saved: 'classic', systemScheme: 'light', knownIds: KNOWN }),
    { id: 'classic', followsSystem: false },
  );
  assert.deepEqual(
    resolveThemeSelection({ legacy: 'light', systemScheme: 'dark', knownIds: KNOWN }),
    { id: 'day', followsSystem: false },
  );
  assert.deepEqual(
    resolveThemeSelection({ saved: 'dark', knownIds: KNOWN }),
    { id: 'classic', followsSystem: false },
  );
});
