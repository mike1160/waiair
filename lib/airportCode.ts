import { icaoToIata } from '../services/iataIcao.ts';

const PLACEHOLDER = new Set([
  '', '—', '-', '–', '???', 'UNK', 'UNKN', 'NULL', 'UNKNOWN', 'N/A', 'NA',
]);

/**
 * IATA when possible. 4-letter ICAO maps to IATA when known
 * (RKSI → ICN, VTSP → HKT). HKT is Phuket (UTC+7), not Hong Kong (HKG).
 */
export function usableAirportCode(code?: string): string {
  const c = String(code || '').trim().toUpperCase();
  if (!c || PLACEHOLDER.has(c)) return '';
  if (/^[A-Z]{4}$/.test(c)) {
    const iata = icaoToIata(c);
    if (/^[A-Z]{3}$/.test(iata) && !PLACEHOLDER.has(iata)) return iata;
    return c;
  }
  return c;
}
