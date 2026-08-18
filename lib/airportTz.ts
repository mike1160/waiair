/** IATA → IANA. Multi-zone countries need airport rows; others can use COUNTRY_TZ. */
const AIRPORT_TZ: Record<string, string> = {
  BKK: 'Asia/Bangkok', DMK: 'Asia/Bangkok', HKT: 'Asia/Bangkok', CNX: 'Asia/Bangkok',
  HDY: 'Asia/Bangkok', USM: 'Asia/Bangkok', KBV: 'Asia/Bangkok', UTP: 'Asia/Bangkok',
  SIN: 'Asia/Singapore', KUL: 'Asia/Kuala_Lumpur', PEN: 'Asia/Kuala_Lumpur', BKI: 'Asia/Kuala_Lumpur',
  CGK: 'Asia/Jakarta', DPS: 'Asia/Makassar', SUB: 'Asia/Jakarta', UPG: 'Asia/Makassar',
  SGN: 'Asia/Ho_Chi_Minh', HAN: 'Asia/Ho_Chi_Minh', DAD: 'Asia/Ho_Chi_Minh',
  MNL: 'Asia/Manila', CEB: 'Asia/Manila',
  AMS: 'Europe/Amsterdam', RTM: 'Europe/Amsterdam', EIN: 'Europe/Amsterdam',
  LHR: 'Europe/London', LGW: 'Europe/London', MAN: 'Europe/London', STN: 'Europe/London', LCY: 'Europe/London',
  CDG: 'Europe/Paris', ORY: 'Europe/Paris',
  FRA: 'Europe/Berlin', MUC: 'Europe/Berlin', BER: 'Europe/Berlin', DUS: 'Europe/Berlin', HAM: 'Europe/Berlin',
  MAD: 'Europe/Madrid', BCN: 'Europe/Madrid', AGP: 'Europe/Madrid',
  FCO: 'Europe/Rome', MXP: 'Europe/Rome', LIN: 'Europe/Rome', NAP: 'Europe/Rome',
  ZRH: 'Europe/Zurich', GVA: 'Europe/Zurich', VIE: 'Europe/Vienna', BRU: 'Europe/Brussels',
  CPH: 'Europe/Copenhagen', ARN: 'Europe/Stockholm', OSL: 'Europe/Oslo', HEL: 'Europe/Helsinki',
  DUB: 'Europe/Dublin', LIS: 'Europe/Lisbon', OPO: 'Europe/Lisbon', ATH: 'Europe/Athens',
  IST: 'Europe/Istanbul', SAW: 'Europe/Istanbul',
  WAW: 'Europe/Warsaw', PRG: 'Europe/Prague', BUD: 'Europe/Budapest', OTP: 'Europe/Bucharest',
  KEF: 'Atlantic/Reykjavik',
  DXB: 'Asia/Dubai', DWC: 'Asia/Dubai', AUH: 'Asia/Dubai', SHJ: 'Asia/Dubai',
  DOH: 'Asia/Qatar', BAH: 'Asia/Bahrain', MCT: 'Asia/Muscat', RUH: 'Asia/Riyadh', JED: 'Asia/Riyadh', MED: 'Asia/Riyadh',
  HKG: 'Asia/Hong_Kong', TPE: 'Asia/Taipei', MFM: 'Asia/Macau',
  NRT: 'Asia/Tokyo', HND: 'Asia/Tokyo', KIX: 'Asia/Tokyo', NGO: 'Asia/Tokyo', FUK: 'Asia/Tokyo',
  ICN: 'Asia/Seoul', GMP: 'Asia/Seoul',
  PEK: 'Asia/Shanghai', PVG: 'Asia/Shanghai', CAN: 'Asia/Shanghai', SZX: 'Asia/Shanghai', CTU: 'Asia/Shanghai',
  DEL: 'Asia/Kolkata', BOM: 'Asia/Kolkata', BLR: 'Asia/Kolkata', MAA: 'Asia/Kolkata', HYD: 'Asia/Kolkata', CCU: 'Asia/Kolkata',
  CMB: 'Asia/Colombo', DAC: 'Asia/Dhaka', KTM: 'Asia/Kathmandu', RGN: 'Asia/Yangon',
  SYD: 'Australia/Sydney', MEL: 'Australia/Melbourne', BNE: 'Australia/Brisbane', PER: 'Australia/Perth',
  ADL: 'Australia/Adelaide', CBR: 'Australia/Sydney', OOL: 'Australia/Brisbane', CNS: 'Australia/Brisbane',
  AKL: 'Pacific/Auckland', WLG: 'Pacific/Auckland', CHC: 'Pacific/Auckland',
  JFK: 'America/New_York', EWR: 'America/New_York', LGA: 'America/New_York', BOS: 'America/New_York',
  PHL: 'America/New_York', BWI: 'America/New_York', IAD: 'America/New_York', DCA: 'America/New_York',
  CLT: 'America/New_York', ATL: 'America/New_York', MIA: 'America/New_York', MCO: 'America/New_York',
  FLL: 'America/New_York', TPA: 'America/New_York', RDU: 'America/New_York',
  ORD: 'America/Chicago', MDW: 'America/Chicago', DFW: 'America/Chicago', DAL: 'America/Chicago',
  IAH: 'America/Chicago', HOU: 'America/Chicago', MSP: 'America/Chicago', DTW: 'America/New_York',
  STL: 'America/Chicago', MCI: 'America/Chicago', AUS: 'America/Chicago', MSN: 'America/Chicago',
  DEN: 'America/Denver', SLC: 'America/Denver', ABQ: 'America/Denver',
  PHX: 'America/Phoenix', LAS: 'America/Los_Angeles',
  LAX: 'America/Los_Angeles', SFO: 'America/Los_Angeles', SJC: 'America/Los_Angeles', OAK: 'America/Los_Angeles',
  SAN: 'America/Los_Angeles', SEA: 'America/Los_Angeles', PDX: 'America/Los_Angeles',
  SNA: 'America/Los_Angeles', BUR: 'America/Los_Angeles', SMF: 'America/Los_Angeles',
  HNL: 'Pacific/Honolulu', ANC: 'America/Anchorage',
  YYZ: 'America/Toronto', YUL: 'America/Toronto', YOW: 'America/Toronto', YHZ: 'America/Halifax',
  YVR: 'America/Vancouver', YYC: 'America/Edmonton', YEG: 'America/Edmonton', YWG: 'America/Winnipeg',
  MEX: 'America/Mexico_City', CUN: 'America/Cancun', GDL: 'America/Mexico_City',
  GRU: 'America/Sao_Paulo', GIG: 'America/Sao_Paulo', BSB: 'America/Sao_Paulo',
  EZE: 'America/Argentina/Buenos_Aires', SCL: 'America/Santiago', LIM: 'America/Lima', BOG: 'America/Bogota',
  JNB: 'Africa/Johannesburg', CPT: 'Africa/Johannesburg', CAI: 'Africa/Cairo', NBO: 'Africa/Nairobi',
  ADD: 'Africa/Addis_Ababa', LOS: 'Africa/Lagos', ACC: 'Africa/Accra', CMN: 'Africa/Casablanca',
  TLV: 'Asia/Jerusalem', AMM: 'Asia/Amman', BEY: 'Asia/Beirut',
};

