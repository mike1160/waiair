import { airportRecByIata } from './airportsDb';
import type { TripExtras } from './tripExtras';

export type ImportCandidate = {
  id: string;
  flightNumber: string;
  dateIso?: string;
  origin?: string;
  destination?: string;
  label: string;
};

const FLIGHT_RE = /\b[A-Z]{2}\d{3,4}\b/gi;
const SKIP_PREFIX = new Set(['AM', 'PM']);
const MONTHS: Record<string, number> = {
  JAN: 0, JANUARY: 0,
  FEB: 1, FEBRUARY: 1,
  MAR: 2, MARCH: 2,
  APR: 3, APRIL: 3,
  MAY: 4,
  JUN: 5, JUNE: 5,
  JUL: 6, JULY: 6,
  AUG: 7, AUGUST: 7,
  SEP: 8, SEPT: 8, SEPTEMBER: 8,
  OCT: 9, OCTOBER: 9,
  NOV: 10, NOVEMBER: 10,
  DEC: 11, DECEMBER: 11,
};

type Hit<T> = { index: number; value: T };

function toIso(year: number, month: number, day: number): string | undefined {
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined;
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) return undefined;
  return d.toISOString().slice(0, 10);
}

function yearFromToken(raw: string): number {
  const n = Number(raw);
  if (raw.length === 2) return n >= 70 ? 1900 + n : 2000 + n;
  return n;
}

function nearest<T>(index: number, hits: Hit<T>[]): T | undefined {
  if (!hits.length) return undefined;
  let best = hits[0];
  let bestDist = Math.abs(hits[0].index - index);
  for (let i = 1; i < hits.length; i++) {
    const dist = Math.abs(hits[i].index - index);
    if (dist < bestDist) {
      best = hits[i];
      bestDist = dist;
    }
  }
  return best.value;
}

export function extractFlightNumbers(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const src = String(text || '');
  for (const m of src.matchAll(FLIGHT_RE)) {
    const number = String(m[0] || '').toUpperCase();
    const prefix = number.slice(0, 2);
    const digits = number.slice(2);
    if (SKIP_PREFIX.has(prefix) && /^20\d{2}$/.test(digits)) continue;
    if (seen.has(number)) continue;
    seen.add(number);
    out.push(number);
  }
  return out;
}

function findFlightHits(text: string): Hit<string>[] {
  const hits: Hit<string>[] = [];
  for (const m of String(text || '').matchAll(FLIGHT_RE)) {
    const number = String(m[0] || '').toUpperCase();
    const prefix = number.slice(0, 2);
    const digits = number.slice(2);
    if (SKIP_PREFIX.has(prefix) && /^20\d{2}$/.test(digits)) continue;
    hits.push({ index: m.index ?? 0, value: number });
  }
  return hits;
}

function findRouteHits(text: string): Hit<{ origin: string; destination: string }>[] {
  const hits: Hit<{ origin: string; destination: string }>[] = [];
  const re = /\b([A-Z]{3})\s*(?:[-–—]|→|to)\s*([A-Z]{3})\b/gi;
  for (const m of String(text || '').matchAll(re)) {
    const origin = String(m[1] || '').toUpperCase();
    const destination = String(m[2] || '').toUpperCase();
    if (!airportRecByIata(origin) || !airportRecByIata(destination)) continue;
    if (origin === destination) continue;
    hits.push({ index: m.index ?? 0, value: { origin, destination } });
  }
  return hits;
}

function findDateHits(text: string): Hit<string>[] {
  const hits: Hit<string>[] = [];
  const src = String(text || '');

  for (const m of src.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    const iso = toIso(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (iso) hits.push({ index: m.index ?? 0, value: iso });
  }

  const monthNames = Object.keys(MONTHS).join('|');
  const dmy = new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\.?\\s+(20\\d{2}|\\d{2})\\b`, 'gi');
  for (const m of src.matchAll(dmy)) {
    const month = MONTHS[String(m[2] || '').toUpperCase()];
    if (month == null) continue;
    const iso = toIso(yearFromToken(m[3]), month, Number(m[1]));
    if (iso) hits.push({ index: m.index ?? 0, value: iso });
  }

  const mdy = new RegExp(`\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2}|\\d{2})\\b`, 'gi');
  for (const m of src.matchAll(mdy)) {
    const month = MONTHS[String(m[1] || '').toUpperCase()];
    if (month == null) continue;
    const iso = toIso(yearFromToken(m[3]), month, Number(m[2]));
    if (iso) hits.push({ index: m.index ?? 0, value: iso });
  }

  for (const m of src.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2}|\d{2})\b/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = yearFromToken(m[3]);
    const dmyIso = a > 12 ? toIso(year, b - 1, a) : toIso(year, b - 1, a);
    const mdyIso = b > 12 ? toIso(year, a - 1, b) : undefined;
    const iso = mdyIso || dmyIso;
    if (iso) hits.push({ index: m.index ?? 0, value: iso });
  }

  return hits;
}

function candidateLabel(c: Omit<ImportCandidate, 'id' | 'label'>): string {
  const bits = [c.flightNumber];
  if (c.origin && c.destination) bits.push(`${c.origin} → ${c.destination}`);
  if (c.dateIso) bits.push(c.dateIso);
  return bits.join(' · ');
}

export function parseImportText(text: string, fallbackDateIso?: string): ImportCandidate[] {
  const flights = findFlightHits(text);
  const routes = findRouteHits(text);
  const dates = findDateHits(text);
  const seen = new Set<string>();
  const out: ImportCandidate[] = [];

  for (const hit of flights) {
    const route = nearest(hit.index, routes);
    const dateIso = nearest(hit.index, dates) || fallbackDateIso;
    const key = `${hit.value}|${dateIso || ''}|${route?.origin || ''}|${route?.destination || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const draft = {
      flightNumber: hit.value,
      dateIso,
      origin: route?.origin,
      destination: route?.destination,
    };
    out.push({
      ...draft,
      id: key,
      label: candidateLabel(draft),
    });
  }
  return out;
}

