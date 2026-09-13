/**
 * 1-stop connections for today from AeroDataBox day boards.
 * Pure: server.js fetches (and caches) the boards; this file ranks hubs and pairs legs.
 */

const MIN_LAYOVER_MIN = 60;
const MAX_LAYOVER_MIN = 8 * 60;
const MAX_HUB_ATTEMPTS = 5;
/** Stop trying further hubs once this many valid connections are found. */
const ENOUGH_CONNECTIONS = 3;
/** Hub boards and route results are shared across users for this long. */
const CONNECTION_CACHE_TTL_MS = 30 * 60 * 1000;

/** Longest plausible single leg; guards against pairing the same flight number on another day. */
const MAX_BLOCK_MS = 20 * 3600000;

const MIDDLE_EAST_HUBS = ['DXB', 'DOH', 'AUH', 'KWI', 'BAH', 'RUH', 'AMM', 'BEY'];

/** List order is the fallback priority; each pair is also used in the reverse direction. */
const REGION_HUBS = {
  'europe>asia': ['AMS', 'FRA', 'LHR', 'CDG', 'MUC', 'VIE', 'ZRH', 'IST', 'DXB', 'DOH', 'KWI', 'BAH', 'AUH', 'RUH', 'CAI'],
  'europe>americas': ['AMS', 'LHR', 'FRA', 'CDG', 'MAD', 'LIS'],
  'europe>africa': ['CDG', 'AMS', 'FRA', 'DXB', 'DOH', 'CAI', 'NBO'],
  'asia>asia': ['SIN', 'HKG', 'DOH', 'DXB', 'KUL', 'BKK', 'NRT', 'ICN', 'PEK', 'PVG'],
  'americas>asia': ['LAX', 'JFK', 'ORD', 'YYZ', 'DXB', 'DOH'],
};

const COUNTRIES_BY_REGION = {
  // TR counts as Europe here: IST is a Europe → Asia hub.
  europe: 'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GI GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM TR UA XK',
  asia: 'AF BD BN BT CN HK ID IN JP KG KH KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL TM TW UZ VN',
  middleEast: 'AE BH IL IQ IR JO KW LB OM PS QA SA SY YE',
  africa: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW',
  americas: 'AG AR AW BB BO BR BS BZ CA CL CO CR CU CW DM DO EC GD GT GY HN HT JM KN KY LC MX NI PA PE PR PY SR SV TC TT US UY VC VE VG VI',
  oceania: 'AU FJ NC NZ PF PG SB TO VU WS',
};

const REGION_BY_CC = new Map();
for (const [region, list] of Object.entries(COUNTRIES_BY_REGION)) {
  for (const cc of list.split(' ')) REGION_BY_CC.set(cc, region);
}

function regionForCountry(country) {
  return REGION_BY_CC.get(String(country || '').trim().toUpperCase()) || 'other';
}

/** Region-pair hubs first, Middle East hubs always appended; never the endpoints themselves. */
function candidateHubs(from, to, fromCountry, toCountry) {
  const a = regionForCountry(fromCountry);
  const b = regionForCountry(toCountry);
  const pair = REGION_HUBS[`${a}>${b}`] || REGION_HUBS[`${b}>${a}`] || [];
  const out = [];
  for (const hub of [...pair, ...MIDDLE_EAST_HUBS]) {
    if (hub === from || hub === to || out.includes(hub)) continue;
    out.push(hub);
  }
  return out;
}

function slugNumber(number) {
  return String(number || '').replace(/\s+/g, '').toUpperCase();
}

function remoteIata(item) {
  return String((item && item.movement && item.movement.airport && item.movement.airport.iata) || '').toUpperCase();
}

function isCancelled(item) {
  return /cancel/i.test(String((item && item.status) || ''));
}

/** Codeshare rows duplicate the operating flight — count and pair operators only. */
function isOperating(item) {
  return String((item && item.codeshareStatus) || '').toLowerCase() !== 'iscodeshared';
}

function movementUtcMs(item) {
  const m = (item && item.movement) || {};
  const raw = (m.revisedTime && m.revisedTime.utc) || (m.scheduledTime && m.scheduledTime.utc) || '';
  const ms = Date.parse(String(raw).replace(' ', 'T'));
  return Number.isFinite(ms) ? ms : null;
}

function isPlausibleBlock(depMs, arrMs) {
  return depMs != null && arrMs != null && arrMs > depMs && arrMs - depMs <= MAX_BLOCK_MS;
}

function countByRemote(items) {
  const counts = new Map();
  for (const item of items || []) {
    if (!isOperating(item) || isCancelled(item)) continue;
    const code = remoteIata(item);
    if (code) counts.set(code, (counts.get(code) || 0) + 1);
  }
  return counts;
}

/**
 * Most likely hubs first: flights today origin → hub and hub → destination (the scarcer side wins).
 * A board we have that shows zero flights rules the hub out; a missing board (null) proves nothing.
 */
function rankHubs(candidates, originDepartures, destArrivals, limit = MAX_HUB_ATTEMPTS) {
  const outbound = countByRemote(originDepartures);
  const inbound = countByRemote(destArrivals);
  const unknown = Number.MAX_SAFE_INTEGER;
  return candidates
    .map((hub, order) => {
      const legs1 = originDepartures ? (outbound.get(hub) || 0) : unknown;
      const legs2 = destArrivals ? (inbound.get(hub) || 0) : unknown;
      return { hub, order, score: Math.min(legs1, legs2) };
    })
    .filter(s => s.score > 0)
    .sort((x, y) => (y.score - x.score) || (x.order - y.order))
    .slice(0, limit)
    .map(s => s.hub);
}

