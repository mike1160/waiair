const DEFAULT_TIMEOUT_MS = 8000;
const RETRIES = 3;

export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new TimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

/** Silent retry up to 3 times (8s timeout each). Throws the last error. */
export async function fetchJsonRetry(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<any> {
  let last: unknown;
  for (let i = 0; i < RETRIES; i++) {
    try {
      const res = await fetchWithTimeout(url, {}, timeoutMs);
      if (res.status === 429) {
        last = Object.assign(new Error('Too many requests'), { status: 429 });
        await sleep(1500 * (i + 1));
        continue;
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const raw = await res.text();
      if (!raw || !raw.trim()) throw new Error('Empty response from upstream API');
      return JSON.parse(raw);
    } catch (e: any) {
      last = e;
      if (i < RETRIES - 1) await sleep(400 * (i + 1));
    }
  }
  throw last;
}
