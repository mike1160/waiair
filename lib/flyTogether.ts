import AsyncStorage from '@react-native-async-storage/async-storage';
import { arrivalExitHint } from './gateWalk';
import { getSupabase, supabaseEnabled } from './supabase';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const DEVICE_KEY = 'waiair.together.device.v1';
const NAME_KEY = 'waiair.together.displayName.v1';
const CACHE_PREFIX = 'waiair.together.cache.v1.';
const ACTIVE_GROUP_KEY = 'waiair.together.active.v1';
const LOCAL_CODES_KEY = 'waiair.together.localCodes.v1';
const CREATE_TIMEOUT_MS = 10_000;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateTogetherCode(): string {
  let out = '';
  for (let j = 0; j < 6; j++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

async function loadLocalCodes(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_CODES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeCode).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function isLocalTogetherCode(code: string): Promise<boolean> {
  const c = normalizeCode(code);
  return (await loadLocalCodes()).includes(c);
}

async function markLocalTogetherCode(code: string): Promise<void> {
  const c = normalizeCode(code);
  const codes = await loadLocalCodes();
  if (!codes.includes(c)) {
    codes.push(c);
    await AsyncStorage.setItem(LOCAL_CODES_KEY, JSON.stringify(codes));
  }
}

export const TOGETHER_MAX_PARTICIPANTS = 8;
export const TOGETHER_TTL_MS = 48 * 60 * 60 * 1000;
export const TOGETHER_LINK_BASE = 'https://waiair.app/together';

export type TogetherParticipant = {
  id: string;
  deviceId: string;
  displayName: string;
  flightNumber: string;
  originIata: string;
  destIata: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  scheduledTime?: string;
  status: string;
  etaIso?: string;
  landedAtIso?: string;
  lat?: number;
  lon?: number;
  delayMin: number;
  progressPct: number;
  joinedAt: string;
};

export type FlyTogetherGroup = {
  id: string;
  code: string;
  groupName?: string;
  createdAt: string;
  expiresAt: string;
  participants: TogetherParticipant[];
};

export type TogetherFlightInput = {
  flightNumber: string;
  originIata: string;
  destIata: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  scheduledTime?: string;
  status?: string;
  etaIso?: string;
  landedAtIso?: string;
  lat?: number;
  lon?: number;
  delayMin?: number;
  progressPct?: number;
};

function normalizeCode(raw: string): string {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function togetherShareLink(code: string): string {
  return `${TOGETHER_LINK_BASE}/${encodeURIComponent(normalizeCode(code))}`;
}

export function parseTogetherCodeFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const s = String(url);
  const m = s.match(/\/together\/([A-Z0-9]{6})/i) || s.match(/together[/?=]([A-Z0-9]{6})/i);
  return m ? normalizeCode(m[1]) : null;
}

export function isValidTogetherCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(normalizeCode(code));
}

export async function getTogetherDeviceId(): Promise<string> {
  try {
    const hit = await AsyncStorage.getItem(DEVICE_KEY);
    if (hit) return hit;
    const id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `dev-${Date.now()}`;
  }
}

export async function getTogetherDisplayName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(NAME_KEY)) || '';
  } catch {
    return '';
  }
}

export async function setTogetherDisplayName(name: string): Promise<void> {
  await AsyncStorage.setItem(NAME_KEY, String(name || '').trim());
}

export async function setActiveTogetherCode(code: string | null): Promise<void> {
  if (!code) {
    await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_GROUP_KEY, normalizeCode(code));
}

export async function getActiveTogetherCode(): Promise<string | null> {
  try {
    const c = await AsyncStorage.getItem(ACTIVE_GROUP_KEY);
    return c ? normalizeCode(c) : null;
  } catch {
    return null;
  }
}

async function cacheGroup(group: FlyTogetherGroup | null, code: string): Promise<void> {
  const key = CACHE_PREFIX + normalizeCode(code);
  if (!group) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), group }));
}

export async function loadCachedGroup(code: string): Promise<FlyTogetherGroup | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + normalizeCode(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.group || null;
  } catch {
    return null;
  }
}