function byNumberFrom(items, remote) {
  const map = new Map();
  for (const item of items || []) {
    if (remoteIata(item) !== remote || isCancelled(item)) continue;
    const key = slugNumber(item.number);
    if (key && !map.has(key)) map.set(key, item);
  }
  return map;
}

/** `/flights/number`-style arrival side so the app's FIDS parser picks up arrival times. */
function arrivalSide(item) {
  const m = (item && item.movement) || {};
  return {
    movement: {
      scheduledTime: m.scheduledTime,
      revisedTime: m.revisedTime,
      runwayTime: m.runwayTime,
      terminal: m.terminal,
      gate: m.gate,
      baggageBelt: m.baggageBelt,
    },
  };
}

/**
 * Pair origin → hub with hub → destination at one hub.
 * Each onward flight appears once, fed by the tightest valid inbound (60 min – 8 h).
 */
function buildConnections({ to, hub, originDepartures, hubArrivals, hubDepartures, destArrivals, from }) {
  const arrivalsAtHub = byNumberFrom(hubArrivals, from);
  const arrivalsAtDest = byNumberFrom(destArrivals, hub);

  const inbound = [];
  for (const dep of originDepartures || []) {
    if (remoteIata(dep) !== hub || !isOperating(dep) || isCancelled(dep)) continue;
    const arr = arrivalsAtHub.get(slugNumber(dep.number));
    const arrMs = movementUtcMs(arr);
    // Flight numbers repeat daily — the matched arrival must belong to this departure.
    if (!isPlausibleBlock(movementUtcMs(dep), arrMs)) continue;
    inbound.push({ dep, arr, arrMs });
  }

  const onward = [];
  for (const dep of hubDepartures || []) {
    if (remoteIata(dep) !== to || !isOperating(dep) || isCancelled(dep)) continue;
    const depMs = movementUtcMs(dep);
    if (depMs == null) continue;
    const arr = arrivalsAtDest.get(slugNumber(dep.number));
    onward.push({ dep, depMs, arr: isPlausibleBlock(depMs, movementUtcMs(arr)) ? arr : undefined });
  }
  onward.sort((a, b) => a.depMs - b.depMs);

  const best = new Map();
  for (const leg1 of inbound) {
    const leg2 = onward.find(o => {
      const min = (o.depMs - leg1.arrMs) / 60000;
      return min >= MIN_LAYOVER_MIN && min <= MAX_LAYOVER_MIN;
    });
    if (!leg2) continue;
    const layoverMin = Math.round((leg2.depMs - leg1.arrMs) / 60000);
    const key = `${slugNumber(leg2.dep.number)}|${leg2.depMs}`;
    const prev = best.get(key);
    if (!prev || layoverMin < prev.layoverMin) best.set(key, { leg1, leg2, layoverMin });
  }

  return [...best.values()].map(({ leg1, leg2, layoverMin }) => ({
    id: `${hub}:${slugNumber(leg1.dep.number)}>${slugNumber(leg2.dep.number)}:${leg2.depMs}`,
    hub,
    layoverMin,
    legs: [
      { ...leg1.dep, arrival: arrivalSide(leg1.arr) },
      leg2.arr ? { ...leg2.dep, arrival: arrivalSide(leg2.arr) } : { ...leg2.dep },
    ],
  }));
}

function sortConnections(connections) {
  const depMs = c => movementUtcMs(c.legs[0]) ?? Number.POSITIVE_INFINITY;
  return [...connections].sort((a, b) => depMs(a) - depMs(b));
}

/** Try hubs in priority order; stop early once enough connections are found. A failing hub is skipped. */
async function collectConnections(hubs, loadHubConnections, enough = ENOUGH_CONNECTIONS) {
  const connections = [];
  const hubsTried = [];
  for (const hub of hubs.slice(0, MAX_HUB_ATTEMPTS)) {
    hubsTried.push(hub);
    try {
      connections.push(...await loadHubConnections(hub));
    } catch { /* next hub */ }
    if (connections.length >= enough) break;
  }
  return { connections: sortConnections(connections), hubsTried };
}

/** IANA zones AeroDataBox reports for remote airports (fills gaps in the proxy's IATA_TZ table). */
function timeZonesFromItems(items) {
  const zones = new Map();
  for (const item of items || []) {
    const ap = item && item.movement && item.movement.airport;
    const code = String((ap && ap.iata) || '').toUpperCase();
    if (code && ap.timeZone && !zones.has(code)) zones.set(code, ap.timeZone);
  }
  return zones;
}

module.exports = {
  MIN_LAYOVER_MIN,
  MAX_LAYOVER_MIN,
  MAX_HUB_ATTEMPTS,
  ENOUGH_CONNECTIONS,
  CONNECTION_CACHE_TTL_MS,
  MIDDLE_EAST_HUBS,
  regionForCountry,
  candidateHubs,
  rankHubs,
  buildConnections,
  sortConnections,
  collectConnections,
  timeZonesFromItems,
};
