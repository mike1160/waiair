import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANGUAGE_OPTIONS } from './languages.ts';

test('language picker names are in each language\'s own script', () => {
  const byCode = Object.fromEntries(LANGUAGE_OPTIONS.map(l => [l.code, l.name]));
  assert.equal(byCode.en, 'English');
  assert.equal(byCode.nl, 'Nederlands');
  assert.equal(byCode.th, 'ไทย');
  assert.equal(byCode.zh, '中文');
  assert.equal(byCode.de, 'Deutsch');
  assert.equal(byCode.ru, 'Русский');
  assert.equal(byCode.ja, '日本語');
  assert.equal(byCode.ko, '한국어');
  assert.equal(byCode.vi, 'Tiếng Việt');
  assert.equal(byCode.id, 'Indonesia');
  assert.equal(byCode.es, 'Español');
  assert.equal(LANGUAGE_OPTIONS.length, 11);
});
