import { PET_RULES } from './petRules';
import { AnimalType, PetCheckResult, CabinResult } from '../../types/pet';

const AIRLINE_NAMES: Record<string, string> = {
  TG: 'Thai Airways',
  KL: 'KLM',
  LH: 'Lufthansa',
  SQ: 'Singapore Airlines',
  EK: 'Emirates',
  QR: 'Qatar Airways',
  EY: 'Etihad Airways',
  FD: 'AirAsia',
  BA: 'British Airways',
  VS: 'Virgin Atlantic',
  AF: 'Air France',
  IB: 'Iberia',
  AZ: 'ITA Airways',
  SK: 'SAS',
  OS: 'Austrian Airlines',
  LX: 'SWISS',
  TP: 'TAP Portugal',
  VY: 'Vueling',
  FR: 'Ryanair',
  U2: 'easyJet',
  TK: 'Turkish Airlines',
  HV: 'Transavia',
  PC: 'Pegasus',
  DY: 'Norwegian',
  W6: 'Wizz Air',
  SN: 'Brussels Airlines',
  LO: 'LOT Polish Airlines',
  OK: 'Czech Airlines',
  BT: 'airBaltic',
  AY: 'Finnair',
  EI: 'Aer Lingus',
  VK: 'Viking Air',
  A3: 'Aegean Airlines',
  OA: 'Olympic Air',
  RO: 'TAROM',
  FB: 'Bulgaria Air',
  JU: 'Air Serbia',
  OU: 'Croatia Airlines',
  EW: 'Eurowings',
  DE: 'Condor',
  X3: 'TUI fly Germany',
  OR: 'TUI fly Netherlands',
  PS: 'Ukraine International Airlines',
  SU: 'Aeroflot',
  MS: 'EgyptAir',
  GF: 'Gulf Air',
  WY: 'Oman Air',
  ME: 'Middle East Airlines',
  FZ: 'flydubai',
  G9: 'Air Arabia',
  MH: 'Malaysia Airlines',
  GA: 'Garuda Indonesia',
  PR: 'Philippine Airlines',
  VN: 'Vietnam Airlines',
  AK: 'AirAsia',
  QZ: 'AirAsia Indonesia',
  SL: 'Thai Lion Air',
  VZ: 'Thai Vietjet',
  PG: 'Bangkok Airways',
  DD: 'Nok Air',
  QV: 'Lao Airlines',
  UB: 'Myanmar National Airlines',
  BI: 'Royal Brunei',
  CX: 'Cathay Pacific',
  JL: 'Japan Airlines',
  NH: 'ANA',
  KE: 'Korean Air',
  OZ: 'Asiana Airlines',
  CA: 'Air China',
  MU: 'China Eastern',
  CZ: 'China Southern',
  BR: 'EVA Air',
  CI: 'China Airlines',
  HX: 'Hong Kong Airlines',
  AI: 'Air India',
  UK: 'Air India',
  PK: 'Pakistan International Airlines',
  UL: 'SriLankan Airlines',
  BG: 'Biman Bangladesh',
  QF: 'Qantas',
  NZ: 'Air New Zealand',
  VA: 'Virgin Australia',
  FJ: 'Fiji Airways',
  AA: 'American Airlines',
  UA: 'United Airlines',
  DL: 'Delta Air Lines',
  WN: 'Southwest Airlines',
  AS: 'Alaska Airlines',
  B6: 'JetBlue',
  AC: 'Air Canada',
  WS: 'WestJet',
  F9: 'Frontier Airlines',
  NK: 'Spirit Airlines',
  G4: 'Allegiant Air',
  SY: 'Sun Country Airlines',
  HA: 'Hawaiian Airlines',
  '3M': 'Silver Airways',
  KS: 'Peninsula Airways',
  PD: 'Porter Airlines',
  TS: 'Air Transat',
  LA: 'LATAM Airlines',
  JJ: 'LATAM Brasil',
  G3: 'GOL',
  AD: 'Azul',
  AR: 'Aerolíneas Argentinas',
  CM: 'Copa Airlines',
  AV: 'Avianca',
  AM: 'Aeroméxico',
  Y4: 'Volaris',
  BW: 'Caribbean Airlines',
  WM: 'Winair',
  '8J': 'Jet Vacations',
  ET: 'Ethiopian Airlines',
  SA: 'South African Airways',
  KQ: 'Kenya Airways',
  AT: 'Royal Air Maroc',
};

export function checkPet(
  airlineIata: string,
  animal: AnimalType,
  weightKg?: number,
  isBrachycephalic?: boolean,
): PetCheckResult | null {
  const rule = PET_RULES.find(r => r.airlineIata === airlineIata);

  if (!rule) return null;

  const animalOk = rule.animalTypes.includes(animal);
  const brachyBlocked = isBrachycephalic && rule.brachycephalicBanned;

  const cabinOk =
    animalOk &&
    rule.cabinAllowed &&
    !brachyBlocked &&
    (!weightKg || !rule.maxWeightCabin || weightKg <= rule.maxWeightCabin);

  const holdOk =
    animalOk &&
    rule.holdAllowed &&
    !brachyBlocked;

  let allowed: CabinResult = 'not_allowed';
  if (cabinOk) allowed = 'cabin';
  else if (holdOk) allowed = 'hold';
  if (!animalOk) allowed = 'not_allowed';

  return {
    allowed,
    airlineName: AIRLINE_NAMES[airlineIata] ?? airlineIata,
    flightNumber: '',
    animal,
    requirements: rule.requirements,
    warnings: rule.warnings,
    lastVerified: rule.lastVerified,
    sourceUrl: rule.sourceUrl,
  };
}
