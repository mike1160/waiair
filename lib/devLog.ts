/**
 * Diagnostic logging that never reaches a shipped build.
 * Traces that are genuinely useful while developing (board loads, search filtering, radar batches) go through
 * here instead of console.log, so a release build stays quiet and nothing ends up in the device log.
 */

export function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && !!__DEV__;
}

/** console.log in a dev build, nothing at all in release. */
export function devLog(...args: unknown[]): void {
  if (!isDevBuild()) return;
  console.log(...args);
}
