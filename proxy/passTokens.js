/**
 * One-time tokens for Wallet passes that carry a scanned boarding-pass barcode. The app POSTs the BCBP data (passenger
 * name, booking reference, seat) and then opens /passes/flight/:flightNumber?token=… in Safari, so personal data never
 * appears in a URL, a log line or browser history. Tokens live in memory for 5 minutes; after the first fetch they keep
 * working for 30 seconds (Safari may request the pass twice) and then expire permanently.
 */
const crypto = require('node:crypto');

const TOKEN_TTL_MS = 5 * 60 * 1000;
const USED_TOKEN_GRACE_MS = 30 * 1000;
const MAX_TOKENS = 500;

/** IATA BCBP: "M" + number of legs, at least the 60 mandatory characters, printable ASCII only. */
function isBcbpBarcode(raw) {
  const s = String(raw || '');
  return /^M[1-9]/.test(s) && s.length >= 60 && s.length <= 1000 && /^[\x20-\x7E]+$/.test(s);
}

/** First leg's carrier + flight number from BCBP ("TG " + "0403 " → "TG403"); '' when missing. */
function bcbpFlightNumber(raw) {
  const leg = String(raw || '').slice(23);
  const carrier = leg.slice(13, 16).trim().toUpperCase();
  const flight = leg.slice(16, 21).trim().toUpperCase().replace(/^0+(?=\d)/, '');
  return carrier && flight ? `${carrier}${flight}` : '';
}

/** Seat and booking reference from the first BCBP leg; empty strings when missing. */
function bcbpPassengerFields(raw) {
  const leg = String(raw || '').slice(23);
  const pnr = leg.slice(0, 7).trim().toUpperCase();
  const seatRaw = leg.slice(25, 29).trim().toUpperCase();
  const seat = seatRaw && !/^0+$/.test(seatRaw) ? seatRaw.replace(/^0+(?=[A-Z0-9])/, '') : '';
  return { pnr, seat };
}

function createPassTokens({
  ttlMs = TOKEN_TTL_MS,
  graceMs = USED_TOKEN_GRACE_MS,
  maxTokens = MAX_TOKENS,
  now = () => Date.now(),
  randomBytes = crypto.randomBytes,
} = {}) {
  /** @type {Map<string, { at: number, usedAt: number | null, flightNumber: string, barcode: string }>} */
  const tokens = new Map();

  /** Unused: expires ttlMs after issue. Used: expires graceMs after the first fetch. */
  function expired(entry, t) {
    return entry.usedAt === null ? t - entry.at >= ttlMs : t - entry.usedAt >= graceMs;
  }

  function prune(t) {
    for (const [token, entry] of tokens) {
      if (expired(entry, t)) tokens.delete(token);
    }
  }

  /** New token for this flight's barcode; the oldest token makes room when the store is full. */
  function issue(flightNumber, barcode) {
    const t = now();
    prune(t);
    while (tokens.size >= maxTokens) tokens.delete(tokens.keys().next().value);
    const token = randomBytes(24).toString('base64url');
    tokens.set(token, { at: t, usedAt: null, flightNumber, barcode });
    return { token, expiresInSec: Math.round(ttlMs / 1000) };
  }

  /**
   * The barcode for a valid token of this flight, or null. The first fetch starts a 30-second window in which repeat
   * fetches of the same flight still work. A token presented for another flight is spent immediately (no probing).
   */
  function redeem(token, flightNumber) {
    const t = now();
    prune(t);
    const key = String(token || '');
    const entry = tokens.get(key);
    if (!entry) return null;
    if (entry.flightNumber !== flightNumber) {
      tokens.delete(key);
      return null;
    }
    if (entry.usedAt === null) entry.usedAt = t;
    return entry.barcode;
  }

  return { issue, redeem, size: () => tokens.size };
}

module.exports = {
  TOKEN_TTL_MS,
  USED_TOKEN_GRACE_MS,
  isBcbpBarcode,
  bcbpFlightNumber,
  bcbpPassengerFields,
  createPassTokens,
};
