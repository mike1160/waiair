/**
 * What the Settings "Travel emails" section shows: when the inbox was last looked at, what that found, and
 * one line per booking still waiting for a trip.
 *
 * Counts and parsed fields only — never a subject, a sender or any part of a mail body. Pure (no React Native,
 * no storage), so the formatting is unit-tested; lib/gmailSyncStatusStore.ts does the reading and writing.
 */
import type { TripExtras } from './tripExtras.ts';

export type GmailSyncStatus = {
  /** When the scan ran. */
  ms: number;
  /** How many travel mails it found — a number, never what they said. */
  found: number;
};

export function isSyncStatus(v: unknown): v is GmailSyncStatus {
  const o = v as GmailSyncStatus;
  return !!o && Number.isFinite(Number(o.ms)) && Number(o.ms) > 0 && Number.isFinite(Number(o.found));
}

const DATE_TAGS: Record<string, string> = {
  en: 'en-GB', nl: 'nl-NL', de: 'de-DE', es: 'es-ES', id: 'id-ID', ja: 'ja-JP',
  ko: 'ko-KR', ru: 'ru-RU', th: 'th-TH', vi: 'vi-VN', zh: 'zh-CN',
};

/** "19 Sep 09:14" in the app's language. */
export function formatSyncMoment(ms: number, locale?: string): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const tag = DATE_TAGS[String(locale || '')] || 'en-GB';
  try {
    return new Intl.DateTimeFormat(tag, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(ms)).replace(/,/g, '');
  } catch {
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** A waiting booking as the list shows it: what it is, and the day it starts. */
export type WaitingBooking = {
  messageId: string;
  kind: 'hotel' | 'carRental' | 'transfer';
  /** The hotel or company name; empty when the mail never said one. */
  title: string;
  /** yyyy-MM-dd of the check-in or pick-up, or '' when the mail had no date. */
  startYmd: string;
  savedMs: number;
};

function ymdOf(raw?: string): string {
  return String(raw || '').match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '';
}

/**
 * One line per queued booking, newest first. A booking whose mail gave neither a name nor a date is dropped:
 * there is nothing to show the user and nothing they could sensibly attach.
 */
export function describeWaiting(
  queue: { messageId: string; extras: Partial<TripExtras>; savedMs: number }[],
): WaitingBooking[] {
  const out: WaitingBooking[] = [];
  for (const item of queue || []) {
    if (!item?.messageId) continue;
    const e = item.extras || {};
    const one = e.hotel
      ? { kind: 'hotel' as const, title: e.hotel.name || '', startYmd: ymdOf(e.hotel.checkIn) }
      : e.carRental
        ? { kind: 'carRental' as const, title: e.carRental.company || '', startYmd: ymdOf(e.carRental.pickupTime) }
        : e.transfer
          ? { kind: 'transfer' as const, title: e.transfer.provider || '', startYmd: ymdOf(e.transfer.pickupTime) }
          : null;
    if (!one || (!one.title && !one.startYmd)) continue;
    out.push({ messageId: item.messageId, savedMs: Number(item.savedMs) || 0, ...one });
  }
  return out.sort((a, b) => b.savedMs - a.savedMs);
}
