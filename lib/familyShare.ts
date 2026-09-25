/**
 * Family Safety Mode: the record of who is following a shared flight, and which moments they may see.
 *
 * No GPS and no location data — a follower learns only what the flight status and the traveller's own
 * Gmail bookings already say. The traveller starts the share; the token is the capability.
 *
 * Everything above `loadShareRecords` is pure, so the rules are unit-tested without touching storage.
 *
 * Known gap, deliberately not papered over here: anyone holding the token can register as a follower and
 * the traveller is never shown who that is. See the note on `addFollower`.
 */

import { useEffect, useState } from 'react';
import type { TripMoment } from './tripMoments.ts';
import { PROXY_BASE } from './proxyUrl.ts';

export const SHARE_STORAGE_KEY = 'waiair.familyShare.v1';
export const SHARE_BASE_URL = 'https://waiair.app/follow';
/** A share outlives a two-week trip's outbound leg but not the trip itself. */
export const SHARE_TTL_MS = 8 * 24 * 3600 * 1000;
export const SHARE_TOKEN_LENGTH = 12;
const PROXY_URL = PROXY_BASE;

/** No look-alikes: a token gets read off a screen and typed, so 0/O and 1/l/I are out. */
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789-_';

export type Follower = {
  /** Expo push token. */
  pushToken: string;
  /** "Sarah", shown in the share UI. */
  name?: string;
  addedMs: number;
};

export type ShareRecord = {
  flightKey: string;
  /** Random, URL-safe, and the only thing standing between a stranger and the traveller's arrival times. */
  token: string;
  createdMs: number;
  expiresMs: number;
  followers: Follower[];
  travelerName?: string;
};

/** Crypto where it exists (both Hermes and Node have it), Math.random only as a last resort. */
function randomToken(length = SHARE_TOKEN_LENGTH): string {
  const n = Math.max(1, Math.round(length));
  const alphabet = TOKEN_ALPHABET;
  const bytes = new Uint8Array(n);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function createShareToken(flightKey: string, travelerName?: string): ShareRecord {
  const now = Date.now();
  const name = String(travelerName || '').trim();
  return {
    flightKey: String(flightKey || ''),
    token: randomToken(),
    createdMs: now,
    expiresMs: now + SHARE_TTL_MS,
    followers: [],
    ...(name ? { travelerName: name } : {}),
  };
}

export function shareUrl(token: string): string {
  return `${SHARE_BASE_URL}/${encodeURIComponent(String(token || ''))}`;
}

/**
 * Adds a follower, or refreshes the name of one already there — the same device following twice is one
 * follower, not two notifications.
 *
 * Nothing here asks the traveller to approve the follower, because the endpoint this mirrors does not
 * either: whoever opens the link is in. That is a real hole in a safety feature and wants a traveller-facing
 * follower list plus a revoke before this ships.
 */
export function addFollower(record: ShareRecord, pushToken: string, name?: string): ShareRecord {
  const token = String(pushToken || '').trim();
  if (!token) return record;
  const clean = String(name || '').trim();
  const existing = record.followers.find(f => f.pushToken === token);
  if (existing) {
    return {
      ...record,
      followers: record.followers.map(f => (
        f.pushToken === token ? { ...f, ...(clean ? { name: clean } : {}) } : f
      )),
    };
  }
  return {
    ...record,
    followers: [...record.followers, { pushToken: token, addedMs: Date.now(), ...(clean ? { name: clean } : {}) }],
  };
}

export function removeFollower(record: ShareRecord, pushToken: string): ShareRecord {
  const token = String(pushToken || '').trim();
  return { ...record, followers: record.followers.filter(f => f.pushToken !== token) };
}

export function isExpired(record: ShareRecord, now = Date.now()): boolean {
  return now > Number(record?.expiresMs ?? 0);
}

/** What the people at home may see. A traveller-only moment never leaves the device. */
export function filterMomentsForFollower(moments: TripMoment[]): TripMoment[] {
  return (moments || []).filter(m => m && (m.audience === 'follower' || m.audience === 'both'));
}

/** What the traveller sees. Follower-only moments are about them, not for them. */
export function filterMomentsForTraveler(moments: TripMoment[]): TripMoment[] {
  return (moments || []).filter(m => m && (m.audience === 'traveler' || m.audience === 'both'));
}

/**
 * What a follower's device should actually show: the follower wording when the moment has one, otherwise
 * the moment's own. Keeps the fan-out from leaking a baggage belt to someone sitting at home.
 */
export function followerText(moment: TripMoment): { title: string; body: string } {
  return {
    title: moment.followerTitle || moment.title,
    body: moment.followerBody || moment.body,
  };
}

/** The record as the proxy is allowed to hold it: no push tokens ever leave the device. */
export function publicShareRecord(record: ShareRecord): Omit<ShareRecord, 'followers'> {
  const { followers: _followers, ...rest } = record;
  return rest;
}

// ── storage ──────────────────────────────────────────────────────────────────

/*
 * AsyncStorage is pulled in only when a storage function actually runs. A static import would drag React
 * Native into this module and the rules above could not be unit-tested under `node --test`.
 */
type Storage = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
};

