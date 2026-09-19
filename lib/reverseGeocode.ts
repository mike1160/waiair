/**
 * Place name for a weather station's coordinates.
 * Open-Meteo has no reverse geocoding (its /v1/reverse is a 404), so the station name was always empty.
 * BigDataCloud's client endpoint is free, needs no key, and is meant to be called straight from an app.
 */

export function reverseGeocodeUrl(lat: number, lon: number, language = 'en'): string {
  const lang = /^[a-z]{2}$/.test(language) ? language : 'en';
  return 'https://api.bigdatacloud.net/data/reverse-geocode-client'
    + `?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`;
}

export type ReversePlace = { name: string; region?: string };

function clean(raw: unknown): string {
  return String(raw ?? '').trim();
}

/** The response → the station's name and region; an empty name when the coordinates are nowhere named. */
export function parseReverseGeocode(body: unknown): ReversePlace {
  if (!body || typeof body !== 'object') return { name: '' };
  const b = body as Record<string, unknown>;
  const name = clean(b.city) || clean(b.locality);
  const region = [clean(b.principalSubdivision), clean(b.countryName)].filter(Boolean).join(', ');
  return { name, region: region || undefined };
}
