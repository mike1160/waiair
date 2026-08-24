import {
  airlineCodeFromFlight,
  airlineColor,
  airlineInitials,
  normalizeAirlineCode,
} from '../AirlineLogo';
import { airlineLogoUrl } from './aviasales';
import { cacheDirectory, downloadAsync, getInfoAsync } from 'expo-file-system/legacy';

const uriCache = new Map<string, string>();

const FALLBACK_LOGO_URLS = (code: string) => [
  airlineLogoUrl(code),
  `https://content.airhex.com/content/logos/airlines_${code}_100_100_s.png`,
  `https://images.kiwi.com/airlines/64/${code}.png`,
];

export async function cacheAirlineLogoUri(codeRaw?: string): Promise<string> {
  const code = normalizeAirlineCode(codeRaw);
  if (!code || !cacheDirectory) return '';

  const cached = uriCache.get(code);
  if (cached) {
    const info = await getInfoAsync(cached);
    if (info.exists) return cached;
    uriCache.delete(code);
  }

  const dest = `${cacheDirectory}waiair-la-${code}.png`;
  try {
    const existing = await getInfoAsync(dest);
    if (existing.exists) {
      uriCache.set(code, dest);
      return dest;
    }
    for (const url of FALLBACK_LOGO_URLS(code)) {
      try {
        const result = await downloadAsync(url, dest);
        if (result.status >= 200 && result.status < 300) {
          uriCache.set(code, result.uri);
          return result.uri;
        }
      } catch {
        /* try next CDN */
      }
    }
  } catch {
    /* no logo on disk */
  }
  return '';
}

export function airlineLogoMeta(f: {
  number?: string;
  airlineCode?: string;
  airline?: string;
}) {
  const airlineIata = normalizeAirlineCode(f.airlineCode || airlineCodeFromFlight(f.number));
  return {
    airlineIata,
    airlineInitials: airlineInitials(airlineIata, f.airline),
    airlineLogoColor: airlineColor(airlineIata),
  };
}