function mapParticipant(row: Record<string, unknown>): TogetherParticipant {
  return {
    id: String(row.id || row.participant_id || ''),
    deviceId: String(row.device_id || row.deviceId || ''),
    displayName: String(row.display_name || row.displayName || 'Traveler'),
    flightNumber: String(row.flight_number || row.flightNumber || ''),
    originIata: String(row.origin_iata || row.originIata || ''),
    destIata: String(row.dest_iata || row.destIata || ''),
    originLat: row.origin_lat != null ? Number(row.origin_lat) : undefined,
    originLon: row.origin_lon != null ? Number(row.origin_lon) : undefined,
    destLat: row.dest_lat != null ? Number(row.dest_lat) : undefined,
    destLon: row.dest_lon != null ? Number(row.dest_lon) : undefined,
    scheduledTime: row.scheduled_time ? String(row.scheduled_time) : undefined,
    status: String(row.status || 'scheduled'),
    etaIso: row.eta_iso ? String(row.eta_iso) : undefined,
    landedAtIso: row.landed_at_iso ? String(row.landed_at_iso) : undefined,
    lat: row.lat != null ? Number(row.lat) : undefined,
    lon: row.lon != null ? Number(row.lon) : undefined,
    delayMin: Number(row.delay_min ?? row.delayMin ?? 0) || 0,
    progressPct: Number(row.progress_pct ?? row.progressPct ?? 0) || 0,
    joinedAt: String(row.joined_at || row.joinedAt || new Date().toISOString()),
  };
}

function mapGroup(json: Record<string, unknown>): FlyTogetherGroup {
  const parts = Array.isArray(json.participants)
    ? json.participants.map((p: Record<string, unknown>) => mapParticipant(p))
    : [];
  return {
    id: String(json.id || ''),
    code: normalizeCode(String(json.code || '')),
    groupName: json.groupName || json.group_name ? String(json.groupName || json.group_name) : undefined,
    createdAt: String(json.createdAt || json.created_at || ''),
    expiresAt: String(json.expiresAt || json.expires_at || ''),
    participants: parts,
  };
}

function participantPayload(
  deviceId: string,
  displayName: string,
  flight: TogetherFlightInput,
): Record<string, unknown> {
  return {
    device_id: deviceId,
    display_name: displayName,
    flight_number: flight.flightNumber.replace(/\s+/g, '').toUpperCase(),
    origin_iata: flight.originIata,
    dest_iata: flight.destIata,
    origin_lat: flight.originLat ?? null,
    origin_lon: flight.originLon ?? null,
    dest_lat: flight.destLat ?? null,
    dest_lon: flight.destLon ?? null,
    scheduled_time: flight.scheduledTime ?? null,
    status: flight.status || 'scheduled',
    eta_iso: flight.etaIso ?? null,
    landed_at_iso: flight.landedAtIso ?? null,
    lat: flight.lat ?? null,
    lon: flight.lon ?? null,
    delay_min: flight.delayMin ?? 0,
    progress_pct: flight.progressPct ?? 0,
  };
}

async function fetchGroupProxy(code: string): Promise<FlyTogetherGroup | null> {
  const r = await fetch(`${PROXY}/together/${encodeURIComponent(normalizeCode(code))}`);
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Proxy fetch HTTP ${r.status}: ${body.slice(0, 160)}`);
  }
  const json = await r.json();
  if (!json?.code) return null;
  return mapGroup(json);
}

async function createGroupProxy(
  displayName: string,
  flight: TogetherFlightInput,
  deviceId: string,
  groupName?: string,
): Promise<FlyTogetherGroup | null> {
  const r = await fetch(`${PROXY}/together`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, displayName, flight, groupName: groupName?.trim() || null }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Proxy create HTTP ${r.status}: ${body.slice(0, 160)}`);
  }
  const json = await r.json();
  if (!json?.code) return null;
  return mapGroup(json);
}

