/**
 * AeroDataBox spend controls. Every upstream call is billed, cache hits are free.
 *  - Per caller (IP): at most USER_CALLS_PER_HOUR upstream calls in a rolling hour.
 *  - Overall: at most GLOBAL_CALLS_PER_HOUR per clock hour, then cached data only.
 */

const HOUR_MS = 60 * 60 * 1000;
const USER_CALLS_PER_HOUR = 10;
const GLOBAL_CALLS_PER_HOUR = 500;

/** Served when a caller is over budget — may be older than the regular cache TTL. */
const STALE_MAX_AGE_MS = 6 * HOUR_MS;
const STALE_MAX_BYTES = 50 * 1024 * 1024;

function minutesLabel(min) {
  return `${min} minute${min === 1 ? '' : 's'}`;
}

function limitError(code, retryAfterMin) {
  const min = Math.max(1, Math.ceil(retryAfterMin));
  const message = code === 'cost_guard'
    ? `Live flight data is paused for a moment. Try again in ${minutesLabel(min)}.`
    : `Try again in ${minutesLabel(min)}.`;
  const err = new Error(message);
  err.code = code;
  err.status = code === 'cost_guard' ? 503 : 429;
  err.retryAfterMin = min;
  return err;
}

function isLimitError(e) {
  return !!e && (e.code === 'rate_limited' || e.code === 'cost_guard');
}

function createCostGuard({
  userLimit = USER_CALLS_PER_HOUR,
  globalLimit = GLOBAL_CALLS_PER_HOUR,
  now = () => Date.now(),
  onGuardTripped = () => {},
} = {}) {
  /** @type {Map<string, number[]>} caller → upstream call timestamps in the last hour */
  const perCaller = new Map();
  let hourStart = 0;
  let hourCalls = 0;
  let trippedThisHour = false;

  function rollHour(t) {
    const start = Math.floor(t / HOUR_MS) * HOUR_MS;
    if (start === hourStart) return;
    hourStart = start;
    hourCalls = 0;
    trippedThisHour = false;
  }

  function recentCalls(caller, t) {
    const list = (perCaller.get(caller) || []).filter(at => t - at < HOUR_MS);
    if (list.length) perCaller.set(caller, list);
    else perCaller.delete(caller);
    return list;
  }

  /**
   * Record one upstream call for `caller`, or throw a limit error without calling upstream.
   * Calls without a caller (background jobs) only count toward the global guard.
   */
  function acquire(caller) {
    const t = now();
    rollHour(t);
    if (hourCalls >= globalLimit) {
      if (!trippedThisHour) {
        trippedThisHour = true;
        onGuardTripped({ calls: hourCalls, limit: globalLimit });
      }
      throw limitError('cost_guard', (hourStart + HOUR_MS - t) / 60000);
    }
    if (caller) {
      const list = recentCalls(caller, t);
      if (list.length >= userLimit) {
        throw limitError('rate_limited', (list[0] + HOUR_MS - t) / 60000);
      }
      list.push(t);
      perCaller.set(caller, list);
    }
    hourCalls += 1;
  }

  function prune() {
    const t = now();
    rollHour(t);
    for (const caller of [...perCaller.keys()]) recentCalls(caller, t);
  }

  function stats() {
    rollHour(now());
    return { hourCalls, globalLimit, callers: perCaller.size, paused: hourCalls >= globalLimit };
  }

  return { acquire, prune, stats };
}

/** Last good upstream response per cache key, bounded by age and total size (oldest evicted first). */
function createResponseStore({
  maxAgeMs = STALE_MAX_AGE_MS,
  maxBytes = STALE_MAX_BYTES,
  now = () => Date.now(),
} = {}) {
  /** @type {Map<string, { at:number, status:number, text:string }>} */
  const entries = new Map();
  let bytes = 0;

  function drop(key) {
    const hit = entries.get(key);
    if (!hit) return;
    bytes -= String(hit.text || '').length;
    entries.delete(key);
  }

  function remember(key, entry) {
    drop(key);
    entries.set(key, entry);
    bytes += String(entry.text || '').length;
    while (bytes > maxBytes && entries.size > 1) drop(entries.keys().next().value);
  }

  function get(key) {
    const hit = entries.get(key);
    if (!hit) return null;
    if (now() - hit.at > maxAgeMs) {
      drop(key);
      return null;
    }
    return hit;
  }

  function prune() {
    const t = now();
    for (const [key, hit] of [...entries]) {
      if (t - hit.at > maxAgeMs) drop(key);
    }
  }

  return { remember, get, prune, size: () => entries.size, bytes: () => bytes };
}

module.exports = {
  HOUR_MS,
  USER_CALLS_PER_HOUR,
  GLOBAL_CALLS_PER_HOUR,
  STALE_MAX_AGE_MS,
  createCostGuard,
  createResponseStore,
  isLimitError,
  limitError,
};
