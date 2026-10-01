/**
 * Gmail inbox scan, device side: the Gmail calls, the imported-id dedupe list and the pending selection.
 * Metadata only (From, Subject, Date) — no email body is fetched and nothing is sent to a server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { gmailAccessToken } from './gmailTripExtras';
import { collectAttachmentNames, collectBody, extractJsonLd, htmlToText } from './gmailMessageText';
import { forwardedHeaders, stripForwardPrefix } from './forwardedMail';
import { importDisplayName } from './importDisplayName';
import { parseJsonLdFlight } from './flightImport';
import { dedupePendingReview } from './gmailImport';
import { parseFlownMails, type FlownMail } from './flownMails';
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
  promoSignals,
  type GmailInboxItem,
  type ListPage,
  classifyForwarded,
  needsBodyClassify,
  matchesTravel,
  truncateSubject,
  bodySignalReport,
  senderDomain,
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
 * [W/19] Mails whose trip is already over: the message id and the date that was rejected, nothing else.
 *
 * They produce no flight, so they are never written off as imported and every scan offers them again —
 * ticked in advance, because an airline confirming a booking is exactly what the pre-selection looks for.
 * This is what lets the next scan leave them unticked and say why, with the mail still on the list.
 */
export const FLOWN_MAILS_KEY = 'waiair.gmail.flownMails.v1';
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

/**
 * Why a mail the scan fetched was not offered [V/1c].
 *
 *   notTravel      nothing in the subject looked like travel — the mail was found by a sender batch
 *   noKind         travel-shaped, but neither sender nor subject said what kind of booking it is
 *   bodyNoSignals  the body was read too, and still said nothing this app can name
 *   bodyUnreadable the body could not be fetched
 *
 * A mail that does not appear in this list at all was never returned by the Gmail search, which is a
 * different problem from anything the classifier does — and the one thing the list proves by its silence.
 */
export type SkipReason =
  | 'notTravel'
  | 'noKind'
  /** The body was read and genuinely said nothing this app can name. */
  | 'bodyNoSignals'
  /** Signals were found but no single kind stood out far enough to act on. */
  | 'kindAmbiguous'
  | 'bodyUnreadable';

export type ScanSkip = {
  id: string;
  subject: string;
  reason: SkipReason;
  /**
   * [V/1d] What the scan actually had in its hands, so the shape of a real mail can be read off the screen
   * instead of guessed at. Only set for mails whose body was fetched, and never sent anywhere.
   */
  bodyChars?: number;
  /** The sender recovered from the forwarded block, or '' when the body held no address. */
  fromDomain?: string;
  /** The opening of the extracted text — enough to see the layout, not the whole booking. */
  head?: string;
  /** [V/1e] Which signals were found and how often, so a near miss is visible as a near miss. */
  signals?: string;
  /** [V/1e] The text around the first check-in/night word, where the booking details actually live. */
  window?: string;
};

