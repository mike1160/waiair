/** EU261 / UK261 eligibility helpers for the AirHelp compensation banner. */

import { isoInAirportTzToUtcMs } from './localFlightTime';

export type Eu261Amount = 250 | 400 | 600;
export type Eu261Kind = 'cancelled' | 'delayed';

export type Eu261Claim = {
  kind: Eu261Kind;
  eligible: boolean;
  reason: string;
  amount: Eu261Amount;
  delayMin: number;
  distanceKm: number | null;
  liabilityPct: number;
  liabilityNote: string;
  airlineClaimUrl: string | null;
  airlineClaimLabel: string | null;
  url: string;
  euConnected: boolean;
};

export const EU261_STEPS = [
  'Document everything (screenshots, boarding pass, receipts).',
  'Request written confirmation of the delay or cancellation from the airline.',
  'Submit a claim via the airline website.',
  'If refused: file with the national enforcement body (NEB).',
  'Last resort: EU Small Claims procedure.',
];

export const EU261_LIABILITY_GUIDE: { label: string; pct: number }[] = [
  { label: '3h+ delay, no extraordinary circumstances', pct: 90 },
  { label: 'Technical issue (airline responsible)', pct: 75 },
  { label: 'Strike — airline staff', pct: 80 },
  { label: 'Strike — ATC', pct: 25 },
  { label: 'Weather / ATC / security', pct: 20 },
];

/** Community / EEA / UK carriers for inbound-to-EU EU261 coverage. */
const EU261_CARRIERS = new Set([
  'A3', 'AF', 'AY', 'AZ', 'A5', 'BT', 'BA', 'BE',
  'D8', 'DE', 'DS', 'DY', 'EI', 'EW', 'EN',
  'FI', 'FR', 'HV', 'I2', 'IB',
  'KL', 'KM', 'LG', 'LH', 'LO', 'LS', 'LX',
  'OA', 'OK', 'OS', 'OU',
  'QS', 'RO', 'RK', 'SK', 'SN',
  'TP', 'TO', 'U2', 'UX', 'VY', 'VS', 'V7',
  'W4', 'W6', 'W9', 'WA', 'WF', 'X3', 'ZB',
]);

const AIRLINE_CLAIM_URL: Record<string, { url: string; label: string }> = {
  KL: { url: 'https://www.klm.com/information/legal/eu-regulation', label: 'KLM claim' },
  AF: { url: 'https://wwws.airfrance.fr/claim', label: 'Air France claim' },
  LH: { url: 'https://www.lufthansa.com/xx/en/homepage', label: 'Lufthansa' },
  LX: { url: 'https://www.swiss.com/xx/en/homepage', label: 'SWISS' },
  OS: { url: 'https://www.austrian.com', label: 'Austrian' },
  SN: { url: 'https://www.brusselsairlines.com', label: 'Brussels Airlines' },
  BA: { url: 'https://www.britishairways.com/en-gb/information/legal/eu-regulation', label: 'British Airways claim' },
  IB: { url: 'https://www.iberia.com', label: 'Iberia' },
  VY: { url: 'https://www.vueling.com', label: 'Vueling' },
  AZ: { url: 'https://www.ita-airways.com', label: 'ITA Airways' },
  SK: { url: 'https://www.flysas.com', label: 'SAS' },
  AY: { url: 'https://www.finnair.com', label: 'Finnair' },
  TP: { url: 'https://www.flytap.com', label: 'TAP' },
  FR: { url: 'https://www.ryanair.com/gb/en/useful-info/help-centre/eu261', label: 'Ryanair EU261' },
  U2: { url: 'https://www.easyjet.com/en/policy/eu-261', label: 'easyJet EU261' },
  W6: { url: 'https://www.wizzair.com', label: 'Wizz Air' },
  HV: { url: 'https://www.transavia.com', label: 'Transavia' },
  TO: { url: 'https://www.transavia.com', label: 'Transavia' },
  EI: { url: 'https://www.aerlingus.com', label: 'Aer Lingus' },
  DY: { url: 'https://www.norwegian.com', label: 'Norwegian' },
  VS: { url: 'https://www.virginatlantic.com', label: 'Virgin Atlantic' },
};

