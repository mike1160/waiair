import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const screen = () => read('SettingsScreen.tsx');

test('[W/18] the Customer Center is no longer presented into a closing modal', () => {
  const s = screen();
  const fn = s.slice(s.indexOf('const openCustomerCenter = async ()'));
  const body = fn.slice(0, fn.indexOf('\n  };'));
  assert.ok(body.indexOf('onClose();') < body.indexOf('MODAL_HANDOFF_MS'), 'close first');
  assert.ok(body.indexOf('MODAL_HANDOFF_MS') < body.indexOf('presentCustomerCenter'), 'then wait, then present');
  assert.ok(body.includes('withSubscriptionTimeout(() => presentCustomerCenter())'), 'with a deadline');
});

test('[W/18] busy is put down unconditionally, not in a finally that may never run', () => {
  const s = screen();
  for (const name of ['const restore = async ()', 'const openCustomerCenter = async ()']) {
    const fn = s.slice(s.indexOf(name));
    const body = fn.slice(0, fn.indexOf('\n  };'));
    assert.ok(body.includes('setBusy(false);'), `${name} puts busy down`);
    assert.ok(!body.includes('} finally {'), `${name} no longer relies on finally`);
    assert.ok(body.includes('withSubscriptionTimeout('), `${name} has a deadline`);
  }
});

test('[W/18] reopening Settings clears a stuck flag', () => {
  const s = screen();
  assert.ok(s.includes('if (!visible) return;\n    setBusy(false);'), 'defensive reset on becoming visible');
  assert.ok(s.includes('setSubscriptionNote(null);'));
});

test('[W/18] the restore outcome is rendered in the screen, every branch', () => {
  const s = screen();
  assert.ok(s.includes('{subscriptionNote ? ('), 'the note is rendered');
  for (const key of ['copy.proRestored', 'copy.restoreNoneFound', 'copy.restorePartialFound',
    'copy.restoreTimedOut', 'copy.restoreFailed']) {
    assert.ok(s.includes(key), `${key} must be reachable`);
  }
  // The toast stays only for the Customer Center, where Settings is closed and a toast IS visible.
  const fn = s.slice(s.indexOf('const restore = async ()'));
  const body = fn.slice(0, fn.indexOf('\n  };'));
  assert.ok(!body.includes('onToast('), 'restore no longer reports through an invisible toast');
});

test('[W/18] the four outcome strings exist in all 11 shipped languages', () => {
  for (const [locale, path] of Object.entries({
    en: 'i18n/locales/en.json', nl: 'i18n/locales/nl.json', zh: 'zh_translations.json',
    th: 'i18n/locales/th.json', de: 'i18n/locales/de.json', ru: 'i18n/locales/ru.json',
    ja: 'i18n/locales/ja.json', ko: 'i18n/locales/ko.json', vi: 'i18n/locales/vi.json',
    id: 'i18n/locales/id.json', es: 'i18n/locales/es.json',
  })) {
    const json = JSON.parse(read(path)) as Record<string, string>;
    for (const key of ['restoreNoneFound', 'restorePartialFound', 'restoreFailed', 'restoreTimedOut']) {
      assert.ok(json[key]?.trim(), `${locale} is missing ${key}`);
    }
  }
  for (const locale of ['ar', 'fr', 'it', 'pt']) {
    const json = JSON.parse(read(`i18n/locales/${locale}.json`)) as Record<string, string>;
    assert.equal(json.restoreNoneFound, undefined, `${locale} should not have been touched`);
  }
});
