import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_STORE_ID, PLAY_PACKAGE, storeListingUrl } from './storeListingUrl.ts';

test('[W/9] both platforms get an https URL that always has a handler', () => {
  for (const p of ['ios', 'android']) {
    const url = storeListingUrl(p);
    assert.ok(url.startsWith('https://'), `${p} must not use a custom scheme: ${url}`);
  }
  assert.ok(!storeListingUrl('android').startsWith('market:'), 'market:// has no handler without Play');
  assert.ok(!storeListingUrl('ios').startsWith('itms'), 'nor does itms-apps:// everywhere');
});

test('[W/9] iOS opens the review composer, Android the listing', () => {
  assert.equal(
    storeListingUrl('ios'),
    `https://apps.apple.com/app/apple-store/id${APP_STORE_ID}?action=write-review`,
  );
  assert.equal(storeListingUrl('android'), `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`);
});

test('[W/9] the identifiers are the real ones, not placeholders', () => {
  assert.match(APP_STORE_ID, /^\d{6,}$/);
  assert.equal(PLAY_PACKAGE, 'com.waiair.WaiAir');
});

test('[W/9] anywhere without a store returns nothing, so nothing is opened', () => {
  assert.equal(storeListingUrl('web'), '');
  assert.equal(storeListingUrl(''), '');
  assert.equal(storeListingUrl(undefined as unknown as string), '');
});
