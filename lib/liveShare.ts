import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { getSupabase, supabaseEnabled } from './supabase';
import type { NextFlightShareData } from '../MyNextFlightShare';

export const LIVE_SHARE_BASE = 'https://waiair.app/live';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const LIVE_TTL_MS = 24 * 60 * 60 * 1000;

export type LiveShareSession = {
  shareCode: string;
  flightNumber: string;
  senderName?: string | null;
  customMessage?: string | null;
  originIata?: string;
  destIata?: string;
  originCity?: string;
  destCity?: string;
  airline?: string;
  url: string;
  expiresAt: string;
};

function normalizeCode(raw: string): string {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function prettyFlightNumber(n: string): string {
  const s = String(n || '').replace(/\s+/g, '').toUpperCase();
  const m = s.match(/^([A-Z]{1,3})(\d{1,4}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : (n || '').trim();
}

export function liveShareUrl(codeOrFlight: string): string {
  const c = normalizeCode(codeOrFlight);
  return `${LIVE_SHARE_BASE}/${encodeURIComponent(c)}`;
}

export function flightLiveUrl(flightNumber: string): string {
  return liveShareUrl(String(flightNumber || '').replace(/\s+/g, '').toUpperCase());
}

async function createViaProxy(input: {
  flightNumber: string;
  senderName?: string;
  customMessage?: string;
  originIata?: string;
  destIata?: string;
  originCity?: string;
  destCity?: string;
  airline?: string;
}): Promise<LiveShareSession> {
  const res = await fetch(`${PROXY}/live`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(String(err?.error || `Live share failed (${res.status})`));
  }
  const data = await res.json();
  const code = normalizeCode(data.shareCode || data.code);
  return {
    shareCode: code,
    flightNumber: prettyFlightNumber(data.flightNumber || input.flightNumber),
    senderName: data.senderName ?? input.senderName ?? null,
    customMessage: data.customMessage ?? input.customMessage ?? null,
    originIata: data.originIata || input.originIata,
    destIata: data.destIata || input.destIata,
    originCity: data.originCity || input.originCity,
    destCity: data.destCity || input.destCity,
    airline: data.airline || input.airline,
    url: data.url || liveShareUrl(code),
    expiresAt: data.expiresAt || new Date(Date.now() + LIVE_TTL_MS).toISOString(),
  };
}

async function createViaSupabase(input: {
  flightNumber: string;
  senderName?: string;
  customMessage?: string;
  originIata?: string;
  destIata?: string;
  originCity?: string;
  destCity?: string;
  airline?: string;
  shareCode: string;
  expiresAt: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from('live_shares').insert({
    share_code: input.shareCode,
    flight_number: String(input.flightNumber || '').replace(/\s+/g, '').toUpperCase(),
    sender_name: input.senderName?.trim() || null,
    custom_message: input.customMessage?.trim() || null,
    origin_iata: input.originIata || null,
    dest_iata: input.destIata || null,
    origin_city: input.originCity || null,
    dest_city: input.destCity || null,
    airline: input.airline || null,
    expires_at: input.expiresAt,
  });
}

export async function createLiveShare(
  data: NextFlightShareData,
  opts?: { senderName?: string; customMessage?: string },
): Promise<LiveShareSession> {
  const payload = {
    flightNumber: data.flightNumber,
    senderName: opts?.senderName?.trim() || undefined,
    customMessage: opts?.customMessage?.trim() || undefined,
    originIata: data.originIata,
    destIata: data.destIata,
    originCity: data.originCity,
    destCity: data.destCity,
    airline: data.airline,
  };

  const session = await createViaProxy(payload);

  if (supabaseEnabled()) {
    try {
      await createViaSupabase({ ...payload, shareCode: session.shareCode, expiresAt: session.expiresAt });
    } catch { /* proxy session still valid */ }
  }

  return session;
}

export async function copyLiveShareLink(url: string): Promise<void> {
  await Clipboard.setStringAsync(url);
}

export async function shareLiveLink(url: string, message: string): Promise<void> {
  try {
    await Share.share({ message: `${message}\n${url}`, url });
  } catch {
    await Share.share({ message: `${message}\n${url}` });
  }
}

export function buildLiveShareMessage(data: NextFlightShareData, senderName?: string): string {
  const num = prettyFlightNumber(data.flightNumber);
  const route = `${data.originIata} → ${data.destIata}`;
  const who = senderName?.trim();
  if (who) return `✈️ ${who} is flying ${num} (${route}) — track live:`;
  return `✈️ Track ${num} ${route} live:`;
}
