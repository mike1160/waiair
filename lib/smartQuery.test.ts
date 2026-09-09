import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSmartQuery,
  homeSearchCanFetch,
  applyPickedChooseHub,
  resolveBoardSearch,
  formatReflectLine,
  REFLECT_COPY,
  type ReflectLocale,
  type SmartQuery,
} from './smartQuery.ts';

/** Wednesday 9 Sep 2026, local noon — weekday/relative dates are stable. */
const NOW = new Date(2026, 8, 9, 12, 0, 0);

function parse(raw: string, home = 'HKT') {
  return parseSmartQuery(raw, { now: NOW, homeIata: home });
}

test('OZ747 and oz 747 are flight numbers for today', () => {
  for (const q of ['OZ747', 'oz 747', 'Oz 747']) {
    const r = parse(q);
    assert.equal(r.flightNumber, 'OZ747', q);
    assert.equal(r.dateKind, 'today');
    assert.equal(r.date, '2026-09-09');
  }
});

test('Incheon / Seoul / ICN / Korea resolve as destination', () => {
  const incheon = parse('Incheon');
  assert.equal(incheon.destination, 'ICN');
  assert.equal(incheon.origin, 'HKT');
  assert.equal(incheon.needsDate, true);

  const icn = parse('ICN');
  assert.equal(icn.destination, 'ICN');

  const seoul = parse('Seoul');
  assert.equal(seoul.destination, 'ICN');
  assert.deepEqual(seoul.destinations, ['ICN', 'GMP']);
  assert.equal(seoul.placeMode, 'merge');
  assert.equal(seoul.ambiguous, undefined);

  const korea = parse('Korea');
  assert.equal(korea.destination, 'ICN');
  assert.ok(korea.destinations?.includes('GMP'));
  assert.equal(korea.placeMode, 'merge');
});

test('Phuket Seoul saturday is a route plus weekday', () => {
  const r = parse('Phuket Seoul saturday');
  assert.equal(r.origin, 'HKT');
  assert.equal(r.destination, 'ICN');
  assert.deepEqual(r.destinations, ['ICN', 'GMP']);
  assert.equal(r.dateKind, 'weekday');
  assert.equal(r.weekday, 6);
  assert.equal(r.date, '2026-09-12');
});

test('Incheon tomorrow 17:20 keeps dest, day and time', () => {
  const r = parse('Incheon tomorrow 17:20');
  assert.equal(r.destination, 'ICN');
  assert.equal(r.dateKind, 'tomorrow');
  assert.equal(r.date, '2026-09-10');
  assert.equal(r.time, '17:20');
  assert.equal(r.needsDate, undefined);
});

test('Bangkok next week is dest plus week', () => {
  const r = parse('Bangkok next week');
  assert.equal(r.destination, 'BKK');
  assert.ok(r.destinations?.includes('DMK'));
  assert.equal(r.dateKind, 'next_week');
  assert.equal(r.date, '2026-09-16');
});

test('Asiana tomorrow is airline OZ from home', () => {
  const r = parse('Asiana tomorrow');
  assert.equal(r.airline, 'OZ');
  assert.equal(r.dateKind, 'tomorrow');
  assert.equal(r.origin, 'HKT');
});

test('BKK–AMS 22 aug is a yearless route date (this/next year)', () => {
  const r = parse('BKK–AMS 22 aug', 'HKT');
  assert.equal(r.origin, 'BKK');
  assert.equal(r.destination, 'AMS');
  assert.equal(r.dateKind, 'absolute');
  assert.equal(r.date, '2027-08-22');
});

