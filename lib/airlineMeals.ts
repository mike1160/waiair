export type AirlineMeal = {
  airlineIata: string;
  description: string;
  menuUrl: string;
};

const MEALS: Record<string, AirlineMeal> = {
  TG: {
    airlineIata: 'TG',
    description: 'Thai mains, jasmine rice, fruit and tea — Book the Cook on selected long-haul.',
    menuUrl: 'https://www.thaiairways.com/en/plan/onboard/dining.page',
  },
  SQ: {
    airlineIata: 'SQ',
    description: 'KrisFlyer dining and Book the Cook — Asian and Western mains on long-haul.',
    menuUrl: 'https://www.singaporeair.com/en_UK/sg/flying-withus/dining/',
  },
  MH: {
    airlineIata: 'MH',
    description: 'Nasi lemak, satay and Malay-Chinese mains with Malaysian hospitality.',
    menuUrl: 'https://www.malaysiaairlines.com/hq/en/experience/dine.html',
  },
  EK: {
    airlineIata: 'EK',
    description: 'Multi-course Arabic and international service, ice cream on many routes.',
    menuUrl: 'https://www.emirates.com/english/experience/dining/',
  },
  QR: {
    airlineIata: 'QR',
    description: 'Arabic mezze and global mains — Qsuite dining on flagship widebodies.',
    menuUrl: 'https://www.qatarairways.com/en/onboard/dining.html',
  },
  CX: {
    airlineIata: 'CX',
    description: 'Cantonese and Western mains, tea service, regional seasonal menus.',
    menuUrl: 'https://www.cathaypacific.com/cx/en_HK/flying-with-us/onboard-experience/food-and-beverage.html',
  },
};

const LONG_HAUL_MS = 3 * 60 * 60 * 1000;

export function mealForAirline(code?: string): AirlineMeal | null {
  const iata = String(code || '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
  return MEALS[iata] || null;
}

export function shouldShowMealInfo(durationMs?: number | null, airlineCode?: string): boolean {
  return (durationMs ?? 0) > LONG_HAUL_MS && !!mealForAirline(airlineCode);
}
