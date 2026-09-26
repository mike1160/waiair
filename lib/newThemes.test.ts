import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/*
 * lib/themes.ts imports react-native for the monospace family, so it cannot be imported here. The source is
 * read instead — the same way lib/i18nCompleteness.test.ts and lib/runtimeVersion.test.ts check files they
 * cannot load. What is guarded is the thing that actually breaks a theme: a missing field or a changed
 * colour in a palette nobody meant to touch.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'lib/themes.ts'), 'utf8');
const BOARD = readFileSync(join(ROOT, 'lib/airportBoard.ts'), 'utf8');

/** The body of one palette: from `  <id>: {` to the closing `  },`. */
function palette(id: string): string {
  const start = SRC.indexOf(`\n  ${id}: {`);
  assert.notEqual(start, -1, `${id} has a palette`);
  const end = SRC.indexOf('\n  },', start);
  assert.notEqual(end, -1, `${id}'s palette is closed`);
  return SRC.slice(start, end);
}

function field(id: string, key: string): string {
  const m = new RegExp(`\\b${key}:\\s*'([^']+)'`).exec(palette(id));
  assert.ok(m, `${id}.${key} is set`);
  return m![1];
}

const NEW = ['eagle', 'cockpit', 'deepspace', 'holo'];

test('P/1 · the four new themes are offered in the STIJL row', () => {
  for (const id of NEW) {
    const entry = new RegExp(`\\{ id: '${id}', name: '[^']+', swatchBg: '#[0-9A-Fa-f]{6}', swatchAccent: '#[0-9A-Fa-f]{6}' \\}`)
      .exec(SRC);
    assert.ok(entry, `${id} is catalogued with a swatch`);
    // Settings builds that row from everything that is neither a country nor a mode, so no group at all.
    assert.doesNotMatch(entry![0], /group:/, `${id} is a style, not a country or a mode`);
    assert.doesNotMatch(entry![0], /pro:/, `${id} is not behind Pro`);
  }
});

