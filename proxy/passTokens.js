/**
 * One-time tokens for Wallet passes that carry a scanned boarding-pass barcode. The app POSTs the BCBP data (passenger
 * name, booking reference, seat) and then opens /passes/flight/:flightNumber?token=… in Safari, so personal data never
 * appears in a URL, a log line or browser history. Tokens live in memory for 5 minutes and work once.
 */
const crypto = require('node:crypto');

const TOKEN_TTL_MS = 5 * 60 * 1000;
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

function createPassTokens({
  ttlMs = TOKEN_TTL_MS,
  maxTokens = MAX_TOKENS,
  now = () => Date.now(),
  randomBytes = crypto.randomBytes,
} = {}) {
  /** @type {Map<string, { at: number, flightNumber: string, barcode: string }>} */
  const tokens = new Map();

  function prune(t) {
    for (const [token, entry] of tokens) {
      if (t - entry.at >= ttlMs) tokens.delete(token);
    }
  }

  /** New token for this flight's barcode; the oldest token makes room when the store is full. */
  function issue(flightNumber, barcode) {
    const t = now();
    prune(t);
    while (tokens.size >= maxTokens) tokens.delete(tokens.keys().next().value);
    const token = randomBytes(24).toString('base64url');
    tokens.set(token, { at: t, flightNumber, barcode });
    return { token, expiresInSec: Math.round(ttlMs / 1000) };
  }

  /** The barcode for a valid token of this flight, or null. Any presented token is spent (no probing, no reuse). */
  function redeem(token, flightNumber) {
    const t = now();
    prune(t);
    const key = String(token || '');
    const entry = tokens.get(key);
    if (!entry) return null;
    tokens.delete(key);
    return entry.flightNumber === flightNumber ? entry.barcode : null;
  }

  return { issue, redeem, size: () => tokens.size };
}

module.exports = {
  TOKEN_TTL_MS,
  isBcbpBarcode,
  bcbpFlightNumber,
  createPassTokens,
};