export function isEu261Carrier(code?: string): boolean {
  const c = String(code || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if (c.length < 2) return false;
  return EU261_CARRIERS.has(c.slice(0, 2)) || EU261_CARRIERS.has(c);
}

export function airlineClaimLink(code?: string): { url: string; label: string } | null {
  const c = String(code || '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
  return AIRLINE_CLAIM_URL[c] || null;
}

const DELAY_THRESHOLD_MIN = 180;

/** EU27 + UK (UK261) + EEA/EFTA airports listed in product spec (ZRH, OSL). */
const EU261_CC = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'GB', 'UK',
  'CH', 'NO', 'IS', 'LI',
]);

/** Explicit IATA fallback when country is unknown. */
const EU261_IATA = new Set([
  'AMS', 'RTM', 'EIN', 'GRQ', 'MST',
  'LHR', 'LGW', 'STN', 'LCY', 'LTN', 'SEN', 'EDI', 'GLA', 'MAN', 'BHX', 'BRS',
  'NCL', 'LBA', 'LPL', 'SOU', 'CWL', 'BFS', 'BHD', 'ABZ', 'INV', 'EMA', 'EXT',
  'CDG', 'ORY', 'NCE', 'LYS', 'MRS', 'TLS', 'BOD', 'NTE', 'LIL', 'SXB', 'BVA',
  'FRA', 'MUC', 'DUS', 'BER', 'HAM', 'CGN', 'STR', 'HAJ', 'NUE', 'LEJ', 'HHN', 'NRN',
  'MAD', 'BCN', 'AGP', 'PMI', 'ALC', 'TFS', 'LPA', 'SVQ', 'VLC', 'BIO', 'IBZ',
  'FCO', 'MXP', 'LIN', 'NAP', 'VCE', 'BLQ', 'CTA', 'PMO', 'TRN', 'PSA', 'FLR', 'BRI',
  'BRU', 'CRL', 'ANR', 'LGG',
  'VIE', 'SZG', 'INN', 'GRZ',
  'CPH', 'BLL', 'AAL', 'AAR',
  'ARN', 'GOT', 'BMA', 'MMX',
  'HEL', 'TMP', 'TKU', 'OUL', 'RVN',
  'ZRH', 'GVA', 'BSL',
  'LIS', 'OPO', 'FAO', 'FNC', 'PDL',
  'ATH', 'SKG', 'HER', 'RHO', 'CFU', 'JTR',
  'DUB', 'ORK', 'SNN',
  'PRG', 'BRQ',
  'WAW', 'KRK', 'GDN', 'WRO', 'KTW', 'POZ',
  'BUD', 'DEB',
  'OSL', 'BGO', 'TRD', 'SVG', 'TOS',
  'OTP', 'CLJ', 'TSR',
  'SOF', 'VAR', 'BOJ',
  'ZAG', 'SPU', 'DBV',
  'LJU',
  'BTS', 'KSC',
  'VNO', 'KUN', 'RIX', 'TLL',
  'LUX', 'MLA', 'LCA', 'PFO',
  'KEF',
]);

const AIRHELP = 'https://www.airhelp.com/en/check-compensation/';

function normIata(code?: string): string {
  return String(code || '').trim().toUpperCase();
}

function normCc(country?: string): string {
  const c = String(country || '').trim().toUpperCase();
  if (c === 'UK' || c === 'GBR' || c === 'UNITED KINGDOM') return 'GB';
  if (c === 'NLD' || c === 'NETHERLANDS' || c === 'HOLLAND') return 'NL';
  return c.length === 2 ? c : '';
}

export function isEu261Airport(iata?: string, country?: string): boolean {
  const cc = normCc(country);
  if (cc && EU261_CC.has(cc)) return true;
  const code = normIata(iata);
  return !!code && EU261_IATA.has(code);
}

export function hasEu261Connection(
  originIata?: string,
  destIata?: string,
  originCountry?: string,
  destCountry?: string,
): boolean {
  return isEu261Airport(originIata, originCountry) || isEu261Airport(destIata, destCountry);
}

function isoMs(iso?: string, iata?: string, country?: string): number {
  if (!iso) return 0;
  const t = isoInAirportTzToUtcMs(iso, iata, country);
  if (t != null) return t;
  const raw = String(iso).trim();
  if (!raw) return 0;
  const fallback = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T')).getTime();
  return Number.isFinite(fallback) ? fallback : 0;
}

