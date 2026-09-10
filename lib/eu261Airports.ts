/** EU261 / UK261 airport eligibility — no affiliate or React Native imports. */

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
