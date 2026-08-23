/** Shared flight-map SVG world backdrop (viewBox 0 0 320 70). */
export const FLIGHT_MAP_VIEW_W = 320;
export const FLIGHT_MAP_VIEW_H = 70;

export const FLIGHT_MAP_OCEAN = '#1a2a35';
export const FLIGHT_MAP_OCEAN_TOP = '#243848';
export const FLIGHT_MAP_LAND_FILL = '#364959';
export const FLIGHT_MAP_LAND_STROKE = '#4d6478';
export const FLIGHT_MAP_GRATICULE = 'rgba(255,255,255,0.11)';

/** Simplified continent silhouettes — equirectangular, tuned for 320×70. */
export const FLIGHT_MAP_CONTINENTS = [
  // North America
  'M 6,20 L 16,13 L 34,11 L 52,15 L 62,24 L 58,34 L 48,30 L 38,26 L 26,28 L 14,32 L 8,26 Z',
  // Central America + Caribbean
  'M 48,32 L 56,30 L 60,36 L 54,40 L 48,38 Z',
  // South America
  'M 34,36 L 46,34 L 56,40 L 60,50 L 58,62 L 48,66 L 38,62 L 32,52 L 30,42 Z',
  // Europe
  'M 124,16 L 140,13 L 158,15 L 168,22 L 162,28 L 146,26 L 128,22 Z',
  // Africa
  'M 144,28 L 162,26 L 174,32 L 180,44 L 176,58 L 164,64 L 152,58 L 146,46 L 142,36 Z',
  // Asia
  'M 166,12 L 204,10 L 248,14 L 284,20 L 292,28 L 280,36 L 240,34 L 198,30 L 168,26 L 158,18 Z',
  // Southeast Asia / Indonesia
  'M 248,36 L 272,34 L 280,40 L 268,44 L 252,42 Z',
  // Australia
  'M 252,46 L 274,44 L 284,50 L 280,58 L 262,60 L 250,54 Z',
  // Greenland
  'M 72,8 L 88,6 L 94,14 L 84,18 L 72,14 Z',
] as const;

/** Latitude / longitude guide lines. */
export const FLIGHT_MAP_GRATICULES = [
  'M 0 17 H 320',
  'M 0 35 H 320',
  'M 0 53 H 320',
  'M 64 0 V 70',
  'M 128 0 V 70',
  'M 192 0 V 70',
  'M 256 0 V 70',
] as const;

export const FLIGHT_MAP_ARC = 'M 20,60 Q 160,10 300,60';

export const FLIGHT_MAP_ARC_START = { x: 20, y: 60 };
export const FLIGHT_MAP_ARC_END = { x: 300, y: 60 };
