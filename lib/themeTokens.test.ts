import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PALETTE_TOKENS,
  SYSTEM_DARK_THEME,
  SYSTEM_LIGHT_THEME,
  paletteTokens,
  resolveThemeSelection,
  skyFor,
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

function lastStop(scene: ReturnType<typeof skyFor>) {
  return scene.overlay.colors[scene.overlay.colors.length - 1];
}

function assertOverlay(scene: ReturnType<typeof skyFor>) {
  const { colors, locations } = scene.overlay;
  assert.ok(colors.length >= 2);
  assert.equal(colors.length, locations.length);
  assert.equal(locations[0], 0);
  assert.equal(locations[locations.length - 1], 1);
  for (let i = 1; i < locations.length; i++) {
    assert.ok(locations[i] >= locations[i - 1]);
  }
}

test('skyFor returns the right photo per hour; dark theme uses dusk/night', () => {
  const lightDawn = skyFor(6, false);
  const lightNoon = skyFor(12, false);
  const lightDusk = skyFor(18, false);
  const lightNight = skyFor(23, false);
  const darkDawn = skyFor(6, true);
  const darkNoon = skyFor(12, true);
  const darkDusk = skyFor(18, true);
  const darkNight = skyFor(23, true);

  for (const scene of [lightDawn, lightNoon, lightDusk, lightNight, darkDawn, darkNoon, darkDusk, darkNight]) {
    assertOverlay(scene);
  }

  assert.equal(lightDawn.image, 'dawn');
  assert.equal(lightNoon.image, 'day');
  assert.equal(lightDusk.image, 'dusk');
  assert.equal(lightNight.image, 'night');
  assert.equal(lastStop(lightDawn), PALETTE_TOKENS.light.bg);
  assert.equal(lastStop(lightNoon), PALETTE_TOKENS.light.bg);
  assert.equal(lastStop(lightDusk), PALETTE_TOKENS.light.bg);
  assert.equal(lastStop(lightNight), PALETTE_TOKENS.light.bg);
  assert.equal(lightNight.dim, 0.25);
  assert.ok(lightNight.iconLight);

  assert.equal(darkDawn.image, 'dusk');
  assert.equal(darkNoon.image, 'dusk');
  assert.equal(darkDusk.image, 'dusk');
  assert.equal(darkNight.image, 'night');
  assert.equal(lastStop(darkDawn), PALETTE_TOKENS.dark.bg);
  assert.equal(lastStop(darkNight), PALETTE_TOKENS.dark.bg);
  assert.equal(darkNight.dim, 0.25);
  assert.ok(darkNight.iconLight);
});
