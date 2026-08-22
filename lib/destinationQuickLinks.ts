import { agodaAffiliateUrl, bookingAffiliateUrl } from './affiliateConfig';
import { isValidAffiliateUrl, globeServiceUrl } from './globeServices';

/** Hotel deep link — Agoda affiliate first, then Booking.com, then Agoda city search. */
export function hotelQuickActionUrl(cityName?: string, destIata?: string): string {
  const city = String(cityName || destIata || '').trim();
  const agodaGlobe = globeServiceUrl({ key: 'agoda' });
  if (isValidAffiliateUrl(agodaGlobe)) return agodaGlobe;
  const agoda = agodaAffiliateUrl(city);
  if (isValidAffiliateUrl(agoda)) return agoda;
  const booking = bookingAffiliateUrl(city);
  if (isValidAffiliateUrl(booking)) return booking;
  if (city) {
    return `https://www.agoda.com/search?city=${encodeURIComponent(city)}`;
  }
  return 'https://www.agoda.com';
}

const TRANSIT_BY_IATA: Record<string, string> = {
  BKK: 'https://www.bts.co.th',
  DMK: 'https://www.bts.co.th',
  SIN: 'https://www.transitlink.com.sg',
  KUL: 'https://www.myrapid.com.my',
  HKG: 'https://www.mtr.com.hk',
};

/** Local transit authority or Google Maps transit search. */
export function transitQuickActionUrl(destIata?: string, cityName?: string): string {
  const iata = String(destIata || '').trim().toUpperCase();
  if (iata && TRANSIT_BY_IATA[iata]) return TRANSIT_BY_IATA[iata];
  const label = String(cityName || iata || 'destination').trim();
  return `https://www.google.com/maps/search/${encodeURIComponent(`transit ${label}`)}`;
}
