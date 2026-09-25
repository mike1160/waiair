/**
 * Gmail inbox scan, device side: the Gmail calls, the imported-id dedupe list and the pending selection.
 * Metadata only (From, Subject, Date) — no email body is fetched and nothing is sent to a server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { gmailAccessToken } from './gmailTripExtras';
import { collectBody, extractJsonLd } from './gmailMessageText';
import { parseJsonLdFlight } from './flightImport';
import type { ImportedMessage } from './gmailImport';
import type { ImportCandidate } from './flightImport';
import type { TripExtras } from './tripExtras';
import { isSyncStatus, type GmailSyncStatus } from './gmailSyncStatus';
import { mergeInbox, type InboxItem } from './gmailInbox';
import {
  SCAN_DAYS_DEFAULT,
  SCAN_TIMEOUT_MS,
  filterImported,
  gmailQueries,
  listOutcome,
  mergeListPages,
  itemFromMetadata,
  type GmailInboxItem,
  type ListPage,
} from './gmailInboxScan';

/** Imported message ids: an email is offered once, so no Gmail label and no gmail.modify scope. */
export const IMPORTED_IDS_KEY = 'gmail_imported_ids';
/** The selection waiting to be parsed into trips (bodies are read in a later step). */
export const PENDING_IMPORT_KEY = 'waiair.gmail.pendingImports.v1';
/** Parsed hotels / cars / transfers with no trip to hang on yet; retried when a matching flight is tracked. */
export const ORPHAN_EXTRAS_KEY = 'waiair.gmail.orphanExtras.v1';
/** Flights found but not confident enough to track on their own: the discovery card offers them. */
export const PENDING_REVIEW_KEY = 'waiair.gmail.pendingReview.v1';
/** When the inbox was last looked at and how many travel mails that found (counts only, no content). */
export const SYNC_STATUS_KEY = 'waiair.gmail.syncStatus.v1';
/**
 * What was decided about a travel mail: linked to a trip, or deliberately put aside [J/5].
 *
 * Only the two ends of the story live here. What is still waiting stays in the queue above, which the scan
 * owns — keeping both in one place would mean two writers for the same row.
 */
export const INBOX_DECISIONS_KEY = 'waiair.gmail.inboxDecisions.v1';
/** A booking with no flight is kept this long before it is forgotten. */
export const ORPHAN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
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

/** Drops the mails that have been dealt with; the rest stay queued for the next run. */
export async function removePendingImports(ids: string[]): Promise<void> {
  const done = new Set(ids || []);
  if (!done.size) return;
  const left = (await loadPendingImports()).filter(i => !done.has(i.id));
  await savePendingImports(left);
}

export type OrphanExtras = {
  messageId: string;
  extras: Partial<TripExtras>;
  savedMs: number;
  /**
   * The trip this booking probably belongs to, when the match was good enough to offer but not to make
   * (lib/matchScore.ts, the 'suggest' tier). Kept with the booking so it can be offered without scoring it
   * again; an older queue simply has neither field.
   */
  suggestedFlightKey?: string;
  matchScore?: number;
};

export async function loadOrphanExtras(now = Date.now()): Promise<OrphanExtras[]> {
  try {
    const raw = await AsyncStorage.getItem(ORPHAN_EXTRAS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o: OrphanExtras) => o && o.extras && now - Number(o.savedMs || 0) < ORPHAN_TTL_MS);
  } catch {
    return [];
  }
}

export async function saveOrphanExtras(list: OrphanExtras[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ORPHAN_EXTRAS_KEY, JSON.stringify(list || []));
  } catch {
    // Not stored: the booking is offered again the next time its mail is scanned.
  }
}

/* ── The inbox: what was decided about a mail, and the whole picture [J/5] ─────────────────────── */

export async function loadInboxDecisions(): Promise<InboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INBOX_DECISIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i: InboxItem) => i && i.messageId && (i.status === 'linked' || i.status === 'ignored'));
  } catch {
    return [];
  }
}

