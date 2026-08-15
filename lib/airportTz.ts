const AIRPORT_TZ: Record<string, string> = {
  BKK: 'Asia/Bangkok', DMK: 'Asia/Bangkok', HKT: 'Asia/Bangkok', CNX: 'Asia/Bangkok',
  HDY: 'Asia/Bangkok', USM: 'Asia/Bangkok', KBV: 'Asia/Bangkok', UTP: 'Asia/Bangkok',
  SIN: 'Asia/Singapore', KUL: 'Asia/Kuala_Lumpur', PEN: 'Asia/Kuala_Lumpur', BKI: 'Asia/Kuala_Lumpur',
  CGK: 'Asia/Jakarta', DPS: 'Asia/Makassar', SUB: 'Asia/Jakarta',
  SGN: 'Asia/Ho_Chi_Minh', HAN: 'Asia/Ho_Chi_Minh', DAD: 'Asia/Ho_Chi_Minh',
  MNL: 'Asia/Manila', CEB: 'Asia/Manila',
  AMS: 'Europe/Amsterdam', RTM: 'Europe/Amsterdam', EIN: 'Europe/Amsterdam',
  LHR: 'Europe/London', LGW: 'Europe/London', MAN: 'Europe/London', STN: 'Europe/London',
  CDG: 'Europe/Paris', ORY: 'Europe/Paris',
  FRA: 'Europe/Berlin', MUC: 'Europe/Berlin', BER: 'Europe/Berlin',
  MAD: 'Europe/Madrid', BCN: 'Europe/Madrid',
  FCO: 'Europe/Rome', MXP: 'Europe/Rome',
  ZRH: 'Europe/Zurich', VIE: 'Europe/Vienna', BRU: 'Europe/Brussels',
  CPH: 'Europe/Copenhagen', ARN: 'Europe/Stockholm', OSL: 'Europe/Oslo', HEL: 'Europe/Helsinki',
  DUB: 'Europe/Dublin', LIS: 'Europe/Lisbon', ATH: 'Europe/Athens',
  IST: 'Europe/Istanbul', SAW: 'Europe/Istanbul',
  DXB: 'Asia/Dubai', DWC: 'Asia/Dubai', AUH: 'Asia/Dubai', SHJ: 'Asia/Dubai',
  DOH: 'Asia/Qatar', BAH: 'Asia/Bahrain', MCT: 'Asia/Muscat', RUH: 'Asia/Riyadh', JED: 'Asia/Riyadh',
  HKG: 'Asia/Hong_Kong', TPE: 'Asia/Taipei', MFM: 'Asia/Macau',
  NRT: 'Asia/Tokyo', HND: 'Asia/Tokyo', KIX: 'Asia/Tokyo',
  ICN: 'Asia/Seoul', GMP: 'Asia/Seoul',
  PEK: 'Asia/Shanghai', PVG: 'Asia/Shanghai', CAN: 'Asia/Shanghai', SZX: 'Asia/Shanghai',
  DEL: 'Asia/Kolkata', BOM: 'Asia/Kolkata', BLR: 'Asia/Kolkata', MAA: 'Asia/Kolkata',
  SYD: 'Australia/Sydney', MEL: 'Australia/Melbourne', BNE: 'Australia/Brisbane', PER: 'Australia/Perth', AKL: 'Pacific/Auckland',
  JFK: 'America/New_York', EWR: 'America/New_York', LGA: 'America/New_York', BOS: 'America/New_York',
  LAX: 'America/Los_Angeles', SFO: 'America/Los_Angeles', SEA: 'America/Los_Angeles',
  ORD: 'America/Chicago', DFW: 'America/Chicago', ATL: 'America/New_York', MIA: 'America/New_York',
  YYZ: 'America/Toronto', YVR: 'America/Vancouver',
  GRU: 'America/Sao_Paulo', EZE: 'America/Argentina/Buenos_Aires',
  JNB: 'Africa/Johannesburg', CPT: 'Africa/Johannesburg', CAI: 'Africa/Cairo', NBO: 'Africa/Nairobi',
};

const COUNTRY_TZ: Record<string, string> = {
  TH: 'Asia/Bangkok', NL: 'Europe/Amsterdam', SG: 'Asia/Singapore', MY: 'Asia/Kuala_Lumpur',
  ID: 'Asia/Jakarta', VN: 'Asia/Ho_Chi_Minh', PH: 'Asia/Manila', GB: 'Europe/London',
  FR: 'Europe/Paris', DE: 'Europe/Berlin', AE: 'Asia/Dubai', QA: 'Asia/Qatar',
  HK: 'Asia/Hong_Kong', JP: 'Asia/Tokyo', KR: 'Asia/Seoul', CN: 'Asia/Shanghai',
  IN: 'Asia/Kolkata', AU: 'Australia/Sydney', US: 'America/New_York',
};

export function timezoneForIata(iata?: string, country?: string): string {
  const code = String(iata || '').toUpperCase();
  if (code && AIRPORT_TZ[code]) return AIRPORT_TZ[code];
  const cc = String(country || '').toUpperCase();
  if (cc.length === 2 && COUNTRY_TZ[cc]) return COUNTRY_TZ[cc];
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
