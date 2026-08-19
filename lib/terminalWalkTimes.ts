export type TerminalWalk = {
  from: string;
  to: string;
  minutes: number;
  notes?: string;
};

export type AirportWalkData = {
  walks: TerminalWalk[];
  notes?: string;
};

export type AirportWalkTimes = {
  [iata: string]: AirportWalkData;
};

function w(from: string, to: string, minutes: number, notes?: string): TerminalWalk {
  return { from, to, minutes, notes };
}

function both(a: string, b: string, minutes: number, notes?: string): TerminalWalk[] {
  return [w(a, b, minutes, notes), w(b, a, minutes, notes)];
}

function single(notes: string): AirportWalkData {
  return { walks: [], notes };
}

function hub(...walks: TerminalWalk[]): AirportWalkData {
  return { walks };
}

/** Normalize terminal codes: T1, 1, Terminal 1 → T1; D → D */
export function normalizeTerminalCode(terminal?: string): string {
  const raw = String(terminal || '').trim();
  if (!raw || raw === '—' || /^(-|–|n\/?a|tba|tbd)$/i.test(raw)) return '';
  const body = raw.replace(/^terminal\s+/i, '').replace(/\s+/g, '');
  if (!body) return '';
  if (/^t\d+[a-z]?$/i.test(body)) return body.toUpperCase();
  if (/^\d+[a-z]?$/i.test(body)) return `T${body.toUpperCase()}`;
  if (/^[A-Z]{1,2}$/i.test(body)) return body.toUpperCase();
  if (/^satellite\s*([a-g])$/i.test(body)) return `SAT${RegExp.$1?.toUpperCase() || body.slice(-1).toUpperCase()}`;
  return body.toUpperCase();
}

