/**
 * What a pasted clipboard holds, for whoever offers the paste.
 *
 * The booking stub on the home screen worked this out inside its own animation, which was fine while it was
 * the only way to paste. The home screen now offers the same thing as a plain button, and two buttons that
 * disagree about what a paste means would be worse than either — so the reading lives here and the screen
 * only decides how it looks.
 */

import { clipboardImportHit, type ClipboardImportHit } from './clipboardTrackable.ts';
import { parseImportText, type ImportCandidate } from './flightImport.ts';
import { ancillaryFirst } from './ancillaryDetect.ts';

export type ClipboardImport =
  /** A flight the app can track, or enough of one to ask about. */
  | { kind: 'flight'; hit: ClipboardImportHit<ImportCandidate> }
  /** Baggage, a seat, a meal: it names a flight but is not one. */
  | { kind: 'ancillary'; text: string }
  /** Nothing the app can use. */
  | { kind: 'none' };

export function readClipboardImport(raw: string | null | undefined): ClipboardImport {
  const text = String(raw || '');
  if (!text.trim()) return { kind: 'none' };
  /*
   * An extra names the flight it belongs to, so the flight number must not be read first: "extra baggage for
   * TG208" would become a search for TG208 and the baggage would never be mentioned.
   */
  if (ancillaryFirst(text)) return { kind: 'ancillary', text };
  const hit = clipboardImportHit<ImportCandidate>(parseImportText(text), text);
  return hit.kind === 'none' ? { kind: 'none' } : { kind: 'flight', hit };
}
