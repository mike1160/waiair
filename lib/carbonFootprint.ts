export type Haul = 'short' | 'medium' | 'long';
export type CabinClass = 'economy' | 'business' | 'first';

export const KG_PER_KM = {
  short: 0.255,
  medium: 0.195,
  long: 0.147,
} as const;

export const CAR_KG_PER_KM = 0.21;
export const ENERGY_KG_PER_DAY = 16;

export const OFFSET_URLS = {
  mossyEarth: 'https://www.mossy.earth/',
  goldStandard: 'https://marketplace.goldstandard.org/',
} as const;

export function haulForDistance(distanceKm: number): Haul {
  if (distanceKm < 1500) return 'short';
  if (distanceKm <= 4000) return 'medium';
  return 'long';
}

export function calculateCO2(distanceKm: number): {
  kg: number;
  carKm: number;
  energyDays: number;
  haul: Haul;
} {
  const km = Math.max(0, Number(distanceKm) || 0);
  const haul = haulForDistance(km);
  const kg = km * KG_PER_KM[haul];
  return {
    kg,
    carKm: CAR_KG_PER_KM > 0 ? kg / CAR_KG_PER_KM : 0,
    energyDays: ENERGY_KG_PER_DAY > 0 ? kg / ENERGY_KG_PER_DAY : 0,
    haul,
  };
}

export function cabinClassFromCompartment(code?: string): CabinClass {
  const c = String(code || '').trim().toUpperCase().slice(0, 1);
  if ('FAPR'.includes(c) && c) return 'first';
  if ('CJDIZ'.includes(c) && c) return 'business';
  return 'economy';
}

export function milesClassFactor(cabin: CabinClass): number {
  if (cabin === 'first') return 2;
  if (cabin === 'business') return 1.5;
  return 1;
}

export function estimatedAwardMiles(distanceKm: number, cabin: CabinClass): number {
  const raw = Math.max(0, Number(distanceKm) || 0) * milesClassFactor(cabin);
  return Math.round(raw / 10) * 10;
}