async function joinGroupProxy(
  code: string,
  displayName: string,
  flight: TogetherFlightInput,
  deviceId: string,
): Promise<FlyTogetherGroup | null> {
  const r = await fetch(`${PROXY}/together/${encodeURIComponent(normalizeCode(code))}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, displayName, flight }),
  });
  if (!r.ok) return null;
  const json = await r.json();
  if (!json?.code) return null;
  return mapGroup(json);
}

async function updateParticipantProxy(
  code: string,
  deviceId: string,
  patch: Partial<TogetherFlightInput>,
): Promise<void> {
  await fetch(`${PROXY}/together/${encodeURIComponent(normalizeCode(code))}/participant`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, patch }),
  }).catch(() => {});
}

async function fetchGroupSupabase(code: string): Promise<FlyTogetherGroup | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const c = normalizeCode(code);
  const { data: row, error } = await sb
    .from('flight_races')
    .select('id,code,created_at,expires_at,group_name')
    .eq('code', c)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error || !row) return null;
  const { data: parts } = await sb
    .from('flight_race_participants')
    .select('*')
    .eq('race_id', row.id)
    .order('joined_at', { ascending: true });
  return mapGroup({
    ...row,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    groupName: row.group_name,
    participants: parts || [],
  });
}

async function createGroupSupabase(
  displayName: string,
  flight: TogetherFlightInput,
  deviceId: string,
  groupName?: string,
): Promise<FlyTogetherGroup | null> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client unavailable');
  const expiresAt = new Date(Date.now() + TOGETHER_TTL_MS).toISOString();
  let code = '';
  for (let i = 0; i < 12; i++) {
    const candidate = generateTogetherCode();
    const { data: existing, error: lookupErr } = await sb.from('flight_races').select('id').eq('code', candidate).maybeSingle();
    if (lookupErr) throw new Error(`Supabase code lookup: ${lookupErr.message} (${lookupErr.code})`);
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new Error('Supabase: could not allocate unique group code');
  const { data: row, error } = await sb
    .from('flight_races')
    .insert({ code, expires_at: expiresAt, group_name: groupName?.trim() || null })
    .select('id,code,created_at,expires_at,group_name')
    .single();
  if (error || !row) {
    throw new Error(`Supabase race insert: ${error?.message || 'no row'} (${error?.code || 'unknown'})`);
  }
  const payload = participantPayload(deviceId, displayName, flight);
  const { error: pErr } = await sb.from('flight_race_participants').insert({
    ...payload,
    race_id: row.id,
  });
  if (pErr) {
    throw new Error(`Supabase participant insert: ${pErr.message} (${pErr.code})`);
  }
  return fetchGroupSupabase(code);
}

async function joinGroupSupabase(
  code: string,
  displayName: string,
  flight: TogetherFlightInput,
  deviceId: string,
): Promise<FlyTogetherGroup | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const c = normalizeCode(code);
  const { data: row } = await sb
    .from('flight_races')
    .select('id')
    .eq('code', c)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!row) return null;
  const { count } = await sb
    .from('flight_race_participants')
    .select('*', { count: 'exact', head: true })
    .eq('race_id', row.id);
  if ((count || 0) >= TOGETHER_MAX_PARTICIPANTS) return null;
  const payload = participantPayload(deviceId, displayName, flight);
  const { error } = await sb.from('flight_race_participants').upsert(
    { ...payload, race_id: row.id },
    { onConflict: 'race_id,device_id' },
  );
  if (error) return null;
  return fetchGroupSupabase(c);
}

async function updateParticipantSupabase(
  code: string,
  deviceId: string,
  patch: Partial<TogetherFlightInput>,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const group = await fetchGroupSupabase(code);
  if (!group) return;
  const row: Record<string, unknown> = {};
  if (patch.status != null) row.status = patch.status;
  if (patch.etaIso != null) row.eta_iso = patch.etaIso;
  if (patch.landedAtIso != null) row.landed_at_iso = patch.landedAtIso;
  if (patch.lat != null) row.lat = patch.lat;
  if (patch.lon != null) row.lon = patch.lon;
  if (patch.delayMin != null) row.delay_min = patch.delayMin;
  if (patch.progressPct != null) row.progress_pct = patch.progressPct;
  if (!Object.keys(row).length) return;
  await sb
    .from('flight_race_participants')
    .update(row)
    .eq('race_id', group.id)
    .eq('device_id', deviceId);
}

function buildLocalParticipant(
  deviceId: string,
  displayName: string,
  flight: TogetherFlightInput,
): TogetherParticipant {
  const now = new Date().toISOString();
  return {
    id: `local-${deviceId}-${Date.now()}`,
    deviceId,
    displayName,
    flightNumber: flight.flightNumber.replace(/\s+/g, '').toUpperCase(),
    originIata: flight.originIata,
    destIata: flight.destIata,
    originLat: flight.originLat,
    originLon: flight.originLon,
    destLat: flight.destLat,
    destLon: flight.destLon,
    scheduledTime: flight.scheduledTime,
    status: flight.status || 'scheduled',
    etaIso: flight.etaIso,
    landedAtIso: flight.landedAtIso,
    lat: flight.lat,
    lon: flight.lon,
    delayMin: flight.delayMin ?? 0,
    progressPct: flight.progressPct ?? 0,
    joinedAt: now,
  };
}

async function createGroupLocal(
  displayName: string,
  flight: TogetherFlightInput,
  deviceId: string,
  groupName?: string,
): Promise<FlyTogetherGroup> {
  const code = generateTogetherCode();
  const now = new Date();
  const group: FlyTogetherGroup = {
    id: `local-${code}`,
    code,
    groupName: groupName?.trim() || undefined,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TOGETHER_TTL_MS).toISOString(),
    participants: [buildLocalParticipant(deviceId, displayName, flight)],
  };
  await markLocalTogetherCode(code);
  return group;
}

async function joinGroupLocal(
  code: string,
  displayName: string,
  flight: TogetherFlightInput,
  deviceId: string,
): Promise<FlyTogetherGroup | null> {
  const c = normalizeCode(code);
  if (!(await isLocalTogetherCode(c))) return null;
  const group = await loadCachedGroup(c);
  if (!group) return null;
  const idx = group.participants.findIndex(p => p.deviceId === deviceId);
  const row = buildLocalParticipant(deviceId, displayName, flight);
  if (idx >= 0) {
    group.participants[idx] = { ...group.participants[idx], ...row, id: group.participants[idx].id };
  } else {
    if (group.participants.length >= TOGETHER_MAX_PARTICIPANTS) return null;
    group.participants.push(row);
  }
  await cacheGroup(group, c);
  return group;
}

async function updateParticipantLocal(
  code: string,
  deviceId: string,
  patch: Partial<TogetherFlightInput>,
): Promise<void> {
  const c = normalizeCode(code);
  if (!(await isLocalTogetherCode(c))) return;
  const group = await loadCachedGroup(c);
  if (!group) return;
  const idx = group.participants.findIndex(p => p.deviceId === deviceId);
  if (idx < 0) return;
  const p = group.participants[idx];
  group.participants[idx] = {
    ...p,
    status: patch.status ?? p.status,
    etaIso: patch.etaIso ?? p.etaIso,
    landedAtIso: patch.landedAtIso ?? p.landedAtIso,
    lat: patch.lat ?? p.lat,
    lon: patch.lon ?? p.lon,
    delayMin: patch.delayMin ?? p.delayMin,
    progressPct: patch.progressPct ?? p.progressPct,
  };
  await cacheGroup(group, c);
}

async function finalizeTogetherGroup(group: FlyTogetherGroup): Promise<FlyTogetherGroup> {
  await cacheGroup(group, group.code);
  await setActiveTogetherCode(group.code);
  return group;
}

export async function fetchTogetherGroup(code: string): Promise<FlyTogetherGroup | null> {
  const c = normalizeCode(code);
  if (!c) return null;
  if (await isLocalTogetherCode(c)) {
    const local = await loadCachedGroup(c);
    if (local) return local;
  }
  try {
    const live = supabaseEnabled()
      ? await fetchGroupSupabase(c)
      : await fetchGroupProxy(c);
    if (live) {
      await cacheGroup(live, c);
      return live;
    }
  } catch (err) {
    console.warn('[FlyTogether] fetch failed:', err instanceof Error ? err.message : err);
  }
  return loadCachedGroup(c);
}

export async function createTogetherGroup(
  displayName: string,
  flight: TogetherFlightInput,
  groupName?: string,
): Promise<FlyTogetherGroup | null> {
  const deviceId = await getTogetherDeviceId();
  const name = displayName.trim() || 'Traveler';
  await setTogetherDisplayName(name);
  const started = Date.now();
  const errors: string[] = [];

  const tryRemote = async (
    label: string,
    fn: () => Promise<FlyTogetherGroup | null>,
  ): Promise<FlyTogetherGroup | null> => {
    const remaining = CREATE_TIMEOUT_MS - (Date.now() - started);
    if (remaining <= 0) {
      errors.push(`${label}: skipped (10s timeout)`);
      return null;
    }
    try {
      const group = await withTimeout(fn(), remaining, label);
      if (group) return group;
      errors.push(`${label}: empty response`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${label}: ${msg}`);
      console.warn(`[FlyTogether] ${label} failed:`, msg);
    }
    return null;
  };

  if (supabaseEnabled()) {
    const supa = await tryRemote('Supabase', () => createGroupSupabase(name, flight, deviceId, groupName));
    if (supa) return finalizeTogetherGroup(supa);
  } else {
    errors.push('Supabase: not configured (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY empty)');
  }

  const proxy = await tryRemote('Proxy', () => createGroupProxy(name, flight, deviceId, groupName));
  if (proxy) return finalizeTogetherGroup(proxy);

  try {
    const local = await createGroupLocal(name, flight, deviceId, groupName);
    console.warn('[FlyTogether] Using local fallback. Errors:', errors.join(' | '));
    return finalizeTogetherGroup(local);
  } catch (err) {
    console.error('[FlyTogether] Local fallback failed:', err, 'Errors:', errors);
    return null;
  }
}

