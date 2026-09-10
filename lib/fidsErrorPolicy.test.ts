import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { recoverFidsError, isFidsEmptySentinel, showBoardEmptyCopy } from './fidsErrorPolicy.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const timeout = Object.assign(new Error('Request timed out'), { name: 'TimeoutError' });
const http502 = Object.assign(new Error('HTTP 502'), { status: 502 });
const emptyDep = new Error('ADB_DEP_EMPTY');
const emptyArr = new Error('ADB_ARR_EMPTY');

test('200-empty sentinel is no-data, not a transport error', () => {
  assert.equal(isFidsEmptySentinel(emptyDep), true);
  assert.equal(isFidsEmptySentinel(emptyArr), true);
  assert.equal(isFidsEmptySentinel(timeout), false);
  assert.equal(isFidsEmptySentinel(http502), false);
});

test('live board: true empty stays empty; OpenSky can fill', () => {
  assert.equal(recoverFidsError({
    error: emptyDep, hasDate: false, offsetDays: 0, cachedCount: 0, openSkyCount: 0,
  }), 'empty');
  assert.equal(recoverFidsError({
    error: emptyDep, hasDate: false, offsetDays: 0, cachedCount: 0, openSkyCount: 3,
  }), 'opensky');
  assert.equal(recoverFidsError({
    error: emptyArr, hasDate: false, offsetDays: 0, cachedCount: 4, openSkyCount: 0,
  }), 'cache');
});

test('live board: timeout/non-200 throws unless OpenSky or cache has flights', () => {
  assert.equal(recoverFidsError({
    error: timeout, hasDate: false, offsetDays: 0, cachedCount: 0, openSkyCount: 0,
  }), 'throw');
  assert.equal(recoverFidsError({
    error: http502, hasDate: false, offsetDays: 0, cachedCount: 0, openSkyCount: 0,
  }), 'throw');
  assert.equal(recoverFidsError({
    error: timeout, hasDate: false, offsetDays: 0, cachedCount: 0, openSkyCount: 2,
  }), 'opensky');
  assert.equal(recoverFidsError({
    error: http502, hasDate: false, offsetDays: 0, cachedCount: 5, openSkyCount: 0,
  }), 'cache');
});

test('calendar day (home today / board tomorrow): no OpenSky; cache or throw', () => {
  assert.equal(recoverFidsError({
    error: timeout, hasDate: true, offsetDays: 0, cachedCount: 0, openSkyCount: 9,
  }), 'throw');
  assert.equal(recoverFidsError({
    error: http502, hasDate: true, offsetDays: 0, cachedCount: 2, openSkyCount: 0,
  }), 'cache');
  assert.equal(recoverFidsError({
    error: timeout, hasDate: false, offsetDays: 1, cachedCount: 0,
  }), 'throw');
  assert.equal(recoverFidsError({
    error: emptyDep, hasDate: true, offsetDays: 0, cachedCount: 0,
  }), 'empty');
});

test('caller contracts: throw vs intentional empty', () => {
  const callers = [
    { name: 'home empty lookup (fullDay)', hasDate: true, offsetDays: 0, onThrow: 'error-copy' },
    { name: 'board load today', hasDate: false, offsetDays: 0, onThrow: 'cache-or-loadTimeout' },
    { name: 'board load other day', hasDate: true, offsetDays: 1, onThrow: 'empty-board' },
    { name: 'runRouteSearch', hasDate: false, offsetDays: 0, onThrow: 'empty-hits' },
    { name: 'second airport arrivals', hasDate: false, offsetDays: 0, onThrow: 'empty-or-keep' },
    { name: 'global place search', hasDate: false, offsetDays: 0, onThrow: 'empty-hits' },
    { name: 'detail baggage enrich', hasDate: false, offsetDays: 0, onThrow: 'keep-flight' },
  ] as const;

  for (const c of callers) {
    const liveEmpty = recoverFidsError({
      error: emptyDep, hasDate: false, offsetDays: 0, cachedCount: 0, openSkyCount: 0,
    });
    assert.equal(liveEmpty, 'empty', `${c.name}: 200-empty must stay empty`);
    const transport = recoverFidsError({
      error: timeout, hasDate: c.hasDate, offsetDays: c.offsetDays, cachedCount: 0, openSkyCount: 0,
    });
    assert.equal(transport, 'throw', `${c.name}: timeout without cache must throw`);
  }

  assert.equal(
    recoverFidsError({ error: timeout, hasDate: true, offsetDays: 0, cachedCount: 0 }),
    'throw',
    'home today fullDay: timeout is not "no flights found"',
  );
});

test('board empty copy stays for no-data, hides under a load error banner', () => {
  assert.equal(showBoardEmptyCopy({ error: '', routeMode: false, hasQuery: false }), true);
  assert.equal(showBoardEmptyCopy({ error: 'Taking too long', routeMode: false, hasQuery: false }), false);
  assert.equal(showBoardEmptyCopy({ error: '', routeMode: true, hasQuery: false }), true);
  assert.equal(showBoardEmptyCopy({ error: 'Taking too long', routeMode: true, hasQuery: false }), true);
  assert.equal(showBoardEmptyCopy({ error: '', routeMode: false, hasQuery: true }), true);
});

test('homeDepartedAtScheduled suffix is translated (NL schema)', () => {
  const files: Record<string, string> = {
    en: 'i18n/locales/en.json',
    nl: 'i18n/locales/nl.json',
    de: 'i18n/locales/de.json',
    es: 'i18n/locales/es.json',
    id: 'i18n/locales/id.json',
    ja: 'i18n/locales/ja.json',
    ko: 'i18n/locales/ko.json',
    ru: 'i18n/locales/ru.json',
    th: 'i18n/locales/th.json',
    vi: 'i18n/locales/vi.json',
    zh: 'zh_translations.json',
  };
  const en = JSON.parse(readFileSync(join(ROOT, files.en), 'utf8')) as Record<string, string>;
  assert.equal(en.homeDepartedAtScheduled, 'departed {time} (scheduled)');
  const nl = JSON.parse(readFileSync(join(ROOT, files.nl), 'utf8')) as Record<string, string>;
  assert.ok(nl.homeDepartedAtScheduled.includes('(schema)'), nl.homeDepartedAtScheduled);
  for (const [loc, rel] of Object.entries(files)) {
    if (loc === 'en') continue;
    const json = JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Record<string, string>;
    const val = json.homeDepartedAtScheduled || '';
    assert.ok(val && !val.includes('(scheduled)'), `${loc} leaked English suffix: ${val}`);
  }
});
