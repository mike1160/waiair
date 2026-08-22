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

const TRANSIT_BY_IATA: Record<string, string> = {
  BKK: 'https://suvarnabhumi.airportthai.co.th/service/transportation',
  DMK: 'https://donmueang.airportthai.co.th/service/transportation',
  SIN: 'https://www.changiairport.com/en/at-changi/getting-around.html',
  KUL: 'https://www.klia.com.my/en/flights/transport-and-parking',
  HKG: 'https://www.hongkongairport.com/en/transport/',
  DXB: 'https://www.dubaiairports.ae/at-the-airport/transport-and-parking',
  PNH: 'https://www.google.com/maps/dir/?api=1&destination=Phnom+Penh+International+Airport&travelmode=transit',
};

/** Local transit authority or Google Maps transit search. */
export function transitQuickActionUrl(destIata?: string, cityName?: string): string {
  const iata = String(destIata || '').trim().toUpperCase();
  if (iata && TRANSIT_BY_IATA[iata]) return TRANSIT_BY_IATA[iata];
  const label = String(cityName || iata || 'destination').trim();
  const airport = iata ? `${iata} Airport` : `${label} airport`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(airport)}&travelmode=transit`;
}
