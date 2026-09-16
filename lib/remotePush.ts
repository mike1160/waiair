/** Register / unregister Expo push tokens per tracked flight on the Railway proxy. */

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

export async function unregisterPushForFlight(opts: {
  proxy: string;
  token: string;
  flightNumber: string;
  fetchImpl?: FetchLike;
}): Promise<boolean> {
  const token = String(opts.token || '').trim();
  const flightNumber = slugPushFlight(opts.flightNumber);
  if (!isExpoPushToken(token) || !flightNumber) return false;
  const base = String(opts.proxy || '').replace(/\/$/, '');
  if (!base) return false;
  return postJson(
    `${base}/push/register`,
    pushUnregisterPayload(token, flightNumber),
    opts.fetchImpl || fetch,
    'DELETE',
  );
}

export async function syncPushForTrackedFlights(opts: {
  proxy: string;
  token: string;
  flightNumbers: string[];
  platform?: RemotePushPlatform;
  fetchImpl?: FetchLike;
}): Promise<number> {
  let ok = 0;
  for (const number of opts.flightNumbers) {
    if (await registerPushForFlight({ ...opts, flightNumber: number })) ok += 1;
  }
  return ok;
}