const DATA: AirportWalkTimes = {
  BKK: hub(
    ...both('T1', 'T2', 25, 'free shuttle bus between terminals'),
    ...both('T1', 'SATC', 12, 'walk via concourse C'),
    ...both('T1', 'SATD', 14),
    ...both('T1', 'SATE', 16),
    ...both('T1', 'SATF', 18),
    ...both('T1', 'SATG', 20),
    ...both('SATC', 'SATD', 8),
    ...both('SATD', 'SATE', 8),
    ...both('SATE', 'SATF', 8),
    ...both('SATF', 'SATG', 8),
  ),
  DMK: hub(...both('T1', 'T2', 10, 'covered walkway')),
  HKT: hub(...both('T1', 'T2', 7, 'domestic ↔ international')),
  CNX: single('Single terminal — max 10 min gate-to-gate'),
  KBV: single('Single terminal — max 8 min gate-to-gate'),
  USM: single('Single terminal — max 8 min gate-to-gate'),
  HDY: single('Single terminal — max 10 min gate-to-gate'),
  UTH: single('Single terminal — max 8 min gate-to-gate'),
  UBP: single('Single terminal — max 8 min gate-to-gate'),

  DXB: hub(
    ...both('T1', 'T2', 25, 'metro / shuttle'),
    ...both('T1', 'T3', 20, 'metro'),
    ...both('T2', 'T3', 15, 'metro'),
    ...both('T3', 'CONCOURSED', 12),
    ...both('T3', 'CONCOURSEA', 10),
    ...both('T3', 'CONCOURSEB', 10),
    ...both('T3', 'CONCOURSEC', 12),
  ),
  AUH: hub(
    ...both('T1', 'T3', 18, 'walk via airside connection'),
    ...both('T1', 'TA', 8),
    ...both('TA', 'TB', 10),
    ...both('TB', 'TC', 10),
  ),
  DOH: hub(
    ...both('CONCOURSEA', 'CONCOURSEB', 15),
    ...both('CONCOURSEA', 'CONCOURSEC', 20),
    ...both('CONCOURSEB', 'CONCOURSEC', 18),
    ...both('CONCOURSED', 'CONCOURSEB', 12),
    ...both('CONCOURSED', 'CONCOURSEA', 15),
  ),
  RUH: hub(
    ...both('T1', 'T2', 20, 'shuttle bus'),
    ...both('T1', 'T3', 22),
    ...both('T2', 'T3', 18),
    ...both('T1', 'T4', 25),
    ...both('T2', 'T4', 22),
  ),
  KWI: hub(...both('T1', 'T2', 12, 'walk via airside bridge'), ...both('T1', 'T4', 15)),

  BOM: hub(
    ...both('T1', 'T2', 18, 'domestic ↔ international shuttle'),
    ...both('T2', 'T3', 15),
    ...both('T1', 'T3', 22),
  ),
  DEL: hub(
    ...both('T1', 'T2', 20, 'metro / shuttle'),
    ...both('T2', 'T3', 18),
    ...both('T1', 'T3', 25),
  ),
  BLR: hub(...both('T1', 'T2', 15, 'walk via airside corridor')),
  CMB: hub(...both('T1', 'T2', 10), ...both('T1', 'T3', 12)),
  KTM: single('Single terminal — max 12 min gate-to-gate'),
  DAC: hub(...both('T1', 'T2', 12)),

  PEK: hub(
    ...both('T2', 'T3', 20, 'shuttle train'),
    ...both('T3', 'T3C', 10),
    ...both('T2', 'T3C', 22),
  ),
  PKX: single('Single terminal — max 15 min gate-to-gate'),
  PVG: hub(
    ...both('T1', 'T2', 25, 'shuttle train / metro'),
    ...both('T1', 'S1', 12, 'Satellite S1'),
    ...both('T2', 'S2', 12, 'Satellite S2'),
    ...both('S1', 'S2', 30, 'inter-terminal train required'),
  ),
  SHA: hub(...both('T1', 'T2', 15)),
  CAN: hub(
    ...both('T1', 'T2', 18),
    ...both('T1', 'T3', 20),
    ...both('T2', 'T3', 15),
  ),
  SZX: single('Single terminal — max 12 min gate-to-gate'),
  CTU: hub(...both('T1', 'T2', 15)),
  HKG: hub(
    ...both('T1', 'T2', 12, 'automated people mover'),
    ...both('T1', 'MIDFIELD', 10),
    ...both('T2', 'MIDFIELD', 10),
  ),
  MFM: single('Single terminal — max 10 min gate-to-gate'),

  SIN: hub(
    ...both('T1', 'T2', 15),
    ...both('T2', 'T3', 10),
    ...both('T1', 'T3', 18),
    ...both('T3', 'T4', 28, 'shuttle train required'),
    ...both('T2', 'T4', 30, 'shuttle train required'),
    ...both('T1', 'T4', 32, 'shuttle train required'),
  ),
  KUL: hub(
    ...both('MAIN', 'KLIA2', 20, 'KLIA Ekspres / shuttle'),
    ...both('G', 'H', 8),
    ...both('H', 'J', 8),
    ...both('J', 'K', 8),
    ...both('K', 'L', 8),
    ...both('L', 'M', 8),
    ...both('M', 'P', 10),
    ...both('P', 'Q', 8),
  ),
  CGK: hub(
    ...both('T1', 'T2', 15),
    ...both('T2', 'T3', 12),
    ...both('T1', 'T3', 20),
  ),
  MNL: hub(
    ...both('T1', 'T2', 18),
    ...both('T2', 'T3', 15),
    ...both('T1', 'T3', 25),
  ),
  DPS: hub(...both('D', 'I', 12, 'domestic ↔ international')),
  SUB: hub(...both('T1', 'T2', 10)),
  SGN: hub(...both('T1', 'T2', 10)),
  HAN: hub(...both('T1', 'T2', 12)),
  DAD: hub(...both('T1', 'T2', 10)),
  PNH: single('Single terminal — max 10 min gate-to-gate'),
  REP: single('Single terminal — max 8 min gate-to-gate'),
  RGN: single('Single terminal — max 10 min gate-to-gate'),
  VTE: single('Single terminal — max 8 min gate-to-gate'),

  LHR: hub(
    ...both('T2', 'T3', 15),
    ...both('T3', 'T4', 18),
    ...both('T2', 'T4', 22),
    ...both('T4', 'T5', 20, 'Heathrow Express / shuttle'),
    ...both('T2', 'T5', 25),
    ...both('T3', 'T5', 22),
    ...both('T5A', 'T5B', 8),
    ...both('T5B', 'T5C', 10),
  ),
  AMS: hub(
    ...both('T1', 'T2', 12),
    ...both('T2', 'T3', 10),
    ...both('T1', 'T3', 18),
    ...both('D', 'E', 8),
    ...both('E', 'F', 8),
    ...both('F', 'G', 10),
    ...both('G', 'H', 10),
    ...both('H', 'M', 12),
  ),
  FRA: hub(
    ...both('T1', 'T2', 15),
    ...both('T1', 'T3', 18),
    ...both('T2', 'T3', 12),
    ...both('T1', 'A', 10),
    ...both('T1', 'B', 12),
    ...both('T1', 'C', 14),
    ...both('T1', 'Z', 16),
  ),
  CDG: hub(
    ...both('T1', 'T2', 20, 'CDGVAL train'),
    ...both('T2A', 'T2B', 10),
    ...both('T2B', 'T2C', 10),
    ...both('T2C', 'T2D', 12),
    ...both('T2D', 'T2E', 12),
    ...both('T2E', 'T2F', 10),
    ...both('T2', 'T3', 18),
  ),
  LGW: hub(...both('N', 'S', 15, 'monorail shuttle')),
  STN: single('Single terminal — max 12 min gate-to-gate'),
  LCY: single('Single terminal — max 8 min gate-to-gate'),
  BCN: hub(...both('T1', 'T2', 12)),
  MAD: hub(
    ...both('T1', 'T2', 15),
    ...both('T2', 'T3', 12),
    ...both('T1', 'T4', 18, 'T4 satellite — train'),
    ...both('T4', 'T4S', 10),
  ),
  FCO: hub(
    ...both('T1', 'T3', 15),
    ...both('T1', 'T2', 12),
    ...both('T2', 'T3', 10),
  ),
  MXP: hub(...both('T1', 'T2', 12)),
  MUC: hub(
    ...both('T1', 'T2', 15),
    ...both('T1', 'T1A', 8),
    ...both('T1', 'T1B', 10),
    ...both('T1B', 'T2', 12),
  ),
  ZRH: hub(...both('A', 'B', 10), ...both('A', 'E', 12)),
  VIE: hub(...both('T1', 'T3', 12)),
  BRU: hub(...both('A', 'B', 10)),
  IST: hub(
    ...both('D', 'E', 15),
    ...both('E', 'F', 15),
    ...both('D', 'F', 25),
    ...both('G', 'F', 18),
    ...both('D', 'G', 30, 'shuttle may be required'),
  ),
  SAW: single('Single terminal — max 12 min gate-to-gate'),
  ATH: hub(...both('MAIN', 'SATELLITE', 12)),
  CPH: hub(...both('T2', 'T3', 10)),
  ARN: hub(...both('T2', 'T5', 15), ...both('T3', 'T4', 12)),
  OSL: hub(...both('D', 'E', 10), ...both('E', 'F', 10)),
  HEL: single('Single terminal — max 10 min gate-to-gate'),
  WAW: hub(...both('T1', 'T2', 12)),
  PRG: hub(...both('T1', 'T2', 10)),
  BUD: hub(...both('T2A', 'T2B', 10)),

  JFK: hub(
    ...both('T1', 'T2', 20, 'AirTrain required'),
    ...both('T2', 'T4', 18),
    ...both('T4', 'T5', 15),
    ...both('T5', 'T7', 18),
    ...both('T7', 'T8', 12),
    ...both('T1', 'T4', 22),
    ...both('T4', 'T8', 20),
  ),
  LAX: hub(
    ...both('T1', 'T2', 18),
    ...both('T2', 'T3', 15),
    ...both('T3', 'T4', 12),
    ...both('T4', 'T5', 15),
    ...both('T5', 'T6', 12),
    ...both('T6', 'T7', 10),
    ...both('T7', 'T8', 12),
    ...both('TBIT', 'T4', 15),
  ),
  YYZ: hub(
    ...both('T1', 'T3', 15),
    ...both('T1', 'T2', 18),
    ...both('T2', 'T3', 12),
  ),

  SYD: hub(
    ...both('T1', 'T2', 15),
    ...both('T1', 'T3', 18),
    ...both('T2', 'T3', 12),
  ),
  MEL: hub(
    ...both('T1', 'T2', 15),
    ...both('T2', 'T3', 12),
    ...both('T1', 'T4', 18),
  ),

  NRT: hub(
    ...both('T1', 'T2', 15),
    ...both('T1', 'T3', 20, 'shuttle bus'),
    ...both('T2', 'T3', 18),
  ),
  HND: hub(
    ...both('T1', 'T2', 12),
    ...both('T2', 'T3', 10),
  ),

  ICN: hub(
    ...both('T1', 'T2', 15, 'shuttle train'),
    ...both('T1', 'CONCOURSEA', 10),
    ...both('T2', 'CONCOURSEM', 10),
  ),

  TPE: hub(...both('T1', 'T2', 12)),
};

