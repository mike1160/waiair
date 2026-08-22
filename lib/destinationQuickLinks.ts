import { Linking } from 'react-native';
import { AFFILIATE_MARKER, AFFILIATE_TRS } from './affiliateConfig';
import { isValidAffiliateUrl, globeServiceUrl } from './globeServices';

function klookTpMediaUrl(city?: string): string {
  const c = String(city || '').trim();
  const target = c
    ? `https://www.klook.com/search/?query=${encodeURIComponent(c)}`
    : 'https://www.klook.com/';
  const params = new URLSearchParams({
    campaign_id: '137',
    marker: AFFILIATE_MARKER,
    p: '4110',
    sub_id: 'waiair',
    trs: AFFILIATE_TRS,
    u: target,
  });
  return `https://tp.media/r?${params.toString()}`;
}

/** Klook activities deep link via Travelpayouts affiliate. */
export function klookQuickActionUrl(cityName?: string, destIata?: string): string {
  const city = String(cityName || destIata || '').trim();
  const klookGlobe = globeServiceUrl({ key: 'klook' });
  if (isValidAffiliateUrl(klookGlobe)) return klookGlobe;
  return klookTpMediaUrl(city);
}

function transitAirportLabel(destIata?: string, cityName?: string): string {
  const iata = String(destIata || '').trim().toUpperCase();
  const label = String(cityName || iata || 'destination').trim();
  return iata ? `${iata} Airport` : `${label} airport`;
}

/** Google Maps app deep link — public transport directions to arrival airport. */
export function transitGoogleMapsAppUrl(destIata?: string, cityName?: string): string {
  const daddr = encodeURIComponent(transitAirportLabel(destIata, cityName));
  return `comgooglemaps://?directionsmode=transit&daddr=${daddr}`;
}

/** Web fallback when Google Maps app is not installed. */
export function transitGoogleMapsWebUrl(destIata?: string, cityName?: string): string {
  const q = encodeURIComponent(transitAirportLabel(destIata, cityName));
  return `https://maps.google.com/?q=${q}&dirflg=r`;
}

export async function openTransitQuickAction(destIata?: string, cityName?: string): Promise<void> {
  const appUrl = transitGoogleMapsAppUrl(destIata, cityName);
  const webUrl = transitGoogleMapsWebUrl(destIata, cityName);
  try {
    if (await Linking.canOpenURL(appUrl)) {
      await Linking.openURL(appUrl);
      return;
    }
  } catch { /* fall through */ }
  await Linking.openURL(webUrl);
}
