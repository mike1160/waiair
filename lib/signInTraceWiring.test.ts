import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/15] all five native calls are traced', () => {
  const src = read('lib/gmailTripExtras.ts');
  for (const step of ['hasPlayServices', 'signInSilently', 'signIn', 'addScopes', 'getTokens']) {
    assert.ok(src.includes(`traceStep('${step}')`), `${step} must be traced`);
  }
  assert.ok(src.includes('resetSignInTrace();'), 'one attempt, one trace');
});

test('[W/15] NO return value changed — the whole point of a diagnostic', () => {
  const src = read('lib/gmailTripExtras.ts');
  // Each of these is the exact return that was there before the instrumentation.
  for (const ret of [
    "return { ok: false, reason: 'cancelled', detail: `cancelled · ${res.type}` };",
    "return { ok: false, reason: 'cancelled', detail: 'cancelled · scope' };",
    'return { ok: false, reason: failure, detail: signInFailureDetail(failure, signInErrorCode(e)) };',
    'return { ok: true };',
  ]) {
    assert.ok(src.includes(ret), `unchanged return missing: ${ret}`);
  }
  // getTokens still swallows and still returns null.
  const fn = src.slice(src.indexOf('async function validToken'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(body.includes('return token;') && body.includes('return null;'));
  assert.ok(body.includes("traceFail('getTokens'"), 'recorded on the way out');
});

test('[W/15] the failing step is marked with Google\'s own code', () => {
  const src = read('lib/gmailTripExtras.ts');
  assert.ok(src.includes("traceFail('addScopes', signInErrorCode(e), e);"));
  assert.ok(src.includes("traceFail('signIn', signInErrorCode(e), e);"));
});

test('[W/15] whoever configured the SDK last is recorded, from both call sites', () => {
  assert.ok(read('lib/gmailTripExtras.ts').includes("markConfigured('gmail');"));
  const credits = read('lib/creditAccount.ts');
  assert.ok(credits.includes("markConfigured('credits');"));
  // creditAccount's own call is untouched: same arguments, same order, no scopes added.
  assert.ok(credits.includes(
    'GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID || undefined });',
  ));
});

test('[W/15] the error screen can never show an empty detail again', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  assert.ok(
    screen.includes("{loginFailure?.detail || loginFailure?.reason || failure || 'unknown'}"),
    'an absent detail falls back to the reason',
  );
  assert.ok(!screen.includes('{loginFailure?.detail ? ('), 'the conditional that could render nothing is gone');
});

test('[W/15] the running bundle is on the screen', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  assert.ok(screen.includes('const bundleLabel = formatUpdateLabel({'), 'the same helper Settings uses');
  assert.ok(screen.includes('signInTraceLines({ bundle: bundleLabel })'));
  assert.ok(screen.includes('isEmbeddedLaunch: Updates.isEmbeddedLaunch'), 'so "embedded" is distinguishable');
});
