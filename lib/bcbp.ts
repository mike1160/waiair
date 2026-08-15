/** IATA BCBP (Resolution 792) boarding-pass barcode parser. */

export type BoardingPassInfo = {
  flightNumber: string;
  dateIso?: string;
  from?: string;
  to?: string;
  pnr?: string;
  seat?: string;
  sequence?: string;
  compartment?: string;
  passengerStatus?: string;
};

function isFlightNumberLike(q: string): boolean {
  return /^[A-Z]{1,3}\s?\d{1,4}[A-Z]?$/i.test(String(q || '').trim());
}

function slug(number: string): string {
  return String(number || '').replace(/\s+/g, '').toUpperCase();
}

/** Julian day-of-year → nearest calendar date (year is not stored in BCBP). */
export function julianDayToIso(day: number, ref = new Date()): string | undefined {
  if (!Number.isFinite(day) || day < 1 || day > 366) return undefined;
  const year = ref.getFullYear();
  const candidates = [year - 1, year, year + 1]
    .map(y => new Date(Date.UTC(y, 0, day)))
    .filter(d => !Number.isNaN(d.getTime()));
  if (!candidates.length) return undefined;
  const best = candidates.reduce((a, b) =>
    Math.abs(a.getTime() - ref.getTime()) <= Math.abs(b.getTime() - ref.getTime()) ? a : b,
  );
  return best.toISOString().slice(0, 10);
}

function iata3(raw: string): string | undefined {
  const v = String(raw || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(v) ? v : undefined;
}

/**
 * Unique header is 23 chars (M + legs + 20-char name + e-ticket indicator).
 * First leg then follows IATA 792:
 *   PNR 7, from 3, to 3, carrier 3, flight 5, Julian 3,
 *   compartment 1, seat 4, sequence 5, passenger status 1.
 */
export function parseBcbp(raw: string): BoardingPassInfo | null {
  const data = String(raw || '').replace(/[\r\n]/g, '').trim();
  if (!data) return null;

  if (isFlightNumberLike(data)) {
    return { flightNumber: slug(data) };
  }

  if (/^M\d/i.test(data) && data.length >= 42) {
    const leg = data.slice(23);
    if (leg.length >= 24) {
      const pnr = leg.slice(0, 7).trim().toUpperCase();
      const from = iata3(leg.slice(7, 10));
      const to = iata3(leg.slice(10, 13));
      const carrier = leg.slice(13, 16).trim().toUpperCase();
      const flightField = leg.slice(16, 21).trim().toUpperCase();
      const julian = parseInt(leg.slice(21, 24).trim(), 10);
      const compartment = leg.slice(24, 25).trim().toUpperCase();
      const seat = leg.slice(25, 29).trim().toUpperCase();
      const sequence = leg.slice(29, 34).trim().replace(/^0+(?=\d)/, '');
      const passengerStatus = leg.slice(34, 35).trim().toUpperCase();

      let flightNumber = '';
      if (carrier && flightField) {
        const num = flightField.replace(/^0+(?=\d)/, '');
        flightNumber = slug(carrier + num);
      }

      if (flightNumber && isFlightNumberLike(flightNumber)) {
        return {
          flightNumber,
          dateIso: julianDayToIso(julian),
          from,
          to,
          pnr: pnr || undefined,
          seat: seat && !/^0+$/.test(seat) ? seat : undefined,
          sequence: sequence || undefined,
          compartment: compartment || undefined,
          passengerStatus: passengerStatus || undefined,
        };
      }
    }
  }

  const token = data.match(/\b([A-Z]{1,3}\s?\d{1,4}[A-Z]?)\b/i);
  if (token && isFlightNumberLike(token[1])) {
    return { flightNumber: slug(token[1]) };
  }
  return null;
}

export function boardingPassSummary(pass: BoardingPassInfo): string {
  const route = pass.from && pass.to ? `${pass.from} → ${pass.to}` : '';
  return [pass.flightNumber, route, 'Found!'].filter(Boolean).join(' · ');
}
