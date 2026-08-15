export type AirportRegion =
  | 'Southeast Asia'
  | 'East Asia'
  | 'South Asia'
  | 'Middle East'
  | 'Europe'
  | 'Africa'
  | 'North America'
  | 'Latin America'
  | 'Oceania'
  | 'Other';

const REGION_BY_CC: Record<string, AirportRegion> = {
  TH: 'Southeast Asia', VN: 'Southeast Asia', SG: 'Southeast Asia', MY: 'Southeast Asia',
  ID: 'Southeast Asia', PH: 'Southeast Asia', KH: 'Southeast Asia', LA: 'Southeast Asia',
  MM: 'Southeast Asia', BN: 'Southeast Asia', TL: 'Southeast Asia',
  CN: 'East Asia', HK: 'East Asia', TW: 'East Asia', JP: 'East Asia', KR: 'East Asia', MO: 'East Asia',
  IN: 'South Asia', PK: 'South Asia', BD: 'South Asia', LK: 'South Asia', NP: 'South Asia',
  AE: 'Middle East', QA: 'Middle East', SA: 'Middle East', BH: 'Middle East', OM: 'Middle East',
  KW: 'Middle East', IL: 'Middle East', JO: 'Middle East', TR: 'Middle East', IR: 'Middle East',
  NL: 'Europe', BE: 'Europe', DE: 'Europe', FR: 'Europe', GB: 'Europe', IE: 'Europe',
  ES: 'Europe', PT: 'Europe', IT: 'Europe', CH: 'Europe', AT: 'Europe', PL: 'Europe',
  SE: 'Europe', NO: 'Europe', DK: 'Europe', FI: 'Europe', GR: 'Europe', CZ: 'Europe',
  HU: 'Europe', RO: 'Europe', PT2: 'Europe',
  ZA: 'Africa', EG: 'Africa', MA: 'Africa', KE: 'Africa', NG: 'Africa', TZ: 'Africa',
  US: 'North America', CA: 'North America', MX: 'North America',
  BR: 'Latin America', AR: 'Latin America', CL: 'Latin America', CO: 'Latin America',
  PE: 'Latin America', PA: 'Latin America',
  AU: 'Oceania', NZ: 'Oceania', FJ: 'Oceania',
};

export function regionForCountry(country?: string): AirportRegion {
  const cc = String(country || '').toUpperCase();
  return REGION_BY_CC[cc] || 'Other';
}

export function groupAirportsByRegion<T extends { country?: string }>(list: T[]): { region: AirportRegion; items: T[] }[] {
  const map = new Map<AirportRegion, T[]>();
  for (const a of list) {
    const r = regionForCountry(a.country);
    const arr = map.get(r) || [];
    arr.push(a);
    map.set(r, arr);
  }
  const order: AirportRegion[] = [
    'Southeast Asia', 'East Asia', 'South Asia', 'Middle East', 'Europe',
    'Africa', 'North America', 'Latin America', 'Oceania', 'Other',
  ];
  return order.filter(r => map.has(r)).map(region => ({ region, items: map.get(region)! }));
}
