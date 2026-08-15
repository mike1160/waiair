import { fetchJsonRetry } from '../lib/net';
import { icaoToIata, iataToIcao } from './iataIcao';

function callsignToNumber(cs: string): string {
  return String(cs || '').replace(/\s+/g, '').toUpperCase();
}

function unixNow() {
  return Math.floor(Date.now() / 1000);
}

function mapOpenSkyFlight(raw: any, dir: 'dep' | 'arr') {
  const number = callsignToNumber(raw.callsign || raw.icao24 || '');
  const origin = icaoToIata(raw.estDepartureAirport || '');
  const destination = icaoToIata(raw.estArrivalAirport || '');
  const first = Number(raw.firstSeen) || 0;
  const last = Number(raw.lastSeen) || 0;
  const depIso = first ? new Date(first * 1000).toISOString() : '';
  const arrIso = last ? new Date(last * 1000).toISOString() : '';
  const airborne = dir === 'dep' && last && Date.now() / 1000 - last < 30 * 60;
  return {
    id: `${number}-${first || last || Math.random()}`,
    number: number || '—',
    airline: '',
    airlineCode: number.slice(0, 3).replace(/\d/g, '') || '—',
    origin,
    originCity: origin,
    originCountry: '',
    destination,
    destCity: destination,
    destCountry: '',
    scheduledTime: dir === 'arr' ? arrIso : depIso,
    revisedTime: dir === 'arr' ? arrIso : depIso,
    actualTime: dir === 'dep' ? depIso : (airborne ? '' : arrIso),
    arrivalTime: arrIso,
    departureTime: depIso,
    gate: '',
    terminal: '',
    baggage: '',
    runway: '',
    arrTerminal: '',
    depTerminal: '',
    status: airborne ? 'en-route' : (dir === 'arr' ? 'landed' : 'en-route'),
    delay: 0,
    aircraft: '',
    aircraftReg: String(raw.icao24 || '').toUpperCase(),
    callSign: String(raw.callsign || '').trim(),
    progress: airborne ? 0.5 : (dir === 'arr' ? 1 : 0.4),
    _normalized: true,
  };
}

export async function getOpenSkyFlights(iata: string, dir: 'dep' | 'arr'): Promise<any[]> {
  const icao = iataToIcao(iata);
  if (!icao) throw new Error('OPENSKY_NO_ICAO');
  const end = unixNow();
  const begin = end - 2 * 60 * 60;
  const path = dir === 'arr' ? 'arrival' : 'departure';
  const url = `https://opensky-network.org/api/flights/${path}?airport=${encodeURIComponent(icao)}&begin=${begin}&end=${end}`;
  const json = await fetchJsonRetry(url, 10000);
  const items = Array.isArray(json) ? json : [];
  const mapped = items.map((row: any) => mapOpenSkyFlight(row, dir)).filter((f: any) => f.number && f.number !== '—');
  if (!mapped.length) throw new Error('OPENSKY_EMPTY');
  return mapped;
}