export async function joinTogetherGroup(
  code: string,
  displayName: string,
  flight: TogetherFlightInput,
): Promise<FlyTogetherGroup | null> {
  const deviceId = await getTogetherDeviceId();
  const name = displayName.trim() || 'Traveler';
  await setTogetherDisplayName(name);
  if (await isLocalTogetherCode(code)) {
    const local = await joinGroupLocal(code, name, flight, deviceId);
    if (local) return finalizeTogetherGroup(local);
  }
  const group = supabaseEnabled()
    ? await joinGroupSupabase(code, name, flight, deviceId)
    : await joinGroupProxy(code, name, flight, deviceId);
  if (group) return finalizeTogetherGroup(group);
  return null;
}

export async function syncTogetherParticipant(
  code: string,
  patch: Partial<TogetherFlightInput>,
): Promise<void> {
  const deviceId = await getTogetherDeviceId();
  try {
    if (await isLocalTogetherCode(code)) {
      await updateParticipantLocal(code, deviceId, patch);
      return;
    }
    if (supabaseEnabled()) {
      await updateParticipantSupabase(code, deviceId, patch);
    } else {
      await updateParticipantProxy(code, deviceId, patch);
    }
  } catch { /* offline */ }
}

function landedMs(p: TogetherParticipant): number {
  const iso = p.landedAtIso || (p.status === 'landed' ? p.etaIso : '');
  const ms = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}