export type InboxScanResult = {
  items: GmailInboxItem[];
  /** True when the 10s budget ran out: what was found so far is shown. */
  partial: boolean;
  reason?: ScanFailure;
  /**
   * [V/1c] What the scan looked at and put aside, with the reason. Never leaves the device: it is the
   * traveller's own mail on the traveller's own screen, and it exists because a forwarded booking that goes
   * missing is otherwise indistinguishable from one that was never there.
   */
  skipped: ScanSkip[];
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
      const body = `${htmlToText(String(json.snippet || ''))}\n${collectBody(json.payload)}`;
      // [M/4] Filenames only — the payload already carries them, and the contents are never fetched.
      const attachments = collectAttachmentNames(json.payload);
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
        out.push({ id, subject, from, text: `${ldText}\n${body}`, attachments });
      } else {
        out.push({ id, subject, from, text: body, attachments });
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
 * [V/1] A second look at a mail that metadata alone could not place. Fetches the body, recovers the headers
 * the forward is carrying, and classifies on those. Returns null whenever that still says nothing — a mail
 * nobody can name stays unimported, exactly as before.
 */
async function rescueForwarded(
  id: string,
  metaHeaders: { name?: string; value?: string }[] | undefined,
  internalDate: string | number | null | undefined,
  authHeaders: Record<string, string>,
  /** [W/16] Gmail's labels, so a body-classified mail carries the same marketing signals as any other. */
  labelIds?: readonly string[] | null,
): Promise<Omit<ScanSkip, 'id'> & { item: GmailInboxItem | null }> {
  const pick = (name: string) => (metaHeaders || [])
    .find(h => String(h?.name || '').toLowerCase() === name)?.value || '';
  const outerFrom = pick('from');
  const outerSubject = pick('subject');
  const seen = truncateSubject(outerSubject);
  if (!needsBodyClassify(outerFrom, outerSubject)) {
    // Either nothing in the subject looked like travel, or it did and named no kind.
    return {
      item: null,
      subject: seen,
      reason: matchesTravel(outerFrom, outerSubject) ? 'noKind' : 'notTravel',
    };
  }
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
      { headers: authHeaders },
    );
    if (!res.ok) return { item: null, subject: seen, reason: 'bodyUnreadable' };
    const json = await res.json() as { snippet?: string; payload?: unknown };
    const body = `${htmlToText(String(json.snippet || ''))}\n${collectBody(json.payload)}`;
    const original = forwardedHeaders(body);
    const kind = classifyForwarded(outerFrom, outerSubject, original, body);
    // [V/1d] What this mail looked like, kept only for the ones that could not be named.
    const report = bodySignalReport(body);
    const seenBody = {
      bodyChars: body.length,
      fromDomain: original.from ? original.from.split('@')[1] || original.from : '',
      head: body.replace(/\s+/g, ' ').trim().slice(0, 200),
      signals: `${report.chars}na-strip · structural=${report.structural} · `
        + (report.scores.length ? report.scores.map(([k, n]) => `${k}=${n}`).join(', ') : 'geen'),
      window: report.window.slice(0, 300),
    };
    if (!kind) {
      /*
       * [V/1g] Signals but no winner is a different answer from no signals at all, and the traveller —
       * or whoever is debugging — deserves to be told which.
       */
      const anySignal = report.structural > 0 || report.scores.length > 0;
      return {
        item: null,
        subject: seen,
        reason: anySignal ? 'kindAmbiguous' : 'bodyNoSignals',
        ...seenBody,
      };
    }
    /*
     * [V/1g] The item is built from the kind that was just worked out — it is *not* handed back to
     * itemFromMetadata.
     *
     * That was the bug behind three rounds of this: itemFromMetadata classifies from headers alone, so
     * feeding it a recovered sender whose domain is in no list and a subject that says only "Booking
     * Confirmation" made it return null, and the kind the body had already proven was thrown away. A hotel
     * that said "hotel" twelve times and counted its own nights was reported as having no signals.
     */
    const from = original.from || outerFrom;
    const headerDate = Date.parse(pick('date'));
    const stamp = Number(internalDate);
    const item: GmailInboxItem = {
      id,
      kind,
      /*
       * Shown as what it is: the airline or hotel that sent it, not the person who passed it on. [W/9] moved
       * the rule into lib/importDisplayName.ts so this path and itemFromMetadata cannot drift apart again —
       * that drift is what listed a forwarded hotel booking under the forwarder's own name.
       */
      sender: importDisplayName({ outerFrom, subject: outerSubject, recoveredFrom: original.from }),
      senderDomain: senderDomain(from),
      subject: stripForwardPrefix(outerSubject) || outerSubject,
      dateMs: Number.isFinite(stamp) && stamp > 0 ? stamp : (Number.isNaN(headerDate) ? 0 : headerDate),
      promo: promoSignals(labelIds, metaHeaders),
      /*
       * [W/16f] Kept, where before it was only kept for the mails that failed to classify. A kind decided by
       * the body is the one case the screen could not explain — "Netflix under Hotels" being the example.
       */
      bodySignals: seenBody.signals,
    };
    return { item, subject: seen, reason: 'noKind' };
  } catch {
    return { item: null, subject: seen, reason: 'bodyUnreadable' };
  }
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
  if (!token) return { items: [], partial: false, reason: 'not_connected', skipped: [] };
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
  if (outcome !== 'ok') return { items: [], partial: false, reason: outcome, skipped: [] };
  ids = mergeListPages(pages.map(p => p.ids), LIST_MAX);
  // Some of the searches did not come back, so what follows is part of the answer, not all of it.
  const listPartial = pages.some(p => p.failed || p.denied);

  const imported = new Set(await loadImportedIds());
  const fresh = ids.filter(id => !imported.has(id));
  const found: GmailInboxItem[] = [];
  /** [V/1c] Everything the scan put aside, and why — read on the import screen, never sent anywhere. */
  const skipped: ScanSkip[] = [];
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
          /*
           * [W/16] List-Unsubscribe joins the headers and labelIds is read off the response below. Both come
           * in this same request — no extra call — and both were being discarded, which is why a newsletter
           * from an airline looked exactly like a ticket.
           */
          + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date'
          + '&metadataHeaders=List-Unsubscribe';
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json() as {
            payload?: { headers?: { name?: string; value?: string }[] };
            internalDate?: string;
            labelIds?: string[];
          };
          const item = itemFromMetadata(id, json.payload?.headers, json.internalDate, json.labelIds);
          if (item) {
            found.push(item);
          } else {
            /*
             * [V/1] Travel-shaped but unclassified, from a sender we do not know: the shape of a forwarded
             * confirmation. One extra request for this mail alone, to read the original sender and subject
             * out of the forwarded body and ask the same classifier again. Mails that already classified —
             * almost all of them — never reach this branch, so a scan costs what it did before.
             */
            const outcome = await rescueForwarded(id, json.payload?.headers, json.internalDate, headers, json.labelIds);
            if (outcome.item) found.push(outcome.item);
            else skipped.push({ ...outcome, id, item: undefined } as ScanSkip);
          }
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

  if (failure && !found.length) return { items: [], partial: false, reason: failure, skipped };
  return { items: filterImported(found, imported), partial: partial || listPartial || !!failure, skipped };
}