const DEST_WORDS: { lang: string; dest: string; destIata: string }[] = [
  { lang: 'en', dest: 'Incheon', destIata: 'ICN' },
  { lang: 'nl', dest: 'Incheon', destIata: 'ICN' },
  { lang: 'de', dest: 'Incheon', destIata: 'ICN' },
  { lang: 'es', dest: 'Incheon', destIata: 'ICN' },
  { lang: 'id', dest: 'Incheon', destIata: 'ICN' },
  { lang: 'vi', dest: 'Incheon', destIata: 'ICN' },
  { lang: 'th', dest: 'อินชอน', destIata: 'ICN' },
  { lang: 'ja', dest: '仁川', destIata: 'ICN' },
  { lang: 'ko', dest: '인천', destIata: 'ICN' },
  { lang: 'zh', dest: '仁川', destIata: 'ICN' },
  { lang: 'ru', dest: 'Инчхон', destIata: 'ICN' },
];

const SATURDAY: { lang: string; day: string }[] = [
  { lang: 'en', day: 'saturday' },
  { lang: 'nl', day: 'zaterdag' },
  { lang: 'de', day: 'Samstag' },
  { lang: 'es', day: 'sábado' },
  { lang: 'id', day: 'Sabtu' },
  { lang: 'vi', day: 'Thứ bảy' },
  { lang: 'th', day: 'วันเสาร์' },
  { lang: 'ja', day: '土曜日' },
  { lang: 'ko', day: '토요일' },
  { lang: 'zh', day: '星期六' },
  { lang: 'ru', day: 'суббота' },
];

const SEOUL_WORDS: { lang: string; word: string }[] = [
  { lang: 'en', word: 'Seoul' },
  { lang: 'nl', word: 'Seoel' },
  { lang: 'de', word: 'Seoul' },
  { lang: 'es', word: 'Seúl' },
  { lang: 'id', word: 'Seoul' },
  { lang: 'vi', word: 'Seoul' },
  { lang: 'th', word: 'โซล' },
  { lang: 'ja', word: 'ソウル' },
  { lang: 'ko', word: '서울' },
  { lang: 'zh', word: '首尔' },
  { lang: 'ru', word: 'Сеул' },
];

test('destination words in all 11 languages resolve to ICN', () => {
  for (const row of DEST_WORDS) {
    const r = parse(row.dest);
    assert.equal(r.destination, row.destIata, row.lang);
  }
});

test('Saturday in all 11 languages is weekday 6 (12 Sep 2026)', () => {
  for (const row of SATURDAY) {
    const r = parse(`Incheon ${row.day}`);
    assert.equal(r.destination, 'ICN', row.lang);
    assert.equal(r.dateKind, 'weekday', row.lang);
    assert.equal(r.weekday, 6, row.lang);
    assert.equal(r.date, '2026-09-12', row.lang);
  }
});

test('destination equal to home airport is an arrival search, never origin === dest', () => {
  for (const q of ['Bangkok', 'BKK', 'Bangkok BKK']) {
    const r = parse(q, 'BKK');
    assert.equal(r.destination, 'BKK', q);
    assert.notEqual(r.origin, r.destination, q);
    assert.equal(r.origin, undefined, q);
    assert.equal(r.needsOrigin, true, q);
  }
});

test('explicit other origin to home dest stays a route, not a loop', () => {
  const r = parse('Phuket Bangkok', 'BKK');
  assert.equal(r.origin, 'HKT');
  assert.equal(r.destination, 'BKK');
  assert.notEqual(r.origin, r.destination);
});

test('Seoul city words in all 11 languages hit ICN+GMP', () => {
  for (const row of SEOUL_WORDS) {
    const r = parse(row.word);
    assert.equal(r.destination, 'ICN', `${row.lang} ${row.word}`);
    assert.ok(r.destinations?.includes('GMP'), row.lang);
    assert.equal(r.placeMode, 'merge', row.lang);
    assert.equal(r.ambiguous, undefined, row.lang);
  }
});