export async function saveInboxDecisions(list: InboxItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(INBOX_DECISIONS_KEY, JSON.stringify(list || []));
  } catch {
    // Not stored: the booking simply shows as waiting again, which is the safe way round.
  }
}

/** Everything the inbox shows: the queue as it stands, plus the decisions already taken. */
export async function loadInbox(): Promise<InboxItem[]> {
  const [queue, decided] = await Promise.all([loadOrphanExtras(), loadInboxDecisions()]);
  return mergeInbox(queue, decided);
}

/**
 * Writes one decision: the mail leaves the waiting queue and its outcome is remembered.
 *
 * Both sides are needed. Dropping it from the queue alone would make it vanish with no explanation, and
 * recording the decision alone would leave it waiting as well as answered.
 */
export async function saveInboxDecision(item: InboxItem): Promise<void> {
  if (!item?.messageId) return;
  const [queue, decided] = await Promise.all([loadOrphanExtras(), loadInboxDecisions()]);
  await saveOrphanExtras(queue.filter(q => q.messageId !== item.messageId));
  await saveInboxDecisions([...decided.filter(d => d.messageId !== item.messageId), item]);
}

/** Back to waiting: the decision is forgotten and the booking rejoins the queue. */
export async function restoreInboxItem(item: InboxItem): Promise<void> {
  if (!item?.messageId) return;
  const [queue, decided] = await Promise.all([loadOrphanExtras(), loadInboxDecisions()]);
  await saveInboxDecisions(decided.filter(d => d.messageId !== item.messageId));
  if (queue.some(q => q.messageId === item.messageId)) return;
  await saveOrphanExtras([...queue, {
    messageId: item.messageId,
    extras: item.extras || {},
    savedMs: Number(item.savedMs) || Date.now(),
    ...(item.suggestedFlightKey
      ? { suggestedFlightKey: item.suggestedFlightKey, matchScore: item.matchScore }
      : {}),
  }]);
}

/**
 * Gone for good: the decision is dropped and the mail is marked as already dealt with, so the next scan
 * does not offer it all over again.
 */
export async function forgetInboxItem(messageId: string): Promise<void> {
  const id = String(messageId || '').trim();
  if (!id) return;
  const [queue, decided] = await Promise.all([loadOrphanExtras(), loadInboxDecisions()]);
  await saveOrphanExtras(queue.filter(q => q.messageId !== id));
  await saveInboxDecisions(decided.filter(d => d.messageId !== id));
  await addImportedIds([id]);
}

/** Drops one waiting booking — the user attached it by hand, or does not want it. */
export async function removeOrphanExtras(messageId: string): Promise<OrphanExtras[]> {
  const left = (await loadOrphanExtras()).filter(o => o.messageId !== messageId);
  await saveOrphanExtras(left);
  return left;
}

export async function loadSyncStatus(): Promise<GmailSyncStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_STATUS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isSyncStatus(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Remembers a finished scan for the Settings section: the moment and the count, never what was in the mails. */
export async function saveSyncStatus(status: GmailSyncStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify({ ms: status.ms, found: status.found }));
  } catch {
    // Not stored: Settings simply shows nothing about the last scan.
  }
}

/**
 * The bodies of the picked mails, flattened to text. Read at import time only, kept in memory: nothing but the
 * parsed fields and the message id is ever written to disk, and no body leaves the device.
 */
