export type DeepLinkAction =
  | { kind: 'myflights' }
  | { kind: 'scan' }
  | { kind: 'departures' }
  | { kind: 'search' };

export function parseWaiAirLink(url?: string | null): DeepLinkAction | null {
  if (!url) return null;
  const raw = String(url);
  const lower = raw.toLowerCase();
  if (!/waiair:\/\//.test(lower) && !lower.includes('waiair.app')) return null;
  if (lower.includes('scan') || lower.includes('boarding')) return { kind: 'scan' };
  if (lower.includes('depart')) return { kind: 'departures' };
  if (lower.includes('search') || lower.includes('track')) return { kind: 'search' };
  if (lower.includes('my-flights') || lower.includes('myflights') || lower.includes('status')) {
    return { kind: 'myflights' };
  }
  return { kind: 'myflights' };
}
