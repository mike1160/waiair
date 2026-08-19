/** Flight-number helpers: codeshare display and ident matching. */

export function slugFlightIdent(raw?: string): string {
  return String(raw || '').replace(/[\s/-]+/g, '').toUpperCase();
}

function padlessNum(digits: string): string {
  return digits.replace(/^0+/, '') || '0';
}

/** KL0645 and KL645 are the same flight. */
export function identsMatch(a?: string, b?: string): boolean {
  const A = slugFlightIdent(a);
  const B = slugFlightIdent(b);
  if (!A || !B) return false;
  if (A === B) return true;
  const ma = A.match(/^([A-Z]{2,3})(\d{1,4}[A-Z]?)$/);
  const mb = B.match(/^([A-Z]{2,3})(\d{1,4}[A-Z]?)$/);
  if (!ma || !mb || ma[1] !== mb[1]) return false;
  return padlessNum(ma[2]) === padlessNum(mb[2]);
}

export function airlineCodeFromIdent(ident?: string): string {
  const slug = slugFlightIdent(ident);
  const m = slug.match(/^([A-Z]{2,3})(?=\d)/);
  return m ? m[1] : '';
}

export type FlightNumberFields = {
  number: string;
  operatingNumber?: string;
  airlineCode?: string;
};

/**
 * Keep the searched marketing number as `number` and stash the operator
 * as `operatingNumber` when AeroDataBox/FA returns the operating ident.
 */
export function applySearchedFlightNumber<T extends FlightNumberFields>(
  flight: T,
  searched: string,
): T {
  const q = slugFlightIdent(searched);
  const op = slugFlightIdent(flight.number);
  if (!q || !op) return flight;
  if (identsMatch(q, op)) return flight;
  const airline = airlineCodeFromIdent(q) || flight.airlineCode;
  return {
    ...flight,
    number: q,
    operatingNumber: op,
    airlineCode: airline || flight.airlineCode,
  };
}

/** Searched number first: VS7132 / KL645 */
export function formatFlightNumber(flight: FlightNumberFields): string {
  const searched = slugFlightIdent(flight.number) || flight.number;
  const operating = slugFlightIdent(flight.operatingNumber || '');
  if (searched && operating && !identsMatch(searched, operating)) {
    return `${searched} / ${operating}`;
  }
  return searched || flight.number;
}