export function listTogetherParticipants(list: TogetherParticipant[]): TogetherParticipant[] {
  return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

export function togetherAllLanded(list: TogetherParticipant[]): boolean {
  return list.length > 0 && list.every(p => p.status === 'landed' || p.status === 'cancelled');
}

export function togetherPrimaryDest(list: TogetherParticipant[]): string {
  const counts = new Map<string, number>();
  for (const p of list) {
    const d = (p.destIata || '').toUpperCase();
    if (!d) continue;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  let best = '';
  let n = 0;
  for (const [d, c] of counts) {
    if (c > n) {
      best = d;
      n = c;
    }
  }
  return best || list[0]?.destIata || '';
}

export function togetherEnRouteNames(list: TogetherParticipant[], excludeId?: string): string[] {
  return list
    .filter(p => p.id !== excludeId && p.status !== 'landed' && p.status !== 'cancelled')
    .map(p => p.displayName.split(' ')[0] || p.displayName);
}

export function togetherMeetingPoint(list: TogetherParticipant[]): string | null {
  if (!togetherAllLanded(list)) return null;
  const dest = togetherPrimaryDest(list);
  const hint = arrivalExitHint(dest);
  if (hint) return hint;
  return dest ? `Arrivals · ${dest}` : null;
}

export function togetherLastLandingGap(list: TogetherParticipant[]): { last: string; first: string; gapMin: number } | null {
  const landed = list.filter(p => p.status === 'landed' && landedMs(p) < Number.MAX_SAFE_INTEGER);
  if (landed.length < 2) return null;
  const sorted = [...landed].sort((a, b) => landedMs(a) - landedMs(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const gapMin = Math.round((landedMs(last) - landedMs(first)) / 60000);
  return { last: last.displayName.split(' ')[0] || last.displayName, first: first.displayName.split(' ')[0] || first.displayName, gapMin };
}

export function interpolateTogetherPosition(p: TogetherParticipant): { lat: number; lon: number } | null {
  if (p.lat != null && p.lon != null && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
    return { lat: p.lat, lon: p.lon };
  }
  const oLat = p.originLat;
  const oLon = p.originLon;
  const dLat = p.destLat;
  const dLon = p.destLon;
  if (oLat == null || oLon == null || dLat == null || dLon == null) return null;
  const t = p.status === 'landed' ? 1 : Math.max(0, Math.min(1, p.progressPct || 0));
  return { lat: oLat + (dLat - oLat) * t, lon: oLon + (dLon - oLon) * t };
}

export function subscribeTogetherGroup(
  code: string,
  onUpdate: (group: FlyTogetherGroup | null) => void,
): () => void {
  const c = normalizeCode(code);
  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let channel: ReturnType<NonNullable<ReturnType<typeof getSupabase>>['channel']> | null = null;

  const pull = async () => {
    if (stopped) return;
    const group = await fetchTogetherGroup(c);
    onUpdate(group);
  };

  void (async () => {
    const local = await isLocalTogetherCode(c);
    await pull();
    if (stopped) return;
    const sb = getSupabase();
    if (sb && supabaseEnabled() && !local) {
      channel = sb
        .channel(`together-${c}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'flight_race_participants' },
          () => { pull(); },
        )
        .subscribe();
      pollTimer = setInterval(pull, 60_000);
    } else {
      pollTimer = setInterval(pull, local ? 5_000 : 15_000);
    }
  })();

  return () => {
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    const sb = getSupabase();
    if (channel && sb) sb.removeChannel(channel);
  };
}

export function togetherFlightFromShare(data: {
  flightNumber: string;
  originIata: string;
  destIata: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  dateIso?: string;
}): TogetherFlightInput {
  return {
    flightNumber: data.flightNumber,
    originIata: data.originIata,
    destIata: data.destIata,
    originLat: data.originLat,
    originLon: data.originLon,
    destLat: data.destLat,
    destLon: data.destLon,
    scheduledTime: data.dateIso,
    status: 'scheduled',
    progressPct: 0,
    delayMin: 0,
  };
}

export function togetherFlightFromTracked(f: {
  number: string;
  origin?: string;
  destination?: string;
  status?: string;
  scheduledTime?: string;
  arrivalTime?: string;
  revisedTime?: string;
  delay?: number;
  lat?: number;
  lng?: number;
  progressPct?: number;
}, originLat?: number, originLon?: number, destLat?: number, destLon?: number): TogetherFlightInput {
  return {
    flightNumber: f.number,
    originIata: f.origin || '',
    destIata: f.destination || '',
    originLat,
    originLon,
    destLat,
    destLon,
    scheduledTime: f.scheduledTime,
    status: f.status || 'scheduled',
    etaIso: f.arrivalTime || f.revisedTime,
    lat: f.lat,
    lon: f.lng,
    delayMin: f.delay || 0,
    progressPct: f.progressPct ?? (f.status === 'landed' ? 1 : f.status === 'en-route' ? 0.5 : 0),
    landedAtIso: f.status === 'landed' ? (f.arrivalTime || f.revisedTime) : undefined,
  };
}
