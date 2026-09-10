import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  localeFromDeviceLocales,
  resolveAppLocale,
  type LocaleHint,
} from './deviceLocale.ts';

function hints(...tags: string[]): LocaleHint[] {
  return tags.map(languageTag => ({
    languageTag,
    languageCode: languageTag.split(/[-_]/)[0],
  }));
}

test('device locale: en-* → en, zh-* → zh, plus the other nine shipped languages', () => {
  assert.equal(localeFromDeviceLocales(hints('en-US')), 'en');
  assert.equal(localeFromDeviceLocales(hints('en-GB')), 'en');
  assert.equal(localeFromDeviceLocales(hints('nl-NL')), 'nl');
  assert.equal(localeFromDeviceLocales(hints('th-TH')), 'th');
  assert.equal(localeFromDeviceLocales(hints('zh-CN')), 'zh');
  assert.equal(localeFromDeviceLocales(hints('zh-TW')), 'zh');
  assert.equal(localeFromDeviceLocales(hints('zh-HK')), 'zh');
  assert.equal(localeFromDeviceLocales(hints('de-DE')), 'de');
  assert.equal(localeFromDeviceLocales(hints('ru-RU')), 'ru');
  assert.equal(localeFromDeviceLocales(hints('ja-JP')), 'ja');
  assert.equal(localeFromDeviceLocales(hints('ko-KR')), 'ko');
  assert.equal(localeFromDeviceLocales(hints('vi-VN')), 'vi');
  assert.equal(localeFromDeviceLocales(hints('id-ID')), 'id');
  assert.equal(localeFromDeviceLocales([{ languageTag: 'in-ID', languageCode: 'in' }]), 'id');
  assert.equal(localeFromDeviceLocales(hints('es-MX')), 'es');
});

test('device locale walks the preference list so a later shipped language wins over an unmatched first', () => {
  assert.equal(localeFromDeviceLocales(hints('pt-BR', 'th-TH')), 'th');
  assert.equal(localeFromDeviceLocales(hints('fr-FR', 'ko-KR')), 'ko');
  assert.equal(localeFromDeviceLocales(hints('pt-BR')), 'en');
});

test('first launch with no stored locale uses the device; saved locale is kept', () => {
  assert.equal(resolveAppLocale({
    storedLocale: null,
    prefsExist: false,
    deviceLocales: hints('ja-JP'),
  }), 'ja');
  assert.equal(resolveAppLocale({
    storedLocale: 'en',
    prefsExist: true,
    deviceLocales: hints('th-TH'),
  }), 'en');
  assert.equal(resolveAppLocale({
    storedLocale: 'nope',
    prefsExist: true,
    deviceLocales: hints('ko-KR'),
  }), 'ko');
});
