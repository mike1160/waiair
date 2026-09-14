/**
 * /flight/:number for a flight that has landed: once the proxy has seen it landed for more than 24h, answer from the
 * stored landed response (each leg flagged stale: true, reason: 'flight_completed') instead of calling AeroDataBox.
 * A live response with a leg that has not landed (the same number flying again) clears the entry.
 */

/** Serve the stored landed response once it was first seen landed longer ago than this. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
/** Entries are dropped after this, so a number that operates again is fetched live at least every 2 days. */
const RETAIN_MS = 48 * 60 * 60 * 1000;
const MAX_ENTRIES = 2000;
const STALE_FLAG = { stale: true, reason: 'flight_completed' };

function legsOf(text) {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    return data && typeof data === 'object' ? [data] : [];
  } catch {
    return [];
  }
}

function isLandedLeg(leg) {
  const s = String((leg && leg.status) || '').trim().toLowerCase();
  return s === 'landed' || s === 'arrived';
}

/** Every leg in the AeroDataBox /flights/number response has landed. */
function allLegsLanded(text) {
  const legs = legsOf(text);
  return legs.length > 0 && legs.every(isLandedLeg);
}

/** Same JSON shape as the live response (the app expects an array), with the stale flag on each leg. */
function markStale(text) {
  const data = JSON.parse(text);
  return JSON.stringify(Array.isArray(data) ? data.map(leg => ({ ...leg, ...STALE_FLAG })) : { ...data, ...STALE_FLAG });
}

function createLandedFlights({
  staleAfterMs = STALE_AFTER_MS,
  retainMs = RETAIN_MS,
  maxEntries = MAX_ENTRIES,
  now = () => Date.now(),
} = {}) {
  /** @type {Map<string, { at: number, status: number, text: string }>} key → first seen landed at, latest landed body */
  const entries = new Map();

  function prune(t) {
    for (const [key, entry] of entries) {
      if (t - entry.at >= retainMs) entries.delete(key);
    }
  }

  /** The stored landed response when it is older than staleAfterMs, else null (fetch live). */
  function staleResponse(key) {
    const t = now();
    prune(t);
    const entry = entries.get(key);
    return entry && t - entry.at > staleAfterMs ? entry : null;
  }

  /** After a live answer: the first landed sighting starts the clock, a leg that has not landed clears it. */
  function observe(key, status, text) {
    if (!(status >= 200 && status < 300)) return;
    if (!allLegsLanded(text)) {
      entries.delete(key);
      return;
    }
    const prev = entries.get(key);
    if (prev) {
      entries.set(key, { ...prev, status, text });
      return;
    }
    const t = now();
    prune(t);
    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
    entries.set(key, { at: t, status, text });
  }

  return { staleResponse, observe, size: () => entries.size };
}

module.exports = {
  STALE_AFTER_MS,
  RETAIN_MS,
  STALE_FLAG,
  allLegsLanded,
  markStale,
  createLandedFlights,
};
