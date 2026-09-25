/**
 * The calendar file, on its way out of the app.
 *
 * lib/ical.ts writes the text; this puts it in a file and hands it to the share sheet, where the traveller
 * picks their own calendar, or Mail, or WhatsApp. Deliberately not expo-calendar: adding an event directly
 * needs calendar write permission and picks the calendar for them, and a .ics is what every other airline
 * app sends.
 */

import { Platform } from 'react-native';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { withTimeout } from './net.ts';
import { buildIcal, hasIcalEvents, icalFileName, type IcalFlight, type IcalOptions } from './ical.ts';

export type CalendarExportResult = 'shared' | 'unavailable' | 'nothing' | 'failed' | 'timeout';

/** Asking whether sharing exists, and writing a few kilobytes: both are instant or broken. */
const PREPARE_TIMEOUT_MS = 5000;
/**
 * The share sheet resolves when it closes, so this has to outlast a person reading it. It is a safety net
 * against a sheet that never reports back at all — which left the button spinning for good.
 */
const SHARE_TIMEOUT_MS = 90_000;

/**
 * Writes the flights to a .ics in the cache and opens the share sheet.
 *
 * 'nothing' when no flight had a departure time to put in a calendar, 'unavailable' when the platform has no
 * share sheet — both are worth telling the traveller about, and neither is an error.
 */
export async function shareFlightsAsCalendar(
  flights: IcalFlight[],
  opts: IcalOptions,
): Promise<CalendarExportResult> {
  if (Platform.OS === 'web') return 'unavailable';
  /*
   * Everything is inside the try, including building the file. hasIcalEvents() used to sit outside it, so a
   * booking the builder could not read threw straight out of here past the caller's error handling.
   */
  try {
    if (!hasIcalEvents(flights, opts)) return 'nothing';
    if (!(await withTimeout(Sharing.isAvailableAsync(), PREPARE_TIMEOUT_MS))) return 'unavailable';
    const dir = cacheDirectory;
    if (!dir) return 'unavailable';
    const uri = `${dir}${icalFileName(flights)}`;
    await withTimeout(writeAsStringAsync(uri, buildIcal(flights, opts)), PREPARE_TIMEOUT_MS);
    try {
      await withTimeout(Sharing.shareAsync(uri, {
        mimeType: 'text/calendar',
        UTI: 'com.apple.ical.ics',
        dialogTitle: opts.labels.bookedVia,
      }), SHARE_TIMEOUT_MS);
    } catch (e) {
      /*
       * The sheet was opened and the file exists; what we have lost is the answer to what the traveller did
       * with it. Saying it worked would be a guess and saying it failed would be wrong, so the caller is
       * told to stop waiting and say nothing.
       */
      console.warn('[calendarExport] the share sheet never came back', e);
      return 'timeout';
    }
    return 'shared';
  } catch (e) {
    console.warn('[calendarExport] failed', e);
    return 'failed';
  }
}
