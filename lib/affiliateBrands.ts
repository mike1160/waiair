/** Visual identity for affiliate tiles — navy/gold shell, brand colour as a thin accent. */

export const TILE_NAVY = '#0A1628';
export const TILE_GOLD = '#C9A84C';
export const TILE_CREAM = '#F4F0E6';

export type AffiliateBrandVisual = {
  logoUri?: string;
  domain?: string;
  color: string;
  textColor: string;
};

const DEFAULT_BRAND: AffiliateBrandVisual = {
  color: TILE_GOLD,
  textColor: TILE_GOLD,
};

function favicon(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`;
}

export const AFFILIATE_BRANDS: Record<string, AffiliateBrandVisual> = {
  airalo: {
    logoUri: 'https://pics.avs.io/200/200/airalo.png',
    domain: 'airalo.com',
    color: '#6B4EFF',
    textColor: TILE_CREAM,
  },
  kiwitaxi: { domain: 'kiwitaxi.com', color: '#FFCC00', textColor: TILE_NAVY },
  gettransfer: { domain: 'gettransfer.com', color: '#00A651', textColor: TILE_CREAM },
  qeeq: { domain: 'qeeq.com', color: '#00B4D8', textColor: TILE_CREAM },
  yesim: { domain: 'yesim.app', color: '#00C4B3', textColor: TILE_NAVY },
  saily: { domain: 'saily.com', color: '#3B2EFF', textColor: TILE_CREAM },
  gigsky: { domain: 'gigsky.com', color: '#00A3E0', textColor: TILE_CREAM },
  kkday: { domain: 'kkday.com', color: '#FF6B00', textColor: TILE_CREAM },
  drimsim: { domain: 'drimsim.com', color: '#E31E24', textColor: TILE_CREAM },
  welcomepickups: { domain: 'welcomepickups.com', color: TILE_GOLD, textColor: TILE_NAVY },
  intui: { domain: 'intui.travel', color: '#2E5BFF', textColor: TILE_CREAM },
  localrent: { domain: 'localrent.com', color: TILE_GOLD, textColor: TILE_NAVY },
  getrentacar: { domain: 'getrentacar.com', color: TILE_GOLD, textColor: TILE_NAVY },
  autoeurope: { domain: 'autoeurope.com', color: TILE_GOLD, textColor: TILE_NAVY },
  autoeuropeeu: { domain: 'autoeurope.eu', color: TILE_GOLD, textColor: TILE_NAVY },
  economybookings: { domain: 'economybookings.com', color: TILE_GOLD, textColor: TILE_NAVY },
  bikesbooking: { domain: 'bikesbooking.com', color: TILE_GOLD, textColor: TILE_NAVY },
  klook: { domain: 'klook.com', color: '#FF5722', textColor: TILE_CREAM },
  tiqets: { domain: 'tiqets.com', color: '#00B67A', textColor: TILE_CREAM },
  getyourguide: { domain: 'getyourguide.com', color: '#FF5533', textColor: TILE_CREAM },
  gocity: { domain: 'gocity.com', color: TILE_GOLD, textColor: TILE_NAVY },
  wegotrip: { domain: 'wegotrip.com', color: TILE_GOLD, textColor: TILE_NAVY },
  uber: { domain: 'uber.com', color: TILE_GOLD, textColor: TILE_NAVY },
  taxi: { color: TILE_GOLD, textColor: TILE_GOLD },
  train: { color: TILE_GOLD, textColor: TILE_GOLD },
  bus: { color: TILE_GOLD, textColor: TILE_GOLD },
  grab: { domain: 'grab.com', color: '#00B14F', textColor: TILE_CREAM },
  bolt: { domain: 'bolt.eu', color: TILE_GOLD, textColor: TILE_NAVY },
  indrive: { domain: 'indrive.com', color: TILE_GOLD, textColor: TILE_NAVY },
  agoda: { domain: 'agoda.com', color: TILE_GOLD, textColor: TILE_NAVY },
  booking: { domain: 'booking.com', color: TILE_GOLD, textColor: TILE_NAVY },
  airbnb: { domain: 'airbnb.com', color: TILE_GOLD, textColor: TILE_NAVY },
  foodpanda: { domain: 'foodpanda.com', color: TILE_GOLD, textColor: TILE_NAVY },
  ubereats: { domain: 'ubereats.com', color: TILE_GOLD, textColor: TILE_NAVY },
  ekta: { domain: 'ektatraveling.com', color: TILE_GOLD, textColor: TILE_NAVY },
  safetywing: { domain: 'safetywing.com', color: TILE_GOLD, textColor: TILE_NAVY },
  airhelp: { domain: 'airhelp.com', color: TILE_GOLD, textColor: TILE_NAVY },
  compensair: { domain: 'compensair.com', color: TILE_GOLD, textColor: TILE_NAVY },
};

export function brandVisual(key: string): AffiliateBrandVisual {
  return AFFILIATE_BRANDS[key] || DEFAULT_BRAND;
}

export function brandFields(key: string): {
  logoUri?: string;
  brandColor: string;
  brandTextColor: string;
} {
  const v = brandVisual(key);
  const logoUri = v.logoUri || (v.domain ? favicon(v.domain) : undefined);
  return {
    logoUri,
    brandColor: v.color,
    brandTextColor: v.textColor,
  };
}
