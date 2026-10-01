import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/16e] the heading counts what was added, not what was ticked', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  assert.ok(
    screen.includes('t().gmailSuccessTrips(outcome.flightsAdded + outcome.bookingsAttached)'),
    'the real numbers',
  );
  assert.ok(!screen.includes('gmailSuccessTrips(imported)'), 'the ticked-mail count is gone');
  assert.ok(!screen.includes('setImported('), 'and so is the state that fed it');
});

test('[W/16e] the failure line no longer claims the mails were unreadable', () => {
  const i18n = read('lib/i18n.ts');
  assert.ok(i18n.includes("'1 email produced nothing'"), 'it says what actually happened');
  // Aim at the string literal, not at the comment that explains why it changed.
  assert.ok(!i18n.includes("'1 email could not be read'"), 'the old wording is gone from the copy');
  for (const [locale, path] of Object.entries({
    en: 'i18n/locales/en.json', nl: 'i18n/locales/nl.json', zh: 'zh_translations.json',
    th: 'i18n/locales/th.json', de: 'i18n/locales/de.json', ru: 'i18n/locales/ru.json',
    ja: 'i18n/locales/ja.json', ko: 'i18n/locales/ko.json', vi: 'i18n/locales/vi.json',
    id: 'i18n/locales/id.json', es: 'i18n/locales/es.json',
  })) {
    const json = JSON.parse(read(path)) as Record<string, string>;
    assert.ok(json.gmailResultFailed?.includes('{n}'), `${locale} keeps the plural form`);
    assert.ok(!/lezen|read|gelesen|leer/i.test(json.gmailResultFailed), `${locale} must not blame reading`);
  }
});

test('[W/16e] the three tier headings exist in all 11 languages', () => {
  for (const [locale, path] of Object.entries({
    en: 'i18n/locales/en.json', nl: 'i18n/locales/nl.json', zh: 'zh_translations.json',
    th: 'i18n/locales/th.json', de: 'i18n/locales/de.json', ru: 'i18n/locales/ru.json',
    ja: 'i18n/locales/ja.json', ko: 'i18n/locales/ko.json', vi: 'i18n/locales/vi.json',
    id: 'i18n/locales/id.json', es: 'i18n/locales/es.json',
  })) {
    const json = JSON.parse(read(path)) as Record<string, string>;
    for (const key of ['gmailMaybeTravel', 'gmailPromotions', 'gmailShowGroup']) {
      assert.ok(json[key]?.trim(), `${locale} is missing ${key}`);
    }
  }
  for (const locale of ['ar', 'fr', 'it', 'pt']) {
    const json = JSON.parse(read(`i18n/locales/${locale}.json`)) as Record<string, string>;
    assert.equal(json.gmailMaybeTravel, undefined, `${locale} should not have been touched`);
  }
});