async function storage(): Promise<Storage | null> {
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    return (mod.default || mod) as unknown as Storage;
  } catch {
    return null;
  }
}


export async function loadShareRecords(): Promise<ShareRecord[]> {
  try {
    const store = await storage();
    const raw = await store?.getItem(SHARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is ShareRecord => !!r && typeof r.token === 'string')
      .map(r => ({ ...r, followers: Array.isArray(r.followers) ? r.followers : [] }));
  } catch {
    return [];
  }
}

export async function saveShareRecords(records: ShareRecord[]): Promise<void> {
  try {
    const store = await storage();
    await store?.setItem(SHARE_STORAGE_KEY, JSON.stringify(records || []));
  } catch { /* a share that cannot be stored is re-created on the next tap */ }
  notifyChanged();
}

export async function getShareRecord(token: string): Promise<ShareRecord | null> {
  const want = String(token || '').trim();
  if (!want) return null;
  return (await loadShareRecords()).find(r => r.token === want) || null;
}

/** The share for one flight, whichever token it has. */
export async function getShareRecordForFlight(flightKey: string): Promise<ShareRecord | null> {
  const want = String(flightKey || '').trim();
  if (!want) return null;
  const now = Date.now();
  return (await loadShareRecords()).find(r => r.flightKey === want && !isExpired(r, now)) || null;
}

export async function upsertShareRecord(record: ShareRecord): Promise<void> {
  if (!record?.token) return;
  const records = await loadShareRecords();
  const at = records.findIndex(r => r.token === record.token);
  if (at >= 0) records[at] = record;
  else records.push(record);
  await saveShareRecords(records);
}

export async function pruneExpiredRecords(now = Date.now()): Promise<void> {
  const records = await loadShareRecords();
  const kept = records.filter(r => !isExpired(r, now));
  if (kept.length !== records.length) await saveShareRecords(kept);
}

// ── change notification ──────────────────────────────────────────────────────

/*
 * AsyncStorage has no change events, so a screen cannot be told that a share was created or revoked.
 * Every write in this module bumps a counter and calls the listeners; that is enough, because every write
 * goes through here. Nothing polls.
 */
let revision = 0;
const listeners = new Set<() => void>();

function notifyChanged(): void {
  revision += 1;
  for (const fn of [...listeners]) {
    try { fn(); } catch { /* one bad listener must not stop the others */ }
  }
}

export function subscribeShareRecords(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * Stops the link. The record goes from the device, and the proxy is told so the token stops answering and
 * the followers it holds are dropped. A proxy that cannot be reached still leaves the device clean: the
 * record is gone, so nothing further is ever uploaded or fanned out for it.
 */
export async function revokeShare(flightKey: string): Promise<void> {
  const want = String(flightKey || '').trim();
  if (!want) return;
  const records = await loadShareRecords();
  const going = records.filter(r => r.flightKey === want);
  if (!going.length) return;
  await saveShareRecords(records.filter(r => r.flightKey !== want));
  for (const r of going) {
    try {
      await fetch(`${PROXY_URL}/family-share/${encodeURIComponent(r.token)}`, { method: 'DELETE' });
    } catch { /* the record is already gone from the device */ }
  }
}

/** The live share for one flight, or null. Re-reads whenever a share is written or revoked. */
export function useShareRecord(flightKey: string): ShareRecord | null {
  const [record, setRecord] = useState<ShareRecord | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () => {
      void getShareRecordForFlight(flightKey).then(r => { if (alive) setRecord(r); });
    };
    read();
    const off = subscribeShareRecords(read);
    return () => { alive = false; off(); };
  }, [flightKey]);
  return record;
}
