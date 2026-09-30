/**
 * Where "Rate WaiAir" sends you [W/9].
 *
 * Tapping it crashed the app outright, with a system crash dialog and no way back. Every line of
 * openStoreListing sits inside a try/catch, so a JavaScript throw was never a candidate — the crash had to
 * be native, and there were exactly two ways in:
 *
 *   StoreReview.requestReview(), reached whenever StoreReview.storeUrl() came back empty. That is Play's
 *   in-app review API, and an app that was not installed from Play — a sideloaded build, which is the only
 *   kind that exists here — can take it down natively rather than rejecting a promise. It is also the wrong
 *   call for a button: in-app review is a prompt the store decides to show, throttled, and it is not allowed
 *   to be triggered by someone asking for it.
 *
 *   `const { Linking } = await import('react-native')`, a dynamic import in a module that already imports
 *   from react-native at the top. Dynamic imports resolve through Metro's asyncRequire, which in a published
 *   bundle has failure modes that no JS catch can see.
 *
 * Neither is proven — the crash was never reproduced here, and no log was captured. So both are removed
 * rather than one being guessed at: a plain https URL, which always has a handler (a browser, if nothing
 * else), opened through the ordinary top-level import. requestReview stays where it belongs, in
 * maybeRequestReview, which the store may throttle as it likes.
 *
 * Pure and react-native-free so it can be unit-tested, in lib/storeListingUrl.test.ts.
 */

/** The App Store listing id. */
export const APP_STORE_ID = '6798072839';
/** The Android application id, as app.config.js declares it. */
export const PLAY_PACKAGE = 'com.waiair.WaiAir';

/**
 * The store page for this platform, or '' where there is no store to send anyone to.
 *
 * https on both: `market://` has no handler on a device without the Play Store, and an itms-apps:// link
 * fails the same way in a simulator. The web URL always resolves, and the store app takes over when it is
 * installed.
 */
export function storeListingUrl(platform: string): string {
  switch (String(platform || '')) {
    case 'ios':
      return `https://apps.apple.com/app/apple-store/id${APP_STORE_ID}?action=write-review`;
    case 'android':
      return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`;
    default:
      return '';
  }
}
