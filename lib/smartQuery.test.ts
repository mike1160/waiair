import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSmartQuery, homeSearchCanFetch, resolveBoardSearch } from './smartQuery.ts';

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

  const vn = parse('Vietnam');
  assert.equal(vn.destination, undefined);
  assert.deepEqual(vn.destinations, ['SGN', 'HAN']);
  assert.equal(vn.placeMode, 'choose');
  assert.equal(homeSearchCanFetch(vn), false);
  const vnPicked = parse('Vietnam SGN');
  assert.equal(vnPicked.destination, 'SGN');
  assert.equal(vnPicked.placeMode, undefined);
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
