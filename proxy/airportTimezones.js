/**
 * Airport timezones for AeroDataBox FIDS windows (ADB expects airport-local times). The airports database loaded at
 * startup (OurAirports) has no timezone column, so each airport's IANA zone comes from its coordinates through a
 * timezone-boundary lookup, cached per airport. This replaced a hardcoded 31-airport table: airports missing from it got
 * the server's UTC clock, so e.g. TPE's live board lay 8 hours in the past and the app filtered every flight away.
 */
const tzlookup = require('@photostructure/tz-lookup');

const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
const MAX_WARNED_CODES = 500;

function isIanaZone(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** IANA zone at a coordinate; null when the lookup fails or returns a zone Intl does not know. */
function timeZoneAt(lat, lon, lookup = tzlookup) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    const tz = lookup(lat, lon);
    return isIanaZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

/** Whole-hour zone from the longitude, for a coordinate the boundary lookup cannot place (Etc/GMT signs are inverted). */
function longitudeZone(lon) {
  if (!Number.isFinite(lon)) return null;
  const hours = Math.max(-12, Math.min(14, Math.round(lon / 15)));
  return hours === 0 ? 'Etc/GMT' : `Etc/GMT${hours > 0 ? '-' : '+'}${Math.abs(hours)}`;
}

/** Date → 'YYYY-MM-DD HH:MM' in the zone. */
function formatAirportLocal(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function shiftDateKey(dayKey, days) {
  const m = String(dayKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dayKey;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(days || 0)));
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/**
 * @param {{ airportsByIata: Map<string, { lat: number, lon: number }>, lookup?: (lat: number, lon: number) => string,
 *   log?: Console }} opts `airportsByIata` is the live map loadAirports() fills at startup
 */
function createAirportTimezones({ airportsByIata, lookup = tzlookup, log = console }) {
  /** IATA → zone, only for airports found in the database (the map is still empty before loadAirports finishes). */
  const zones = new Map();
  const warned = new Set();

  /** Zone of an airport in the database; `hint` (a zone from the app or AeroDataBox) only for airports not in it. */
  function timeZoneFor(iata, hint) {
    const code = String(iata || '').trim().toUpperCase();
    if (zones.has(code)) return zones.get(code);
    const airport = airportsByIata.get(code);
    if (airport) {
      const lat = Number(airport.lat);
      const lon = Number(airport.lon);
      const tz = timeZoneAt(lat, lon, lookup) || longitudeZone(lon);
      if (tz) {
        zones.set(code, tz);
        return tz;
      }
    }
    return isIanaZone(hint) ? hint : null;
  }

  function zoneOrUtc(iata) {
    const tz = timeZoneFor(iata);
    if (tz) return tz;
    const code = String(iata || '').trim().toUpperCase();
    if (!warned.has(code) && warned.size < MAX_WARNED_CODES) {
      warned.add(code);
      log.warn('[tz] airport not in the airports database, using UTC:', code || '(empty)');
    }
    return 'UTC';
  }

  /**
   * AeroDataBox window in airport-local time. `offsetDays` ≠ 0: that whole local day. Today (the live board): now −6 h …
   * now +6 h, not before local midnight.
   */
  function localWindow(iata, offsetDays = 0, now = Date.now()) {
    const zone = zoneOrUtc(iata);
    const today = formatAirportLocal(new Date(now), zone).slice(0, 10);
    const date = shiftDateKey(today, offsetDays);
    if (offsetDays) {
      return { from: `${date}%2000:00`, to: `${date}%2023:59`, tz: zone, date };
    }
    const toLocal = formatAirportLocal(new Date(now + LIVE_WINDOW_MS), zone);
    const fromMidnight = `${today} 00:00`;
    const from6h = formatAirportLocal(new Date(now - LIVE_WINDOW_MS), zone);
    const from = fromMidnight > from6h ? fromMidnight : from6h;
    return { from: from.replace(' ', '%20'), to: toLocal.replace(' ', '%20'), tz: zone, date: today };
  }

  /** Airport-local calendar day: database zone, then `hint`, then UTC. */
  function today(iata, hint, now = Date.now()) {
    return formatAirportLocal(new Date(now), timeZoneFor(iata, hint) || 'UTC').slice(0, 10);
  }

  return { timeZoneFor, localWindow, today };
}

module.exports = {
  isIanaZone,
  timeZoneAt,
  longitudeZone,
  formatAirportLocal,
  shiftDateKey,
  createAirportTimezones,
};
