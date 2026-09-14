const DEFAULT_TIMEOUT_MS = 8000;
const RETRIES = 3;
/** Longest proxy-announced wait still worth a silent retry. Budget limits reset in minutes. */
const MAX_RETRY_WAIT_MS = 5000;

/** Full-day home FIDS (route + arrivals) — one attempt, including body read. */
export const HOME_FIDS_TIMEOUT_MS = 20000;

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
): Promise<{ status: number; ok: boolean; text: string }> {
  const ctrl = new AbortController();
  const onParentAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
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
 */
export async function fetchJsonRetry(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<any> {
  let last: unknown;
  for (let i = 0; i < RETRIES; i++) {
    if (signal?.aborted) throw last || new TimeoutError();
    try {
      const res = await fetchTextWithTimeout(url, timeoutMs, signal);
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
      if (isRateLimitError(e) && e.retryAfterMin) throw e;
      last = e;
      if (i < RETRIES - 1) await sleep(400 * (i + 1));
    }
  }
  throw last;
}
