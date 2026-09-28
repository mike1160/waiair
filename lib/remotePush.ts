/**
 * Expo push tokens per tracked flight, on the Railway proxy.
 *
 * Registering used to be the only thing this file did reliably [W/1]. The sync was additive — it told the proxy
 * which flights the device follows *now* and never which ones it had stopped following — and the unregister was
 * fired and forgotten: not awaited, its failure swallowed. A row in push_tokens carries no user identity and dies
 * only when something deletes it, so one dropped unregister meant a week of notifications about a flight the
 * traveller had disconnected. That is the bug, and it is a data bug rather than a UI one.
 *
 * Two changes. The sync is authoritative: it posts the whole tracked set to /push/sync and the proxy removes
 * everything else for that token, so any unregister that never landed is corrected the next time the app syncs.
 * And the calls retry, briefly, instead of giving up on the first bad connection — an unfollow on a flaky hotel
 * wifi should not need a later reconcile to take effect.
 */

export type RemotePushPlatform = 'ios' | 'android' | 'web' | string;

export function slugPushFlight(number: string): string {
  return String(number || '').replace(/[\s/-]+/g, '').toUpperCase();
}

export function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(String(token || '').trim());
}

export function pushRegisterPayload(
  token: string,
  flightNumber: string,
  platform?: RemotePushPlatform,
): { token: string; flightNumber: string; platform?: string } {
  return {
    token: String(token || '').trim(),
    flightNumber: slugPushFlight(flightNumber),
    ...(platform ? { platform: String(platform) } : {}),
  };
}

export function pushUnregisterPayload(token: string, flightNumber: string): { token: string; flightNumber: string } {
  return {
    token: String(token || '').trim(),
    flightNumber: slugPushFlight(flightNumber),
  };
}

/**
 * The authoritative payload: every flight this device follows, deduped. An empty array is legitimate and is
 * sent as such — it tells the proxy this device follows nothing, which is how the last unfollow is honoured.
 */
export function pushSyncPayload(
  token: string,
  flightNumbers: readonly string[],
  platform?: RemotePushPlatform,
): { token: string; flightNumbers: string[]; platform?: string } {
  const seen = new Set<string>();
  for (const n of flightNumbers || []) {
    const slug = slugPushFlight(n);
    if (slug) seen.add(slug);
  }
  return {
    token: String(token || '').trim(),
    flightNumbers: [...seen],
    ...(platform ? { platform: String(platform) } : {}),
  };
}

/** How many times a write is attempted before the next sync is left to fix it. */
export const PUSH_RETRY_ATTEMPTS = 3;
/** Backoff between attempts, multiplied by the attempt number. */
export const PUSH_RETRY_DELAY_MS = 1500;

export type RetryOptions = {
  attempts?: number;
  delayMs?: number;
  /** Injected by the tests; nothing here waits for real seconds under test. */
  sleep?: (ms: number) => Promise<void>;
};

const realSleep = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });

type FetchLike = typeof fetch;

async function postJson(
  url: string,
  body: object,
  fetchImpl: FetchLike,
  method: 'POST' | 'DELETE' = 'POST',
): Promise<boolean> {
  try {
    const res = await fetchImpl(url, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    return !!res && res.ok;
  } catch {
    return false;
  }
}

/**
 * The same write, tried a few times. A failure here is nearly always a connection that was not there for a
 * second, and the cost of one more attempt is far lower than the cost of the row it failed to delete.
 */
async function postJsonRetrying(
  url: string,
  body: object,
  fetchImpl: FetchLike,
  method: 'POST' | 'DELETE',
  retry: RetryOptions = {},
): Promise<boolean> {
  const attempts = Math.max(1, retry.attempts ?? PUSH_RETRY_ATTEMPTS);
  const delayMs = retry.delayMs ?? PUSH_RETRY_DELAY_MS;
  const sleep = retry.sleep || realSleep;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await postJson(url, body, fetchImpl, method)) return true;
    if (attempt < attempts) await sleep(delayMs * attempt);
  }
  return false;
}

export async function registerPushForFlight(opts: {
  proxy: string;
  token: string;
  flightNumber: string;
  platform?: RemotePushPlatform;
  fetchImpl?: FetchLike;
}): Promise<boolean> {
  const token = String(opts.token || '').trim();
  const flightNumber = slugPushFlight(opts.flightNumber);
  if (!isExpoPushToken(token) || !flightNumber) return false;
  const base = String(opts.proxy || '').replace(/\/$/, '');
  if (!base) return false;
  return postJson(
    `${base}/push/register`,
    pushRegisterPayload(token, flightNumber, opts.platform),
    opts.fetchImpl || fetch,
  );
}

/**
 * Stop pushes for one flight. Retried, and the caller awaits it: the previous version dropped this into a
 * swallowed catch, so the row survived and the notifications kept coming.
 */
export async function unregisterPushForFlight(opts: {
  proxy: string;
  token: string;
  flightNumber: string;
  fetchImpl?: FetchLike;
  retry?: RetryOptions;
}): Promise<boolean> {
  const token = String(opts.token || '').trim();
  const flightNumber = slugPushFlight(opts.flightNumber);
  if (!isExpoPushToken(token) || !flightNumber) return false;
  const base = String(opts.proxy || '').replace(/\/$/, '');
  if (!base) return false;
  return postJsonRetrying(
    `${base}/push/register`,
    pushUnregisterPayload(token, flightNumber),
    opts.fetchImpl || fetch,
    'DELETE',
    opts.retry,
  );
}

/**
 * Tell the proxy exactly which flights this device follows. One request, and the proxy deletes the rest — an
 * empty list included, because "I follow nothing" is the state after the last unfollow and used to be sent as
 * nothing at all.
 */
export async function syncPushForTrackedFlights(opts: {
  proxy: string;
  token: string;
  flightNumbers: readonly string[];
  platform?: RemotePushPlatform;
  fetchImpl?: FetchLike;
  retry?: RetryOptions;
}): Promise<boolean> {
  const token = String(opts.token || '').trim();
  if (!isExpoPushToken(token)) return false;
  const base = String(opts.proxy || '').replace(/\/$/, '');
  if (!base) return false;
  return postJsonRetrying(
    `${base}/push/sync`,
    pushSyncPayload(token, opts.flightNumbers || [], opts.platform),
    opts.fetchImpl || fetch,
    'POST',
    opts.retry,
  );
}
