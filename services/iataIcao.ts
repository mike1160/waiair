/** IATA → ICAO. FlightAware and OpenSky airport endpoints use ICAO. */
export const IATA_ICAO: Record<string, string> = {
  BKK: 'VTBS', DMK: 'VTBD', HKT: 'VTSP',
  USM: 'VTSM', CNX: 'VTCC', KBV: 'VTSG',
  AMS: 'EHAM', SIN: 'WSSS', KUL: 'WMKK',
  DXB: 'OMDB', LHR: 'EGLL', CDG: 'LFPG',
  PEN: 'WMKP', DPS: 'WADD', MNL: 'RPLL',
  SGN: 'VVTS', HAN: 'VVNB', HKG: 'VHHH',
  CGK: 'WIII', JKT: 'WIII', BWN: 'WBSB',
  PNH: 'VDPP', RGN: 'VYYY', VTE: 'VLVT',
  CEB: 'RPVM', CRK: 'RPLC', KLO: 'RPVK',
  SUB: 'WARR', JOG: 'WAHI', UPG: 'WAAA',
  NRT: 'RJAA', HND: 'RJTT', ICN: 'RKSI',
  PEK: 'ZBAA', PVG: 'ZSPD', CAN: 'ZGGG',
  DEL: 'VIDP', BOM: 'VABB', BLR: 'VOBL',
  SYD: 'YSSY', MEL: 'YMML', AUH: 'OMAA',
  DOH: 'OTHH', FRA: 'EDDF', MUC: 'EDDM',
  FCO: 'LIRF', MAD: 'LEMD', BCN: 'LEBL',
  JFK: 'KJFK', LAX: 'KLAX', SFO: 'KSFO',
};

const ICAO_IATA: Record<string, string> = Object.fromEntries(
  Object.entries(IATA_ICAO).map(([iata, icao]) => [icao, iata]),
);

export function iataToIcao(iata: string): string {
  const code = String(iata || '').trim().toUpperCase();
  if (code.length === 4) return code;
  return IATA_ICAO[code] || '';
}

export function icaoToIata(icao: string): string {
  const code = String(icao || '').trim().toUpperCase();
  if (code.length === 3) return code;
  return ICAO_IATA[code] || code;
}
