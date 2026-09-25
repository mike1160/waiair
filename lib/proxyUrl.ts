/**
 * Where the app's own backend lives.
 *
 * This was written out in twenty-nine places as
 * `process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app'`, and that fallback only
 * catches a variable that is *missing*. A variable that is present but is not a URL — a token that landed on
 * the wrong key, a half-finished edit — sailed straight through, and every request in the app then went to a
 * relative path with no host: no socket, no response, no error to report. A total outage with nothing in the
 * logs, which is exactly what happened.
 *
 * So the value has to look like a URL before it is trusted. Anything else falls back, and the app keeps
 * working on its own address rather than failing silently everywhere at once.
 *
 * Pure and free of React Native on purpose: half the callers are unit-tested modules.
 */

/** The address the app is deployed at, and what it falls back to when the environment says nothing usable. */
export const PROXY_URL_FALLBACK = 'https://waiair-production.up.railway.app';

/** A value is only a base URL if it says so: http:// or https://, and something after it. */
export function isProxyUrl(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  return /^https?:\/\/[^\s/]+/i.test(raw);
}

/**
 * The proxy base, without a trailing slash. Pass a value to check one; the default reads the environment.
 */
export function proxyUrl(value: unknown = process.env.EXPO_PUBLIC_PROXY_URL): string {
  const raw = String(value ?? '').trim();
  return (isProxyUrl(raw) ? raw : PROXY_URL_FALLBACK).replace(/\/+$/, '');
}

/** The proxy base for this run. Read once: the environment cannot change while the app is open. */
export const PROXY_BASE = proxyUrl();
