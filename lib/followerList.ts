/**
 * Who is following a shared flight, for the traveller's own screen.
 *
 * The list lives on the proxy (proxy/familyPush.js): the device that shares a flight never learns the push
 * tokens of the people who follow it, only a name, when they started, and an opaque id to remove them with.
 *
 * The reading of "how long" is pure and tested here; the fetching is a thin wrapper around it.
 */

const PROXY_URL = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export type Follower = {
  /** Opaque: a digest of the push token, enough to revoke, useless to reach anyone with. */
  id: string;
  name: string | null;
  /** When they started following, in ms. */
  since: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** How long someone has been following, as the sheet says it. */
export type FollowerAge =
  | { kind: 'justNow' }
  | { kind: 'hours'; n: number }
  | { kind: 'days'; n: number };

/**
 * Under an hour is "just now" — a number of minutes is more precision than this is worth, and a follower who
 * joined four minutes ago is simply new. After a day it counts in days, rounded down: someone who started
 * yesterday evening has been following "1 day", not two. A missing timestamp also reads as new.
 */
export function followerAge(since: number, now: number): FollowerAge {
  const at = Number(since);
  // No timestamp is not the same as a very old one: "following for 20,000 days" is worse than saying nothing.
  if (!Number.isFinite(at) || at <= 0) return { kind: 'justNow' };
  const ms = now - at;
  if (!Number.isFinite(ms) || ms < HOUR_MS) return { kind: 'justNow' };
  if (ms < DAY_MS) return { kind: 'hours', n: Math.max(1, Math.floor(ms / HOUR_MS)) };
  return { kind: 'days', n: Math.max(1, Math.floor(ms / DAY_MS)) };
}

/** Oldest first, the order the proxy sends and the sheet shows. */
export function sortFollowers(list: Follower[]): Follower[] {
  return [...(list || [])].sort((a, b) => Number(a?.since || 0) - Number(b?.since || 0));
}

/** The followers of a share, or null when the share is gone or the proxy cannot be reached. */
export async function fetchFollowers(token: string, signal?: AbortSignal): Promise<Follower[] | null> {
  const share = String(token || '').trim();
  if (!share) return null;
  try {
    const res = await fetch(`${PROXY_URL}/family-share/${encodeURIComponent(share)}/followers`, { signal });
    if (!res.ok) return null;
    const json = await res.json();
    const rows = Array.isArray(json?.followers) ? json.followers : [];
    return sortFollowers(rows.map((f: Follower) => ({
      id: String(f?.id || ''),
      name: f?.name ? String(f.name) : null,
      since: Number(f?.since) || 0,
    })).filter((f: Follower) => !!f.id));
  } catch {
    return null;
  }
}

/** Removes one follower. True when the proxy confirmed it. */
export async function revokeFollower(token: string, id: string): Promise<boolean> {
  const share = String(token || '').trim();
  const who = String(id || '').trim();
  if (!share || !who) return false;
  try {
    const res = await fetch(
      `${PROXY_URL}/family-share/${encodeURIComponent(share)}/followers/${encodeURIComponent(who)}`,
      { method: 'DELETE' },
    );
    return res.ok;
  } catch {
    return false;
  }
}
