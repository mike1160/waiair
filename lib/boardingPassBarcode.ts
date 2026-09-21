/** Scanned boarding-pass barcode (IATA BCBP) for the Wallet pass — pure helpers, no React Native imports. */

function slug(flightNumber: string): string {
  return String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
}

/** AsyncStorage key of the raw barcode for a flight: boarding_pass_{flightNumber}. */
export function boardingPassStorageKey(flightNumber: string): string {
  return `boarding_pass_${slug(flightNumber)}`;
}

/** Scanner output without trailing line breaks; the rest stays byte-for-byte what the gate scanner reads. */
export function normalizeBcbp(raw: string): string {
  return String(raw || '').replace(/[\r\n]+$/, '');
}

/** IATA BCBP: "M" + number of legs, at least the 60 mandatory characters, printable ASCII (same check as the proxy). */
export function isBcbpBarcode(raw: string): boolean {
  const s = normalizeBcbp(raw);
  return /^M[1-9]/.test(s) && s.length >= 60 && s.length <= 1000 && /^[\x20-\x7E]+$/.test(s);
}

/** Pass URL opened in Safari after the token POST; only the one-time token is in the URL. */
export function walletPassUrl(proxy: string, flightNumber: string, token: string, departureIso?: string | null): string {
  const url = `${String(proxy).replace(/\/$/, '')}/passes/flight/${encodeURIComponent(slug(flightNumber))}?token=${encodeURIComponent(token)}`;
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(String(departureIso || '').trim());
  return date ? `${url}&date=${date[1]}` : url;
}
