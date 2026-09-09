import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HOME_EMPTY_CRUISE_GAP_MS,
  HOME_EMPTY_PLANE_MS,
  HOME_EMPTY_STAR_COUNT,
  HOME_EMPTY_TWINKLE_COUNT,
  HOME_EMPTY_BRIGHT_COUNT,
  HOME_LIVE_DUMMY,
  HOME_LIVE_MIN_COUNT,
  formatHomeLiveLine,
  homeEmptyHeadingKey,
  homeEmptyShowCloud,
  homeEmptyShowGlow,
  homeEmptyShowMoon,
  homeEmptyShowStars,
  homeEmptyStarSeed,
  homeEmptyStars,
  homeLiveLineKind,
  homeLiveWhenKey,
  moonPhase,
  moonShadowDx,
} from './homeEmptyAlive.ts';

test('afternoon heading is today; 18:00 local switches to tonight', () => {
  assert.equal(homeEmptyHeadingKey(12), 'homeWhereToToday');
  assert.equal(homeEmptyHeadingKey(17), 'homeWhereToToday');
  assert.equal(homeEmptyHeadingKey(18), 'homeWhereToTonight');
  assert.equal(homeEmptyHeadingKey(22), 'homeWhereToTonight');
  assert.equal(homeEmptyHeadingKey(0), 'homeWhereToToday');
  assert.equal(homeLiveWhenKey(17), 'homeLiveToday');
  assert.equal(homeLiveWhenKey(18), 'homeLiveTonight');
});

test('live line hides below 1 and drops the count below 3', () => {
  assert.equal(homeLiveLineKind(41, 'Tokyo', '22:35'), 'full');
  assert.equal(homeLiveLineKind(3, 'Tokyo', '22:35'), 'full');
  assert.equal(homeLiveLineKind(2, 'Tokyo', '22:35'), 'next');
  assert.equal(homeLiveLineKind(1, 'Tokyo', '22:35'), 'next');
  assert.equal(homeLiveLineKind(0, 'Tokyo', '22:35'), 'hide');
  assert.equal(homeLiveLineKind(41, '', '22:35'), 'hide');
  assert.equal(HOME_LIVE_MIN_COUNT, 3);
  assert.equal(HOME_LIVE_DUMMY.count, 41);
});

test('dummy live line follows the 18:00 today/tonight switch', () => {
  const board = (when: string, city: string, n: number, dest: string, time: string) =>
    `${when} from ${city} · ${n} flights · next to ${dest} ${time}`;
  const nextOnly = (dest: string, time: string) => `Next to ${dest} ${time}`;
  const base = {
    count: 41,
    city: 'Bangkok',
    dest: 'Tokyo',
    time: '22:35',
    today: 'Today',
    tonight: 'Tonight',
    board,
    nextOnly,
  };
  assert.equal(
    formatHomeLiveLine({ ...base, hour: 17 }),
    'Today from Bangkok · 41 flights · next to Tokyo 22:35',
  );
  assert.equal(
    formatHomeLiveLine({ ...base, hour: 18 }),
    'Tonight from Bangkok · 41 flights · next to Tokyo 22:35',
  );
  assert.equal(
    formatHomeLiveLine({ ...base, hour: 21, count: 2 }),
    'Next to Tokyo 22:35',
  );
  assert.equal(formatHomeLiveLine({ ...base, hour: 21, count: 0 }), null);
});

test('stars and moon only on the night photo; glow on night and dusk', () => {
  assert.equal(homeEmptyShowStars('night'), true);
  assert.equal(homeEmptyShowMoon('night'), true);
  assert.equal(homeEmptyShowStars('dusk'), false);
  assert.equal(homeEmptyShowMoon('dusk'), false);
  assert.equal(homeEmptyShowStars('day'), false);
  assert.equal(homeEmptyShowGlow('night'), true);
  assert.equal(homeEmptyShowGlow('dusk'), true);
  assert.equal(homeEmptyShowGlow('day'), false);
  assert.equal(homeEmptyShowGlow('dawn'), false);
  assert.equal(homeEmptyShowCloud('day'), true);
  assert.equal(homeEmptyShowCloud('night'), false);
});

test('moon phase on known eclipse dates', () => {
  const neu = moonPhase(Date.parse('2024-04-08T18:18:00Z'));
  assert.ok(neu.illumination < 0.08, `new moon illum ${neu.illumination}`);
  const full = moonPhase(Date.parse('2024-03-25T07:13:00Z'));
  assert.ok(full.illumination > 0.92, `full moon illum ${full.illumination}`);
  assert.equal(moonShadowDx(1, true, 7), -14);
  assert.equal(moonShadowDx(0, true, 7), 0);
  assert.ok(moonShadowDx(0.2, true, 7) < 0);
  assert.ok(moonShadowDx(0.2, false, 7) > 0);
  const thin = moonShadowDx(0.053, false, 7);
  assert.ok(thin > 0 && thin < 2, `thin waning dx ${thin}`);
});

test('seeded stars stay put, vary 1–1.6 px, and keep five brighter ones high in the band', () => {
  const seed = homeEmptyStarSeed('2026-09-09');
  const a = homeEmptyStars(seed);
  const b = homeEmptyStars(seed);
  assert.equal(a.length, HOME_EMPTY_STAR_COUNT);
  assert.deepEqual(a, b);
  assert.equal(a.filter(s => s.twinkle).length, HOME_EMPTY_TWINKLE_COUNT);
  assert.equal(a.filter(s => s.bright).length, HOME_EMPTY_BRIGHT_COUNT);
  for (const s of a) {
    assert.ok(s.size >= 1 && s.size <= 1.6, `size ${s.size}`);
    assert.ok(s.y <= 0.38);
  }
  assert.ok(a.filter(s => s.y > 0.28).length < a.length * 0.35);
  assert.notDeepEqual(a, homeEmptyStars(homeEmptyStarSeed('2026-09-10')));
});

test('empty-home cruise gap is 2–3 minutes, crossing stays 9s', () => {
  assert.equal(HOME_EMPTY_PLANE_MS, 9000);
  assert.equal(HOME_EMPTY_CRUISE_GAP_MS, 150_000);
  assert.ok(HOME_EMPTY_CRUISE_GAP_MS >= 120_000);
  assert.ok(HOME_EMPTY_CRUISE_GAP_MS <= 180_000);
});
