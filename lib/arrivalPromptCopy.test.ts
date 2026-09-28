import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/**
 * The arrival prompt, end to end in the files it has to exist in [W/3].
 *
 * Text-based, because App.tsx and the screen import react-native and cannot be loaded under node --test. It
 * covers the gap that has bitten before: a field added to the type and to storage, and never rendered.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const SHIPPED: Record<string, string> = {
  en: 'i18n/locales/en.json',
  nl: 'i18n/locales/nl.json',
  zh: 'zh_translations.json',
  th: 'i18n/locales/th.json',
  de: 'i18n/locales/de.json',
  ru: 'i18n/locales/ru.json',
  ja: 'i18n/locales/ja.json',
  ko: 'i18n/locales/ko.json',
  vi: 'i18n/locales/vi.json',
  id: 'i18n/locales/id.json',
  es: 'i18n/locales/es.json',
};

const KEYS = ['arrivalPromptQ', 'arrivalPromptYes', 'arrivalPromptNo'] as const;

test('[W/3] every shipped language has the three keys, with the placeholders they are given', () => {
  for (const [locale, path] of Object.entries(SHIPPED)) {
    const json = JSON.parse(read(path)) as Record<string, string>;
    for (const key of KEYS) {
      assert.equal(typeof json[key], 'string', `${locale} is missing ${key}`);
      assert.ok(json[key].trim().length > 0, `${locale} ${key} is empty`);
    }
    for (const ph of ['{flight}', '{destination}', '{arrive}']) {
      assert.ok(json.arrivalPromptQ.includes(ph), `${locale} arrivalPromptQ drops ${ph}`);
    }
    assert.ok(json.arrivalPromptYes.includes('{iata}'), `${locale} arrivalPromptYes drops {iata}`);
    assert.ok(json.arrivalPromptNo.includes('{iata}'), `${locale} arrivalPromptNo drops {iata}`);
  }
});

test('[W/3] the four untranslated locales are left alone', () => {
  // Standing constraint: 11 languages ship, and ar/fr/it/pt are not among them.
  for (const locale of ['ar', 'fr', 'it', 'pt']) {
    const json = JSON.parse(read(`i18n/locales/${locale}.json`)) as Record<string, string>;
    assert.equal(json.arrivalPromptQ, undefined, `${locale} should not have been touched`);
  }
});

test('[W/3] the parameter order matches the English function', () => {
  const params = JSON.parse(read('lib/en_fn_params.json')) as Record<string, string[]>;
  assert.deepEqual(params.arrivalPromptQ, ['flight', 'destination', 'arrive']);
  assert.deepEqual(params.arrivalPromptYes, ['iata']);
  assert.deepEqual(params.arrivalPromptNo, ['iata']);
  const i18n = read('lib/i18n.ts');
  assert.ok(i18n.includes('arrivalPromptQ: (flight: string, destination: string, arrive: string)'));
});

test('[W/3] the prompt is rendered, not merely stored', () => {
  const screen = read('screens/HomeTrackedScreen.tsx');
  assert.ok(screen.includes('function ArrivalPromptBar('), 'the bar exists');
  assert.ok(screen.includes('<ArrivalPromptBar'), 'and is rendered');
  assert.ok(
    screen.includes('!f.boardingPrompt && f.arrivalPrompt && onArrivalAnswer'),
    'gated so the two prompts can never both show',
  );
  assert.ok(screen.includes('copy.arrivalPromptQ('), 'through the translated copy');
});

test('[W/3] the app detects, carries and answers it', () => {
  const app = read('App.tsx');
  assert.ok(app.includes('suggestArrivalLeg(journey, tracked, airport.iata)'), 'detected off the same journey');
  assert.ok(app.includes('const boarding=suggestBoardingLeg('), 'boarding asked first');
  assert.ok(app.includes('boarding ? null : suggestArrivalLeg'), 'and only one of the two is ever set');
  assert.ok(app.includes('arrivalPrompt: t.arrivalPrompt || null,'), 'carried to the home screen');
  assert.ok(app.includes('onArrivalAnswer={(f, arriveHere)'), 'wired to the answer handler');
  assert.ok(app.includes('const answerArrivalPrompt=useCallback('), 'which exists');
  assert.ok(app.includes('rebased=arrivalLegFlight(journey, prompt.arriveIata);'), 'and re-bases on yes');
});
