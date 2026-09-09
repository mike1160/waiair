import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLocalizedCity, iatasForCityQuery } from './cityLocalized.ts';

const SEOUL: Record<string, string> = {
  en: 'Seoul',
  nl: 'Seoul',
  de: 'Seoul',
  es: 'Seúl',
  vi: 'Seoul',
  id: 'Seoul',
  th: 'โซล',
  ja: 'ソウル',
  ko: '서울',
  zh: '首尔',
  ru: 'Сеул',
};

const BANGKOK: Record<string, string> = {
  en: 'Bangkok',
  nl: 'Bangkok',
  de: 'Bangkok',
  es: 'Bangkok',
  vi: 'Bangkok',
  id: 'Bangkok',
  th: 'กรุงเทพฯ',
  ja: 'バンコク',
  ko: '방콕',
  zh: '曼谷',
  ru: 'Бангкок',
};

test('ICN / BKK city names are localized in all 11 locales', () => {
  for (const [loc, name] of Object.entries(SEOUL)) {
    assert.equal(getLocalizedCity('ICN', loc, 'Seoul'), name, `ICN ${loc}`);
    assert.equal(getLocalizedCity('GMP', loc, 'Seoel'), name, `GMP ${loc}`);
  }
  for (const [loc, name] of Object.entries(BANGKOK)) {
    assert.equal(getLocalizedCity('BKK', loc, 'Bangkok'), name, `BKK ${loc}`);
  }
});

test('non-NL locales never fall back to a Dutch catalog city', () => {
  assert.equal(getLocalizedCity('GMP', 'th', 'Seoel'), 'โซล');
  assert.equal(getLocalizedCity('GMP', 'en', 'Seoel'), 'Seoul');
  assert.equal(getLocalizedCity('LHR', 'th', 'Londen'), 'ลอนดอน');
  assert.equal(getLocalizedCity('LHR', 'en', 'Londen'), 'London');
});

test('Dutch UI shows Seoul / Beirut, not dated oe-exonyms', () => {
  assert.equal(getLocalizedCity('ICN', 'nl', 'Seoul'), 'Seoul');
  assert.equal(getLocalizedCity('GMP', 'nl', 'Seoel'), 'Seoul');
  assert.equal(getLocalizedCity('BEY', 'nl', 'Beiroet'), 'Beirut');
  assert.equal(getLocalizedCity('PEK', 'nl', 'Peking'), 'Peking');
});

test('dated NL spellings still resolve in search', () => {
  assert.ok(iatasForCityQuery('Seoel').includes('ICN'));
  assert.ok(iatasForCityQuery('Seoel').includes('GMP'));
  assert.ok(iatasForCityQuery('Beiroet').includes('BEY'));
});