test('Taiwan in all 11 languages is a choose-hub (no fetch until TPE or KHH)', () => {
  const words = [
    { lang: 'en', word: 'Taiwan' },
    { lang: 'nl', word: 'Taiwan' },
    { lang: 'de', word: 'Taiwan' },
    { lang: 'es', word: 'Taiwán' },
    { lang: 'id', word: 'Taiwan' },
    { lang: 'vi', word: 'Đài Loan' },
    { lang: 'th', word: 'ไต้หวัน' },
    { lang: 'ja', word: '台湾' },
    { lang: 'ko', word: '대만' },
    { lang: 'zh', word: '台湾' },
    { lang: 'ru', word: 'Тайвань' },
  ];
  for (const row of words) {
    const r = parse(row.word);
    assert.equal(r.destination, undefined, `${row.lang} ${row.word}`);
    assert.deepEqual(r.destinations, ['TPE', 'KHH'], row.lang);
    assert.equal(r.placeMode, 'choose', row.lang);
    assert.equal(r.ambiguous, undefined, row.lang);
    assert.equal(homeSearchCanFetch(r), false, row.lang);
  }
});

test('Japan / Seoul / Shanghai / Bangkok merge; Vietnam / Taiwan / China choose', () => {
  const jp = parse('Japan');
  assert.equal(jp.destination, 'HND');
  assert.deepEqual(jp.destinations, ['HND', 'NRT']);
  assert.equal(jp.placeMode, 'merge');
  assert.equal(jp.ambiguous, undefined);
  assert.equal(homeSearchCanFetch({ ...jp, dateKind: 'today' }), true);

  const vn = parse('Vietnam', 'BKK');
  assert.equal(vn.origin, 'BKK');
  assert.equal(vn.destination, undefined);
  assert.deepEqual(vn.destinations, ['SGN', 'HAN']);
  assert.equal(vn.placeMode, 'choose');
  assert.equal(vn.needsOrigin, undefined);
  assert.equal(homeSearchCanFetch(vn), false);
  const vnPicked = applyPickedChooseHub(vn, 'SGN');
  assert.equal(vnPicked.origin, 'BKK');
  assert.equal(vnPicked.destination, 'SGN');
  assert.equal(vnPicked.placeMode, undefined);
  assert.equal(vnPicked.needsOrigin, undefined);
  assert.equal(homeSearchCanFetch({ ...vnPicked, dateKind: 'today' }), true);

  const kr = parse('Korea');
  assert.equal(kr.placeMode, 'merge');
  assert.ok(kr.destinations?.includes('GMP'));

  const sh = parse('Shanghai');
  assert.equal(sh.placeMode, 'merge');
  assert.ok(sh.destinations?.includes('PVG') && sh.destinations?.includes('SHA'));

  const bk = parse('Bangkok');
  assert.equal(bk.placeMode, 'merge');
  assert.deepEqual(bk.destinations, ['BKK', 'DMK']);

  const cn = parse('China');
  assert.equal(cn.placeMode, 'choose');
  assert.equal(cn.destination, undefined);
  assert.ok(cn.destinations?.includes('PEK') && cn.destinations?.includes('PVG'));
  assert.equal(homeSearchCanFetch(cn), false);
});

test('Indonesia and Thailand countries resolve to the main hub, not a catalogue-order airport', () => {
  const id = parse('Indonesia');
  assert.equal(id.destination, 'CGK');
  assert.equal(id.destinations, undefined);

  const th = parse('Thailand');
  assert.equal(th.destination, 'BKK');
  assert.equal(th.destinations, undefined);
});

test('board search uses the same parser: flight, route, home arrivals', () => {
  const flight = resolveBoardSearch('OZ747', { now: NOW, homeIata: 'HKT' });
  assert.equal(flight.kind, 'flight');
  if (flight.kind === 'flight') assert.equal(flight.flightNumber, 'OZ747');

  const route = resolveBoardSearch('Incheon', { now: NOW, homeIata: 'HKT' });
  assert.equal(route.kind, 'route');
  if (route.kind === 'route') {
    assert.equal(route.origin, 'HKT');
    assert.equal(route.destination, 'ICN');
  }

  const home = resolveBoardSearch('Bangkok', { now: NOW, homeIata: 'BKK' });
  assert.equal(home.kind, 'place');
  if (home.kind === 'place') {
    assert.equal(home.iata, 'BKK');
    assert.equal(home.arrivalsOnly, true);
  }
});

