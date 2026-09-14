/** Home-search timeout: health vs connection, and DEV abort logs. */

import { fetchWithTimeout, isRateLimitError, TimeoutError } from './net.ts';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export type SearchTimeoutKind = 'timeout' | 'slow';
export type UpstreamName = 'ADB' | 'OpenSky' | 'FA';

export function searchTimeoutKind(healthOk: boolean): SearchTimeoutKind {
  return healthOk ? 'slow' : 'timeout';
}

export type LookupFailure =
  | { kind: 'rateLimited'; retryAfterMin: number | null }
  | { kind: 'timeout' }
  | { kind: 'failed' };

/** Home search failure: budget limit (with the proxy's minutes), a timeout to check against /health, or a plain failure. */
export function classifyLookupError(error: unknown): LookupFailure {
  if (isRateLimitError(error)) return { kind: 'rateLimited', retryAfterMin: error.retryAfterMin };
  if (error instanceof TimeoutError || (error as { name?: string })?.name === 'TimeoutError') return { kind: 'timeout' };
  return { kind: 'failed' };
}

export function isTimeoutLike(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TimeoutError) return true;
  const e = error as { name?: string; status?: number; code?: string };
  if (e.name === 'TimeoutError' || e.name === 'AbortError') return true;
  if (e.status === 504 || e.code === 'UPSTREAM_TIMEOUT') return true;
  return false;
}

export function logUpstreamAbort(upstream: UpstreamName, elapsedMs: number): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[searchTimeout] ${upstream} 15s abort after ${Math.round(elapsedMs)}ms`);
  }
}

export async function withUpstreamAbortLog<T>(
  upstream: UpstreamName,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } catch (error) {
    if (isTimeoutLike(error)) logUpstreamAbort(upstream, Date.now() - t0);
    throw error;
  }
}

export async function proxyHealthOk(timeoutMs = 2500): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${PROXY}/health`, {}, timeoutMs);
    return !!res.ok;
  } catch {
    return false;
  }
}
