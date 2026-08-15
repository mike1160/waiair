/** EU261 / UK261 eligibility helpers for the AirHelp compensation banner. */

export type Eu261Amount = 250 | 400 | 600;
export type Eu261Kind = 'cancelled' | 'delayed';

export type Eu261Claim = {
  kind: Eu261Kind;
  amount: Eu261Amount;
  url: string;
  euConnected: boolean;
};

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

function isoMs(iso?: string): number {
  if (!iso) return 0;
  const raw = String(iso).trim();
  if (!raw) return 0;
  const t = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T')).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function delayMinutesFromTimes(
  scheduled?: string,
  actual?: string,
  revised?: string,
  storedDelay?: number,
): number {
  const stored = Math.max(0, Math.round(Number(storedDelay) || 0));
  const sched = isoMs(scheduled);
  const basis = isoMs(actual) || isoMs(revised);
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
  originIata?: string;
  destIata?: string;
  originCountry?: string;
  destCountry?: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  flightNumber?: string;
}): Eu261Claim | null {
  const euOrigin = isEu261Airport(input.originIata, input.originCountry);
  const euDest = isEu261Airport(input.destIata, input.destCountry);
  if (!euOrigin && !euDest) return null;

  const cancelled = String(input.status || '').toLowerCase() === 'cancelled';
  const delay = delayMinutesFromTimes(
    input.scheduledTime,
    input.actualTime || input.departureTime,
    input.revisedTime,
    input.delayMin,
  );

  if (!cancelled && delay < DELAY_THRESHOLD_MIN) return null;

  let km: number | null = null;
  const { originLat: lat1, originLon: lon1, destLat: lat2, destLon: lon2 } = input;
  if (
    lat1 != null && lon1 != null && lat2 != null && lon2 != null &&
    Number.isFinite(lat1) && Number.isFinite(lon1) && Number.isFinite(lat2) && Number.isFinite(lon2) &&
    !(lat1 === 0 && lon1 === 0) && !(lat2 === 0 && lon2 === 0)
  ) {
    km = haversineKm(lat1, lon1, lat2, lon2);
  }

  return {
    kind: cancelled ? 'cancelled' : 'delayed',
    amount: compensationAmount(km, euOrigin && euDest, euOrigin || euDest),
    url: airHelpUrl(input.flightNumber, input.scheduledTime || input.departureTime || input.actualTime),
    euConnected: true,
  };
}
