import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DESTINATION_BACKGROUNDS_KEY,
  destinationPhotoIata,
  parseDestinationBackgroundsEnabled,
  toDestinationPhoto,
} from './destinationPhoto.ts';

test('destination backgrounds are ON by default; only a stored "false" turns them off', () => {
  assert.equal(DESTINATION_BACKGROUNDS_KEY, 'destination_backgrounds_enabled');
  assert.equal(parseDestinationBackgroundsEnabled(null), true);
  assert.equal(parseDestinationBackgroundsEnabled(undefined), true);
  assert.equal(parseDestinationBackgroundsEnabled('true'), true);
  assert.equal(parseDestinationBackgroundsEnabled('false'), false);
});

test('only a 3-letter arrival code is looked up', () => {
  assert.equal(destinationPhotoIata('bkk'), 'BKK');
  assert.equal(destinationPhotoIata(' HKT '), 'HKT');
  assert.equal(destinationPhotoIata('VTBS'), '');
  assert.equal(destinationPhotoIata(''), '');
  assert.equal(destinationPhotoIata(null), '');
});

test('proxy null or a malformed body falls back to the sky theme (null)', () => {
  assert.deepEqual(toDestinationPhoto({
    url: 'https://images.unsplash.com/photo-b?w=1080',
    photographer: 'Photographer b',
    photographerUrl: 'https://unsplash.com/@pb?utm_source=waiair&utm_medium=referral',
  }), {
    url: 'https://images.unsplash.com/photo-b?w=1080',
    photographer: 'Photographer b',
    photographerUrl: 'https://unsplash.com/@pb?utm_source=waiair&utm_medium=referral',
  });
  assert.equal(toDestinationPhoto(null), null);
  assert.equal(toDestinationPhoto({ url: 'http://insecure.example/x.jpg' }), null);
  assert.equal(toDestinationPhoto({ photographer: 'x' }), null);
  assert.deepEqual(toDestinationPhoto({ url: 'https://images.unsplash.com/x' }), {
    url: 'https://images.unsplash.com/x', photographer: '', photographerUrl: '',
  });
});
