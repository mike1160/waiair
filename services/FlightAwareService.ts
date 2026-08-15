import { fetchWithTimeout } from '../lib/net';

const FA_BASE = 'https://aeroapi.flightaware.com/aeroapi';
const FA_KEY = process.env.EXPO_PUBLIC_FLIGHTAWARE_KEY || '';
const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

/** OTA kill switch — false skips FlightAware entirely. */
export function isFaEnabled(): boolean {
  return process.env.EXPO_PUBLIC_FA_ENABLED !== 'false';
}

const DAILY_CAP = 200;
let dailyCalls = 0;
let callDate = '';

function bumpBudget() {
  const today = new Date().toDateString();
  if (today !== callDate) {
    dailyCalls = 0;
    callDate = today;
  }
  if (dailyCalls >= DAILY_CAP) throw new Error('DAILY_BUDGET_EXCEEDED');
  dailyCalls += 1;
}

export type FAFlightDetail = {
  flightNumber: string;
  airline: string;
  departure: string;
  destination: string;
  scheduledDeparture: string;
  estimatedDeparture: string;
  actualDeparture: string;
  scheduledArrival: string;
  estimatedArrival: string;
  actualArrival: string;
  departureGate: string;
  arrivalGate: string;
  departureTerminal: string;
  arrivalTerminal: string;
  baggageBelt: string;
  status: string;
  progress: number;
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  aircraft: string;
  registration: string;
};

const STATUS_MAP: Record<string, string> = {
  Scheduled: 'Scheduled',
  Active: 'En Route',
  'En Route/Taxi': 'Taxiing',
  Arrived: 'Landed',
  Cancelled: 'Cancelled',
  Diverted: 'Diverted',
};

function mapStatus(s: string): string {
  return STATUS_MAP[s] || s || 'Scheduled';
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapFaPayload(data: any): FAFlightDetail {
  const f = data?.flights?.[0] || data;
  if (!f) throw new Error('FLIGHT_NOT_FOUND');
  const ident = str(f.ident || f.ident_iata || f.fa_flight_id);
  if (!ident) throw new Error('FLIGHT_NOT_FOUND');
  const progressRaw = Number(f.progress_percent);
  return {
    flightNumber: ident,
    airline: str(f.operator || f.operator_iata),
    departure: str(f.origin?.code_iata || f.origin?.code),
    destination: str(f.destination?.code_iata || f.destination?.code),
    scheduledDeparture: str(f.scheduled_out || f.scheduled_off),
    estimatedDeparture: str(f.estimated_out || f.estimated_off),
    actualDeparture: str(f.actual_out || f.actual_off),
    scheduledArrival: str(f.scheduled_in || f.scheduled_on),
    estimatedArrival: str(f.estimated_in || f.estimated_on),
    actualArrival: str(f.actual_in || f.actual_on),
    departureGate: str(f.gate_origin),
    arrivalGate: str(f.gate_destination),
    departureTerminal: str(f.terminal_origin),
    arrivalTerminal: str(f.terminal_destination),
    baggageBelt: str(f.baggage_claim),
    status: mapStatus(str(f.status)),
    progress: Number.isFinite(progressRaw) ? progressRaw : 0,
    lat: num(f.last_position?.latitude),
    lng: num(f.last_position?.longitude),
    altitude: num(f.last_position?.altitude),
    speed: num(f.last_position?.groundspeed),
    heading: num(f.last_position?.heading),
    aircraft: str(f.aircraft_type),
    registration: str(f.registration),
  };
}

async function faFetchDirect(endpoint: string): Promise<any> {
  if (!FA_KEY) throw new Error('FA_NO_KEY');
  const res = await fetchWithTimeout(`${FA_BASE}${endpoint}`, {
    headers: { 'x-apikey': FA_KEY, Accept: 'application/json' },
  }, 8000);
  if (!res.ok) throw new Error(`FA_${res.status}`);
  return res.json();
}

/** Pro tracked flights only. Never used for FIDS. */
export async function getFAFlightDetail(ident: string): Promise<FAFlightDetail> {
  if (!isFaEnabled()) throw new Error('FA_DISABLED');
  const clean = String(ident || '').replace(/\s+/g, '').toUpperCase();
  if (!clean) throw new Error('FLIGHT_NOT_FOUND');
  bumpBudget();

  try {
    const data = await fetchWithTimeout(
      `${PROXY}/fa/flights/${encodeURIComponent(clean)}`,
      { headers: { Accept: 'application/json' } },
      8000,
    ).then(async res => {
      if (!res.ok) throw new Error(`FA_${res.status}`);
      return res.json();
    });
    return mapFaPayload(data);
  } catch (err) {
    if (!FA_KEY) throw err;
    const data = await faFetchDirect(`/flights/${encodeURIComponent(clean)}`);
    return mapFaPayload(data);
  }
}
