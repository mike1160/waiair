/**
 * What actually happened during an import, on the screen the traveller is looking at [W/14].
 *
 * A fresh Play install found 34 travel mails, the import was tapped, and nothing came back. Three separate
 * reasons why that could be silent, and no way to tell them apart from the outside:
 *
 *   The tally loop in applyGmailImports counted only 'added' and 'limit'. A 'failed' or 'invalid' from
 *   addTrackByNumber was counted nowhere at all — outcome.failed comes from plan.unparsedIds, not from there —
 *   so a refused flight left no trace in the result at all.
 *
 *   Every error inside addTrackByNumber is reported with showToast, and a toast behind a full-screen modal is
 *   invisible. The code already knew this: "the toast and the paywall that used to carry this news never
 *   reached the traveller: the import simply looked like it did nothing."
 *
 *   applyGmailImports returns null when it has nothing queued, and the success screen renders a spinner while
 *   the outcome is null — so a null answer is an ActivityIndicator that never resolves.
 *
 * This is a diagnostic, not a fix. Nothing here changes what the import does; it records what it did and
 * hands it to the screen, so the next attempt says which of the three it was instead of being guessed at.
 *
 * Pure, and unit-tested in lib/importDiagnostics.test.ts.
 */

import type { NotifyPermissionSnapshot } from './notifyPermissionState.ts';

/** How long the screen waits for an outcome before it stops trusting that one is coming. */
export const IMPORT_DIAGNOSTIC_TIMEOUT_MS = 20000;

/** How many error lines are kept. Enough to see a pattern, short enough to stay on one card. */
export const MAX_DIAGNOSTIC_ERRORS = 5;

export type ImportDiagnostics = {
  /** Flights the import actually tracked. */
  added: number;
  /** Refused for want of a free flight or a credit. */
  limitReached: number;
  /** addTrackByNumber said 'failed' — counted nowhere before this. */
  failed: number;
  /** addTrackByNumber said 'invalid' — likewise. */
  invalid: number;
  /** Already tracked, so nothing to do. */
  alreadyTracked: number;
  /** What the app believed about Pro at the moment the import ran. */
  isPro: boolean;
  /** Whether the notification permission question had been answered. */
  notify: NotifyPermissionSnapshot;
  /** Was the queue written before the import started? A silent failure here means nothing to import. */
  queueSaved: boolean;
  /** Short, technical, no mail contents. */
  errors: string[];
  /**
   * [W/19] Why the bodies that never arrived never arrived — ids and a status, nothing from the mails.
   * Already rendered lines (lib/bodyFetchLog.ts bodyFetchLines), because the shape of those is that
   * module's business, and capped there at five.
   */
  bodyNotes: string[];
};

export function emptyDiagnostics(): ImportDiagnostics {
  return {
    added: 0,
    limitReached: 0,
    failed: 0,
    invalid: 0,
    alreadyTracked: 0,
    isPro: false,
    notify: { phase: 'unknown', waitedMs: 0 },
    queueSaved: false,
    errors: [],
    bodyNotes: [],
  };
}

/**
 * Add an error, trimmed and capped.
 *
 * Deliberately not the mail, the subject or the sender: a reason and at most a flight number. This goes on
 * screen, and a screenshot of it may well end up in a message to somebody.
 */
export function withDiagnosticError(
  d: ImportDiagnostics,
  where: string,
  message: unknown,
): ImportDiagnostics {
  /*
   * Only a string or a number is a message. Anything else stringifies to "[object Object]", which is noise
   * on a screen whose whole job is to be read out to somebody.
   */
  const raw = (message as { message?: unknown } | null)?.message ?? message;
  const text = (typeof raw === 'string' || typeof raw === 'number')
    ? String(raw).replace(/\s+/g, ' ').trim().slice(0, 120)
    : '';
  const line = `${where}: ${text || 'unknown'}`;
  if (d.errors.length >= MAX_DIAGNOSTIC_ERRORS) return d;
  return { ...d, errors: [...d.errors, line] };
}

/** Has an import that started at `startedAt` waited long enough that no outcome is coming? */
export function importTimedOut(startedAt: number, now: number, limitMs = IMPORT_DIAGNOSTIC_TIMEOUT_MS): boolean {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now - startedAt >= limitMs;
}

/**
 * The lines the screen shows. Technical on purpose and therefore untranslated, exactly like the sign-in
 * status code beside it: these are for reading out to whoever is fixing it, not for reassurance.
 */
export function diagnosticsLines(d: ImportDiagnostics | null | undefined): string[] {
  if (!d) return [];
  const counts = `added ${d.added} · limit ${d.limitReached} · failed ${d.failed} · invalid ${d.invalid}`
    + (d.alreadyTracked ? ` · already ${d.alreadyTracked}` : '');
  const state = `isPro ${d.isPro} · notify ${d.notify.phase}`
    + (d.notify.waitedMs ? ` ${d.notify.waitedMs}ms` : '')
    + ` · queue ${d.queueSaved ? 'saved' : 'NOT saved'}`;
  // [W/19] The body reasons last: the counts are what is read first, and these explain one of them.
  return [counts, state, ...d.errors, ...(d.bodyNotes || [])];
}
