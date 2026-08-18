export type DeepLinkAction =
  | { kind: 'myflights' }
  | { kind: 'scan' }
  | { kind: 'departures' }
  | { kind: 'search' }
  | { kind: 'together'; code: string };

export function parseWaiAirLink(url?: string | null): DeepLinkAction | null {
  if (!url) return null;
  const raw = String(url);
  const lower = raw.toLowerCase();
  if (!/waiair:\/\//.test(lower) && !lower.includes('waiair.app')) return null;
  const togetherMatch = raw.match(/\/together\/([A-Z0-9]{6})/i) || raw.match(/together[/?=]([A-Z0-9]{6})/i);
  if (togetherMatch) return { kind: 'together', code: togetherMatch[1].toUpperCase() };
  if (lower.includes('scan') || lower.includes('boarding')) return { kind: 'scan' };
  if (lower.includes('depart')) return { kind: 'departures' };
  if (lower.includes('search') || lower.includes('track')) return { kind: 'search' };
  if (lower.includes('my-flights') || lower.includes('myflights') || lower.includes('status')) {
    return { kind: 'myflights' };
  }
  return { kind: 'myflights' };
}
