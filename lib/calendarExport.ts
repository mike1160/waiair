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
import { buildIcal, hasIcalEvents, icalFileName, type IcalFlight, type IcalOptions } from './ical.ts';

export type CalendarExportResult = 'shared' | 'unavailable' | 'nothing' | 'failed';

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
  if (!hasIcalEvents(flights, opts)) return 'nothing';
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    const dir = cacheDirectory;
    if (!dir) return 'unavailable';
    const uri = `${dir}${icalFileName(flights)}`;
    await writeAsStringAsync(uri, buildIcal(flights, opts));
    await Sharing.shareAsync(uri, {
      mimeType: 'text/calendar',
      UTI: 'com.apple.ical.ics',
      dialogTitle: opts.labels.bookedVia,
    });
    return 'shared';
  } catch (e) {
    console.warn('[calendarExport] failed', e);
    return 'failed';
  }
}
