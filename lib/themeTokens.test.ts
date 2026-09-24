import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PALETTE_TOKENS,
  SYSTEM_DARK_THEME,
  SYSTEM_LIGHT_THEME,
  paletteTokens,
  resolveThemeSelection,
  skyFor,
  homeChrome,
  skyChromeScrim,
  skyChromeTint,
  skyForImage,
  statusBarStyleForSky,
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

test('status bar is light on dark skies and dark on pale skies, collapse-independent', () => {
  assert.equal(statusBarStyleForSky(skyFor(12, false)), 'dark');
  assert.equal(statusBarStyleForSky(skyFor(6, false)), 'dark');
  assert.equal(statusBarStyleForSky(skyFor(18, false)), 'light');
  assert.equal(statusBarStyleForSky(skyFor(23, false)), 'light');
  assert.equal(statusBarStyleForSky(skyFor(12, true)), 'light');
});

test('sky chrome is navy on pale day/dawn and white on dusk/night', () => {
  const navy = PALETTE_TOKENS.light.navy;
  assert.equal(skyChromeTint(skyFor(12, false)), navy);
  assert.equal(skyChromeTint(skyFor(6, false)), navy);
  assert.equal(skyChromeTint(skyForImage('day', false)), navy);
  assert.equal(skyChromeTint(skyForImage('dawn', false)), navy);
  assert.equal(skyChromeTint(skyFor(18, false)), '#FFFFFF');
  assert.equal(skyChromeTint(skyFor(23, false)), '#FFFFFF');
  assert.equal(skyChromeTint(skyForImage('dusk', false)), '#FFFFFF');
  assert.equal(skyChromeTint(skyForImage('night', false)), '#FFFFFF');
  assert.equal(statusBarStyleForSky(skyForImage('day', false)), 'dark');
  assert.equal(statusBarStyleForSky(skyForImage('dawn', false)), 'dark');
  assert.equal(statusBarStyleForSky(skyForImage('dusk', false)), 'light');
  assert.equal(statusBarStyleForSky(skyForImage('night', false)), 'light');
});

test('the header icons always get a wash in the opposite direction, so they stay readable on any photo', () => {
  // White icons (a dark sky) get a dark wash; navy icons get a light one.
  assert.match(skyChromeScrim(true), /^rgba\(10,22,40,/);
  assert.match(skyChromeScrim(false), /^rgba\(255,255,255,/);
  assert.notEqual(skyChromeScrim(true), skyChromeScrim(false));
});

test('a theme with no photo takes its header colours from itself, not from the sky', () => {
  // Arctic: ice white by design, and the same at every hour. After sunset the sky tint is white, which is
  // how the title and the icons disappeared into the background.
  const night = skyFor(23, false);
  assert.equal(skyChromeTint(night), '#FFFFFF', 'the sky would ask for white');
  const arctic = homeChrome({ photo: false, scene: night, themeText: '#0A1628', themeIsDark: false });
  assert.equal(arctic.tint, '#0A1628', 'but the header takes the theme text, so it stays readable');
  assert.equal(arctic.scrim, 'transparent', 'and no wash on a flat background');
  assert.equal(arctic.statusBar, 'dark');

  // Midday in a dark focus theme is the same bug mirrored: the sky would ask for navy on black.
  const noon = skyFor(12, false);
  assert.notEqual(skyChromeTint(noon), '#FFFFFF');
  const blackout = homeChrome({ photo: false, scene: noon, themeText: '#FFFFFF', themeIsDark: true });
  assert.equal(blackout.tint, '#FFFFFF');
  assert.equal(blackout.statusBar, 'light');
});

test('with a photo behind it the header still follows the sky, day and night', () => {
  const night = skyFor(23, false);
  const overNight = homeChrome({ photo: true, scene: night, themeText: '#0A1628', themeIsDark: false });
  assert.equal(overNight.tint, skyChromeTint(night));
  assert.equal(overNight.scrim, skyChromeScrim(true), 'a dark wash under white icons');

  const noon = skyFor(12, false);
  const overNoon = homeChrome({ photo: true, scene: noon, themeText: '#0A1628', themeIsDark: false });
  assert.equal(overNoon.tint, skyChromeTint(noon));
  assert.equal(overNoon.scrim, skyChromeScrim(false));
});

test('the header never paints its text in its own background colour', () => {
  // Every theme the app ships, at every hour, on a flat background.
  const themes = [
    { name: 'arctic', bg: '#F0F4F8', text: '#0A1628', dark: false },
    { name: 'blackout', bg: '#000000', text: '#FFFFFF', dark: true },
    { name: 'vapor', bg: '#0D0015', text: '#FFFFFF', dark: true },
  ];
  for (const th of themes) {
    for (let hour = 0; hour < 24; hour++) {
      const c = homeChrome({ photo: false, scene: skyFor(hour, th.dark), themeText: th.text, themeIsDark: th.dark });
      assert.notEqual(c.tint.toUpperCase(), th.bg.toUpperCase(), `${th.name} at ${hour}:00`);
    }
  }
});
