/** Interpolate a live aircraft between AeroDataBox position updates. */

export type LatLng = { latitude: number; longitude: number };
export type MapPosition = LatLng & { heading: number };

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function toDeg(r: number) {
  return (r * 180) / Math.PI;
}

export function validCoord(lat?: number | null, lon?: number | null): boolean {
  return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

export function interpolateGC(a: LatLng, b: LatLng, t: number): LatLng {
  const lat1 = toRad(a.latitude);
  const lon1 = toRad(a.longitude);
  const lat2 = toRad(b.latitude);
  const lon2 = toRad(b.longitude);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ));
  if (!(d > 1e-6)) return a;
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  return {
    latitude: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    longitude: toDeg(Math.atan2(y, x)),
  };
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function lerpHeading(from: number, to: number, t: number): number {
  const a = ((Number(from) % 360) + 360) % 360;
  const b = ((Number(to) % 360) + 360) % 360;
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return ((a + d * Math.min(1, Math.max(0, t))) + 360) % 360;
}

export function interpolatePosition(
  from: MapPosition | null,
  to: MapPosition | null,
  t: number,
): MapPosition | null {
  if (!to) return from;
  if (!from) return to;
  const pt = interpolateGC(from, to, Math.min(1, Math.max(0, t)));
  return { ...pt, heading: lerpHeading(from.heading, to.heading, t) };
}

export function positionFromCoords(
  lat?: number | null,
  lon?: number | null,
  heading?: number | null,
): MapPosition | null {
  if (!validCoord(lat, lon)) return null;
  const h = heading != null && Number.isFinite(heading) ? heading : 0;
  return { latitude: lat as number, longitude: lon as number, heading: h };
}

export function headingAlongRoute(from: LatLng, to: LatLng): number {
  return bearingDeg(from, to);
}

export const LIVE_MAP_POLL_MS = 60_000;
