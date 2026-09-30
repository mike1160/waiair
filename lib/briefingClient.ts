/**
 * Asking the proxy a briefing question [T/1].
 *
 * The payload is built by `briefingPayload` below, from a fixed list of fields, and that is the whole
 * privacy story on this side: there is no path by which a mail body, a hotel address or a traveller's name
 * could be attached, because nothing here copies an object wholesale. The proxy builds its prompt from the
 * same fixed list again (proxy/briefing.js), so the guarantee holds even if this file is wrong.
 *
 * Eight seconds and then it gives up, because that is how long someone will stare at a spinner before
 * deciding the app is broken.
 */

import { PROXY_BASE } from './proxyUrl.ts';
import { knownTemperature } from './temperatureValue.ts';

/** Everything the proxy is ever told. Anything not on this list does not exist as far as a question goes. */
export interface BriefingPayload {
  flight: {
    number: string;
    origin: string;
    destination: string;
    /** The airports by name as well as by code [T/1], so "HKT" is never guessed as Hong Kong. */
    originCity: string;
    destinationAirport: string;
    airline: string;
    departureTime: string;
    arrivalTime: string;
    status: string;
    delayMinutes: number;
  };
  phase: string;
  weather: { temp: number | null; condition: string };
  destinationCity: string;
  language: string;
  question: string;
}

export interface BriefingFacts {
  number?: string;
  origin?: string;
  destination?: string;
  originCity?: string;
  destinationAirport?: string;
  airline?: string;
  departureTime?: string;
  arrivalTime?: string;
  status?: string;
  delayMinutes?: number | null;
  phase?: string | null;
  temp?: number | null;
  condition?: string;
  destinationCity?: string;
  language?: string;
}

function s(v: unknown, max = 120): string {
  return String(v ?? '').trim().slice(0, max);
}

/** The journey, and only the journey. */
export function briefingPayload(facts: BriefingFacts, question: string): BriefingPayload {
  // [W/12] This used to coerce with Number(), and Number(null) is 0 — which the isFinite check then
  // accepted as a real reading. The facts say null for "no weather yet"; it became zero degrees.
  const temp = knownTemperature(facts.temp);
  return {
    flight: {
      number: s(facts.number, 10).toUpperCase(),
      origin: s(facts.origin, 4).toUpperCase(),
      destination: s(facts.destination, 4).toUpperCase(),
      originCity: s(facts.originCity, 60),
      destinationAirport: s(facts.destinationAirport, 60),
      airline: s(facts.airline, 60),
      departureTime: s(facts.departureTime, 40),
      arrivalTime: s(facts.arrivalTime, 40),
      status: s(facts.status, 24),
      delayMinutes: Math.round(Number(facts.delayMinutes) || 0),
    },
    phase: s(facts.phase, 24).toUpperCase(),
    weather: { temp, condition: s(facts.condition, 40) },
    destinationCity: s(facts.destinationCity, 60),
    language: s(facts.language, 5).toLowerCase() || 'en',
    question: s(question, 300),
  };
}

export type BriefingResult =
  | { ok: true; answer: string }
  | { ok: false; reason: 'unavailable' | 'error' };

/**
 * Timeout in step with the proxy's own, so the app gives up at the same moment the request does.
 * [W/12] Raised with it, from 8s: a 400-token answer takes longer to generate than a 150-token one.
 */
export const BRIEFING_TIMEOUT_MS = 15000;

/**
 * One question, one answer. Never throws: a briefing that fails shows "try again", which is the truth, and
 * never a sentence the app made up to fill the space.
 */
export async function askBriefing(
  facts: BriefingFacts,
  question: string,
  opts: { fetchImpl?: typeof fetch; base?: string; timeoutMs?: number } = {},
): Promise<BriefingResult> {
  const text = s(question, 300);
  if (!text) return { ok: false, reason: 'error' };
  const doFetch = opts.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? BRIEFING_TIMEOUT_MS);
  try {
    const res = await doFetch(`${opts.base || PROXY_BASE}/api/briefing`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(briefingPayload(facts, text)),
      signal: controller.signal,
    });
    if (res.status === 503) return { ok: false, reason: 'unavailable' };
    if (!res.ok) return { ok: false, reason: 'error' };
    const json = await res.json() as { answer?: string };
    const answer = s(json?.answer, 600);
    return answer ? { ok: true, answer } : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
