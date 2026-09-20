import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { parseImportText, parseTripExtras, type ImportCandidate } from './flightImport';
import { dedupeByBookingRef } from './gmailImport';
import { collectBody, joinSplitFlightNumbers } from './gmailMessageText';
import {
  cleanTripExtras,
  mergeTripExtras,
  type TripExtras,
} from './tripExtras';

const SUGGEST_KEY = 'waiair.gmail.tripSuggest.v1';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export type GmailSuggestion = {
  id: string;
  kind: 'hotel' | 'carRental' | 'transfer';
  snippet: string;
  extras: Partial<TripExtras>;
};

/*
 * Gmail integration — both phones use the native Google Sign-In SDK (@react-native-google-signin), which
 * stores and refreshes the tokens itself. There is no browser redirect flow: a custom scheme such as
 * waiair://gmail-oauth cannot be registered on a Web OAuth client, which is what made Android fail with a
 * 400 from Google.
 *
 * iOS matches its OAuth client by bundle id (com.waiair.WaiAir, team J56ZKH58J9); its reversed client ID is
 * a URL scheme in ios/WaiAir/Info.plist. Android matches by package name plus the signing certificate's
 * SHA-1, both registered on the Android OAuth client in the Google Cloud project — which is why there is no
 * androidClientId to pass here. The SDK wants the web (server) client instead.
 */
const IOS_GMAIL_CLIENT_ID = String(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
  || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  || '546917111636-v3ob8is9r4oue1n13cq8s2s7avree9jn.apps.googleusercontent.com',
).trim();

const WEB_GMAIL_CLIENT_ID = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '').trim();

function useNativeGmail(): boolean {
  if (Platform.OS === 'ios') return !!IOS_GMAIL_CLIENT_ID;
  if (Platform.OS === 'android') return !!WEB_GMAIL_CLIENT_ID;
  return false;
}

/** Gmail integration: configure is global, so re-apply it before every native call (credit login configures it too). */
function configureNativeGmail(): void {
  GoogleSignin.configure({
    iosClientId: IOS_GMAIL_CLIENT_ID || undefined,
    webClientId: WEB_GMAIL_CLIENT_ID || undefined,
    scopes: [SCOPE],
  });
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
    // Android needs Play Services for the sign-in sheet; without this the SDK throws instead of asking.
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
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
  return useNativeGmail();
}

/*
 * Scanning by hand is free for everyone: the import screen, the flight import and the trip-extras sheet all
 * scan without a Pro check. Only the automatic daily sync is Pro (see lib/gmailAutoSync.ts).
 */

export async function isGmailConnected(): Promise<boolean> {
  return nativeGmailUser();
}

async function validToken(): Promise<string | null> {
  // Gmail integration: the SDK hands out a fresh access token (refreshing when needed).
  if (!(await nativeGmailUser())) return null;
  try {
    return (await GoogleSignin.getTokens()).accessToken || null;
  } catch {
    return null;
  }
}

/** A fresh access token for the inbox scan (lib/gmailInboxStore.ts); on iOS the SDK keeps it in the keychain. */
export async function gmailAccessToken(): Promise<string | null> {
  return validToken();
}

export async function connectGmail(): Promise<{ ok: boolean; reason?: 'not_configured' | 'cancelled' | 'error' }> {
  if (!useNativeGmail()) return { ok: false, reason: 'not_configured' };
  return connectNativeGmail();
}

// The same senders write in the language of the country you booked from, so every query lists the words
// those mails actually carry — German, French, Spanish and Thai next to English and Dutch.
const QUERIES = [
  'subject:(booking confirmation OR reservation OR boekingsbevestiging OR bevestiging'
  + ' OR Buchungsbestätigung OR Reservierung OR réservation OR séjour OR reserva OR estancia OR ยืนยันการจอง)'
  // Brands rather than domains, so the mails from expedia.nl and agoda.com.sg are found as well.
  + ' from:(booking OR agoda OR airbnb OR hotels.com OR expedia OR trip.com OR ctrip.com'
  + ' OR vrbo OR orbitz OR travelocity OR wotif OR priceline OR hotelbeds OR bedsonline OR hopper.com)',
  'subject:(car rental OR rental confirmation OR huurauto OR Mietwagen OR location de voiture OR alquiler OR เช่ารถ)'
  + ' from:(qeeq.com OR rentalcars OR hertz OR avis.com OR sixt OR europcar OR enterprise.com OR alamo'
  + ' OR nationalcar OR dollar.com OR thrifty OR goldcar OR centauro.net OR okmobility OR turo OR zipcar)',
  'subject:(transfer confirmation OR driver details OR pickup confirmation OR Transferbestätigung OR transfert OR traslado)'
  + ' from:(kiwitaxi.com OR blacklane.com OR welcomepickups.com)',
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
}): Promise<{ suggestions: GmailSuggestion[]; reason?: 'not_connected' | 'not_configured' | 'error' }> {
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
}): Promise<GmailSuggestion[]> {
  if (!opts.flightKey) return [];
  const result = await scanGmailTripExtras({ arrivalIso: opts.arrivalIso });
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
const FLIGHT_QUERY = 'subject:(e-ticket OR eticket OR itinerary OR "flight confirmation" OR "booking confirmation"'
  + ' OR "boarding pass" OR "check-in" OR "your trip" OR "your flight" OR reisschema OR vlucht OR boekingsbevestiging'
  + ' OR Flug OR Bordkarte OR Flugticket OR "billet électronique" OR embarquement OR vuelo OR embarque'
  + ' OR เที่ยวบิน OR ตั๋วเครื่องบิน) newer_than:365d';

export async function scanGmailFlights(opts?: {
  now?: number;
}): Promise<{ candidates: ImportCandidate[]; reason?: 'not_connected' | 'not_configured' | 'error' }> {
  if (!gmailScanConfigured()) return { candidates: [], reason: 'not_configured' };
  const token = await validToken();
  if (!token) return { candidates: [], reason: 'not_connected' };

  const headers = { Authorization: `Bearer ${token}` };
  // Only trips from yesterday on; undated hits stay so the user can still pick them.
  const today = new Date((opts?.now ?? Date.now()) - 86400000).toISOString().slice(0, 10);
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
