import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { parseImportText, parseTripExtras, type ImportCandidate } from './flightImport';
import { dedupeByBookingRef } from './gmailImport';
import { collectBody, joinSplitFlightNumbers } from './gmailMessageText';
import {
  cleanTripExtras,
  mergeTripExtras,
  type TripExtras,
} from './tripExtras';

const TOKEN_KEY = 'waiair.gmail.oauth.v1';
const SUGGEST_KEY = 'waiair.gmail.tripSuggest.v1';
const TRIAL_KEY = 'gmailScanTrialStart';
const TRIAL_DAYS = 7;
const REDIRECT = 'waiair://gmail-oauth';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export type GmailSuggestion = {
  id: string;
  kind: 'hotel' | 'carRental' | 'transfer';
  snippet: string;
  extras: Partial<TripExtras>;
};

type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

function clientId(): string {
  return String(process.env.EXPO_PUBLIC_GOOGLE_GMAIL_CLIENT_ID || '').trim();
}

/*
 * Gmail integration — iOS uses the native Google Sign-In SDK (GoogleSignIn pod via
 * @react-native-google-signin). The iOS OAuth client belongs to bundle com.waiair.WaiAir
 * (team J56ZKH58J9); its reversed client ID is registered as a URL scheme in ios/WaiAir/Info.plist.
 * The SDK stores and refreshes the tokens itself, so iOS never touches TOKEN_KEY.
 * Other platforms keep the browser redirect flow below.
 */
const IOS_GMAIL_CLIENT_ID = String(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
  || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  || '546917111636-v3ob8is9r4oue1n13cq8s2s7avree9jn.apps.googleusercontent.com',
).trim();

function useNativeGmail(): boolean {
  return Platform.OS === 'ios' && !!IOS_GMAIL_CLIENT_ID;
}

/** Gmail integration: configure is global, so re-apply it before every native call (credit login configures it too). */
function configureNativeGmail(): void {
  GoogleSignin.configure({ iosClientId: IOS_GMAIL_CLIENT_ID, scopes: [SCOPE] });
}

/** Gmail integration: the signed-in native user, only when gmail.readonly was granted. */
async function nativeGmailUser(): Promise<boolean> {
  configureNativeGmail();
  try {
    if (!GoogleSignin.hasPreviousSignIn()) return false;
    const res = await GoogleSignin.signInSilently();
    return res.type === 'success' && (res.data.scopes || []).includes(SCOPE);
  } catch {
    return false;
  }
}