/** ISO country → primary IANA zone (single-zone countries). */
const COUNTRY_TZ: Record<string, string> = {
  AD: 'Europe/Andorra', AE: 'Asia/Dubai', AF: 'Asia/Kabul', AL: 'Europe/Tirane',
  AM: 'Asia/Yerevan', AO: 'Africa/Luanda', AR: 'America/Argentina/Buenos_Aires',
  AT: 'Europe/Vienna', AU: 'Australia/Sydney', AZ: 'Asia/Baku',
  BA: 'Europe/Sarajevo', BD: 'Asia/Dhaka', BE: 'Europe/Brussels', BG: 'Europe/Sofia',
  BH: 'Asia/Bahrain', BN: 'Asia/Brunei', BO: 'America/La_Paz', BR: 'America/Sao_Paulo',
  BT: 'Asia/Thimphu', BY: 'Europe/Minsk',
  CA: 'America/Toronto', CH: 'Europe/Zurich', CL: 'America/Santiago', CN: 'Asia/Shanghai',
  CO: 'America/Bogota', CR: 'America/Costa_Rica', CU: 'America/Havana', CY: 'Asia/Nicosia',
  CZ: 'Europe/Prague',
  DE: 'Europe/Berlin', DK: 'Europe/Copenhagen', DO: 'America/Santo_Domingo',
  DZ: 'Africa/Algiers',
  EC: 'America/Guayaquil', EE: 'Europe/Tallinn', EG: 'Africa/Cairo', ES: 'Europe/Madrid',
  ET: 'Africa/Addis_Ababa',
  FI: 'Europe/Helsinki', FJ: 'Pacific/Fiji', FR: 'Europe/Paris',
  GB: 'Europe/London', GE: 'Asia/Tbilisi', GH: 'Africa/Accra', GR: 'Europe/Athens',
  GT: 'America/Guatemala',
  HK: 'Asia/Hong_Kong', HN: 'America/Tegucigalpa', HR: 'Europe/Zagreb', HU: 'Europe/Budapest',
  ID: 'Asia/Jakarta', IE: 'Europe/Dublin', IL: 'Asia/Jerusalem', IN: 'Asia/Kolkata',
  IQ: 'Asia/Baghdad', IR: 'Asia/Tehran', IS: 'Atlantic/Reykjavik', IT: 'Europe/Rome',
  JM: 'America/Jamaica', JO: 'Asia/Amman', JP: 'Asia/Tokyo',
  KE: 'Africa/Nairobi', KG: 'Asia/Bishkek', KH: 'Asia/Phnom_Penh', KR: 'Asia/Seoul',
  KW: 'Asia/Kuwait', KZ: 'Asia/Almaty',
  LA: 'Asia/Vientiane', LB: 'Asia/Beirut', LK: 'Asia/Colombo', LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg', LV: 'Europe/Riga',
  MA: 'Africa/Casablanca', MC: 'Europe/Monaco', MD: 'Europe/Chisinau', ME: 'Europe/Podgorica',
  MK: 'Europe/Skopje', MM: 'Asia/Yangon', MN: 'Asia/Ulaanbaatar', MO: 'Asia/Macau',
  MT: 'Europe/Malta', MU: 'Indian/Mauritius', MV: 'Indian/Maldives', MX: 'America/Mexico_City',
  MY: 'Asia/Kuala_Lumpur', MZ: 'Africa/Maputo',
  NA: 'Africa/Windhoek', NG: 'Africa/Lagos', NL: 'Europe/Amsterdam', NO: 'Europe/Oslo',
  NP: 'Asia/Kathmandu', NZ: 'Pacific/Auckland',
  OM: 'Asia/Muscat',
  PA: 'America/Panama', PE: 'America/Lima', PH: 'Asia/Manila', PK: 'Asia/Karachi',
  PL: 'Europe/Warsaw', PR: 'America/Puerto_Rico', PT: 'Europe/Lisbon', PY: 'America/Asuncion',
  QA: 'Asia/Qatar',
  RO: 'Europe/Bucharest', RS: 'Europe/Belgrade', RU: 'Europe/Moscow',
  SA: 'Asia/Riyadh', SE: 'Europe/Stockholm', SG: 'Asia/Singapore', SI: 'Europe/Ljubljana',
  SK: 'Europe/Bratislava', SN: 'Africa/Dakar', SV: 'America/El_Salvador',
  TH: 'Asia/Bangkok', TJ: 'Asia/Dushanbe', TM: 'Asia/Ashgabat', TN: 'Africa/Tunis',
  TR: 'Europe/Istanbul', TW: 'Asia/Taipei', TZ: 'Africa/Dar_es_Salaam',
  UA: 'Europe/Kyiv', UG: 'Africa/Kampala', US: 'America/New_York', UY: 'America/Montevideo',
  UZ: 'Asia/Tashkent',
  VE: 'America/Caracas', VN: 'Asia/Ho_Chi_Minh',
  ZA: 'Africa/Johannesburg', ZM: 'Africa/Lusaka', ZW: 'Africa/Harare',
};

/** Known IANA zone only — null if we should not guess the phone's timezone. */
export function knownTimeZone(iata?: string, country?: string): string | null {
  const code = String(iata || '').toUpperCase();
  if (code && AIRPORT_TZ[code]) return AIRPORT_TZ[code];
  const cc = String(country || '').toUpperCase();
  if (cc.length === 2 && COUNTRY_TZ[cc]) return COUNTRY_TZ[cc];
  return null;
}

export function timezoneForIata(iata?: string, country?: string): string {
  const known = knownTimeZone(iata, country);
  if (known) return known;
  const code = String(iata || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return 'UTC';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
