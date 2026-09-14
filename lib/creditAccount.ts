/**
 * Credits account: Sign in with Apple / Google / LINE, proxy session (SecureStore) and the /credits endpoints.
 * The proxy verifies the provider tokens and holds the RevenueCat secret key; the app only sees its session.
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import Line, { Scope } from '@xmartlabs/react-native-line';
import { fetchWithTimeout } from './net';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const SESSION_KEY = 'waiair.credits.session.v1';
const REQUEST_TIMEOUT_MS = 15000;
/** OAuth web client ID — Google puts it in the ID token `aud`, which the proxy checks. */
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
/** LINE Login channel (also hosts the LIFF page) — the proxy checks both tokens against the same ID. */
const LINE_CHANNEL_ID = process.env.EXPO_PUBLIC_LINE_CHANNEL_ID || '2011593172';
/** A closed LINE login: the Android module's code, or LineSDK Swift's AuthorizeErrorReason.userCancelled. */
const LINE_CANCEL_CODES = ['LOGIN_CANCELLED', '3003'];

export type CreditProvider = 'apple' | 'google' | 'line';
const CREDIT_PROVIDERS: readonly CreditProvider[] = ['apple', 'google', 'line'];
export type CreditSession = { userId: string; sessionToken: string; expiresAt: number; provider: CreditProvider };
export type ServerCredits = { balance: number; freeUsed: number };
export type DeductResult =
  | { ok: true; kind: 'free' | 'credit'; credits: ServerCredits }
  | { ok: false; insufficient: boolean; credits?: ServerCredits };

export class CreditAccountError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function parseSession(raw: string | null): CreditSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<CreditSession>;
    if (!s.userId || !s.sessionToken || !CREDIT_PROVIDERS.includes(s.provider as CreditProvider)) return null;
    if (typeof s.expiresAt !== 'number' || s.expiresAt < Date.now()) return null;
    return s as CreditSession;
  } catch {
    return null;
  }
}

export async function loadCreditSession(): Promise<CreditSession | null> {
  if (Platform.OS === 'web') return null;
  try {
    return parseSession(await SecureStore.getItemAsync(SESSION_KEY));
  } catch {
    return null;
  }
}

export async function clearCreditSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch { /* ignore */ }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Google needs the web client ID (proxy audience), plus the iOS client ID on iOS. */
export function isGoogleSignInConfigured(): boolean {
  if (Platform.OS === 'web' || !GOOGLE_WEB_CLIENT_ID) return false;
  return Platform.OS === 'ios' ? !!GOOGLE_IOS_CLIENT_ID : true;
}

/** LINE Login uses the native SDK (LINE app, or its browser fallback) on iOS and Android. */
export function isLineSignInConfigured(): boolean {
  return Platform.OS !== 'web' && !!LINE_CHANNEL_ID;
}

async function appleIdToken(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    return credential.identityToken ?? null;
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

async function googleIdToken(): Promise<string | null> {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID || undefined });
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  return isSuccessResponse(response) ? response.data.idToken : null;
}

let lineReady: Promise<void> | null = null;

/** The LINE SDK needs setup() once per app launch before login or logout. */
function ensureLineSetup(): Promise<void> {
  if (!lineReady) {
    lineReady = Line.setup({ channelId: LINE_CHANNEL_ID }).catch((e: unknown) => {
      lineReady = null;
      throw e;
    });
  }
  return lineReady;
}

type LineTokens = { idToken: string; accessToken: string; nonce?: string };

async function lineTokens(): Promise<LineTokens | null> {
  await ensureLineSetup();
  try {
    // openid → the ID token the proxy verifies; profile → lets the proxy match the access token to the same user.
    const result = await Line.login({ scopes: [Scope.Profile, Scope.OpenId] });
    const idToken = result.accessToken.idToken;
    if (!idToken) throw new CreditAccountError('line_no_id_token');
    return { idToken, accessToken: result.accessToken.accessToken, nonce: result.idTokenNonce };
  } catch (e) {
    if (LINE_CANCEL_CODES.includes(String((e as { code?: unknown })?.code))) return null;
    throw e;
  }
}

/**
 * Sign in and exchange the provider token(s) for a proxy session. LINE also sends its access token, which the proxy
 * stores. `deviceFreeUsed` carries free flights used while signed out. Returns null when the user cancels.
 */
export async function signInForCredits(provider: CreditProvider, deviceFreeUsed: number): Promise<CreditSession | null> {
  let body: Record<string, unknown>;
  if (provider === 'line') {
    const tokens = await lineTokens();
    if (!tokens) return null;
    body = { provider, ...tokens, freeUsed: deviceFreeUsed };
  } else {
    const idToken = provider === 'apple' ? await appleIdToken() : await googleIdToken();
    if (!idToken) return null;
    body = { provider, idToken, freeUsed: deviceFreeUsed };
  }
  const res = await fetchWithTimeout(`${PROXY}/credits/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, REQUEST_TIMEOUT_MS);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.sessionToken || !json?.userId) {
    throw new CreditAccountError(json?.error || `http_${res.status}`);
  }
  const session: CreditSession = {
    userId: String(json.userId),
    sessionToken: String(json.sessionToken),
    expiresAt: Number(json.expiresAt) || 0,
    provider,
  };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signOutProvider(provider: CreditProvider | null | undefined): Promise<void> {
  try {
    if (provider === 'google' && isGoogleSignInConfigured()) await GoogleSignin.signOut();
    if (provider === 'line' && isLineSignInConfigured()) {
      // Revokes the LINE access token (the proxy's stored copy stops working too).
      await ensureLineSetup();
      await Line.logout();
    }
  } catch { /* ignore */ }
}

async function authed(
  session: CreditSession,
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<{ status: number; json: any }> {
  const res = await fetchWithTimeout(`${PROXY}${path}`, {
    method: init.method || 'GET',
    body: init.body,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.sessionToken}` },
  }, REQUEST_TIMEOUT_MS);
  const json = await res.json().catch(() => null);
  // Session revoked or for another user → force a fresh sign-in.
  if (res.status === 401 || res.status === 403) await clearCreditSession();
  return { status: res.status, json };
}

function toServerCredits(json: any): ServerCredits {
  return { balance: Math.max(0, Number(json?.balance) || 0), freeUsed: Math.max(0, Number(json?.freeUsed) || 0) };
}

const userPath = (session: CreditSession) => encodeURIComponent(session.userId);

/** Balance (RevenueCat virtual currency) + free flights used, via the proxy. */
export async function fetchServerCredits(session: CreditSession): Promise<ServerCredits> {
  const { status, json } = await authed(session, `/credits/balance/${userPath(session)}`);
  if (status !== 200) throw new CreditAccountError(json?.error || `http_${status}`);
  return toServerCredits(json);
}

/** Charge a tracked flight once (free flight or 1 credit), server-side. */
export async function deductServerCredit(session: CreditSession, flightKey: string): Promise<DeductResult> {
  const { status, json } = await authed(session, `/credits/deduct/${userPath(session)}`, {
    method: 'POST',
    body: JSON.stringify({ flightKey }),
  });
  if (status === 200) {
    return { ok: true, kind: json?.kind === 'free' ? 'free' : 'credit', credits: toServerCredits(json) };
  }
  if (status === 402) return { ok: false, insufficient: true, credits: toServerCredits(json) };
  return { ok: false, insufficient: false };
}

export async function deleteServerCreditAccount(session: CreditSession): Promise<boolean> {
  const { status } = await authed(session, `/credits/account/${userPath(session)}`, { method: 'DELETE' });
  return status === 200;
}
