import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { daysUntilDeparture, hoursUntilCheckin, nowPhaseId, nowPhaseLines, type NowPhaseCopy } from './nowPhase.ts';

const COPY: NowPhaseCopy = {
  nowTomorrow: 'Your flight is tomorrow',
  nowInDays: (days: number) => `Your flight is in ${days} days`,
  nowTomorrowSub: (h: number) => `Check-in opens in ${h} hours`,
  nowDayAfterTomorrow: 'Your flight is the day after tomorrow',
  nowInDays: (d: number) => `Your flight is in ${d} days`,
  nowCheckinOpensInDays: (d: number) => `Check-in opens in ${d} days`,
  nowCheckinOpen: 'Check-in is open',
  nowCheckinOpenSub: 'Add your boarding pass to Wallet',
  nowPrepare: 'Time to prepare',
  nowPrepareSub: 'Check traffic to the airport',
  nowHeadToAirport: 'Head to the airport',
  nowHeadToAirportSub: 'Allow extra time for security',
  nowAtAirportNow: 'You should be at the airport now',
  nowAtAirportNowSub: 'Go straight to your gate',
  nowBoardingSoon: 'Boarding soon',
  nowBoardingSoonSub: 'Have your boarding pass ready',
  nowOnYourWay: "You're on your way",
  nowOnYourWaySub: (d: string) => `Arrives in ${d}`,
  nowWelcomeTo: (c: string) => `Welcome to ${c}`,
  nowBaggageTerminal: (term: string) => `Baggage claim at terminal ${term}`,
  nowBaggageClaim: 'Baggage claim',
  nowCheckDetails: 'Check your flight details',
};

test('the phase ladder follows the time left until departure', () => {
  assert.equal(nowPhaseId({ minutesToDeparture: 48 * 60 }), 'tomorrow');
  assert.equal(nowPhaseId({ minutesToDeparture: 24 * 60 + 1 }), 'tomorrow');
  assert.equal(nowPhaseId({ minutesToDeparture: 24 * 60 }), 'checkin', '24h: check-in is open');
  assert.equal(nowPhaseId({ minutesToDeparture: 12 * 60 + 1 }), 'checkin');
  assert.equal(nowPhaseId({ minutesToDeparture: 12 * 60 }), 'prepare');
  assert.equal(nowPhaseId({ minutesToDeparture: 3 * 60 + 1 }), 'prepare');
  assert.equal(nowPhaseId({ minutesToDeparture: 3 * 60 }), 'head');
  assert.equal(nowPhaseId({ minutesToDeparture: 61 }), 'head');
  assert.equal(nowPhaseId({ minutesToDeparture: 60 }), 'airport', 'inside the hour');
  assert.equal(nowPhaseId({ minutesToDeparture: -20 }), 'airport', 'past the time but not departed');
});

test('boarding, departed and landed only apply once departure time has passed', () => {
  assert.equal(nowPhaseId({ minutesToDeparture: 6 * 24 * 60, landed: true }), 'tomorrow');
  assert.equal(nowPhaseId({ minutesToDeparture: 3 * 24 * 60, landed: true, departed: true, boarding: true }), 'tomorrow');
  assert.equal(nowPhaseId({ minutesToDeparture: 2 * 60, boarding: true, departed: true, landed: true }), 'head');
  assert.equal(nowPhaseId({ minutesToDeparture: 5, boarding: true, departed: true }), 'airport', 'not departed yet');
  assert.equal(nowPhaseId({ minutesToDeparture: -30, landed: true }), 'landed');
  assert.equal(nowPhaseId({ minutesToDeparture: -10, departed: true }), 'inflight');
  assert.equal(nowPhaseId({ minutesToDeparture: -5, boarding: true, departed: true }), 'inflight', 'departed wins');
  assert.equal(nowPhaseId({ minutesToDeparture: null, landed: true }), 'landed');
  assert.equal(nowPhaseId({ minutesToDeparture: null, boarding: true }), 'boarding');
});

