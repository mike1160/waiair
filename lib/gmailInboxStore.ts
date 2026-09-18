/**
 * Gmail inbox scan, device side: the Gmail calls, the imported-id dedupe list and the pending selection.
 * Metadata only (From, Subject, Date) — no email body is fetched and nothing is sent to a server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { gmailAccessToken } from './gmailTripExtras';
import {
  SCAN_DAYS_DEFAULT,
  SCAN_TIMEOUT_MS,
  filterImported,
  gmailQuery,
  itemFromMetadata,
  type GmailInboxItem,
} from './gmailInboxScan';

/** Imported message ids: an email is offered once, so no Gmail label and no gmail.modify scope. */
export const IMPORTED_IDS_KEY = 'gmail_imported_ids';
/** The selection waiting to be parsed into trips (bodies are read in a later step). */
export const PENDING_IMPORT_KEY = 'waiair.gmail.pendingImports.v1';
const LIST_MAX = 50;
const FETCH_CONCURRENCY = 5;

export type ScanFailure = 'offline' | 'not_connected' | 'error';

export type InboxScanResult = {
  items: GmailInboxItem[];
  /** True when the 10s budget ran out: what was found so far is shown. */
  partial: boolean;
  reason?: ScanFailure;
};

async function readIds(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function loadImportedIds(): Promise<string[]> {
  return readIds(IMPORTED_IDS_KEY);
}

export async function addImportedIds(ids: string[]): Promise<void> {
  const next = new Set(await loadImportedIds());
  for (const id of ids) if (id) next.add(id);
  try {
    await AsyncStorage.setItem(IMPORTED_IDS_KEY, JSON.stringify([...next]));
  } catch {
    // Not stored: the mails are offered again on the next scan.
  }
}

/** What the user picked, kept for the step that reads the bodies and builds the trips. */
export async function savePendingImports(items: GmailInboxItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(items));
  } catch {
    // Not stored: the next step simply has nothing queued.
  }
}

export async function loadPendingImports(): Promise<GmailInboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_IMPORT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isOffline(e: unknown): boolean {
  const msg = String((e as Error)?.message || e || '').toLowerCase();
  return msg.includes('network request failed') || msg.includes('failed to fetch') || msg.includes('offline');
}

/**
 * One inbox scan. `onProgress` reports 0..1 over the metadata fetches so the loading screen can follow the real work.
 * Over the time budget the scan stops and returns what it has (`partial`).
 */
export async function scanGmailInbox(opts?: {
  days?: number;
  timeoutMs?: number;
  onProgress?: (done: number, total: number) => void;
  now?: number;
}): Promise<InboxScanResult> {
  const days = opts?.days ?? SCAN_DAYS_DEFAULT;
  const budget = opts?.timeoutMs ?? SCAN_TIMEOUT_MS;
  const startedAt = opts?.now ?? Date.now();
  const token = await gmailAccessToken();
  if (!token) return { items: [], partial: false, reason: 'not_connected' };
  const headers = { Authorization: `Bearer ${token}` };
  const outOfTime = () => Date.now() - startedAt > budget;

  let ids: string[] = [];
  try {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${LIST_MAX}`
      + `&q=${encodeURIComponent(gmailQuery(days))}`;
    const res = await fetch(listUrl, { headers });
    if (res.status === 401 || res.status === 403) return { items: [], partial: false, reason: 'not_connected' };
    if (!res.ok) return { items: [], partial: false, reason: 'error' };
    const json = await res.json() as { messages?: { id?: string }[] };
    ids = (json.messages || []).map(m => String(m?.id || '')).filter(Boolean);
  } catch (e) {
    return { items: [], partial: false, reason: isOffline(e) ? 'offline' : 'error' };
  }

  const imported = new Set(await loadImportedIds());
  const fresh = ids.filter(id => !imported.has(id));
  const found: GmailInboxItem[] = [];
  let done = 0;
  let partial = false;
  let failure: ScanFailure | undefined;

  const worker = async (queue: string[]) => {
    for (const id of queue) {
      if (outOfTime()) {
        partial = true;
        return;
      }
      try {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`
          + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date';
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json() as { payload?: { headers?: { name?: string; value?: string }[] }; internalDate?: string };
          const item = itemFromMetadata(id, json.payload?.headers, json.internalDate);
          if (item) found.push(item);
        } else if (res.status === 401 || res.status === 403) {
          failure = 'not_connected';
          return;
        }
      } catch (e) {
        if (isOffline(e)) {
          failure = 'offline';
          return;
        }
      } finally {
        done += 1;
        opts?.onProgress?.(done, fresh.length);
      }
    }
  };

  const lanes: string[][] = Array.from({ length: FETCH_CONCURRENCY }, () => []);
  fresh.forEach((id, i) => lanes[i % FETCH_CONCURRENCY].push(id));
  await Promise.all(lanes.map(worker));

  if (failure && !found.length) return { items: [], partial: false, reason: failure };
  return { items: filterImported(found, imported), partial: partial || !!failure };
}
