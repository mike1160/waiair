import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/**
 * The home-airport correction, in the files it has to exist in [W/4]. Text-based: App.tsx and the settings
 * screen import react-native and cannot be loaded under node --test.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/4] the guess prefers the principal gateway before it is saved', () => {
  const app = read('App.tsx');
  assert.ok(app.includes('const preferred=preferredHomeAirport(nearest);'), 'applied to the GPS result');
  assert.ok(app.includes('const swapped=airportFromIata(preferred);'), 'and resolved to a real airport');
  assert.ok(app.includes('if(swapped) return swapped;'), 'falling back to the nearest when it cannot be');
});

test('[W/4] every automatic write records itself as automatic', () => {
  const app = read('App.tsx');
  assert.ok(app.includes("savePrefs({ defaultAirport: nearest, defaultAirportSource: 'auto' })"), 'the GPS guess');
  assert.ok(
    app.includes("savePrefs({ defaultAirport: asAirport, defaultAirportSource: 'auto' })"),
    'and the one derived from a tracked flight',
  );
});

test('[W/4] a hand-picked airport is recorded as manual, so nothing corrects it', () => {
  assert.ok(
    read('SettingsScreen.tsx').includes("savePrefs({ defaultAirport: currentAirport, defaultAirportSource: 'manual' })"),
  );
});

test('[W/4] the correction runs at load, before the airport reaches the screen', () => {
  const app = read('App.tsx');
  const correction = app.indexOf('const correctTo=homeAirportCorrection({');
  const setIt = app.indexOf('if(pinned?.iata){', correction);
  assert.ok(correction > 0, 'the correction is wired into the prefs load');
  assert.ok(setIt > correction, 'and happens before setAirport, so the wrong airport never shows');
  assert.ok(app.includes("defaultAirportSource: 'auto' }).catch(()=>{});"), 'the correction is persisted');
  assert.ok(app.includes('showToast(t().homeAirportFixed(corrected.iata));'), 'and announced, never silent');
});

test('[W/4] prefs carry and validate the provenance', () => {
  const prefs = read('lib/prefs.ts');
  assert.ok(prefs.includes("defaultAirportSource: 'auto' | 'manual' | null;"), 'in the type');
  assert.ok(prefs.includes('defaultAirportSource: null,'), 'defaulting to unrecorded');
  assert.ok(
    prefs.includes("parsed?.defaultAirportSource === 'auto' || parsed?.defaultAirportSource === 'manual'"),
    'and validated on load, so stored junk reads as unrecorded',
  );
});

test('[W/4] the toast copy exists in all 11 shipped languages', () => {
  const paths: Record<string, string> = {
    en: 'i18n/locales/en.json', nl: 'i18n/locales/nl.json', zh: 'zh_translations.json',
    th: 'i18n/locales/th.json', de: 'i18n/locales/de.json', ru: 'i18n/locales/ru.json',
    ja: 'i18n/locales/ja.json', ko: 'i18n/locales/ko.json', vi: 'i18n/locales/vi.json',
    id: 'i18n/locales/id.json', es: 'i18n/locales/es.json',
  };
  for (const [locale, path] of Object.entries(paths)) {
    const json = JSON.parse(read(path)) as Record<string, string>;
    assert.equal(typeof json.homeAirportFixed, 'string', `${locale} is missing homeAirportFixed`);
    assert.ok(json.homeAirportFixed.includes('{iata}'), `${locale} drops {iata}`);
  }
  assert.deepEqual(JSON.parse(read('lib/en_fn_params.json')).homeAirportFixed, ['iata']);
});

test('[W/4] the proxy drops airports with no scheduled service from both nearest routes', () => {
  const server = read('proxy/server.js');
  assert.equal(
    (server.match(/rankNearestAirports\(airports, lat, lon/g) || []).length, 2,
    'both /airports/nearest and /airports/search/term/:coords',
  );
  assert.ok(server.includes("require('./nearestAirports')"));
  assert.ok(server.includes('scheduledService: col.scheduled_service === undefined'), 'and the flag is stored');
  assert.ok(server.includes('type,'), 'along with the airport type, which was being discarded');
});
