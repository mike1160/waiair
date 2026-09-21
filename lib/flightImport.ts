import { airportRecByIata } from './airportsDb.ts';
import { FLIGHT_BRANDS, FLIGHT_DOMAINS, TRAVEL_DOMAINS, brandLabel, senderDomain } from './gmailInboxScan.ts';
import type { TripExtras, TripRestaurant } from './tripExtrasModel.ts';

export type ImportCandidate = {
  id: string;
  flightNumber: string;
  dateIso?: string;
  origin?: string;
  destination?: string;
  label: string;
  /** Gmail integration: set when the candidate came from a Gmail scan ("Geïmporteerd uit Gmail"). */
  source?: 'gmail';
  /**
   * How sure we are this is a real flight the user is taking, 0–100 (see scoreCandidate). 85 and up is
   * trusted enough to track without asking; below that the candidate is offered for review.
   */
  confidence: number;
};

/** Where a candidate came from, which is most of what decides its confidence. */
export type ParseContext = {
  /** The raw `From:` header, so a known airline or OTA can lift the score. */
  from?: string;
  /** 'gmail' when this came out of a real mail rather than a paste or a calendar entry. */
  source?: 'gmail';
  /** The mail carried schema.org JSON-LD: authoritative, so it starts high (see parseJsonLdFlight). */
  jsonLd?: boolean;
  /** How many characters of `text` are the subject line: a number found only there is weaker evidence. */
  subjectChars?: number;
  /** Today, for "is this date in the future"; defaults to the clock. */
  now?: number;
};

/** A flight number in an airline's own shape: two or three letters, then up to four digits. */
const STRICT_FLIGHT_NUMBER = /^[A-Z]{2,3}\d{1,4}$/;

const CONFIDENCE_BASE = 50;
/** JSON-LD is machine-written by the airline, so it starts far above a number scraped out of prose. */
const CONFIDENCE_JSONLD_BASE = 75;

function isFutureYmd(ymd: string | undefined, now: number): boolean {
  if (!ymd) return false;
  const today = new Date(now).toISOString().slice(0, 10);
  return ymd >= today;
}

function knownFlightSender(from: string): boolean {
  const domain = senderDomain(from);
  if (!domain) return false;
  return FLIGHT_DOMAINS.includes(domain) || FLIGHT_BRANDS.includes(brandLabel(domain));
}

