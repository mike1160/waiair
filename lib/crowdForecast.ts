import { isoInAirportTzToUtcMs, localHourFromIso } from './localFlightTime';

export type CrowdLevel = 'quiet' | 'moderate' | 'busy' | 'veryBusy';

export type CrowdFlightLike = {
  scheduledTime?: string;
  revisedTime?: string;
  departureTime?: string;
  arrivalTime?: string;
};

export type CrowdHour = {
  hour: number;
  count: number;
  level: CrowdLevel;
};

export type CrowdForecast = {
  now: CrowdHour;
  hours: CrowdHour[];
};

function flightIso(f: CrowdFlightLike): string {
  return String(f.revisedTime || f.scheduledTime || f.departureTime || f.arrivalTime || '').trim();
}

export function crowdLevelOf(count: number): CrowdLevel {
  if (count >= 19) return 'veryBusy';
  if (count >= 11) return 'busy';
  if (count >= 5) return 'moderate';
  return 'quiet';
}

export function buildCrowdForecast(
  flights: CrowdFlightLike[],
  iata: string,
  country?: string,
  now = Date.now(),
): CrowdForecast | null {
  const nowHour = localHourFromIso(new Date(now).toISOString(), iata, country);
  if (nowHour == null) return null;

  const counts = [0, 0, 0, 0];
  for (const f of flights) {
    const iso = flightIso(f);
    if (!iso) continue;
    const ms = isoInAirportTzToUtcMs(iso, iata, country);
    if (ms == null || !Number.isFinite(ms)) continue;
    const h = localHourFromIso(iso, iata, country);
    if (h == null) continue;
    const delta = (h - nowHour + 24) % 24;
    if (delta >= 0 && delta < 4) counts[delta] += 1;
  }

  const hours: CrowdHour[] = counts.map((count, i) => ({
    hour: (nowHour + i) % 24,
    count,
    level: crowdLevelOf(count),
  }));
  return { now: hours[0], hours };
}
