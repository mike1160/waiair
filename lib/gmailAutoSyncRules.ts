/**
 * When the automatic Gmail sync may run, how far back it looks, and what the notification says.
 * Pure: no React Native imports, so the 24h rule and the Pro gate are unit-tested.
 */

import type { GmailInboxItem } from './gmailInboxScan';

/** Once a day at most. */
export const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** First run (no last-sync stamp) looks back as far as a manual scan. */
export const SYNC_FIRST_RUN_DAYS = 90;
export const SYNC_MAX_DAYS = 90;

export type SyncGate = {
  isPro: boolean;
  /** Gmail actually connected (a token exists). */
  connected: boolean;
  /** The Settings toggle; Pro users have it on by default. */
  autoSyncOn: boolean;
  /** Stamp of the last completed sync, null when it never ran. */
  lastSyncMs?: number | null;
  now: number;
};

/** Pro, connected, switched on, and a full day since the last sync. */
export function shouldRunGmailSync(gate: SyncGate): boolean {
  if (!gate.isPro || !gate.connected || !gate.autoSyncOn) return false;
  const last = typeof gate.lastSyncMs === 'number' && Number.isFinite(gate.lastSyncMs) ? gate.lastSyncMs : null;
  if (last == null) return true;
  if (last > gate.now) return true; // clock moved backwards: treat as due rather than never running again
  return gate.now - last >= SYNC_INTERVAL_MS;
}

/** Days to search: everything since the last sync, rounded up; 90 on the first run. */
export function syncScanDays(lastSyncMs: number | null | undefined, now: number): number {
  const last = typeof lastSyncMs === 'number' && Number.isFinite(lastSyncMs) ? lastSyncMs : null;
  if (last == null || last > now) return SYNC_FIRST_RUN_DAYS;
  const days = Math.ceil((now - last) / (24 * 60 * 60 * 1000));
  return Math.min(SYNC_MAX_DAYS, Math.max(1, days));
}

export type SyncNotificationCopy = {
  gmailSyncFoundTitle: string;
  gmailSyncFoundOne: (subject: string) => string;
  gmailSyncFoundMany: (n: number) => string;
};

/** The notification for a finished sync; null when nothing new was found (then nothing is shown). */
export function syncNotification(
  items: GmailInboxItem[],
  copy: SyncNotificationCopy,
): { title: string; body: string } | null {
  const found = (items || []).filter(Boolean);
  if (!found.length) return null;
  const first = found[0];
  const name = String(first.sender || first.subject || '').trim();
  return {
    title: copy.gmailSyncFoundTitle,
    body: found.length === 1 && name ? copy.gmailSyncFoundOne(name) : copy.gmailSyncFoundMany(found.length),
  };
}