/**
 * [W/19] The mails whose trip is over, with the date that was judged.
 *
 * Read on the import screen for one question only: should this row be ticked in advance? The mail itself is
 * still fetched, still listed and still one tap from being imported.
 */
export async function loadFlownMails(): Promise<FlownMail[]> {
  try {
    const raw = await AsyncStorage.getItem(FLOWN_MAILS_KEY);
    return parseFlownMails(raw ? JSON.parse(raw) : []);
  } catch {
    // Unreadable: every mail is simply offered the way it was before, which is the old behaviour.
    return [];
  }
}

export async function saveFlownMails(list: FlownMail[]): Promise<void> {
  try {
    const clean = parseFlownMails(list);
    if (!clean.length) return void await AsyncStorage.removeItem(FLOWN_MAILS_KEY);
    await AsyncStorage.setItem(FLOWN_MAILS_KEY, JSON.stringify(clean));
  } catch { /* the next scan ticks them as it used to; nothing else breaks */ }
}

/** Settings → "Clear import history": every mail is offered again on the next scan. */
export async function clearImportedIds(): Promise<void> {
  try {
    // [W/19] "Every mail again" has to mean every mail, labels and pre-selection included.
    await AsyncStorage.multiRemove([IMPORTED_IDS_KEY, FLOWN_MAILS_KEY]);
  } catch { /* nothing to forget */ }
}

/** Settings → "Disconnect Gmail": the dedupe list and the last-scan line go with the connection. */
export async function clearGmailScanState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([IMPORTED_IDS_KEY, SYNC_STATUS_KEY, FLOWN_MAILS_KEY]);
  } catch { /* nothing to forget */ }
}

/**
 * The low-confidence flights the discovery card should offer; replaces whatever was queued before.
 *
 * [W/19] One card per flight per day. Six cards came off one KLM booking — a ticket mail that arrived twice
 * naming both legs padded, plus a confirmation naming the same two legs plain — because whatever the parse
 * produced was stored as-is. Two legs on the same day are still two cards: the number is half of the key.
 */
export async function savePendingReview(candidates: ImportCandidate[]): Promise<void> {
  try {
    const list = dedupePendingReview((candidates || []).filter(c => c && c.flightNumber));
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
