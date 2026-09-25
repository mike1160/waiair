const DEFAULT_TIMEOUT_MS = 8000;
const RETRIES = 3;
/** Longest proxy-announced wait still worth a silent retry. Budget limits reset in minutes. */
const MAX_RETRY_WAIT_MS = 5000;

/** Full-day home FIDS (route + arrivals) — one attempt, including body read. */
export const HOME_FIDS_TIMEOUT_MS = 20000;

/**
 * Whole-lookup budget for a flight-number search, enforced with `withTimeout` — a race, not a fetch option.
 *
 * The per-attempt timeouts below cannot be relied on for this: an iOS network task can disappear without ever
 * calling back into JS, and the fetch promise then never settles. Aborting it changes nothing, so a search that
 * only awaits the chain would show its spinner for ever with no error and no retry. The full-day board lookups
 * have had this deadline all along, which is why they recover and a flight-number search did not.
 *
 * It has to outlast the retrying it guards, or it stops searches that were about to succeed: three attempts of
 * DEFAULT_TIMEOUT_MS plus the backoff between them is 25.2s, and 28.5s when the proxy asks us to wait. At 20s
 * a search needing two retries — ordinary on mobile data — was cut off a few seconds before its answer.
 */
export const FLIGHT_SEARCH_TIMEOUT_MS = 30000;

export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Proxy AeroDataBox budget hit (429 per caller, 503 cost guard). `retryAfterMin` is null when no wait was given. */
export class RateLimitError extends Error {
  status: number;
  retryAfterMin: number | null;

  constructor(status: number, retryAfterMin: number | null) {
    super(retryAfterMin ? `Too many requests — try again in ${retryAfterMin} min` : 'Too many requests');
    this.name = 'RateLimitError';
    this.status = status;
    this.retryAfterMin = retryAfterMin;
  }
}

/** Flight-number search quota used up — the app's own count or the proxy's 402. */
export class SearchQuotaError extends Error {
  tier: string;
  limit: number | null;
  used: number | null;

  constructor(tier: string, limit: number | null = null, used: number | null = null) {
    super('Search quota reached');
    this.name = 'SearchQuotaError';
    this.tier = tier;
    this.limit = limit;
    this.used = used;
  }
}

export function isSearchQuotaError(error: unknown): error is SearchQuotaError {
  return error instanceof SearchQuotaError || (error as { name?: string })?.name === 'SearchQuotaError';
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError || (error as { name?: string })?.name === 'RateLimitError';
}

/** 429, or the proxy's 503 cost guard, as a RateLimitError (with the proxy's retryAfterMin when present); else null. */
export function rateLimitFromResponse(status: number, text: string): RateLimitError | null {
  if (status !== 429 && status !== 503) return null;
  let body: { error?: string; retryAfterMin?: unknown } | null = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (status === 503 && body?.error !== 'cost_guard') return null;
  const min = Number(body?.retryAfterMin);
  return new RateLimitError(status, Number.isFinite(min) && min > 0 ? Math.ceil(min) : null);
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const onParentAbort = () => ctrl.abort();
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new TimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onParentAbort);
  }
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function fetchTextWithTimeout(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<{ status: number; ok: boolean; text: string }> {
  const ctrl = new AbortController();
  const onParentAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, headers ? { signal: ctrl.signal, headers } : { signal: ctrl.signal });
    const text = await res.text();
    return { status: res.status, ok: res.ok, text };
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new TimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

/**
 * Silent retry up to 3 times (8s timeout each, including body). Throws the last error.
 * A budget limit with a wait of minutes throws a RateLimitError at once: retrying only repeats the rejection.
 * A search quota refusal (402) throws a SearchQuotaError at once.
 */
export async function fetchJsonRetry(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<any> {
  let last: unknown;
  for (let i = 0; i < RETRIES; i++) {
    if (signal?.aborted) throw last || new TimeoutError();
    try {
      const res = await fetchTextWithTimeout(url, timeoutMs, signal, headers);
      if (res.status === 402) {
        let body: { tier?: string; limit?: unknown; used?: unknown } | null = null;
        try { body = JSON.parse(res.text); } catch { /* not JSON */ }
        const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
        throw new SearchQuotaError(String(body?.tier || 'free'), num(body?.limit), num(body?.used));
      }
      const limited = rateLimitFromResponse(res.status, res.text);
      if (limited) {
        if (limited.retryAfterMin && limited.retryAfterMin * 60_000 > MAX_RETRY_WAIT_MS) throw limited;
        last = limited;
        await sleep(1500 * (i + 1));
        continue;
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const raw = res.text;
      if (!raw || !raw.trim()) throw new Error('Empty response from upstream API');
      return JSON.parse(raw);
    } catch (e: any) {
      if (isSearchQuotaError(e)) throw e;
      if (isRateLimitError(e) && e.retryAfterMin) throw e;
      last = e;
      if (i < RETRIES - 1) await sleep(400 * (i + 1));
    }
  }
  throw last;
}