export function parseCalendarEvent(input: {
  title?: string | null;
  notes?: string | null;
  location?: string | null;
  startDate?: Date | string | null;
}): ImportCandidate[] {
  const title = String(input.title || '');
  const notes = String(input.notes || '');
  const location = String(input.location || '');
  const blob = [title, notes, location].filter(Boolean).join('\n');
  const start = input.startDate instanceof Date
    ? input.startDate
    : input.startDate
      ? new Date(input.startDate)
      : null;
  const fallback = start && !Number.isNaN(start.getTime())
    ? start.toISOString().slice(0, 10)
    : undefined;
  const parsed = parseImportText(blob, fallback);
  return parsed.map((c, i) => ({
    ...c,
    id: `${c.id}|${title}|${i}`,
    label: title && !c.origin
      ? `${c.flightNumber}${c.dateIso ? ` · ${c.dateIso}` : ''} · ${title}`
      : c.label,
  }));
}

function firstMatch(src: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = src.match(re);
    const v = String(m?.[1] || '').replace(/\s+/g, ' ').trim();
    if (v && v.length > 1 && v.length < 220) return v.replace(/[.,;]+$/, '');
  }
  return undefined;
}

function detectBrand(src: string, brands: { re: RegExp; name: string }[]): string | undefined {
  const lower = src.toLowerCase();
  for (const b of brands) {
    if (b.re.test(lower)) return b.name;
  }
  return undefined;
}

function toIsoDate(raw?: string): string | undefined {
  const s = String(raw || '').trim();
  if (!s) return undefined;
  const iso = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const hits = findDateHits(s);
  return hits[0]?.value;
}

function toIsoDateTime(raw?: string): string | undefined {
  const s = String(raw || '').trim();
  if (!s) return undefined;
  const full = s.match(/\b(20\d{2}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})\b/);
  if (full) {
    const hh = full[2].padStart(2, '0');
    return `${full[1]}T${hh}:${full[3]}:00`;
  }
  const date = toIsoDate(s);
  const time = s.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (date && time) {
    let h = Number(time[1]);
    const mer = String(time[3] || '').toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return `${date}T${String(h).padStart(2, '0')}:${time[2]}:00`;
  }
  return date;
}

/**
 * Parse a pasted hotel / car-rental / transfer confirmation.
 * Fills what is found and leaves the rest undefined.
 */
