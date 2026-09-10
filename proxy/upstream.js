/** Shared upstream fetch + FIDS window helpers for the WaiAir proxy. */

const UPSTREAM_TIMEOUT_MS = 15_000;
const FIDS_RESULT_CAP = 1500;

function timeoutError() {
  const err = new Error('upstream_timeout');
  err.code = 'UPSTREAM_TIMEOUT';
  err.status = 504;
  return err;
}

function failedError(message) {
  const err = new Error(message || 'upstream_failed');
  err.code = 'UPSTREAM_FAILED';
  err.status = 502;
  return err;
}

function isUpstreamTimeout(e) {
  if (!e) return false;
  if (e.code === 'UPSTREAM_TIMEOUT' || e.status === 504) return true;
  const name = e.name || '';
  const type = e.type || '';
  return name === 'AbortError' || type === 'aborted' || e.type === 'request-timeout';
}

function normalizeUpstreamError(e) {
  if (isUpstreamTimeout(e)) return timeoutError();
  return failedError(e && e.message ? e.message : 'upstream_failed');
}

/**
 * Fetch URL with AbortController. Timeout covers headers and body.
 * @param {string} url
 * @param {RequestInit} [opts]
 * @param {number} [timeoutMs]
 * @param {typeof fetch} [fetchFn]
 */
async function fetchWithAbort(url, opts = {}, timeoutMs = UPSTREAM_TIMEOUT_MS, fetchFn) {
  const fetchImpl = fetchFn || fetch;
  const ctrl = new AbortController();
  let timer;
  const timeoutP = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try { ctrl.abort(); } catch { /* already aborted */ }
      reject(timeoutError());
    }, timeoutMs);
  });
  const pending = Promise.resolve()
    .then(() => fetchImpl(url, { ...opts, signal: ctrl.signal }))
    .then(async (r) => {
      const text = await r.text();
      return { status: r.status, ok: !!r.ok, text };
    });
  pending.catch(() => {});
  try {
    return await Promise.race([pending, timeoutP]);
  } catch (e) {
    throw normalizeUpstreamError(e);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** AeroDataBox allows at most 12h between fromLocal and toLocal. */
function fidsDaySlices(dateKey) {
  return [
    { from: `${dateKey} 00:00`.replace(' ', '%20'), to: `${dateKey} 11:59`.replace(' ', '%20') },
    { from: `${dateKey} 12:00`.replace(' ', '%20'), to: `${dateKey} 23:59`.replace(' ', '%20') },
  ];
}

function stampUtcMinute(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Inclusive-start slices covering [fromDate, toDate), default 12h (ADB window cap). */
function utcWindowSlices(fromDate, toDate, sliceHours = 12) {
  const slices = [];
  const end = toDate.getTime();
  let start = fromDate.getTime();
  const sliceMs = Math.max(1, sliceHours) * 3600000;
  while (start < end) {
    const sliceEnd = Math.min(start + sliceMs, end);
    slices.push({ from: new Date(start), to: new Date(sliceEnd) });
    start = sliceEnd;
  }
  return slices;
}

function fidsListFromJson(json, dir) {
  const key = dir === 'Arrival' ? 'arrivals' : 'departures';
  if (Array.isArray(json?.[key])) return { key, list: json[key], template: json, arrayRoot: false };
  if (Array.isArray(json)) return { key, list: json, template: json, arrayRoot: true };
  return { key, list: [], template: json, arrayRoot: false };
}

function mergeFidsBodies(texts, dir, cap = FIDS_RESULT_CAP) {
  const key = dir === 'Arrival' ? 'arrivals' : 'departures';
  const seen = new Set();
  const merged = [];
  let template = null;
  let arrayRoot = false;
  outer: for (const text of texts) {
    let json;
    try { json = JSON.parse(text); } catch { continue; }
    if (!template) {
      template = json;
      arrayRoot = Array.isArray(json);
    }
    const { list } = fidsListFromJson(json, dir);
    for (const item of list) {
      const t = item?.movement?.scheduledTime;
      const ts = (t && (t.utc || t.local)) || item?.number || '';
      const id = `${item?.number || ''}|${ts}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
      if (merged.length >= cap) break outer;
    }
  }
  if (!template) return JSON.stringify({ [key]: merged });
  if (arrayRoot) return JSON.stringify(merged);
  return JSON.stringify({ ...template, [key]: merged });
}

function jsonArrayFromBody(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.flights)) return json.flights;
  if (Array.isArray(json?.items)) return json.items;
  return [];
}

function mergeJsonArrays(texts, cap = FIDS_RESULT_CAP) {
  const seen = new Set();
  const merged = [];
  outer: for (const text of texts) {
    let json;
    try { json = JSON.parse(text); } catch { continue; }
    for (const item of jsonArrayFromBody(json)) {
      const dep = item?.departure?.scheduledTime;
      const ts = (dep && (dep.utc || dep.local)) || item?.departure?.scheduledTimeUtc || '';
      const id = `${item?.number || item?.id || ''}|${ts}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
      if (merged.length >= cap) break outer;
    }
  }
  return JSON.stringify(merged);
}

function pruneTtlMap(map, ttlMs, now = Date.now()) {
  for (const [k, v] of map.entries()) {
    if (!v || typeof v.at !== 'number' || now - v.at >= ttlMs) map.delete(k);
  }
  return map;
}

function ttlGet(map, key, ttlMs, now = Date.now()) {
  pruneTtlMap(map, ttlMs, now);
  const hit = map.get(key);
  if (!hit) return undefined;
  if (now - hit.at >= ttlMs) {
    map.delete(key);
    return undefined;
  }
  return hit;
}

function ttlSet(map, key, value, ttlMs, now = Date.now()) {
  pruneTtlMap(map, ttlMs, now);
  map.set(key, value);
  return value;
}

module.exports = {
  UPSTREAM_TIMEOUT_MS,
  FIDS_RESULT_CAP,
  fetchWithAbort,
  isUpstreamTimeout,
  fidsDaySlices,
  utcWindowSlices,
  stampUtcMinute,
  mergeFidsBodies,
  mergeJsonArrays,
  pruneTtlMap,
  ttlGet,
  ttlSet,
};
