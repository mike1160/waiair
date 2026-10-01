import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

/**
 * The Gmail sign-in diagnostic, in the files it has to exist in [W/6]. Text-based: both import react-native.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('[W/6] the connect no longer swallows the error', () => {
  const src = read('lib/gmailTripExtras.ts');
  assert.ok(
    !/catch \{\s*return \{ ok: false, reason: 'error' \};/.test(src),
    'the bare catch that discarded the status code must be gone',
  );
  assert.ok(src.includes('classifyGoogleSignInError(e, statusCodes)'), 'the SDK\'s own codes are passed in');
  assert.ok(src.includes('detail: signInFailureDetail(failure, signInErrorCode(e))'), 'and the code is kept');
  assert.ok(src.includes("import { GoogleSignin, statusCodes }"), 'statusCodes is imported');
});

test('[W/6] every failure path carries a detail, including the ones that are not exceptions', () => {
  const src = read('lib/gmailTripExtras.ts');
  assert.ok(src.includes("detail: `cancelled · ${res.type}`"), 'a non-success sign-in says which type');
  assert.ok(src.includes("detail: 'cancelled · scope'"), 'a refused Gmail scope is distinguishable');
  assert.ok(src.includes("detail: `not_configured · ${Platform.OS}`"), 'and an unconfigured platform says so');
  assert.ok(src.includes('export type GmailConnectResult'), 'the result type is shared with the screens');
});

test('[W/6] the screen says what went wrong instead of "try again"', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  assert.ok(screen.includes("loginFailure?.reason === 'misconfigured'"), 'a build that cannot sign in is named');
  assert.ok(screen.includes('t().googleLoginMisconfigured'));
  assert.ok(screen.includes("loginFailure?.reason === 'no_play_services' ? t().googleLoginPlayServices"));
  /*
   * [W/15] The detail is no longer rendered conditionally — it falls back to the reason, so the line can
   * never be empty. The guarantee this test exists for is stronger than it was, not weaker: the status code
   * still reaches the screen, and now so does something when there is no code.
   */
  assert.ok(
    screen.includes("{loginFailure?.detail || loginFailure?.reason || failure || 'unknown'}"),
    'the detail still reaches the screen, with a fallback instead of nothing',
  );
  assert.ok(screen.includes('selectable'), 'selectable, so it can be copied into a report');
});

test('[W/6] no retry button for a failure that cannot succeed, and no error for a cancel', () => {
  const screen = read('screens/GmailImportScreen.tsx');
  assert.ok(screen.includes('signInFailureIsRetryable(loginFailure.reason as GoogleSignInFailure)'));
  assert.ok(screen.includes('{retryable ? ('), 'the button is conditional');
  assert.ok(screen.includes("if (login.reason === 'cancelled') {"), 'a cancel closes rather than reporting');
  assert.ok(screen.includes('onCloseRef.current();'));
});

test('[W/6] both new messages exist in all 11 shipped languages', () => {
  const paths: Record<string, string> = {
    en: 'i18n/locales/en.json', nl: 'i18n/locales/nl.json', zh: 'zh_translations.json',
    th: 'i18n/locales/th.json', de: 'i18n/locales/de.json', ru: 'i18n/locales/ru.json',
    ja: 'i18n/locales/ja.json', ko: 'i18n/locales/ko.json', vi: 'i18n/locales/vi.json',
    id: 'i18n/locales/id.json', es: 'i18n/locales/es.json',
  };
  for (const [locale, path] of Object.entries(paths)) {
    const json = JSON.parse(read(path)) as Record<string, string>;
    for (const key of ['googleLoginMisconfigured', 'googleLoginPlayServices']) {
      assert.equal(typeof json[key], 'string', `${locale} is missing ${key}`);
      assert.ok(json[key].trim().length > 0, `${locale} ${key} is empty`);
    }
  }
  for (const locale of ['ar', 'fr', 'it', 'pt']) {
    const json = JSON.parse(read(`i18n/locales/${locale}.json`)) as Record<string, string>;
    assert.equal(json.googleLoginMisconfigured, undefined, `${locale} should not have been touched`);
  }
});
