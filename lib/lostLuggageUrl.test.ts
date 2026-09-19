import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lostLuggageSearchQuery, lostLuggageUrl } from './lostLuggageUrl.ts';

test('a known airline is searched by its name', () => {
  assert.equal(lostLuggageSearchQuery('TG'), 'Thai Airways delayed baggage report');
  assert.equal(lostLuggageSearchQuery('kl'), lostLuggageSearchQuery('KL'), 'case does not matter');
  assert.match(lostLuggageSearchQuery('EK'), /^Emirates delayed baggage report$/);
});

test('an unknown or missing airline still gives a working search', () => {
  assert.equal(lostLuggageSearchQuery('ZZ'), 'ZZ airline delayed baggage report');
  assert.equal(lostLuggageSearchQuery(''), 'airline delayed baggage report');
  assert.equal(lostLuggageSearchQuery(null), 'airline delayed baggage report');
});

test('the link is a search, never the dead WorldTracer form', () => {
  for (const code of ['TG', 'SQ', 'EK', 'QR', 'KL', '', 'ZZ']) {
    const url = lostLuggageUrl(code);
    assert.match(url, /^https:\/\/www\.google\.com\/search\?q=/, code);
    assert.doesNotMatch(url, /worldtracer\.aero|claim\.exe|pax\.do/, code);
  }
  assert.equal(
    lostLuggageUrl('TG'),
    'https://www.google.com/search?q=Thai%20Airways%20delayed%20baggage%20report',
  );
});