test('originSource is home when GPS/home fills origin, typed when the user wrote it', () => {
  const inferred = parse('Seoul', 'HKT');
  assert.equal(inferred.origin, 'HKT');
  assert.equal(inferred.originSource, 'home');

  const typed = parse('Phuket Seoul', 'AMS');
  assert.equal(typed.origin, 'HKT');
  assert.equal(typed.originSource, 'typed');
});

const LOCALES: ReflectLocale[] = ['en', 'nl', 'de', 'es', 'id', 'vi', 'ru', 'th', 'ja', 'ko', 'zh'];

const COMPLETE: SmartQuery = {
  destination: 'ICN',
  origin: 'BKK',
  dateKind: 'tomorrow',
  originSource: 'typed',
};

const LABELS = {
  dest: 'Seoul',
  origin: 'Bangkok',
  date: 'tomorrow',
};

function joinReflect(locale: ReflectLocale, q: SmartQuery, labels: typeof LABELS = LABELS): string {
  const line = formatReflectLine(q, locale, labels);
  const slots = line.segments.filter(s => s.kind !== 'check').map(s => s.text);
  const body = slots.join(' · ');
  const check = line.segments.some(s => s.kind === 'check') ? '✓ ' : '';
  return `${check}${body}`;
}

test('formatReflectLine complete phrase uses each locale\'s own particles, not English To/from', () => {
  const expected: Record<ReflectLocale, string> = {
    en: '✓ To Seoul · tomorrow · from Bangkok',
    nl: '✓ Naar Seoul · tomorrow · vanuit Bangkok',
    de: '✓ Nach Seoul · tomorrow · von Bangkok',
    es: '✓ A Seoul · tomorrow · desde Bangkok',
    id: '✓ Ke Seoul · tomorrow · dari Bangkok',
    vi: '✓ Đến Seoul · tomorrow · từ Bangkok',
    ru: '✓ В Seoul · tomorrow · из Bangkok',
    th: '✓ ไป Seoul · tomorrow · จาก Bangkok',
    ja: '✓ Seoulへ · tomorrow · Bangkokから',
    ko: '✓ Seoul로 · tomorrow · Bangkok에서',
    zh: '✓ 到Seoul · tomorrow · 从Bangkok',
  };
  for (const loc of LOCALES) {
    const got = joinReflect(loc, COMPLETE);
    assert.equal(got, expected[loc], loc);
    assert.equal(formatReflectLine(COMPLETE, loc, LABELS).state, 'complete', loc);
  }
  for (const loc of ['th', 'ja', 'ko', 'zh'] as const) {
    const got = joinReflect(loc, COMPLETE);
    assert.equal(got.startsWith('✓ To '), false, loc);
    assert.equal(got.includes(' from '), false, loc);
  }
  const ja = formatReflectLine(COMPLETE, 'ja', { dest: 'ソウル', origin: 'バンコク', date: '明日' });
  assert.equal(ja.segments.find(s => s.slot === 'dest')?.text, 'ソウルへ');
  assert.equal(ja.segments.find(s => s.slot === 'origin')?.text, 'バンコクから');
  const ko = formatReflectLine(COMPLETE, 'ko', { dest: '서울', origin: '방콕', date: '내일' });
  assert.equal(ko.segments.find(s => s.slot === 'dest')?.text, '서울로');
  assert.equal(ko.segments.find(s => s.slot === 'origin')?.text, '방콕에서');
  const zh = formatReflectLine(COMPLETE, 'zh', { dest: '首尔', origin: '曼谷', date: '明天' });
  assert.equal(zh.segments.find(s => s.slot === 'dest')?.text, '到首尔');
  assert.equal(zh.segments.find(s => s.slot === 'origin')?.text, '从曼谷');
  const th = formatReflectLine(COMPLETE, 'th', { dest: 'โซล', origin: 'กรุงเทพ', date: 'พรุ่งนี้' });
  assert.equal(th.segments.find(s => s.slot === 'dest')?.text, 'ไป โซล');
  assert.equal(th.segments.find(s => s.slot === 'origin')?.text, 'จาก กรุงเทพ');
});

