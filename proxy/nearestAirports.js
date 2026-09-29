/**
 * "Which airport are you at?" answered without offering somewhere nobody can fly from [W/4].
 *
 * The nearest-airport routes ranked the whole dataset by straight-line distance and returned the top three.
 * That dataset is OurAirports filtered to large and medium fields with an IATA code, which includes airports
 * with no scheduled passenger service at all — so the closest airport to central Paris is Le Bourget, which
 * handles business jets, and the closest to central Istanbul is Atatürk, closed to scheduled passengers since
 * 2019. Both were returned first, and the app writes the first result down as the traveller's home airport.
 *
 * So anything without scheduled service is dropped before ranking. The filter is a preference rather than a
 * rule: if it would leave nothing at all — a gap in the data, somewhere genuinely remote — the unfiltered
 * ranking is returned instead, because a distant airport is a better answer than none.
 *
 * Choosing *between* two airports that both have scheduled service is a different problem and not this file's:
 * distance cannot separate Suvarnabhumi from Don Mueang, and lib/primaryAirport.ts decides that on the client.
 *
 * Pure, and unit-tested in proxy/nearestAirports.test.js.
 */

const EARTH_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * An airport counts as servable unless the data says outright that it has no scheduled service. Missing or
 * unknown is treated as servable: this is a filter against a known negative, not a whitelist.
 */
function hasScheduledService(a) {
  return a?.scheduledService !== false;
}

/**
 * The `limit` nearest airports to a point, closest first, each with `distanceKm`.
 *
 * `project` maps a stored airport to the shape the route returns; it defaults to identity so the ranking can
 * be tested on its own.
 */
function rankNearestAirports(airports, lat, lon, opts = {}) {
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.floor(opts.limit)) : 3;
  const project = typeof opts.project === 'function' ? opts.project : (a => a);
  const list = Array.isArray(airports) ? airports : [];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const measured = [];
  for (const a of list) {
    if (!Number.isFinite(a?.lat) || !Number.isFinite(a?.lon)) continue;
    measured.push({ a, d: haversineKm(lat, lon, a.lat, a.lon) });
  }
  const servable = measured.filter(x => hasScheduledService(x.a));
  // The filter is a preference: somewhere with no servable airport in the data still gets an answer.
  const pool = servable.length ? servable : measured;
  return pool
    .sort((x, y) => x.d - y.d)
    .slice(0, limit)
    .map(x => ({ ...project(x.a), distanceKm: Math.round(x.d * 10) / 10 }));
}

module.exports = { haversineKm, hasScheduledService, rankNearestAirports };
