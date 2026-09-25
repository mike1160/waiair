import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROXY_URL_FALLBACK, isProxyUrl, proxyUrl } from './proxyUrl.ts';

test('a real URL is used as given, without its trailing slash', () => {
  assert.equal(proxyUrl('https://waiair-production.up.railway.app'), 'https://waiair-production.up.railway.app');
  assert.equal(proxyUrl('https://staging.example.com/'), 'https://staging.example.com');
  assert.equal(proxyUrl('https://staging.example.com///'), 'https://staging.example.com');
  assert.equal(proxyUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(proxyUrl('  https://spaced.example.com  '), 'https://spaced.example.com');
});

test('a value that is not a URL falls back instead of breaking every request', () => {
  // The outage this exists for: a 32-character token on the proxy key made every request a relative path
  // with no host — no socket, no response, nothing in the logs.
  assert.equal(proxyUrl('22d268ab0db00c6177ca83e6a1fe9c36'), PROXY_URL_FALLBACK);
  assert.equal(proxyUrl('waiair-production.up.railway.app'), PROXY_URL_FALLBACK, 'a host with no scheme is not a URL');
  assert.equal(proxyUrl('ftp://example.com'), PROXY_URL_FALLBACK);
  assert.equal(proxyUrl('https://'), PROXY_URL_FALLBACK, 'a scheme with no host is no better');
  assert.equal(proxyUrl('/flight'), PROXY_URL_FALLBACK);
});

test('absent, empty or nonsense all fall back', () => {
  assert.equal(proxyUrl(undefined), PROXY_URL_FALLBACK);
  assert.equal(proxyUrl(null), PROXY_URL_FALLBACK);
  assert.equal(proxyUrl(''), PROXY_URL_FALLBACK);
  assert.equal(proxyUrl('   '), PROXY_URL_FALLBACK);
  assert.equal(proxyUrl(42), PROXY_URL_FALLBACK);
  assert.equal(proxyUrl({}), PROXY_URL_FALLBACK);
});

test('what counts as a URL', () => {
  assert.equal(isProxyUrl('https://a.b'), true);
  assert.equal(isProxyUrl('HTTPS://A.B'), true, 'the scheme is not case-sensitive');
  assert.equal(isProxyUrl('https:// spaced'), false);
  assert.equal(isProxyUrl('22d268ab0db00c6177ca83e6a1fe9c36'), false);
  assert.equal(isProxyUrl(''), false);
});
