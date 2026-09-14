/** Destination background photos (proxy /photos/destination/:iata) — pure helpers, no React Native imports. */

/** AsyncStorage key of the Settings toggle "Destination backgrounds". */
export const DESTINATION_BACKGROUNDS_KEY = 'destination_backgrounds_enabled';

export type DestinationPhoto = {
  url: string;
  photographer: string;
  photographerUrl: string;
};

/** Stored toggle value → enabled. Default ON: only an explicit "false" turns it off. */
export function parseDestinationBackgroundsEnabled(raw: string | null | undefined): boolean {
  return raw !== 'false';
}

/** A usable 3-letter arrival IATA code for the photo lookup, else ''. */
export function destinationPhotoIata(code?: string | null): string {
  const c = String(code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : '';
}

/** Proxy JSON → photo; null for null or anything without an https image URL (then the sky theme stays). */
export function toDestinationPhoto(json: unknown): DestinationPhoto | null {
  const j = json as Partial<DestinationPhoto> | null;
  if (!j || typeof j.url !== 'string' || !/^https:\/\//.test(j.url)) return null;
  return {
    url: j.url,
    photographer: typeof j.photographer === 'string' ? j.photographer : '',
    photographerUrl: typeof j.photographerUrl === 'string' ? j.photographerUrl : '',
  };
}
