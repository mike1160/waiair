/**
 * Google Sign-In via expo-auth-session (no extra native rebuild).
 * Native @react-native-google-signin remains as a fallback in creditAccount.ts.
 */
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

const EXPO_PROXY_REDIRECT = 'https://auth.expo.io/@waiair/waiair';

function googleClientIds() {
  const web = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB
    || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    || '';
  const ios = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
    || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    || '';
  const android = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '';
  return { web, ios, android };
}

export function isGoogleAuthSessionConfigured(): boolean {
  const { web, ios, android } = googleClientIds();
  if (Platform.OS === 'ios') return !!(ios || web);
  if (Platform.OS === 'android') return !!(android || web);
  return !!web;
}

function decodeJwtPayload(token: string): Record<string, string> {
  try {
    const part = token.split('.')[1];
    if (!part) return {};
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
}

export type GoogleAuthProfile = {
  idToken: string;
  email: string;
  name: string;
  picture: string;
};

/** Open Google OAuth; null if the user cancels. */
export async function promptGoogleIdToken(): Promise<GoogleAuthProfile | null> {
  const { web, ios, android } = googleClientIds();
  const clientId = Platform.select({
    ios: ios || web,
    android: android || web,
    default: web,
  }) || '';
  if (!clientId) throw new Error('google_not_configured');

  const nonceRaw = `${Date.now()}-${Math.random()}`;
  const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonceRaw);
  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
  };
  const nativeUri = AuthSession.makeRedirectUri({ scheme: 'waiair' });
  const redirectUri = nativeUri || EXPO_PROXY_REDIRECT;
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    extraParams: { nonce, prompt: 'select_account' },
    usePKCE: false,
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') return null;
  const idToken = String(result.params?.id_token || result.authentication?.idToken || '');
  if (!idToken) throw new Error('google_no_id_token');
  const payload = decodeJwtPayload(idToken);
  return {
    idToken,
    email: payload.email || '',
    name: payload.name || payload.given_name || '',
    picture: payload.picture || '',
  };
}
