import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLocalizedCity } from './cityLocalized.ts';
import {
  formatHomeTripTitle,
  formatOriginCalendarDay,
  homeTripDayLabel,
  homeTripTitle,
} from './homeTripTitle.ts';
import { homeRelativeDayOffset } from './homeNow.ts';

const NOW = Date.parse('2026-09-09T12:00:00+07:00');
const COPY = { today: 'Today', tomorrow: 'Tomorrow' };

test('title is destination city from the reflect table, not the flight number', () => {
  const dep = Date.parse('2026-09-10T15:20:00+07:00');
  const title = homeTripTitle({
    destIata: 'ICN',
    destCity: 'Seoel',
    originIata: 'HKT',
    originCountry: 'TH',
    depMs: dep,
    now: NOW,
    locale: 'en',
    ...COPY,
  });
  assert.equal(title, 'Seoul · Tomorrow');
  assert.equal(title.includes('OZ'), false);
  assert.equal(title.includes('748'), false);
  assert.equal(getLocalizedCity('ICN', 'en', 'Seoel'), 'Seoul');
});

test('same origin-local day is Today; next calendar day is Tomorrow', () => {
  const todayDep = Date.parse('2026-09-09T16:50:00+07:00');
  assert.equal(homeRelativeDayOffset(todayDep, Date.parse('2026-09-09T07:00:00+07:00'), 'BKK', 'TH'), 0);
  assert.equal(
    homeTripTitle({
      destIata: 'PVG',
      originIata: 'BKK',
      originCountry: 'TH',
      depMs: todayDep,
      now: Date.parse('2026-09-09T07:00:00+07:00'),
      locale: 'en',
      ...COPY,
    }),
    'Shanghai · Today',
  );
  assert.equal(
    homeTripTitle({
      destIata: 'ICN',
      originIata: 'HKT',
      originCountry: 'TH',
      depMs: Date.parse('2026-09-10T15:20:00+07:00'),
      now: NOW,
      locale: 'en',
      ...COPY,
    }),
    'Seoul · Tomorrow',
  );
});

test('further dates use weekday + day + month in the UI locale, not In n days', () => {
  const dep = Date.parse('2026-09-11T15:20:00+07:00');
  assert.equal(homeRelativeDayOffset(dep, NOW, 'HKT', 'TH'), 2);
  assert.equal(
    homeTripDayLabel({
      offset: 2,
      depMs: dep,
      originIata: 'HKT',
      originCountry: 'TH',
      locale: 'en',
      ...COPY,
    }),
    'Fri 11 Sep',
  );
  assert.equal(formatOriginCalendarDay(dep, 'HKT', 'TH', 'en'), 'Fri 11 Sep');
  const title = homeTripTitle({
    destIata: 'ICN',
    originIata: 'HKT',
    originCountry: 'TH',
    depMs: dep,
    now: NOW,
    locale: 'en',
    ...COPY,
  });
  assert.equal(title, 'Seoul · Fri 11 Sep');
  assert.equal(title.includes('In 2 days'), false);

  const nlDay = homeTripDayLabel({
    offset: 2,
    depMs: dep,
    originIata: 'HKT',
    originCountry: 'TH',
    locale: 'nl',
    today: 'Vandaag',
    tomorrow: 'Morgen',
  });
  assert.notEqual(nlDay, 'Fri 11 Sep');
  assert.equal(nlDay.toLowerCase().includes('sep'), true);
});

test('Thai reflect city sits in the title', () => {
  const title = homeTripTitle({
    destIata: 'ICN',
    originIata: 'BKK',
    originCountry: 'TH',
    depMs: Date.parse('2026-09-09T16:50:00+07:00'),
    now: NOW,
    locale: 'th',
    today: 'วันนี้',
    tomorrow: 'พรุ่งนี้',
  });
  assert.equal(title.startsWith('โซล · '), true);
  assert.equal(title.endsWith('วันนี้'), true);
});

test('formatHomeTripTitle joins with a middle dot', () => {
  assert.equal(formatHomeTripTitle('Shanghai', 'Today'), 'Shanghai · Today');
  assert.equal(formatHomeTripTitle('Seoul', ''), 'Seoul');
  assert.equal(formatHomeTripTitle('', 'Today'), 'Today');
});
