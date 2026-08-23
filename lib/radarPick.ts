import type { RadarPick } from '../RadarFlightSheet';

/** ADS-B often uses ICAO airline prefix (THA316) while lookup wants IATA (TG316). */
const AIRLINE_ICAO_TO_IATA: Record<string, string> = {
  THA: 'TG', SLK: 'MI', AXM: 'D7', MAS: 'MH', AWQ: 'QZ', LNI: 'JT', GIA: 'GA',
  TGW: 'TR', JSA: '3K', SEJ: '6E', AIC: 'AI', UAE: 'EK', ETD: 'EY', QTR: 'QR',
  SIA: 'SQ', PAL: 'PR', HVN: 'VN', CEB: '5J', BKP: 'PG', NOK: 'DD', AIQ: 'FD',
  KAL: 'KE', AAR: 'OZ', ANA: 'NH', JAL: 'JL', CAL: 'CI', CPA: 'CX', HDA: 'HX',
  CSN: 'CZ', CCA: 'CA', CES: 'MU', BAW: 'BA', AFR: 'AF', DLH: 'LH', KLM: 'KL',
  RYR: 'FR', EZY: 'U2', WZZ: 'W6', SAS: 'SK', FIN: 'AY', IBE: 'IB', TAP: 'TP',
  AUA: 'OS', SWR: 'LX', BEL: 'SN', IAW: 'AZ', QFA: 'QF', ANZ: 'NZ', VIR: 'VS',
  AAL: 'AA', UAL: 'UA', DAL: 'DL', ACA: 'AC', CXA: 'MF', CSC: '3U', NAX: 'DY',
  TRA: 'HV', TVF: 'TO',
};

export function radarCallsignToFlightNumber(cs: string): string {
  const clean = String(cs || '').replace(/\s+/g, '').toUpperCase();
  const m = clean.match(/^([A-Z]{3})(\d{1,4}[A-Z]?)$/);
  if (m && AIRLINE_ICAO_TO_IATA[m[1]]) return AIRLINE_ICAO_TO_IATA[m[1]] + m[2];
  return clean;
}

export function parseRadarPlaneMessage(raw: string): RadarPick | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.type !== 'planeSelect') return null;
    const callsign = String(data.callsign || data.icao || '').trim();
    if (!callsign) return null;
    const altitude = data.altitude == null || data.altitude === '' ? null : Number(data.altitude);
    const speedMs = data.speedMs == null || data.speedMs === '' ? null : Number(data.speedMs);
    return {
      callsign,
      icao: String(data.icao || '').trim(),
      altitude: Number.isFinite(altitude as number) ? (altitude as number) : null,
      speedMs: Number.isFinite(speedMs as number) ? (speedMs as number) : null,
      lat: Number.isFinite(Number(data.lat)) ? Number(data.lat) : null,
      lon: Number.isFinite(Number(data.lon)) ? Number(data.lon) : null,
      heading: Number.isFinite(Number(data.heading)) ? Number(data.heading) : null,
      vertRate: Number.isFinite(Number(data.vertRate)) ? Number(data.vertRate) : null,
      country: String(data.country || '').trim(),
      registration: String(data.registration || '').trim(),
    };
  } catch {
    return null;
  }
}

export function pickRadarFlight<T extends { status: string }>(hits: T[]): T | null {
  if (!hits.length) return null;
  return hits.find(f => f.status === 'en-route')
    || hits.find(f => f.status === 'boarding')
    || hits[0];
}