export const AIRPORT_TERMINAL_WALKS: AirportWalkTimes = DATA;

function lookupWalk(
  airport: AirportWalkData,
  from: string,
  to: string,
): TerminalWalk | undefined {
  return airport.walks.find(
    walk =>
      (normalizeTerminalCode(walk.from) === from && normalizeTerminalCode(walk.to) === to)
      || (normalizeTerminalCode(walk.from) === to && normalizeTerminalCode(walk.to) === from),
  );
}

export function getTerminalWalkTime(
  iata: string,
  fromTerminal: string,
  toTerminal: string,
): { minutes: number; notes?: string } | null {
  const code = String(iata || '').trim().toUpperCase();
  const from = normalizeTerminalCode(fromTerminal);
  const to = normalizeTerminalCode(toTerminal);
  if (!code || !from || !to) return null;
  if (from === to) return { minutes: 0 };

  const airport = DATA[code];
  if (!airport) return null;

  const hit = lookupWalk(airport, from, to);
  if (hit) {
    return { minutes: hit.minutes, notes: hit.notes };
  }

  if (airport.walks.length === 0 && airport.notes) {
    return { minutes: 10, notes: airport.notes };
  }

  return null;
}

export function hasTerminalChange(fromTerminal?: string, toTerminal?: string): boolean {
  const from = normalizeTerminalCode(fromTerminal);
  const to = normalizeTerminalCode(toTerminal);
  return !!(from && to && from !== to);
}
