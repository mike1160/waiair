/** Collapse FIDS/API airline names and map known aliases to a display name. */

const BY_IATA: Record<string, string> = {
  TG: 'Thai Airways',
};

const BY_NAME: Record<string, string> = {
  'thai international': 'Thai Airways',
  'thai international airways': 'Thai Airways',
  'thai intl': 'Thai Airways',
  'thai airways international': 'Thai Airways',
  'thai airways': 'Thai Airways',
};

export function collapseAirlineName(raw?: string | null): string {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

export function normalizeAirlineName(name?: string | null, iata?: string | null): string {
  const code = String(iata || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (code && BY_IATA[code]) return BY_IATA[code];
  const collapsed = collapseAirlineName(name);
  if (!collapsed) return code || '—';
  const alias = BY_NAME[collapsed.toLowerCase()];
  if (alias) return alias;
  return collapsed;
}
