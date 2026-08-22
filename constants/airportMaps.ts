/** Official terminal / gate map pages for common hubs. */
export const AIRPORT_MAPS: Record<string, string> = {
  AMS: 'https://www.schiphol.nl/en/route-map/',
  BKK: 'https://suvarnabhumi.airportthai.co.th/airport-map',
  DMK: 'https://donmueang.airportthai.co.th/airport-map',
  DPS: 'https://www.baliairport.co.id/terminal-map',
  SIN: 'https://www.changiairport.com/en/maps.html',
  LHR: 'https://www.heathrow.com/at-the-airport/terminal-guides',
  CDG: 'https://www.parisaeroport.fr/en/passengers/access/paris-charles-de-gaulle/airport-map',
  DXB: 'https://www.dubaiairports.ae/at-the-airport/navigating-the-airport/airport-maps',
  AUH: 'https://www.zayedinternationalairport.ae/en/plan-and-prepare/at-the-airport/interactive-map',
  DOH: 'https://www.hamadairport.com/en/at-the-airport/maps-and-directions',
  NRT: 'https://www.narita-airport.jp/en/map/',
  HND: 'https://tokyo-haneda.com/en/floor/index.html',
  ICN: 'https://www.airport.kr/ap/en/d/d/01/01.do',
  SYD: 'https://www.sydneyairport.com.au/info-sheet/maps',
  KUL: 'https://www.klia.com.my/airport-guide/airport-maps/',
};

export function airportMapUrl(iata: string, gate?: string): string {
  const code = String(iata || '').trim().toUpperCase();
  const mapped = AIRPORT_MAPS[code];
  if (mapped) return mapped;
  const g = String(gate || '').replace(/^gate\s+/i, '').trim();
  const q = [code, 'airport', g].filter(Boolean).join('+');
  return `https://www.google.com/maps/search/${q}`;
}