/** Gmail integration: native sign-in, then ask for the Gmail scope if an earlier sign-in lacked it. */
async function connectNativeGmail(): Promise<{ ok: boolean; reason?: 'not_configured' | 'cancelled' | 'error' }> {
  configureNativeGmail();
  try {
    let scopes: string[] | null = null;
    if (GoogleSignin.hasPreviousSignIn()) {
      const silent = await GoogleSignin.signInSilently();
      if (silent.type === 'success') scopes = silent.data.scopes || [];
    }
    if (!scopes) {
      const res = await GoogleSignin.signIn();
      if (res.type !== 'success') return { ok: false, reason: 'cancelled' };
      scopes = res.data.scopes || [];
    }
    if (!scopes.includes(SCOPE)) {
      const added = await GoogleSignin.addScopes({ scopes: [SCOPE] });
      if (!added || added.type !== 'success' || !(added.data.scopes || []).includes(SCOPE)) {
        return { ok: false, reason: 'cancelled' };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export function gmailScanConfigured(): boolean {
  if (useNativeGmail()) return true;
  return !!clientId();
}

export type GmailScanAccess = {
  allowed: boolean;
  isPro: boolean;
  inTrial: boolean;
  trialExpired: boolean;
  trialStarted: boolean;
  daysLeft: number;
};

async function readTrialStart(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(TRIAL_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function trialDaysLeft(startMs: number, now = Date.now()): number {
  const end = startMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}

export async function getGmailScanAccess(isPro: boolean): Promise<GmailScanAccess> {
  if (isPro) {
    return {
      allowed: true,
      isPro: true,
      inTrial: false,
      trialExpired: false,
      trialStarted: false,
      daysLeft: 0,
    };
  }
  const start = await readTrialStart();
  if (start == null) {
    return {
      allowed: false,
      isPro: false,
      inTrial: false,
      trialExpired: false,
      trialStarted: false,
      daysLeft: TRIAL_DAYS,
    };
  }
  const daysLeft = trialDaysLeft(start);
  const inTrial = daysLeft > 0;
  return {
    allowed: inTrial,
    isPro: false,
    inTrial,
    trialExpired: !inTrial,
    trialStarted: true,
    daysLeft,
  };
}

/** Starts the 7-day trial on first enable. Pro is always allowed. */
export async function enableGmailScanTrial(isPro: boolean): Promise<GmailScanAccess> {
  if (isPro) return getGmailScanAccess(true);
  const current = await getGmailScanAccess(false);
  if (current.trialStarted) return current;
  const now = Date.now();
  try {
    await AsyncStorage.setItem(TRIAL_KEY, String(now));
  } catch { /* ignore */ }
  return {
    allowed: true,
    isPro: false,
    inTrial: true,
    trialExpired: false,
    trialStarted: true,
    daysLeft: TRIAL_DAYS,
  };
}

async function loadTokens(): Promise<TokenSet | null> {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenSet;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveTokens(tokens: TokenSet): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export async function isGmailConnected(): Promise<boolean> {
  if (useNativeGmail()) return nativeGmailUser();
  const t = await loadTokens();
  return !!t?.accessToken;
}

async function refreshAccess(tokens: TokenSet): Promise<TokenSet | null> {
  if (!tokens.refreshToken) return tokens.expiresAt > Date.now() + 15_000 ? tokens : null;
  const body = new URLSearchParams({
    client_id: clientId(),
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const json = await res.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  const next: TokenSet = {
    accessToken: json.access_token,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + Math.max(30, Number(json.expires_in) || 3600) * 1000,
  };
  await saveTokens(next);
  return next;
}

async function validToken(): Promise<string | null> {
  if (useNativeGmail()) {
    // Gmail integration: the SDK hands out a fresh access token (refreshing when needed).
    if (!(await nativeGmailUser())) return null;
    try {
      return (await GoogleSignin.getTokens()).accessToken || null;
    } catch {
      return null;
    }
  }
  let tokens = await loadTokens();
  if (!tokens) return null;
  if (tokens.expiresAt < Date.now() + 20_000) {
    tokens = await refreshAccess(tokens);
  }
  return tokens?.accessToken || null;
}

/** A fresh access token for the inbox scan (lib/gmailInboxStore.ts); on iOS the SDK keeps it in the keychain. */
export async function gmailAccessToken(): Promise<string | null> {
  return validToken();
}

export async function connectGmail(): Promise<{ ok: boolean; reason?: 'not_configured' | 'cancelled' | 'error' }> {
  if (useNativeGmail()) return connectNativeGmail();
  const id = clientId();
  if (!id) return { ok: false, reason: 'not_configured' };
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return new Promise(resolve => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      if (!url.startsWith(REDIRECT)) return;
      sub.remove();
      const code = new URL(url.replace('waiair://', 'https://waiair.app/')).searchParams.get('code');
      if (!code) {
        resolve({ ok: false, reason: 'cancelled' });
        return;
      }
      try {
        const body = new URLSearchParams({
          client_id: id,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT,
        });
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const json = await res.json() as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        if (!json.access_token) {
          resolve({ ok: false, reason: 'error' });
          return;
        }
        await saveTokens({
          accessToken: json.access_token,
          refreshToken: json.refresh_token,
          expiresAt: Date.now() + Math.max(30, Number(json.expires_in) || 3600) * 1000,
        });
        resolve({ ok: true });
      } catch {
        resolve({ ok: false, reason: 'error' });
      }
    });
    Linking.openURL(authUrl).catch(() => {
      sub.remove();
      resolve({ ok: false, reason: 'error' });
    });
  });
}

const QUERIES = [
  'subject:(booking confirmation OR reservation OR boekingsbevestiging OR bevestiging) from:(booking.com OR agoda.com OR airbnb.com OR hotels.com OR expedia.com OR trip.com OR ctrip.com)',
  'subject:(car rental OR rental confirmation) from:(qeeq.com OR rentalcars.com OR hertz.com OR avis.com OR sixt.com)',
  'subject:(transfer confirmation OR driver details OR pickup confirmation) from:(kiwitaxi.com OR blacklane.com OR welcomepickups.com)',
];

function windowQuery(arrivalIso?: string): string {
  const ms = Date.parse(String(arrivalIso || ''));
  if (!Number.isFinite(ms)) return 'newer_than:14d';
  // Gmail integration: confirmations arrive when you book, often months before the trip — look back 180 days.
  const from = new Date(ms - 180 * 86400000).toISOString().slice(0, 10).replace(/-/g, '/');
  const to = new Date(ms + 3 * 86400000).toISOString().slice(0, 10).replace(/-/g, '/');
  return `after:${from} before:${to}`;
}

function kindOf(extras: Partial<TripExtras>): GmailSuggestion['kind'] | null {
  if (extras.hotel) return 'hotel';
  if (extras.carRental) return 'carRental';
  if (extras.transfer) return 'transfer';
  return null;
}

export async function scanGmailTripExtras(opts: {
  arrivalIso?: string;
  isPro: boolean;
}): Promise<{ suggestions: GmailSuggestion[]; reason?: 'not_pro' | 'trial_expired' | 'not_connected' | 'not_configured' | 'error' }> {
  const access = await getGmailScanAccess(!!opts.isPro);
  if (!access.allowed) {
    return { suggestions: [], reason: access.trialExpired ? 'trial_expired' : 'not_pro' };
  }
  if (!gmailScanConfigured()) return { suggestions: [], reason: 'not_configured' };
  const token = await validToken();
  if (!token) return { suggestions: [], reason: 'not_connected' };

  const win = windowQuery(opts.arrivalIso);
  const headers = { Authorization: `Bearer ${token}` };
  const suggestions: GmailSuggestion[] = [];
  const seen = new Set<string>();

  try {
    for (const q of QUERIES) {
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=${encodeURIComponent(`${q} ${win}`)}`;
      const listRes = await fetch(listUrl, { headers });
      if (!listRes.ok) continue;
      const listJson = await listRes.json() as { messages?: { id: string }[] };
      for (const msg of listJson.messages || []) {
        if (seen.has(msg.id)) continue;
        seen.add(msg.id);
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers },
        );
        if (!msgRes.ok) continue;
        const bodyJson = await msgRes.json() as { snippet?: string; payload?: unknown };
        const parsed = parseTripExtras(`${bodyJson.snippet || ''}\n${collectBody(bodyJson.payload)}`);
        const kind = kindOf(parsed);
        if (!kind) continue;
        suggestions.push({
          id: msg.id,
          kind,
          snippet: String(bodyJson.snippet || '').slice(0, 140),
          extras: parsed,
        });
      }
    }
    // One card per booking: the confirmation, the reminder and the change mail all carry the same reference.
    const kept = new Set(
      dedupeByBookingRef(suggestions.map(s => ({ messageId: s.id, extras: s.extras }))).kept.map(k => k.messageId),
    );
    return { suggestions: suggestions.filter(s => kept.has(s.id)) };
  } catch {
    return { suggestions: [], reason: 'error' };
  }
}

type SuggestMap = Record<string, GmailSuggestion[]>;

async function loadSuggestMap(): Promise<SuggestMap> {
  try {
    const raw = await AsyncStorage.getItem(SUGGEST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SuggestMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getCachedGmailSuggestions(flightKey: string): Promise<GmailSuggestion[]> {
  const map = await loadSuggestMap();
  return map[flightKey] || [];
}

export async function clearGmailSuggestion(flightKey: string, id: string): Promise<void> {
  const map = await loadSuggestMap();
  map[flightKey] = (map[flightKey] || []).filter(s => s.id !== id);
  await AsyncStorage.setItem(SUGGEST_KEY, JSON.stringify(map));
}

export async function backgroundScanGmailTripExtras(opts: {
  flightKey: string;
  arrivalIso?: string;
  isPro: boolean;
}): Promise<GmailSuggestion[]> {
  if (!opts.flightKey) return [];
  const access = await getGmailScanAccess(!!opts.isPro);
  if (!access.allowed) return [];
  const result = await scanGmailTripExtras({
    arrivalIso: opts.arrivalIso,
    isPro: opts.isPro,
  });
  if (!result.suggestions.length) return [];
  const map = await loadSuggestMap();
  map[opts.flightKey] = result.suggestions;
  await AsyncStorage.setItem(SUGGEST_KEY, JSON.stringify(map));
  return result.suggestions;
}

export function extrasFromSuggestion(s: GmailSuggestion): TripExtras | undefined {
  return mergeTripExtras(undefined, s.extras, 'gmail') || cleanTripExtras(s.extras as TripExtras);
}

/*
 * Gmail integration — flight confirmations. Finds airline / OTA e-tickets and itineraries and
 * returns import candidates (flight number, date, route) for ImportFlightsModal.
 * Candidates carry source 'gmail' so the UI can show "Geïmporteerd uit Gmail".
 */
const FLIGHT_QUERY = 'subject:(e-ticket OR eticket OR itinerary OR "flight confirmation" OR "booking confirmation" OR "boarding pass" OR "check-in" OR "your trip" OR "your flight" OR reisschema OR vlucht OR boekingsbevestiging) newer_than:365d';

export async function scanGmailFlights(opts: {
  isPro: boolean;
  now?: number;
}): Promise<{ candidates: ImportCandidate[]; reason?: 'not_pro' | 'trial_expired' | 'not_connected' | 'not_configured' | 'error' }> {
  const access = await getGmailScanAccess(!!opts.isPro);
  if (!access.allowed) {
    return { candidates: [], reason: access.trialExpired ? 'trial_expired' : 'not_pro' };
  }
  if (!gmailScanConfigured()) return { candidates: [], reason: 'not_configured' };
  const token = await validToken();
  if (!token) return { candidates: [], reason: 'not_connected' };

  const headers = { Authorization: `Bearer ${token}` };
  // Only trips from yesterday on; undated hits stay so the user can still pick them.
  const today = new Date((opts.now ?? Date.now()) - 86400000).toISOString().slice(0, 10);
  const out: ImportCandidate[] = [];
  const seen = new Set<string>();
  try {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(FLIGHT_QUERY)}`;
    const listRes = await fetch(listUrl, { headers });
    if (!listRes.ok) return { candidates: [], reason: listRes.status === 401 ? 'not_connected' : 'error' };
    const listJson = await listRes.json() as { messages?: { id: string }[] };
    for (const msg of listJson.messages || []) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers },
      );
      if (!msgRes.ok) continue;
      const bodyJson = await msgRes.json() as { snippet?: string; payload?: unknown };
      const text = joinSplitFlightNumbers(`${bodyJson.snippet || ''}\n${collectBody(bodyJson.payload)}`);
      for (const c of parseImportText(text)) {
        if (c.dateIso && c.dateIso < today) continue;
        const key = `${c.flightNumber}|${c.dateIso || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...c, id: `gmail:${msg.id}:${c.id}`, source: 'gmail' });
      }
    }
    out.sort((a, b) => String(a.dateIso || '9999').localeCompare(String(b.dateIso || '9999')));
    return { candidates: out };
  } catch {
    return { candidates: [], reason: 'error' };
  }
}