export async function fetchMessageTexts(ids: string[]): Promise<ImportedMessage[]> {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return [];
  const token = await gmailAccessToken();
  if (!token) return [];
  const headers = { Authorization: `Bearer ${token}` };
  const out: ImportedMessage[] = [];
  for (const id of list) {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
        { headers },
      );
      if (!res.ok) continue;
      const json = await res.json() as {
        snippet?: string;
        payload?: { headers?: { name?: string; value?: string }[] };
      };
      const header = (name: string) => (json.payload?.headers || [])
        .find(h => String(h?.name || '').toLowerCase() === name)?.value || '';
      const subject = header('subject');
      // The sender is most of what decides how much a flight number in this mail is trusted
      // (scoreCandidate in lib/flightImport.ts): an airline's own confirmation is worth more than a forward.
      const from = header('from');
      const body = `${json.snippet || ''}\n${collectBody(json.payload)}`;
      // Airlines that put the itinerary only in a PDF still mark the mail up with schema.org JSON-LD.
      // Those fields go in front of the body as plain text, so parseImportText reads them like any other mail.
      const ldFlight = parseJsonLdFlight(extractJsonLd(json.payload));
      if (ldFlight?.flightNumber) {
        const ldText = [
          ldFlight.flightNumber,
          ldFlight.dateIso || '',
          ldFlight.origin || '',
          ldFlight.destination || '',
          ldFlight.confirmationRef || '',
        ].filter(Boolean).join(' ');
        out.push({ id, subject, from, text: `${ldText}\n${body}` });
      } else {
        out.push({ id, subject, from, text: body });
      }
    } catch {
      // One mail that will not load must not stop the rest; it stays pending.
    }
  }
  return out;
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

  /*
   * The searches run together, and their results are shared out rather than concatenated: one id from each
   * batch, then the next, until the page is full. A mailbox full of airline mail can no longer push a hotel
   * confirmation off the end, and the number of mails whose headers are read afterwards is unchanged, so the
   * time budget below behaves exactly as it did.
   */
  let ids: string[] = [];
  const queries = gmailQueries(days);
  const perQuery = Math.max(5, Math.ceil(LIST_MAX / Math.max(1, queries.length)) * 2);
  // Each batch reports its own ending and nothing throws out of it: with `Promise.all`, one request that
  // fails to leave the phone would otherwise reject all of them and fail a scan the other batches answered.
  const pages: ListPage[] = await Promise.all(queries.map(async (q): Promise<ListPage> => {
    try {
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${perQuery}`
        + `&q=${encodeURIComponent(q)}`;
      const res = await fetch(listUrl, { headers });
      if (res.status === 401 || res.status === 403) return { ids: [], denied: true };
      if (!res.ok) return { ids: [], failed: true };
      const json = await res.json() as { messages?: { id?: string }[] };
      return { ids: (json.messages || []).map(m => String(m?.id || '')).filter(Boolean) };
    } catch (e) {
      return { ids: [], failed: true, offline: isOffline(e) };
    }
  }));
  const outcome = listOutcome(pages);
  if (outcome !== 'ok') return { items: [], partial: false, reason: outcome };
  ids = mergeListPages(pages.map(p => p.ids), LIST_MAX);
  // Some of the searches did not come back, so what follows is part of the answer, not all of it.
  const listPartial = pages.some(p => p.failed || p.denied);

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
  return { items: filterImported(found, imported), partial: partial || listPartial || !!failure };
}

/** Settings → "Clear import history": every mail is offered again on the next scan. */
export async function clearImportedIds(): Promise<void> {
  try {
    await AsyncStorage.removeItem(IMPORTED_IDS_KEY);
  } catch { /* nothing to forget */ }
}

/** Settings → "Disconnect Gmail": the dedupe list and the last-scan line go with the connection. */
export async function clearGmailScanState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([IMPORTED_IDS_KEY, SYNC_STATUS_KEY]);
  } catch { /* nothing to forget */ }
}

/** The low-confidence flights the discovery card should offer; replaces whatever was queued before. */
export async function savePendingReview(candidates: ImportCandidate[]): Promise<void> {
  try {
    const list = (candidates || []).filter(c => c && c.flightNumber);
    if (!list.length) return void await AsyncStorage.removeItem(PENDING_REVIEW_KEY);
    await AsyncStorage.setItem(PENDING_REVIEW_KEY, JSON.stringify(list));
  } catch { /* the card simply has nothing to show */ }
}

export async function loadPendingReview(): Promise<ImportCandidate[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_REVIEW_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is ImportCandidate => !!c && typeof c.flightNumber === 'string');
  } catch {
    return [];
  }
}

export async function clearPendingReview(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_REVIEW_KEY);
  } catch { /* nothing queued */ }
}