test('formatReflectLine partial marks missing slots as ? and inferred origin', () => {
  const partial: SmartQuery = {
    destination: 'ICN',
    dateKind: 'tomorrow',
    needsOrigin: true,
  };
  const line = formatReflectLine(partial, 'en', { dest: 'Seoul', date: 'tomorrow' });
  assert.equal(line.state, 'partial');
  assert.equal(line.segments.some(s => s.kind === 'check'), false);
  const origin = line.segments.find(s => s.slot === 'origin');
  assert.equal(origin?.missing, true);
  assert.equal(origin?.text, 'from ?');

  const inferred: SmartQuery = {
    destination: 'ICN',
    origin: 'HKT',
    dateKind: 'today',
    originSource: 'home',
  };
  const homeLine = formatReflectLine(inferred, 'en', {
    dest: 'Seoul',
    origin: 'Phuket',
    date: 'today',
  });
  assert.equal(homeLine.state, 'complete');
  assert.equal(homeLine.segments.find(s => s.slot === 'origin')?.inferred, true);
});

test('formatReflectLine choose-hub waits for a city chip', () => {
  const q: SmartQuery = {
    origin: 'BKK',
    destinations: ['SGN', 'HAN'],
    placeMode: 'choose',
    dateKind: 'today',
  };
  for (const loc of LOCALES) {
    const line = formatReflectLine(q, loc, {
      country: 'Vietnam',
      chooseA: 'Ho Chi Minh',
      chooseB: 'Hanoi',
    });
    assert.equal(line.state, 'choose', loc);
    assert.equal(line.segments.length, 1, loc);
    assert.equal(line.segments[0].text, REFLECT_COPY[loc].choose('Vietnam', 'Ho Chi Minh', 'Hanoi'), loc);
  }
});

test('formatReflectLine empty for blank or flight-number-only', () => {
  assert.equal(formatReflectLine({}, 'en').state, 'empty');
  assert.equal(formatReflectLine({ flightNumber: 'OZ747', dateKind: 'today' }, 'ja').state, 'empty');
});

test('locale JSON reflect templates match native particle order (not English To/from)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const files: Record<ReflectLocale, string> = {
    en: 'i18n/locales/en.json',
    nl: 'i18n/locales/nl.json',
    de: 'i18n/locales/de.json',
    es: 'i18n/locales/es.json',
    id: 'i18n/locales/id.json',
    vi: 'i18n/locales/vi.json',
    ru: 'i18n/locales/ru.json',
    th: 'i18n/locales/th.json',
    ja: 'i18n/locales/ja.json',
    ko: 'i18n/locales/ko.json',
    zh: 'zh_translations.json',
  };
  for (const loc of LOCALES) {
    const json = JSON.parse(readFileSync(join(root, files[loc]), 'utf8')) as Record<string, string>;
    const dest = String(json.homeReflectDest || '').replace('{name}', 'Seoul');
    const origin = String(json.homeReflectFrom || '').replace('{name}', 'Bangkok');
    assert.equal(dest, REFLECT_COPY[loc].dest('Seoul'), loc);
    assert.equal(origin, REFLECT_COPY[loc].origin('Bangkok'), loc);
    const choose = String(json.homeReflectChoose || '')
      .replace('{country}', 'Vietnam')
      .replace('{a}', 'Ho Chi Minh')
      .replace('{b}', 'Hanoi');
    assert.equal(choose, REFLECT_COPY[loc].choose('Vietnam', 'Ho Chi Minh', 'Hanoi'), loc);
  }
  const ja = JSON.parse(readFileSync(join(root, files.ja), 'utf8')) as Record<string, string>;
  assert.equal(ja.homeReflectDest.startsWith('To '), false);
  assert.equal(ja.homeReflectDest.includes('{name}へ'), true);
});
