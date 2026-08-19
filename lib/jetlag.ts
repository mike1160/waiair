import { getTimezoneOffset } from 'date-fns-tz';
import { timezoneForIata } from './airportTz';

function tzOffsetMinutes(timeZone: string, date = new Date()): number {
  return Math.round(getTimezoneOffset(timeZone, date) / 60000);
}

function formatUtcLabel(timeZone: string, date = new Date()): string {
  const mins = tzOffsetMinutes(timeZone, date);
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const offset = m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, '0')}`;
  return `${timeZone.replace(/_/g, ' ')} (${offset})`;
}

export type JetlagInfo = {
  diffHours: number;
  eastbound: boolean;
  originLabel: string;
  destLabel: string;
};

export function getJetlagInfo(
  originIata?: string,
  destIata?: string,
  originCountry?: string,
  destCountry?: string,
): JetlagInfo | null {
  const originTz = timezoneForIata(originIata, originCountry);
  const destTz = timezoneForIata(destIata, destCountry);
  const originOff = tzOffsetMinutes(originTz);
  const destOff = tzOffsetMinutes(destTz);
  const diffMinutes = destOff - originOff;
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 3) return null;
  return {
    diffHours,
    eastbound: diffHours > 0,
    originLabel: formatUtcLabel(originTz),
    destLabel: formatUtcLabel(destTz),
  };
}