export function delayMinutesFromTimes(
  scheduled?: string,
  actual?: string,
  revised?: string,
  storedDelay?: number,
  iata?: string,
  country?: string,
): number {
  const stored = Math.max(0, Math.round(Number(storedDelay) || 0));
  const sched = isoMs(scheduled, iata, country);
  const basis = isoMs(actual, iata, country) || isoMs(revised, iata, country);
  if (!sched || !basis) return stored;
  const computed = Math.max(0, Math.round((basis - sched) / 60000));
  return Math.max(stored, computed);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function compensationAmount(
  km: number | null,
  bothEu: boolean,
  oneEu: boolean,
): Eu261Amount {
  if (km != null && Number.isFinite(km) && km > 0) {
    if (km < 1500) return 250;
    if (km <= 3500) return 400;
    return 600;
  }
  if (bothEu) return 250;
  if (oneEu) return 600;
  return 600;
}

function dateParam(iso?: string): string {
  const m = String(iso || '').match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const ms = isoMs(iso);
  if (!ms) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

export function airHelpUrl(flightNumber?: string, dateIso?: string): string {
  const params = new URLSearchParams();
  const flight = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  const date = dateParam(dateIso);
  if (flight && flight !== '—') params.set('flight', flight);
  if (date) params.set('date', date);
  const q = params.toString();
  return q ? `${AIRHELP}?${q}` : AIRHELP;
}

export function eu261Claim(input: {
  status?: string;
  delayMin?: number;
  scheduledTime?: string;
  actualTime?: string;
  revisedTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  originIata?: string;
  destIata?: string;
  originCountry?: string;
  destCountry?: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  flightNumber?: string;
  airlineCode?: string;
}): Eu261Claim | null {
  const euOrigin = isEu261Airport(input.originIata, input.originCountry);
  const euDest = isEu261Airport(input.destIata, input.destCountry);
  if (!euOrigin && !euDest) return null;

  const carrier = String(input.airlineCode || '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    || String(input.flightNumber || '').replace(/\s+/g, '').replace(/[^A-Za-z].*$/, '').toUpperCase();
  const euCarrier = isEu261Carrier(carrier);

  const cancelled = String(input.status || '').toLowerCase() === 'cancelled';
  const delay = delayMinutesFromTimes(
    input.scheduledTime,
    input.actualTime || input.departureTime || input.arrivalTime,
    input.revisedTime,
    input.delayMin,
    input.originIata,
    input.originCountry,
  );

  if (!cancelled && delay < DELAY_THRESHOLD_MIN) return null;

  /** Inbound to EU is covered only on an EU/EEA/UK carrier. */
  const covered = euOrigin || (euDest && euCarrier);
  const hours = Math.max(0, Math.round(delay / 60));
  let eligible = covered;
  let reason = '';
  if (cancelled && covered) {
    reason = euOrigin
      ? 'Cancelled flight departing from the EU/EEA/UK — EU261 likely applies.'
      : 'Cancelled inbound EU flight on an EU carrier — EU261 likely applies.';
  } else if (cancelled && !covered) {
    eligible = false;
    reason = 'Cancelled inbound to the EU on a non-EU airline — EU261 usually does not apply.';
  } else if (covered) {
    reason = euOrigin
      ? `Delayed ${hours}h, departing from the EU/EEA/UK — compensation likely if arrival is 3h+ late.`
      : `Delayed ${hours}h, arriving in the EU on an EU carrier — compensation likely.`;
  } else {
    eligible = false;
    reason = 'Arrives in the EU but the airline is not an EU/EEA/UK carrier — inbound EU261 does not apply.';
  }

  let km: number | null = null;
  const { originLat: lat1, originLon: lon1, destLat: lat2, destLon: lon2 } = input;
  if (
    lat1 != null && lon1 != null && lat2 != null && lon2 != null &&
    Number.isFinite(lat1) && Number.isFinite(lon1) && Number.isFinite(lat2) && Number.isFinite(lon2) &&
    !(lat1 === 0 && lon1 === 0) && !(lat2 === 0 && lon2 === 0)
  ) {
    km = haversineKm(lat1, lon1, lat2, lon2);
  }

  const link = airlineClaimLink(carrier);
  return {
    kind: cancelled ? 'cancelled' : 'delayed',
    eligible,
    reason,
    amount: compensationAmount(km, euOrigin && euDest, euOrigin || euDest),
    delayMin: delay,
    distanceKm: km,
    liabilityPct: eligible ? 90 : 0,
    liabilityNote: eligible
      ? 'No extraordinary circumstances on file — airline is usually liable.'
      : 'Route/carrier combination is outside EU261.',
    airlineClaimUrl: link?.url || null,
    airlineClaimLabel: link?.label || null,
    url: airHelpUrl(input.flightNumber, input.scheduledTime || input.departureTime || input.actualTime),
    euConnected: true,
  };
}
