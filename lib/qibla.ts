/** Qibla bearing toward Mecca, clockwise from north (0–360). */

export const MECCA_LAT = 21.4225;
export const MECCA_LON = 39.8262;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function calculateQibla(lat: number, lon: number): number {
  const dLon = toRad(MECCA_LON - lon);
  const latRad = toRad(lat);
  const meccaLat = toRad(MECCA_LAT);
  const x = Math.sin(dLon) * Math.cos(meccaLat);
  const y = Math.cos(latRad) * Math.sin(meccaLat)
        - Math.sin(latRad) * Math.cos(meccaLat)
        * Math.cos(dLon);
  const bearing = (toDeg(Math.atan2(x, y)) + 360) % 360;
  return Number.isFinite(bearing) ? bearing : 0;
}