export function parseTripExtras(text: string): Partial<TripExtras> {
  const src = String(text || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ');
  if (!src.trim()) return {};

  const hotelName = firstMatch(src, [
    /(?:hotel(?:\s+name)?|property(?:\s+name)?|accommodation)\s*[:\-]\s*(.+)/i,
    /you(?:'re| are) staying at\s+(.+)/i,
    /welcome to\s+(.+)/i,
  ]);
  const hotelAddress = firstMatch(src, [
    /(?:address|street(?:\s+address)?|property address)\s*[:\-]\s*(.+)/i,
    /\b(\d{1,5}\s+[A-Z][A-Za-z0-9 .'#\-]+,\s*[A-Za-z .'-]+,?\s*\d{4,6}[A-Z]{0,3})\b/,
  ]);
  const checkIn = toIsoDate(firstMatch(src, [
    /(?:check[\s-]?in(?:\s+date)?|arrival(?:\s+date)?)\s*[:\-]\s*(.+)/i,
  ]));
  const checkOut = toIsoDate(firstMatch(src, [
    /(?:check[\s-]?out(?:\s+date)?|departure(?:\s+date)?)\s*[:\-]\s*(.+)/i,
  ]));
  const hotelRef = firstMatch(src, [
    /(?:booking\s+(?:reference|number|id)|confirmation(?:\s+(?:number|code|id|ref))?|reservation\s+(?:number|id)|pin(?:\s+code)?)\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
  ]);
  const hotelBrand = detectBrand(src, [
    { re: /booking\.com/, name: 'Booking.com' },
    { re: /agoda/, name: 'Agoda' },
    { re: /airbnb/, name: 'Airbnb' },
    { re: /hotels\.com/, name: 'Hotels.com' },
    { re: /expedia/, name: 'Expedia' },
  ]);

  const carCompany = firstMatch(src, [
    /(?:rental(?:\s+car)?\s+company|supplier|car hire)\s*[:\-]\s*(.+)/i,
  ]) || detectBrand(src, [
    { re: /qeeq/, name: 'QEEQ' },
    { re: /rentalcars/, name: 'Rentalcars' },
    { re: /hertz/, name: 'Hertz' },
    { re: /\bavis\b/, name: 'Avis' },
    { re: /budget/, name: 'Budget' },
    { re: /\bsixt\b/, name: 'Sixt' },
    { re: /enterprise/, name: 'Enterprise' },
  ]);
  const carPickup = firstMatch(src, [
    /(?:pickup location|pick-up location|collection point|collect from)\s*[:\-]\s*(.+)/i,
  ]);
  const carDrop = firstMatch(src, [
    /(?:return location|drop[\s-]?off(?: location)?|drop off)\s*[:\-]\s*(.+)/i,
  ]);
  const carPickupTime = toIsoDateTime(firstMatch(src, [
    /(?:pickup date\/time|pick-up date(?:\/time)?|pickup(?:\s+date(?:\/time)?)?)\s*[:\-]\s*(.+)/i,
  ]));
  const carDropTime = toIsoDateTime(firstMatch(src, [
    /(?:return date\/time|drop[\s-]?off date(?:\/time)?|return(?:\s+date)?)\s*[:\-]\s*(.+)/i,
  ]));
  const carRef = firstMatch(src, [
    /(?:reservation number|booking ref(?:erence)?|rental(?:\s+agreement)?(?:\s+number)?)\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
  ]);

  const driver = firstMatch(src, [
    /(?:your driver|driver(?:'s)? name|driver)\s*[:\-]\s*(.+)/i,
  ]);
  const vehicle = firstMatch(src, [
    /(?:vehicle(?: description)?|car type|car model)\s*[:\-]\s*(.+)/i,
  ]);
  const meetTime = toIsoDateTime(firstMatch(src, [
    /(?:pickup time|meeting time|meet(?:ing)? at|pick-up time)\s*[:\-]\s*(.+)/i,
  ]));
  const meetPoint = firstMatch(src, [
    /(?:pickup point|meeting point|meet(?:ing)? point|pick-up point)\s*[:\-]\s*(.+)/i,
  ]);
  const dropPoint = firstMatch(src, [
    /(?:drop[\s-]?off(?: point| location)?|destination)\s*[:\-]\s*(.+)/i,
  ]);
  const phone = firstMatch(src, [
    /(?:driver(?:'s)? phone|contact(?: number)?|phone(?: number)?|mobile)\s*[:\-]\s*([+\d][\d \-()]{6,})/i,
  ]);
  const transferRef = firstMatch(src, [
    /(?:transfer(?: booking)?(?:\s+(?:ref|reference|number))?|order(?:\s+number)?)\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
  ]);
  const transferBrand = detectBrand(src, [
    { re: /kiwitaxi/, name: 'Kiwitaxi' },
    { re: /welcome\s*pickups/, name: 'Welcome Pickups' },
    { re: /gettransfer/, name: 'GetTransfer' },
    { re: /blacklane/, name: 'Blacklane' },
  ]);

  const looksHotel = !!(hotelName || hotelAddress || hotelBrand || (checkIn && (hotelRef || hotelAddress)));
  const looksCar = !!(carCompany || carPickup || carRef);
  const looksTransfer = !!(driver || vehicle || transferBrand || (meetPoint && meetTime));

  const out: Partial<TripExtras> = {};
  if (looksHotel) {
    out.hotel = {
      name: hotelName || hotelBrand,
      address: hotelAddress,
      checkIn,
      checkOut,
      confirmationRef: hotelRef,
      source: 'parsed',
    };
  }
  if (looksCar) {
    out.carRental = {
      company: carCompany,
      pickupLocation: carPickup,
      dropoffLocation: carDrop,
      pickupTime: carPickupTime,
      dropoffTime: carDropTime,
      confirmationRef: carRef,
      source: 'parsed',
    };
  }
  if (looksTransfer) {
    out.transfer = {
      provider: transferBrand,
      pickupLocation: meetPoint,
      dropoffLocation: dropPoint,
      pickupTime: meetTime,
      confirmationRef: transferRef,
      driverName: driver,
      driverPhone: phone,
      vehicleDescription: vehicle,
      source: 'parsed',
    };
  }
  return out;
}

