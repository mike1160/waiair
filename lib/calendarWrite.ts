/**
 * A flight written straight into the traveller's own calendar.
 *
 * The .ics in lib/calendarExport.ts goes through the share sheet, which is the right way to hand the file to
 * Mail, WhatsApp or Files — but not to the Calendar app. Calendar registers no share extension for .ics on
 * iOS, so it never appeared among the targets and "add to calendar" could not actually add anything to a
 * calendar. This writes the event with the calendar permission the app already declares.
 *
 * Both routes take the same IcalFlight and the same description, so the entry reads the same whichever way
 * it got there.
 */

import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import { withTimeout } from './net.ts';
import {
  ALARM_MINUTES,
  arrivalUtcMs,
  departureUtcMs,
  icalDescription,
  icalLocation,
  icalSummary,
  type IcalFlight,
  type IcalOptions,
} from './ical.ts';

export type CalendarWriteResult = 'added' | 'denied' | 'no_calendar' | 'nothing' | 'unavailable' | 'failed';

/** Asking the OS for permission and a calendar: both answer at once or something is wrong. */
const CALENDAR_TIMEOUT_MS = 10_000;
/** A flight with no arrival still gets a block of time, so the calendar has something to draw. */
const ASSUMED_HOURS = 2;

async function ensurePermission(): Promise<boolean> {
  try {
    const current = await withTimeout(Calendar.getCalendarPermissions(), CALENDAR_TIMEOUT_MS);
    if (current.granted) return true;
    const next = await withTimeout(Calendar.requestCalendarPermissions(), CALENDAR_TIMEOUT_MS);
    return next.granted;
  } catch {
    return false;
  }
}

/** The calendar to write to: the default one on iOS, else the first that allows changes. */
async function writableCalendar(): Promise<Calendar.ExpoCalendar | null> {
  try {
    if (Platform.OS === 'ios') {
      try {
        return Calendar.getDefaultCalendarSync();
      } catch { /* fall through to the list */ }
    }
    const calendars = await withTimeout(Calendar.getCalendars(Calendar.EntityTypes.EVENT), CALENDAR_TIMEOUT_MS);
    return calendars.find(c => c.allowsModifications && c.isPrimary)
      ?? calendars.find(c => c.allowsModifications)
      ?? null;
  } catch {
    return null;
  }
}

/**
 * Writes one event per flight and says what happened. Never throws: the button that calls this has a
 * spinner, and an exception on the way out is how that spinner used to be left running.
 */
export async function addFlightsToCalendar(
  flights: IcalFlight[],
  opts: IcalOptions,
): Promise<{ result: CalendarWriteResult; added: number }> {
  if (Platform.OS === 'web') return { result: 'unavailable', added: 0 };
  const usable = (flights || []).filter(f => f && String(f.flightNumber || '').trim() && departureUtcMs(f) != null);
  if (!usable.length) return { result: 'nothing', added: 0 };

  try {
    if (!(await ensurePermission())) return { result: 'denied', added: 0 };
    const cal = await writableCalendar();
    if (!cal) return { result: 'no_calendar', added: 0 };

    let added = 0;
    for (const f of usable) {
      const startMs = departureUtcMs(f);
      if (startMs == null) continue;
      const endMs = arrivalUtcMs(f);
      const start = new Date(startMs);
      // An arrival that is missing or before the departure is not written as an end date.
      const end = endMs != null && endMs > startMs
        ? new Date(endMs)
        : new Date(startMs + ASSUMED_HOURS * 3600_000);
      await withTimeout(cal.createEvent({
        title: icalSummary(f),
        startDate: start,
        endDate: end,
        location: icalLocation(f) || undefined,
        notes: icalDescription(f, opts),
        alarms: ALARM_MINUTES.map(minutes => ({ relativeOffset: -minutes })),
        timeZone: 'UTC',
      }), CALENDAR_TIMEOUT_MS);
      added += 1;
    }
    // Nothing written despite having something to write is a failure, not a success with a zero.
    if (!added) return { result: 'failed', added: 0 };
    return { result: 'added', added };
  } catch (e) {
    console.warn('[calendarWrite] failed', e);
    return { result: 'failed', added: 0 };
  }
}

