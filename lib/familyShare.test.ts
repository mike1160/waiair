/**
 * Family Safety Mode: the share record and the audience filters. Pure functions only — no AsyncStorage.
 * node:test, no jest.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SHARE_TOKEN_LENGTH,
  SHARE_TTL_MS,
  addFollower,
  createShareToken,
  filterMomentsForFollower,
  filterMomentsForTraveler,
  followerText,
  isExpired,
  publicShareRecord,
  removeFollower,
  shareUrl,
  type ShareRecord,
} from './familyShare.ts';
import type { MomentAudience, MomentKind, TripMoment } from './tripMoments.ts';

function moment(kind: MomentKind, audience: MomentAudience, extra: Partial<TripMoment> = {}): TripMoment {
  return {
    key: `k:${kind}`,
    triggerMs: 1,
    kind,
    audience,
    title: `${kind} title`,
    body: `${kind} body`,
    flightKey: 'kl875',
    urgent: false,
    ...extra,
  };
}

test('createShareToken: a URL-safe token, an 8-day life, and no followers yet', () => {
  const before = Date.now();
  const r = createShareToken('kl875', 'Sarah');
  assert.equal(r.flightKey, 'kl875');
  assert.equal(r.travelerName, 'Sarah');
  assert.deepEqual(r.followers, []);
  assert.equal(r.token.length, SHARE_TOKEN_LENGTH);
  assert.match(r.token, /^[A-Za-z0-9_-]+$/, 'URL-safe, no escaping needed');
  assert.ok(r.createdMs >= before);
  assert.equal(r.expiresMs - r.createdMs, SHARE_TTL_MS);
  assert.equal(SHARE_TTL_MS, 8 * 24 * 3600 * 1000);
});

test('createShareToken: tokens do not repeat, and a blank name is left off', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(createShareToken('kl875').token);
  assert.equal(seen.size, 500, 'no collisions across 500 tokens');
  assert.equal(createShareToken('kl875').travelerName, undefined);
  assert.equal(createShareToken('kl875', '   ').travelerName, undefined);
});

test('shareUrl: the follow link, with the token escaped', () => {
  assert.equal(shareUrl('abc123XYZ_-9'), 'https://waiair.app/follow/abc123XYZ_-9');
  assert.equal(shareUrl('a/b?c'), 'https://waiair.app/follow/a%2Fb%3Fc');
});

test('addFollower: appends without mutating the record it was given', () => {
  const base = createShareToken('kl875', 'Sarah');
  const one = addFollower(base, 'ExponentPushToken[aaa]', 'Mum');
  assert.equal(base.followers.length, 0, 'the original is untouched');
  assert.equal(one.followers.length, 1);
  assert.equal(one.followers[0].pushToken, 'ExponentPushToken[aaa]');
  assert.equal(one.followers[0].name, 'Mum');
  assert.ok(one.followers[0].addedMs > 0);

  const two = addFollower(one, 'ExponentPushToken[bbb]');
  assert.equal(two.followers.length, 2);
  assert.equal(two.followers[1].name, undefined, 'a follower may stay nameless');
});

test('addFollower: the same device twice is one follower, with the newer name', () => {
  const base = addFollower(createShareToken('kl875'), 'ExponentPushToken[aaa]', 'Mum');
  const again = addFollower(base, 'ExponentPushToken[aaa]', 'Mama');
  assert.equal(again.followers.length, 1, 'no duplicate notifications for one device');
  assert.equal(again.followers[0].name, 'Mama');
  // An empty push token is not a follower.
  assert.equal(addFollower(base, '   ').followers.length, 1);
});

test('removeFollower: drops just that device, immutably', () => {
  let r = createShareToken('kl875');
  r = addFollower(r, 'ExponentPushToken[aaa]', 'Mum');
  r = addFollower(r, 'ExponentPushToken[bbb]', 'Dad');
  const gone = removeFollower(r, 'ExponentPushToken[aaa]');
  assert.equal(r.followers.length, 2, 'the original is untouched');
  assert.deepEqual(gone.followers.map(f => f.name), ['Dad']);
  // Removing someone who is not there changes nothing.
  assert.equal(removeFollower(gone, 'ExponentPushToken[zzz]').followers.length, 1);
});

test('isExpired: true only past the expiry', () => {
  const r: ShareRecord = {
    flightKey: 'kl875', token: 'tok', createdMs: 1000, expiresMs: 2000, followers: [],
  };
  assert.equal(isExpired(r, 1999), false);
  assert.equal(isExpired(r, 2000), false, 'the last millisecond still counts');
  assert.equal(isExpired(r, 2001), true);
  // A fresh share is not expired.
  assert.equal(isExpired(createShareToken('kl875')), false);
});

test('filterMomentsForFollower: follower and both, never traveler-only', () => {
  const all = [
    moment('evening_before', 'traveler'),
    moment('depart_now', 'traveler'),
    moment('landed', 'both'),
    moment('delay_impact', 'both'),
    moment('departed', 'follower'),
    moment('hotel_arrived', 'follower'),
    moment('car_return', 'traveler'),
  ];
  assert.deepEqual(
    filterMomentsForFollower(all).map(m => m.kind),
    ['landed', 'delay_impact', 'departed', 'hotel_arrived'],
  );
  assert.deepEqual(filterMomentsForFollower([]), []);
});

test('filterMomentsForTraveler: traveler and both, never follower-only', () => {
  const all = [
    moment('evening_before', 'traveler'),
    moment('landed', 'both'),
    moment('departed', 'follower'),
    moment('hotel_arrived', 'follower'),
  ];
  assert.deepEqual(
    filterMomentsForTraveler(all).map(m => m.kind),
    ['evening_before', 'landed'],
  );
});

test('the two filters together cover everything once, and overlap only on both', () => {
  const all = [
    moment('evening_before', 'traveler'),
    moment('landed', 'both'),
    moment('departed', 'follower'),
  ];
  const f = filterMomentsForFollower(all);
  const t = filterMomentsForTraveler(all);
  const union = new Set([...f, ...t].map(m => m.kind));
  assert.equal(union.size, all.length, 'no moment is dropped by both filters');
  const overlap = f.filter(m => t.includes(m)).map(m => m.kind);
  assert.deepEqual(overlap, ['landed'], "only 'both' moments go to each side");
});

test('followerText: the follower wording wins, the traveler wording is the fallback', () => {
  const twoVoices = moment('landed', 'both', {
    title: 'Welcome to Bangkok',
    body: 'Bags on belt 12.',
    followerTitle: 'Sarah has landed in Bangkok',
    followerBody: '✈️ Local time: 06:35',
  });
  assert.deepEqual(followerText(twoVoices), {
    title: 'Sarah has landed in Bangkok',
    body: '✈️ Local time: 06:35',
  });
  assert.doesNotMatch(followerText(twoVoices).body, /belt/, 'the belt never reaches the follower');

  const oneVoice = moment('departed', 'follower');
  assert.deepEqual(followerText(oneVoice), { title: 'departed title', body: 'departed body' });
});

test('publicShareRecord: push tokens never leave the device', () => {
  let r = createShareToken('kl875', 'Sarah');
  r = addFollower(r, 'ExponentPushToken[aaa]', 'Mum');
  const pub = publicShareRecord(r);
  assert.equal('followers' in pub, false);
  assert.equal(JSON.stringify(pub).includes('ExponentPushToken'), false);
  assert.deepEqual(pub, {
    flightKey: 'kl875',
    token: r.token,
    createdMs: r.createdMs,
    expiresMs: r.expiresMs,
    travelerName: 'Sarah',
  });
});
