/** Home airport is inferred (location or first-flight origin), never required at launch. */

export type HomeAirport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
};

export function shouldSetHomeAirport(current: { iata?: string } | null | undefined): boolean {
  return !String(current?.iata || '').trim();
}

export function homeAirportFromOrigin(
  origin: string | undefined,
  rec?: {
    iata?: string;
    name?: string;
    city?: string;
    country?: string;
    lat?: number;
    lon?: number;
  } | null,
  cached?: {
    iata?: string;
    name?: string;
    city?: string;
    country?: string;
    flag?: string;
    lat?: number;
    lon?: number;
  } | null,
): HomeAirport | null {
  const iata = String(origin || rec?.iata || cached?.iata || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) return null;
  const country = String(cached?.country || rec?.country || '').toUpperCase();
  return {
    iata,
    name: cached?.name || rec?.name || iata,
    city: cached?.city || rec?.city || '',
    country,
    flag: cached?.flag || '',
    lat: Number(cached?.lat ?? rec?.lat) || 0,
    lon: Number(cached?.lon ?? rec?.lon) || 0,
  };
}
