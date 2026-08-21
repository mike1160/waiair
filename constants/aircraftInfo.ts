export type AircraftSpecs = {
  name: string;
  iata: string;
  passengers: string;
  range: string;
  engines: string;
  wikiTitle: string;
  seatGuruSlug: string;
};

/** Common FIDS types → name, IATA code, passengers, range, engines. */
const AIRCRAFT_BY_KEY: Record<string, AircraftSpecs> = {
  A320: {
    name: 'Airbus A320',
    iata: 'A320',
    passengers: '150–180',
    range: '6,100 km',
    engines: '2 × CFM56 / IAE V2500',
    wikiTitle: 'Airbus A320',
    seatGuruSlug: 'Airbus_A320',
  },
  A321: {
    name: 'Airbus A321',
    iata: 'A321',
    passengers: '185–236',
    range: '5,950 km',
    engines: '2 × CFM56 / IAE V2500',
    wikiTitle: 'Airbus A321',
    seatGuruSlug: 'Airbus_A321',
  },
  A321NEO: {
    name: 'Airbus A321neo',
    iata: 'A21N',
    passengers: '180–244',
    range: '7,400 km',
    engines: '2 × CFM LEAP-1A / PW1100G',
    wikiTitle: 'Airbus A321neo',
    seatGuruSlug: 'Airbus_A321neo',
  },
  B737: {
    name: 'Boeing 737',
    iata: 'B737',
    passengers: '126–149',
    range: '5,470 km',
    engines: '2 × CFM56',
    wikiTitle: 'Boeing 737',
    seatGuruSlug: 'Boeing_737',
  },
  'B737-800': {
    name: 'Boeing 737-800',
    iata: 'B738',
    passengers: '162–189',
    range: '5,440 km',
    engines: '2 × CFM56-7B',
    wikiTitle: 'Boeing 737 Next Generation',
    seatGuruSlug: 'Boeing_737-800',
  },
  B777: {
    name: 'Boeing 777',
    iata: 'B777',
    passengers: '301–396',
    range: '13,650 km',
    engines: '2 × GE90 / PW4000 / Trent 800',
    wikiTitle: 'Boeing 777',
    seatGuruSlug: 'Boeing_777',
  },
  'B787-8': {
    name: 'Boeing 787-8',
    iata: 'B788',
    passengers: '242',
    range: '13,620 km',
    engines: '2 × GEnx / Trent 1000',
    wikiTitle: 'Boeing 787 Dreamliner',
    seatGuruSlug: 'Boeing_787-8',
  },
  'B787-9': {
    name: 'Boeing 787-9',
    iata: 'B789',
    passengers: '290',
    range: '14,140 km',
    engines: '2 × GEnx / Trent 1000',
    wikiTitle: 'Boeing 787 Dreamliner',
    seatGuruSlug: 'Boeing_787-9',
  },
  B747: {
    name: 'Boeing 747',
    iata: 'B744',
    passengers: '366–467',
    range: '13,450 km',
    engines: '4 × GEnx / PW4000 / CF6',
    wikiTitle: 'Boeing 747',
    seatGuruSlug: 'Boeing_747',
  },
  'A350-900': {
    name: 'Airbus A350-900',
    iata: 'A359',
    passengers: '300–350',
    range: '15,000 km',
    engines: '2 × Rolls-Royce Trent XWB',
    wikiTitle: 'Airbus A350',
    seatGuruSlug: 'Airbus_A350-900',
  },
  A330: {
    name: 'Airbus A330',
    iata: 'A333',
    passengers: '250–300',
    range: '13,400 km',
    engines: '2 × PW4000 / CF6 / Trent 700',
    wikiTitle: 'Airbus A330',
    seatGuruSlug: 'Airbus_A330',
  },
  'A220-300': {
    name: 'Airbus A220-300',
    iata: 'BCS3',
    passengers: '130–160',
    range: '6,300 km',
    engines: '2 × Pratt & Whitney PW1500G',
    wikiTitle: 'Airbus A220',
    seatGuruSlug: 'Airbus_A220-300',
  },
};

/** Longest needles first so A321neo / 737-800 / 787-8 win over the generic type. */
const ALIASES: Array<[string, keyof typeof AIRCRAFT_BY_KEY]> = [
  ['A321NEO', 'A321NEO'],
  ['A321N', 'A321NEO'],
  ['A21N', 'A321NEO'],
  ['B737800', 'B737-800'],
  ['B738', 'B737-800'],
  ['B7878', 'B787-8'],
  ['B788', 'B787-8'],
  ['B7879', 'B787-9'],
  ['B789', 'B787-9'],
  ['B787', 'B787-9'],
  ['A220300', 'A220-300'],
  ['BCS3', 'A220-300'],
  ['BCS1', 'A220-300'],
  ['A220', 'A220-300'],
  ['A350900', 'A350-900'],
  ['A359', 'A350-900'],
  ['A35K', 'A350-900'],
  ['A350', 'A350-900'],
  ['A339', 'A330'],
  ['A333', 'A330'],
  ['A330', 'A330'],
  ['A321', 'A321'],
  ['A320', 'A320'],
  ['B77W', 'B777'],
  ['B77L', 'B777'],
  ['B773', 'B777'],
  ['B772', 'B777'],
  ['B777', 'B777'],
  ['B744', 'B747'],
  ['B748', 'B747'],
  ['B747', 'B747'],
  ['B737', 'B737'],
];

function compactType(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function lookupAircraft(raw?: string): AircraftSpecs | null {
  const compact = compactType(String(raw || ''));
  if (!compact) return null;
  for (const [needle, key] of ALIASES) {
    if (compact.includes(needle)) return AIRCRAFT_BY_KEY[key];
  }
  return null;
}

export function wikipediaSummaryUrl(aircraftName: string): string {
  const title = String(aircraftName || '').trim().replace(/\s+/g, '_');
  return `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
}

export function seatGuruUrl(airlineName?: string, slug?: string): string {
  const airline = String(airlineName || '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (airline) return `https://www.seatguru.com/airlines/${airline}/information.php`;
  if (slug) return `https://www.seatguru.com/browseairlines/browseairlines.php`;
  return 'https://www.seatguru.com';
}