test('the >24h phase holds every day until 24h before departure', () => {
  for (const day of [6, 5, 4, 3, 2]) {
    const minutes = day * 24 * 60 + 90;
    assert.equal(nowPhaseId({ minutesToDeparture: minutes, landed: true }), 'tomorrow', `${day} days`);
    assert.equal(daysUntilDeparture(minutes, day), day);
  }
  assert.equal(nowPhaseId({ minutesToDeparture: 30 * 60, landed: true }), 'tomorrow');
  assert.equal(daysUntilDeparture(30 * 60, 1), 1, 'calendar tomorrow, not an hour bucket');
  assert.equal(daysUntilDeparture(46 * 60, 2), 2, '46h can still be the day after tomorrow');
  assert.equal(daysUntilDeparture(134 * 60, 5), 5, 'not rounded from hours');
  assert.equal(daysUntilDeparture(6 * 24 * 60, null), null, 'no calendar: do not invent a day count');
  assert.equal(nowPhaseId({ minutesToDeparture: 24 * 60 + 1 }), 'tomorrow');
  assert.equal(nowPhaseId({ minutesToDeparture: 24 * 60 }), 'checkin');
});

test('without a usable departure time the card falls back', () => {
  assert.equal(nowPhaseId({}), 'unknown');
  assert.equal(nowPhaseId({ minutesToDeparture: null }), 'unknown');
  assert.equal(nowPhaseId({ minutesToDeparture: Number.NaN }), 'unknown');
  assert.deepEqual(nowPhaseLines('unknown', COPY), { title: 'Check your flight details', sub: '' });
});

test('hours until check-in opens counts down to 24h before departure', () => {
  assert.equal(hoursUntilCheckin(48 * 60), 24);
  assert.equal(hoursUntilCheckin(26 * 60), 2);
  assert.equal(hoursUntilCheckin(24 * 60 + 30), 1, 'rounded up to whole hours');
  assert.equal(hoursUntilCheckin(20 * 60), 0, 'already open');
  assert.equal(hoursUntilCheckin(null), 0);
});

test('every phase has its title and subtitle', () => {
  assert.deepEqual(nowPhaseLines('tomorrow', COPY, { minutesToDeparture: 6 * 24 * 60 + 90, calendarDays: 6 }), {
    title: 'Your flight is in 6 days', sub: 'Check-in opens in 5 days',
  });
  assert.deepEqual(nowPhaseLines('tomorrow', COPY, { minutesToDeparture: 46 * 60, calendarDays: 2 }), {
    title: 'Your flight is the day after tomorrow', sub: 'Check-in opens in 22 hours',
  });
  assert.deepEqual(nowPhaseLines('tomorrow', COPY, { minutesToDeparture: 30 * 60, calendarDays: 1 }), {
    title: 'Your flight is tomorrow', sub: 'Check-in opens in 6 hours',
  });
  assert.deepEqual(nowPhaseLines('checkin', COPY), { title: 'Check-in is open', sub: 'Add your boarding pass to Wallet' });
  assert.deepEqual(nowPhaseLines('prepare', COPY), { title: 'Time to prepare', sub: 'Check traffic to the airport' });
  assert.deepEqual(nowPhaseLines('head', COPY), { title: 'Head to the airport', sub: 'Allow extra time for security' });
  assert.deepEqual(nowPhaseLines('airport', COPY), { title: 'You should be at the airport now', sub: 'Go straight to your gate' });
  assert.deepEqual(nowPhaseLines('boarding', COPY), { title: 'Boarding soon', sub: 'Have your boarding pass ready' });
  assert.deepEqual(nowPhaseLines('inflight', COPY, { landsIn: '2h 15m' }), {
    title: "You're on your way", sub: 'Arrives in 2h 15m',
  });
  assert.deepEqual(nowPhaseLines('inflight', COPY), { title: "You're on your way", sub: '' }, 'no remaining time: title only');
});

test('landed uses the city, and the terminal only when the flight data has one', () => {
  assert.deepEqual(nowPhaseLines('landed', COPY, { city: 'Bangkok', terminal: '2' }), {
    title: 'Welcome to Bangkok', sub: 'Baggage claim at terminal 2',
  });
  assert.deepEqual(nowPhaseLines('landed', COPY, { city: 'Bangkok' }), {
    title: 'Welcome to Bangkok', sub: 'Baggage claim',
  });
  assert.deepEqual(nowPhaseLines('landed', COPY, {}), { title: 'Baggage claim', sub: '' });
});

const NL: NowPhaseCopy = {
  ...COPY,
  nowTomorrow: 'Je vlucht is morgen',
  nowDayAfterTomorrow: 'Je vlucht is overmorgen',
  nowInDays: (days: number) => `Je vlucht is over ${days} dagen`,
  nowHeadToAirport: 'Ga naar het vliegveld',
  nowWelcomeTo: (city: string) => `Welkom in ${city}`,
};

