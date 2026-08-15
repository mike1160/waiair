export type DelayOutlook = {
  airline: string;
  onTimePercent: number;
  avgDelayWhenLate: number;
  source: 'historical' | 'airline';
};

const AIRLINE_ON_TIME: Record<string, { name: string; pct: number; lateAvg: number }> = {
  TG: { name: 'Thai Airways', pct: 82, lateAvg: 14 },
  FD: { name: 'Thai AirAsia', pct: 71, lateAvg: 18 },
  AK: { name: 'AirAsia', pct: 71, lateAvg: 18 },
  QZ: { name: 'Indonesia AirAsia', pct: 71, lateAvg: 18 },
  D7: { name: 'AirAsia X', pct: 70, lateAvg: 22 },
  PG: { name: 'Bangkok Airways', pct: 88, lateAvg: 11 },
  VJ: { name: 'VietJet', pct: 68, lateAvg: 22 },
  VN: { name: 'Vietnam Airlines', pct: 76, lateAvg: 16 },
  MH: { name: 'Malaysia Airlines', pct: 79, lateAvg: 15 },
  SQ: { name: 'Singapore Airlines', pct: 86, lateAvg: 12 },
  GA: { name: 'Garuda Indonesia', pct: 77, lateAvg: 16 },
  PR: { name: 'Philippine Airlines', pct: 74, lateAvg: 18 },
  '5J': { name: 'Cebu Pacific', pct: 69, lateAvg: 21 },
  CX: { name: 'Cathay Pacific', pct: 83, lateAvg: 13 },
  EK: { name: 'Emirates', pct: 80, lateAvg: 15 },
  QR: { name: 'Qatar Airways', pct: 84, lateAvg: 12 },
  KL: { name: 'KLM', pct: 78, lateAvg: 16 },
  LH: { name: 'Lufthansa', pct: 76, lateAvg: 17 },
  BA: { name: 'British Airways', pct: 75, lateAvg: 18 },
};

function airlineCode(raw?: string): string {
  return String(raw || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
}

export function airlineOutlook(code?: string, name?: string): DelayOutlook | null {
  const iata = airlineCode(code);
  const hit = AIRLINE_ON_TIME[iata];
  if (hit) {
    return {
      airline: hit.name,
      onTimePercent: hit.pct,
      avgDelayWhenLate: hit.lateAvg,
      source: 'airline',
    };
  }
  if (!iata) return null;
  return {
    airline: name || iata,
    onTimePercent: 75,
    avgDelayWhenLate: 16,
    source: 'airline',
  };
}

export function weekdayPart(iso?: string): { weekday: string; part: string } {
  const d = iso ? new Date(iso) : new Date();
  const weekday = Number.isNaN(d.getTime())
    ? 'today'
    : d.toLocaleDateString('en-GB', { weekday: 'long' });
  const h = Number.isNaN(d.getTime()) ? 12 : d.getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return { weekday, part };
}