function knownTravelSender(from: string): boolean {
  const domain = senderDomain(from);
  if (!domain) return false;
  return TRAVEL_DOMAINS.includes(domain) || knownFlightSender(from);
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * How much this candidate looks like a flight the user is actually taking. The sender carries the most
 * weight — an airline's own confirmation is worth far more than a flight number in prose — and a date in
 * the past or no date at all pulls it back down.
 */
export function scoreCandidate(
  c: { flightNumber: string; dateIso?: string; origin?: string; destination?: string; source?: 'gmail' },
  ctx?: ParseContext & { subjectOnly?: boolean },
): number {
  const now = ctx?.now ?? Date.now();
  const from = String(ctx?.from || '');
  let score = ctx?.jsonLd ? CONFIDENCE_JSONLD_BASE : CONFIDENCE_BASE;

  if (from && knownFlightSender(from)) score += 30;
  if (STRICT_FLIGHT_NUMBER.test(String(c.flightNumber || '').toUpperCase())) score += 20;
  if (isFutureYmd(c.dateIso, now)) score += 15;
  if (c.origin && c.destination) score += 10;
  if ((c.source || ctx?.source) === 'gmail') score += 10;

  if (ctx?.subjectOnly) score -= 20;
  if (!c.dateIso) score -= 15;
  if (from && !knownTravelSender(from)) score -= 10;

  return clampScore(score);
}

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
  // Dutch months that differ from English (Trip.com NL and other Dutch senders write these).
  MRT: 2, MAART: 2,
  MEI: 4,
  OKT: 9, OKTOBER: 9,
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

/**
 * Gmail integration (also fixes paste import): a list like "TG922 BKK-FRA 18 Sep\nEK373 DXB-BKK 20 Sep" must give
 * each flight the route/date on its own line — plain nearest-by-index gave EK373 the date of the line above.
 * Falls back to the nearest hit anywhere when the flight's line has none (HTML tables, multi-line itineraries).
 */
function nearestSameLine<T>(text: string, index: number, hits: Hit<T>[]): T | undefined {
  const start = text.lastIndexOf('\n', index) + 1;
  const endAt = text.indexOf('\n', index);
  const end = endAt === -1 ? text.length : endAt;
  const onLine = hits.filter(h => h.index >= start && h.index < end);
  return nearest(index, onLine.length ? onLine : hits);
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

  // 21/10/2026, 21.10.2026 and 21-10-2026 (the Dutch and German way); an ISO date cannot match this shape.
  for (const m of src.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2}|\d{2})\b/g)) {
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

function candidateLabel(c: Omit<ImportCandidate, 'id' | 'label' | 'confidence'>): string {
  const bits = [c.flightNumber];
  if (c.origin && c.destination) bits.push(`${c.origin} → ${c.destination}`);
  if (c.dateIso) bits.push(c.dateIso);
  return bits.join(' · ');
}

export function parseImportText(text: string, fallbackDateIso?: string, ctx?: ParseContext): ImportCandidate[] {
  const flights = findFlightHits(text);
  const routes = findRouteHits(text);
  const dates = findDateHits(text);
  const seen = new Set<string>();
  const out: ImportCandidate[] = [];

  const src = String(text || '');
  for (const hit of flights) {
    const route = nearestSameLine(src, hit.index, routes);
    const dateIso = nearestSameLine(src, hit.index, dates) || fallbackDateIso;
    const key = `${hit.value}|${dateIso || ''}|${route?.origin || ''}|${route?.destination || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const draft = {
      flightNumber: hit.value,
      dateIso,
      origin: route?.origin,
      destination: route?.destination,
    };
    // Only in the subject line: the sender shouted a flight number but the mail never backs it up.
    const subjectOnly = ctx?.subjectChars != null
      && flights.every(f => f.value !== hit.value || f.index < (ctx.subjectChars as number));
    out.push({
      ...draft,
      id: key,
      label: candidateLabel(draft),
      ...(ctx?.source ? { source: ctx.source } : {}),
      confidence: scoreCandidate({ ...draft, source: ctx?.source }, { ...ctx, subjectOnly }),
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
    // The label has to start the line: "Bevestigingsnummer hotel: 123" is a booking number, not a name.
    /(?:^|\n)\s*(?:hotel(?:\s+name)?|property(?:\s+name)?|accommodation)\s*[:\-]\s*(.+)/i,
    /you(?:'re| are) staying at\s+(.+)/i,
    /welcome to\s+(.+)/i,
    // Gmail integration: common OTA wording ("Your booking is confirmed at …", "Your stay at …")
    /(?:booking|reservation|stay) (?:is )?confirmed (?:at|for)\s+(.+)/i,
    /your (?:upcoming )?(?:stay|reservation|booking) at\s+(.+)/i,
    // Dutch (Trip.com NL, Booking.com NL): "Je boeking bij Hotel X is bevestigd", "Hotelnaam: Hotel X"
    /(?:je|jouw|uw)\s+(?:boeking|reservering|verblijf)\s+(?:bij|voor|in)\s+(.+?)\s+is\s+bevestigd/i,
    /(?:hotelnaam|naam\s+(?:van\s+het\s+)?hotel|accommodatie)\s*[:\-]\s*(.+)/i,
  ]);
  const hotelAddress = firstMatch(src, [
    /(?:address|street(?:\s+address)?|property address|adres|hoteladres)\s*[:\-]\s*(.+)/i,
    /\b(\d{1,5}\s+[A-Z][A-Za-z0-9 .'#\-]+,\s*[A-Za-z .'-]+,?\s*\d{4,6}[A-Z]{0,3})\b/,
  ]);
  const checkIn = toIsoDate(firstMatch(src, [
    /(?:check[\s-]?in(?:\s+date)?|arrival(?:\s+date)?|inchecken|incheckdatum|aankomstdatum)\s*[:\-]\s*(.+)/i,
  ]));
  const checkOut = toIsoDate(firstMatch(src, [
    /(?:check[\s-]?out(?:\s+date)?|departure(?:\s+date)?|uitchecken|uitcheckdatum|vertrekdatum)\s*[:\-]\s*(.+)/i,
  ]));
  const hotelRef = firstMatch(src, [
    // The hotel's own number first: Trip.com prints both its booking number and the hotel's confirmation.
    /(?:bevestigingsnummer\s+hotel|hotel\s+confirmation\s+(?:number|code))\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
    /(?:booking\s+(?:reference|number|id)|confirmation(?:\s+(?:number|code|id|ref))?|reservation\s+(?:number|id)|pin(?:\s+code)?)\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
    // Each OTA has its own word for it: Expedia and Orbitz "itinerary", Airbnb "reservation code",
    // Priceline "trip number", Hotelbeds "booking code".
    /(?:itinerary\s+(?:number|no\.?|#)|reservation\s+code|trip\s+number|booking\s+code|folio\s+number)\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
    /(?:bevestigingsnummer|bevestigingscode|boekingsnummer|reserveringsnummer|boekingsreferentie)\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
  ]);
  const hotelBrand = detectBrand(src, [
    { re: /booking\.com/, name: 'Booking.com' },
    { re: /agoda/, name: 'Agoda' },
    { re: /airbnb/, name: 'Airbnb' },
    { re: /hotels\.com/, name: 'Hotels.com' },
    { re: /expedia/, name: 'Expedia' },
    { re: /trip\.com/, name: 'Trip.com' },
    { re: /\bctrip\b/, name: 'Ctrip' },
    { re: /\bvrbo\b/, name: 'Vrbo' },
    { re: /orbitz/, name: 'Orbitz' },
    { re: /travelocity/, name: 'Travelocity' },
    { re: /\bwotif\b/, name: 'Wotif' },
    { re: /priceline/, name: 'Priceline' },
    { re: /hotelbeds/, name: 'Hotelbeds' },
    { re: /bedsonline/, name: 'Bedsonline' },
    { re: /tripadvisor/, name: 'Tripadvisor' },
  ]);

  // A named company is strong evidence; a brand found anywhere in the mail is not ("budget airline").
  const carCompanyLabel = firstMatch(src, [
    /(?:rental(?:\s+car)?\s+company|supplier|car hire|verhuurder|autoverhuurder|mietwagenfirma)\s*[:\-]\s*(.+)/i,
  ]);
  const carBrand = detectBrand(src, [
    { re: /qeeq/, name: 'QEEQ' },
    { re: /rentalcars/, name: 'Rentalcars' },
    { re: /hertz/, name: 'Hertz' },
    { re: /\bavis\b/, name: 'Avis' },
    { re: /\bbudget\b/, name: 'Budget' },
    { re: /\bsixt\b/, name: 'Sixt' },
    { re: /enterprise/, name: 'Enterprise' },
    { re: /europcar/, name: 'Europcar' },
    { re: /\bkeddy\b/, name: 'Keddy by Europcar' },
    { re: /\balamo\b/, name: 'Alamo' },
    { re: /national\s?car/, name: 'National' },
    { re: /\bthrifty\b/, name: 'Thrifty' },
    { re: /\bdollar\s+(?:rent|car)/, name: 'Dollar' },
    { re: /goldcar/, name: 'Goldcar' },
    { re: /centauro/, name: 'Centauro' },
    { re: /ok\s?mobility/, name: 'OK Mobility' },
    { re: /\bturo\b/, name: 'Turo' },
    { re: /zipcar/, name: 'Zipcar' },
  ]);
  const carCompany = carCompanyLabel || carBrand;
  const carPickup = firstMatch(src, [
    /(?:pick[\s-]?up location|collection point|collect from|ophaallocatie|abholort)\s*[:\-]\s*(.+)/i,
  ]);
  const carDrop = firstMatch(src, [
    /(?:return location|drop[\s-]?off(?: location)?|drop off)\s*[:\-]\s*(.+)/i,
  ]);
  const carPickupTime = toIsoDateTime(firstMatch(src, [
    /(?:pick[\s-]?up date(?:\/time| and time)?|pick[\s-]?up|trip start(?:s)?|rental start(?:s)?)\s*[:\-]\s*(.+)/i,
  ]));
  const carDropTime = toIsoDateTime(firstMatch(src, [
    /(?:return date(?:\/time| and time)?|drop[\s-]?off date(?:\/time)?|return|trip end(?:s)?|rental end(?:s)?)\s*[:\-]\s*(.+)/i,
  ]));
  const carRef = firstMatch(src, [
    /(?:reservation number|booking ref(?:erence)?|rental(?:\s+agreement)?(?:\s+number)?)\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
    // Enterprise, Alamo and National say "confirmation number"; Turo calls it a trip id.
    /(?:confirmation\s+(?:number|code)|agreement\s+(?:number|no\.?)|trip\s+id|voucher\s+(?:number|no\.?))\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
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

  /*
   * Excursions and attraction tickets. parseTripExtras only ever sees text, never the From: header, so the
   * operator is read from the brand the mail prints about itself — which those senders always do.
   */
  const excursionOperator = detectBrand(src, [
    { re: /getyourguide/, name: 'GetYourGuide' },
    { re: /viator/, name: 'Viator' },
    { re: /klook/, name: 'Klook' },
    { re: /musement/, name: 'Musement' },
    { re: /civitatis/, name: 'Civitatis' },
    { re: /tiqets/, name: 'Tiqets' },
  ]);
  const excursionName = firstMatch(src, [
    /(?:^|\n)\s*(?:activity|tour|excursion)(?:\s+name)?\s*[:\-]\s*(.+)/i,
    /(?:^|\n)\s*(?:activiteit|excursie)\s*[:\-]\s*(.+)/i,
    /(?:^|\n)\s*(?:ausflug|aktivität)\s*[:\-]\s*(.+)/i,
    /(?:^|\n)\s*(?:activité|visite)\s*[:\-]\s*(.+)/i,
    /(?:^|\n)\s*(?:actividad|excursión|visita)\s*[:\-]\s*(.+)/i,
    /your (?:tour|activity|excursion)(?: is)?(?: confirmed)?\s*[:\-]\s*(.+)/i,
    /(?:booking|reservation) confirmed for\s+(.+)/i,
    /your tickets? for\s+(.+)/i,
  ]);
  const excursionWhen = toIsoDateTime(firstMatch(src, [
    /(?:date\s*(?:&|and)\s*time|date and time|start(?:ing)? time|starts)\s*[:\-]\s*(.+)/i,
    /(?:^|\n)\s*(?:date|datum(?:\s+en\s+tijd)?|datum\/tijd|fecha(?: y hora)?|date et heure|when)\s*[:\-]\s*(.+)/i,
  ]));
  const excursionPickup = firstMatch(src, [
    /(?:pick[\s-]?up(?:\s+(?:point|location))?|meet(?:ing)?\s+point|meet at|meeting location|departure point)\s*[:\-]\s*(.+)/i,
    /(?:ophaal(?:punt|locatie)?|vertrekpunt|ontmoetingspunt)\s*[:\-]\s*(.+)/i,
    /(?:abholort|treffpunkt)\s*[:\-]\s*(.+)/i,
    /(?:lieu de rendez-vous|point de rencontre|point de départ)\s*[:\-]\s*(.+)/i,
    /(?:punto de encuentro|lugar de recogida)\s*[:\-]\s*(.+)/i,
  ]);
  const excursionDrop = firstMatch(src, [
    /(?:drop[\s-]?off\s+point|return(?:s)? to|eindpunt|r[üu]ckgabeort)\s*[:\-]\s*(.+)/i,
  ]);
  // One generic reference matcher, shared by the excursion and the table booking.
  const genericRef = firstMatch(src, [
    /(?:booking\s+(?:reference|number|id)|confirmation\s+(?:number|code|id|ref)|reference\s+(?:number|code)|voucher\s+(?:number|code|no\.?)|ticket\s+(?:number|code))\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
    /(?:boekingsnummer|bevestigingsnummer|buchungsnummer|num[ée]ro de r[ée]servation)\s*[:\-#]?\s*([A-Z0-9-]{4,})/i,
  ]);

  /*
   * Restaurants. The platform comes from the brand in the mail for the same reason as the operator above;
   * Iens is TheFork's Dutch site and its mails carry the TheFork booking, so it maps to 'thefork'.
   */
  const restaurantPlatform = detectBrand(src, [
    { re: /opentable/, name: 'opentable' },
    { re: /thefork|lafourchette/, name: 'thefork' },
    { re: /\biens\b/, name: 'thefork' },
    { re: /\bresy\b/, name: 'other' },
    { re: /quandoo/, name: 'other' },
    { re: /bookatable/, name: 'other' },
  ]) as TripRestaurant['platform'] | undefined;
  const restaurantName = firstMatch(src, [
    /\breservation at\s+(.+?)(?:\s+for\s+\d+\b|[,\n]|$)/i,
    /\b(?:tafelreservering|tafel)(?:\s+bevestigd)?\s*(?:bij\s*)?[:\-]\s*([^,\n]+)/i,
    /\btafel bij\s+([^,\n]+)/i,
    /\btisch\s+(?:bei|im)\s+([^,\n]+)/i,
    /\br[ée]servation chez\s+([^,\n]+)/i,
    /\breserva en\s+([^,\n]+)/i,
    /(?:^|\n)\s*restaurant\s*[:\-]\s*(.+)/i,
  ]);
  const restaurantWhen = toIsoDateTime(firstMatch(src, [
    /(?:date\s*(?:&|and)\s*time|date and time|reservation time|zeit|heure|hora)\s*[:\-]\s*(.+)/i,
    /(?:^|\n)\s*(?:date|datum|fecha)\s*[:\-]\s*(.+)/i,
  ]));
  const partyMatch = src.match(/\b(\d{1,2})\s*(?:personen|persoon|persons?|people|guests?|pax|personnes|personas|couverts|g[äa]ste)\b/i)
    || src.match(/\b(?:party of|table for|tafel voor|tisch f[üu]r|table pour|mesa para)\s+(\d{1,2})\b/i)
    || src.match(/\bfor\s+(\d{1,2})\b(?=\s+(?:on|at|@))/i);
  const partySize = partyMatch ? Number(partyMatch[1]) : undefined;
  const restaurantAddress = firstMatch(src, [
    /(?:restaurant address|adres restaurant)\s*[:\-]\s*(.+)/i,
  ]);

  // An activity or a table needs more than the platform's name: the operator plus one real booking detail,
  // or a line that names the activity outright.
  const looksExcursion = !!(excursionName || (excursionOperator && (excursionWhen || genericRef || excursionPickup)));
  const looksRestaurant = !!(
    (restaurantName && (restaurantPlatform || partySize != null || restaurantWhen))
    || (restaurantPlatform && restaurantPlatform !== 'other' && (restaurantName || partySize != null))
  );

  // The brand alone is not a hotel: every Expedia mail carries the word "Expedia", flights included.
  // "Your booking is confirmed for …" is shared wording: on an excursion mail it names the tour, not a hotel,
  // so a stay needs its own evidence (dates, or a line that says hotel) before that phrase counts.
  const hotelEvidence = !!(checkIn || checkOut || hotelAddress);
  const looksHotel = !!(hotelName || hotelAddress || (hotelBrand && (checkIn || checkOut || hotelRef)) || (checkIn && hotelRef))
    && !((looksExcursion || looksRestaurant) && !hotelEvidence);
  // A rental always says where or when you collect the car. A brand or a booking number on its own does not
  // make one: "budget airline" in a flight mail used to be enough to invent a Budget rental.
  const looksCar = !!(carCompanyLabel || carPickup || carDrop || carPickupTime || carDropTime);
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
  if (looksExcursion) {
    out.excursion = {
      name: excursionName,
      dateTime: excursionWhen,
      pickupLocation: excursionPickup,
      dropoffLocation: excursionDrop,
      confirmationRef: genericRef,
      operator: excursionOperator,
      source: 'parsed',
    };
  }
  if (looksRestaurant) {
    out.restaurant = {
      name: restaurantName,
      dateTime: restaurantWhen,
      partySize,
      confirmationRef: genericRef,
      platform: restaurantPlatform,
      address: restaurantAddress,
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


/** A flight as schema.org/FlightReservation describes it — see parseJsonLdFlight. */
export type JsonLdFlight = {
  flightNumber?: string;
  /** YYYY-MM-DD departure date. */
  dateIso?: string;
  /** IATA code. */
  origin?: string;
  /** IATA code. */
  destination?: string;
  airline?: string;
  confirmationRef?: string;
  /** 0–100, and never low: the airline wrote this markup itself (see CONFIDENCE_JSONLD_BASE). */
  confidence: number;
};

function ldTypes(node: unknown): string[] {
  const t = (node as { '@type'?: unknown })?.['@type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
}

function ldString(node: unknown, key: string): string {
  const v = (node as Record<string, unknown>)?.[key];
  return typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : '');
}

function iataOf(node: unknown): string {
  const code = ldString(node, 'iataCode');
  return /^[A-Z0-9]{3}$/i.test(code) ? code.toUpperCase() : '';
}

/** Walks a JSON-LD object graph (objects, arrays and @graph wrappers) and yields every node. */
function ldNodes(root: unknown, seen = new Set<unknown>()): unknown[] {
  if (!root || typeof root !== 'object' || seen.has(root)) return [];
  seen.add(root);
  if (Array.isArray(root)) return root.flatMap(n => ldNodes(n, seen));
  const out: unknown[] = [root];
  for (const v of Object.values(root as Record<string, unknown>)) {
    if (v && typeof v === 'object') out.push(...ldNodes(v, seen));
  }
  return out;
}

/**
 * The first flight in a mail's JSON-LD. Google's own variant puts several types in an "@type" array, and some
 * airlines wrap everything in an itinerary or @graph, so the whole graph is searched rather than the top level.
 * Returns null unless a flight number came out of it — without one there is nothing to track.
 */
export function parseJsonLdFlight(ldObjects: unknown[], opts?: { now?: number }): JsonLdFlight | null {
  for (const node of (ldObjects || []).flatMap(o => ldNodes(o))) {
    const isReservation = ldTypes(node).includes('FlightReservation');
    const flight = (node as { reservationFor?: unknown })?.reservationFor;
    const leg = ldTypes(flight).includes('Flight') ? flight : (isReservation ? flight : null);
    if (!leg) continue;

    const number = ldString(leg, 'flightNumber').replace(/\s+/g, '').toUpperCase();
    if (!number) continue;

    const departure = ldString(leg, 'departureTime');
    const dateIso = /^(\d{4}-\d{2}-\d{2})/.exec(departure)?.[1];
    const out: JsonLdFlight = { flightNumber: number, confidence: CONFIDENCE_JSONLD_BASE };
    if (dateIso) out.dateIso = dateIso;
    const origin = iataOf((leg as { departureAirport?: unknown }).departureAirport);
    if (origin) out.origin = origin;
    const destination = iataOf((leg as { arrivalAirport?: unknown }).arrivalAirport);
    if (destination) out.destination = destination;
    const airline = ldString((leg as { airline?: unknown }).airline, 'name');
    if (airline) out.airline = airline;
    const ref = ldString(node, 'reservationNumber') || ldString(node, 'reservationId');
    if (ref) out.confirmationRef = ref;
    // Structured data scores on its own terms: no sender or subject is involved in reading it.
    let score = CONFIDENCE_JSONLD_BASE;
    if (isFutureYmd(out.dateIso, opts?.now ?? Date.now())) score += 15;
    if (out.origin && out.destination) score += 10;
    out.confidence = clampScore(score);
    return out;
  }
  return null;
}