test('P/1 · every new theme has a complete palette, so no screen can fall through', () => {
  const required = [
    'bg', 'card', 'list', 'border', 'text', 'secondary', 'muted', 'accent', 'accentDim',
    'tabOn', 'field', 'fieldBorder', 'gold', 'icon', 'flightNumberColor', 'cardOutline',
  ];
  for (const id of NEW) {
    for (const key of required) {
      assert.match(field(id, key), /^(#[0-9A-Fa-f]{3,8}|rgba?\()/, `${id}.${key}`);
    }
    const body = palette(id);
    assert.match(body, /isDark: (true|false)/, `${id}.isDark`);
    assert.match(body, /fontScale: [\d.]+/, `${id}.fontScale`);
    assert.match(body, /statusEmoji: (true|false)/, `${id}.statusEmoji`);
  }
  assert.match(palette('holo'), /isDark: false/, 'Holographic is the light one');
  for (const id of ['eagle', 'cockpit', 'deepspace']) {
    assert.match(palette(id), /isDark: true/, id);
  }
});

test('P/1 · each new theme carries its own flag, and claims no mode', () => {
  for (const id of NEW) {
    assert.match(palette(id), new RegExp(`\\n    ${id}: true,`), `${id} sets its own flag`);
    for (const other of ['blackout', 'vapor', 'arctic', 'kids']) {
      assert.doesNotMatch(palette(id), new RegExp(`\\n    ${other}: true,`), `${id} is not ${other}`);
    }
  }
});

test('P/1 · the spec colours are the ones in the palette', () => {
  assert.equal(field('eagle', 'bg'), '#0A0E1A');
  assert.equal(field('eagle', 'accent'), '#FF6B00');
  assert.equal(field('eagle', 'text'), '#FFFFFF');
  assert.equal(field('eagle', 'secondary'), '#8899AA');
  assert.equal(field('cockpit', 'bg'), '#1C1C1E');
  assert.equal(field('cockpit', 'accent'), '#FF9500');
  assert.equal(field('cockpit', 'text'), '#F2F2F7');
  assert.equal(field('deepspace', 'bg'), '#050510');
  assert.equal(field('deepspace', 'accent'), '#7B2FFF');
  assert.equal(field('deepspace', 'card'), '#0D0D2B');
  assert.equal(field('holo', 'bg'), '#F8F8FF');
  assert.equal(field('holo', 'text'), '#1A1A2E');

  // The tokens the components read for what a flat palette cannot hold.
  assert.match(SRC, /export const EAGLE = \{[\s\S]*?statusGreen: '#00CC66'/);
  assert.match(SRC, /export const COCKPIT = \{[\s\S]*?green: '#30D158'[\s\S]*?red: '#FF3B30'/);
  assert.match(SRC, /export const DEEP_SPACE = \{[\s\S]*?cyan: '#00D4FF'[\s\S]*?nebula: '#FF2FD4'/);
  assert.match(SRC, /export const HOLO = \{[\s\S]*?gradient: \['#FF6B9D', '#C44DFF', '#4DAAFF'\]/);
  assert.match(SRC, /shimmerMs: 3000/);
});

test('P/1 · Airport is a real departures board now', () => {
  assert.equal(field('airport', 'bg'), '#1A1A1A');
  assert.equal(field('airport', 'card'), '#242424');
  assert.equal(field('airport', 'border'), '#333333');
  assert.equal(field('airport', 'accent'), '#FFB800', 'the yellow a board actually uses');
  assert.equal(field('airport', 'secondary'), '#999999');
  // Still square, still monospace: what airport mode already was.
  assert.match(palette('airport'), /square: true/);
  assert.match(palette('airport'), /mono: MONO/);

  // The board panel reads the same table as the theme, so the two cannot drift apart.
  assert.match(SRC, /export const AIRPORT_BOARD = \{[\s\S]*?green: '#00CC44'/);
  assert.match(SRC, /AIRPORT_BOARD[\s\S]*?red: '#FF3333'/);
  assert.match(SRC, /AIRPORT_BOARD[\s\S]*?landed: '#FFFFFF'/);
  assert.match(SRC, /AIRPORT_BOARD[\s\S]*?bg: '#1A1A1A'/);
  assert.match(SRC, /AIRPORT_BOARD[\s\S]*?rule: '#333333'/);
  // And the status colours the card paints with.
  assert.match(BOARD, /on_time: '#00CC44'/);
  assert.match(BOARD, /delayed: '#FFB800'/);
  assert.match(BOARD, /landed: '#FFFFFF'/);
  assert.match(BOARD, /cancelled: '#FF3333'/);
});

test('P/1 · the themes that were here before are untouched', () => {
  // Classic and Day take their base from the shared palette tokens, so the reference is what to guard.
  assert.match(palette('classic'), /bg: dark\.bg/);
  assert.equal(field('classic', 'text'), '#F4F7FB');
  assert.match(palette('day'), /bg: light\.bg/);
  assert.equal(field('midnight', 'bg'), '#000000');
  assert.equal(field('midnight', 'accent'), '#007AFF');
  assert.equal(field('blossom', 'accent'), '#FF2D78');
  assert.equal(field('tropical', 'bg'), '#0D2E1C');
  assert.equal(field('blackout', 'bg'), '#000000');
  assert.equal(field('blackout', 'accent'), '#FFFFFF');
  assert.equal(field('kids', 'accent'), '#FF6B6B');
  assert.match(palette('arctic'), /isDark: false/);
});

test('P/1 · every catalogued theme has a palette, and no palette is unreachable', () => {
  /*
   * A catalogue entry with no palette renders undefined colours; a palette with no entry is rejected by the
   * boot resolver, which is how a saved theme silently became Classic.
   */
  const catalogued = [...SRC.matchAll(/\{ id: '([a-z]+)', name:/g)].map(m => m[1]);
  assert.ok(catalogued.length > 30, 'the catalogue was found');
  for (const id of catalogued) {
    // A literal block for the picked styles, a countryTheme() call for the flags: both count.
    const literal = SRC.includes(`\n  ${id}: {`);
    const built = new RegExp(`\\n  ${id}: countryTheme\\(`).test(SRC);
    assert.ok(literal || built, `${id} has a palette`);
  }
  for (const id of NEW) {
    assert.ok(catalogued.includes(id), `${id} is catalogued`);
  }
});
