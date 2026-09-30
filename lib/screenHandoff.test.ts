import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXIT_FALLBACK_GRACE_MS,
  MODAL_HANDOFF_MS,
  SIGN_IN_STALL_MS,
  exitFallbackMs,
  mayDismissDuringSignIn,
  signInWatchdogAction,
} from './screenHandoff.ts';

test('[W/7] the fallback waits for the animation, then stops waiting', () => {
  assert.equal(exitFallbackMs(220), 220 + EXIT_FALLBACK_GRACE_MS);
  assert.ok(exitFallbackMs(220) > 220, 'it must never pre-empt a healthy animation');
  assert.equal(exitFallbackMs(0), EXIT_FALLBACK_GRACE_MS);
});

test('[W/7] a nonsense duration still yields a usable fallback', () => {
  // Better a fixed grace period than NaN, which would mean setTimeout fires immediately.
  assert.equal(exitFallbackMs(NaN), EXIT_FALLBACK_GRACE_MS);
  assert.equal(exitFallbackMs(-100), EXIT_FALLBACK_GRACE_MS);
  assert.equal(exitFallbackMs(undefined as unknown as number), EXIT_FALLBACK_GRACE_MS);
});

test('[W/7] the handover happens exactly once, whichever fires first', () => {
  // The latch the caller pairs with the fallback: the callback and the timer must not both hand over.
  const handovers: string[] = [];
  let done = false;
  const once = (who: string) => { if (done) return; done = true; handovers.push(who); };
  once('animation');
  once('fallback');
  assert.deepEqual(handovers, ['animation']);

  const other: string[] = [];
  let done2 = false;
  const once2 = (who: string) => { if (done2) return; done2 = true; other.push(who); };
  once2('fallback');
  once2('animation');
  assert.deepEqual(other, ['fallback'], 'and the other way round');
});

test('[W/7] a sign-in in flight is never interrupted', () => {
  // The inversion: the old watchdog dismissed the modal the Google sheet was presented from.
  assert.equal(mayDismissDuringSignIn(true), false);
  assert.equal(mayDismissDuringSignIn(false), true);
});

test('[W/7] the stall recovery waits out a real first-time sign-in', () => {
  // Consent alert, account picker and a permissions screen: far longer than the old two seconds.
  assert.ok(SIGN_IN_STALL_MS >= 60_000, 'a first sign-in takes as long as it takes');
  assert.equal(signInWatchdogAction({ connecting: true, elapsedMs: 2_000 }), 'wait');
  assert.equal(signInWatchdogAction({ connecting: true, elapsedMs: 30_000 }), 'wait');
  assert.equal(signInWatchdogAction({ connecting: true, elapsedMs: SIGN_IN_STALL_MS }), 'recover');
  assert.equal(signInWatchdogAction({ connecting: true, elapsedMs: SIGN_IN_STALL_MS + 1 }), 'recover');
});

test('[W/7] nothing to recover when no sign-in is running', () => {
  assert.equal(signInWatchdogAction({ connecting: false, elapsedMs: 10 ** 9 }), 'wait');
  assert.equal(signInWatchdogAction({ connecting: true, elapsedMs: NaN }), 'wait');
});

test('[W/7] the stall limit is injectable, so the tests need no real clock', () => {
  assert.equal(signInWatchdogAction({ connecting: true, elapsedMs: 50, stallMs: 40 }), 'recover');
  assert.equal(signInWatchdogAction({ connecting: true, elapsedMs: 30, stallMs: 40 }), 'wait');
});

test('[W/7] the modal handover outlasts the modal transition itself', () => {
  // RN's fade is around 300ms; presenting into a dismissal is its own black screen.
  assert.ok(MODAL_HANDOFF_MS > 300);
});