test('reported flights keep the Dutch line that matches the clock', () => {
  const title = (
    minutes: number,
    flags: { landed?: boolean; boarding?: boolean; departed?: boolean } = {},
    extra: { city?: string; calendarDays?: number } = {},
  ) => {
    const id = nowPhaseId({ minutesToDeparture: minutes, ...flags });
    return nowPhaseLines(id, NL, { minutesToDeparture: minutes, ...extra }).title;
  };
  assert.equal(title(6 * 24 * 60 + 90, { landed: true }, { calendarDays: 6 }), 'Je vlucht is over 6 dagen');
  assert.equal(title(46 * 60, { landed: true }, { calendarDays: 2 }), 'Je vlucht is overmorgen');
  assert.equal(title(30 * 60, { landed: true }, { calendarDays: 1 }), 'Je vlucht is morgen');
  assert.equal(title(2 * 60, { landed: true, boarding: true, departed: true }, { calendarDays: 1 }), 'Ga naar het vliegveld');
  assert.equal(title(-40, { landed: true }, { city: 'Bangkok' }), 'Welkom in Bangkok');
});

test('more than a day out: tomorrow, the day after tomorrow, or in X days (calendar days at the departure airport)', () => {
  const lines = (days: number | undefined, hours: number) =>
    nowPhaseLines('tomorrow', COPY, { calendarDays: days, minutesToDeparture: hours * 60 });
  assert.deepEqual(lines(1, 30), { title: 'Your flight is tomorrow', sub: 'Check-in opens in 6 hours' });
  assert.deepEqual(lines(2, 50), { title: 'Your flight is the day after tomorrow', sub: 'Check-in opens in 26 hours' });
  assert.deepEqual(lines(4, 100), { title: 'Your flight is in 4 days', sub: 'Check-in opens in 3 days' });
  assert.deepEqual(lines(12, 290), { title: 'Your flight is in 12 days', sub: 'Check-in opens in 11 days' });
  // Check-in exactly two days away switches to days; just under stays in hours.
  assert.equal(lines(3, 72).sub, 'Check-in opens in 2 days');
  assert.equal(lines(2, 71).sub, 'Check-in opens in 47 hours');
  // Without a day count (older callers) the card keeps saying tomorrow.
  assert.equal(lines(undefined, 30).title, 'Your flight is tomorrow');
});

const NOW_KEYS = [
  'nowTomorrow', 'nowTomorrowSub', 'nowDayAfterTomorrow', 'nowInDays', 'nowCheckinOpensInDays',
  'nowCheckinOpen', 'nowCheckinOpenSub', 'nowPrepare', 'nowPrepareSub', 'nowHeadToAirport', 'nowHeadToAirportSub',
  'nowAtAirportNow', 'nowAtAirportNowSub', 'nowBoardingSoon', 'nowBoardingSoonSub', 'nowOnYourWay', 'nowOnYourWaySub',
  'nowWelcomeTo', 'nowBaggageTerminal', 'nowBaggageClaim', 'nowCheckDetails',
];

test('every app language has every Now-card line, with exactly the placeholders English uses', () => {
  const params = JSON.parse(readFileSync(new URL('./en_fn_params.json', import.meta.url), 'utf8')) as Record<string, string[]>;
  const files: Record<string, string> = {
    en: '../i18n/locales/en.json', nl: '../i18n/locales/nl.json', zh: '../zh_translations.json',
    th: '../i18n/locales/th.json', de: '../i18n/locales/de.json', ru: '../i18n/locales/ru.json',
    ja: '../i18n/locales/ja.json', ko: '../i18n/locales/ko.json', vi: '../i18n/locales/vi.json',
    id: '../i18n/locales/id.json', es: '../i18n/locales/es.json',
  };
  for (const [loc, file] of Object.entries(files)) {
    const table = JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8')) as Record<string, unknown>;
    for (const key of NOW_KEYS) {
      const value = table[key];
      assert.ok(typeof value === 'string' && value.trim(), `${loc}: ${key} is missing`);
      assert.doesNotMatch(value as string, /【/, `${loc}: ${key} is still marked untranslated`);
      const want = [...(params[key] || [])].sort();
      const got = [...new Set(Array.from((value as string).matchAll(/\{(\w+)\}/g), m => m[1]))].sort();
      assert.deepEqual(got, want, `${loc}: ${key} placeholders`);
    }
  }
});
