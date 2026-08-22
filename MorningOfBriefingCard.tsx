import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { minutesUntilDeparture, isStillOnGround } from './boardingCountdown';
import { formatGateLabel, hasRealGate } from './GateBadge';
import { WeatherGlyph } from './LuxuryInfoPanel';
import { airportRecByIata, displayAirportIata } from './lib/airportsDb';
import { fetchWeatherSnapshot, type WeatherSnapshot } from './lib/destinationServices';
import {
  flightClockUtcMs,
  formatAirportClock,
  resolveDepartureIso,
  type FlightClockFields,
} from './lib/flightTimes';
import { fetchJsonRetry } from './lib/net';
import { formatTempC, getPrefs } from './lib/prefs';
import { runWhileAppActive } from './lib/appActivity';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const WINDOW_MIN = 12 * 60;
const LEAVE_BEFORE_MIN = 45;
const BG = '#0f1117';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';
const BOARDING = '#22c55e';
const DELAYED = '#f59e0b';
const ON_TIME = '#3b82f6';
const LANDED = '#22c55e';

export type MorningFlight = FlightClockFields & {
  id: string;
  number: string;
  origin: string;
  originCity?: string;
  originCountry?: string;
  destination: string;
  destCity?: string;
  destCountry?: string;
  status: string;
  gate?: string;
  aircraftReg?: string;
  delay?: number;
};

type InboundBits = {
  label: string;
  color: string;
};

function accentFor(status: string): string {
  const s = String(status || '').toLowerCase();
  if (s.includes('board')) return BOARDING;
  if (s.includes('delay')) return DELAYED;
  if (s.includes('cancel')) return '#ef4444';
  return ON_TIME;
}

function pickMorningFlight(flights: MorningFlight[], now: number): MorningFlight | null {
  let best: MorningFlight | null = null;
  let bestMins = Infinity;
  for (const f of flights) {
    if (!isStillOnGround(f, now)) continue;
    const mins = minutesUntilDeparture(f, now);
    if (mins == null || mins < 0 || mins > WINDOW_MIN) continue;
    if (mins < bestMins) {
      bestMins = mins;
      best = f;
    }
  }
  return best;
}

function adbTime(side: any, keys: string[]): string {
  if (!side || typeof side !== 'object') return '';
  for (const k of keys) {
    const v = side[k];
    if (!v) continue;
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'object') {
      const t = v.utc || v.local || v.scheduledTime || '';
      if (typeof t === 'string' && t.trim()) return t;
    }
  }
  return '';
}

function adbIata(ap: any): string {
  return displayAirportIata(ap?.iata || ap?.iataCode || ap?.localCode);
}

async function fetchInbound(f: MorningFlight, depMs: number): Promise<InboundBits | null> {
  const reg = String(f.aircraftReg || '').replace(/\s+/g, '').toUpperCase();
  const origin = displayAirportIata(f.origin);
  if (!reg || !origin || !Number.isFinite(depMs)) return null;
  const ours = String(f.number || '').replace(/\s+/g, '').toUpperCase();
  const json = await fetchJsonRetry(`${PROXY}/aircraft/reg/${encodeURIComponent(reg)}/flights`);
  const items = Array.isArray(json)
    ? json
    : Array.isArray(json?.flights) ? json.flights
    : json && typeof json === 'object' ? [json]
    : [];
  let bestMs = -Infinity;
  let delayed = false;
  let landed = false;
  for (const item of items) {
    const arr = item?.arrival ?? {};
    const dest = adbIata(arr.airport);
    if (dest !== origin) continue;
    const num = String(item?.number || '').replace(/\s+/g, '').toUpperCase();
    if (num && num === ours) continue;
    const actual = adbTime(arr, ['runwayTime', 'actualTime']);
    const revised = adbTime(arr, ['revisedTime', 'predictedTime']);
    const scheduled = adbTime(arr, ['scheduledTime']);
    const arrIso = actual || revised || scheduled;
    const arrMs = arrIso ? new Date(String(arrIso).replace(' ', 'T')).getTime() : NaN;
    if (!Number.isFinite(arrMs) || arrMs >= depMs) continue;
    if (arrMs <= bestMs) continue;
    bestMs = arrMs;
    const st = String(item?.status || '').toLowerCase();
    landed = st === 'arrived' || st === 'landed' || !!actual;
    const schedMs = scheduled ? new Date(String(scheduled).replace(' ', 'T')).getTime() : NaN;
    const lateMs = (actual || revised) ? new Date(String(actual || revised).replace(' ', 'T')).getTime() : NaN;
    delayed = st.includes('delay') || (Number.isFinite(schedMs) && Number.isFinite(lateMs) && lateMs - schedMs > 5 * 60000);
  }
  if (bestMs < 0) return null;
  if (delayed) return { label: 'Inbound delayed', color: DELAYED };
  if (landed) return { label: 'Inbound landed', color: LANDED };
  return { label: 'Inbound on time', color: ON_TIME };
}

export default function MorningOfBriefingCard({
  flights,
  onOpenDetails,
}: {
  flights: MorningFlight[];
  onOpenDetails: (f: MorningFlight) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [wx, setWx] = useState<WeatherSnapshot | null>(null);
  const [inbound, setInbound] = useState<InboundBits | null>(null);

  useEffect(() => {
    return runWhileAppActive(() => {
      const id = setInterval(() => setNow(Date.now()), 30000);
      return () => clearInterval(id);
    });
  }, []);

  const flight = useMemo(() => pickMorningFlight(flights, now), [flights, now]);
  const depIso = flight ? resolveDepartureIso(flight) : '';
  const depMs = flight
    ? (flightClockUtcMs(depIso, flight.origin, flight.originCountry) ?? NaN)
    : NaN;
  const accent = flight ? accentFor(flight.status) : ON_TIME;
  const hour12 = getPrefs().timeFormat === '12h';

  useEffect(() => {
    if (!flight || !Number.isFinite(depMs)) {
      setInbound(null);
      return;
    }
    let cancelled = false;
    fetchInbound(flight, depMs)
      .then(next => { if (!cancelled) setInbound(next); })
      .catch(() => { if (!cancelled) setInbound(null); });
    return () => { cancelled = true; };
  }, [flight?.id, flight?.aircraftReg, flight?.origin, flight?.number, depMs]);

  useEffect(() => {
    if (!flight) {
      setWx(null);
      return;
    }
    const rec = airportRecByIata(flight.origin);
    if (!rec || !Number.isFinite(rec.lat) || !Number.isFinite(rec.lon)) {
      setWx(null);
      return;
    }
    let cancelled = false;
    fetchWeatherSnapshot(rec.lat, rec.lon, rec.city || flight.origin, depIso, flight.origin, flight.originCountry)
      .then(snap => { if (!cancelled) setWx(snap); })
      .catch(() => { if (!cancelled) setWx(null); });
    return () => { cancelled = true; };
  }, [flight?.id, flight?.origin, depIso]);

  if (!flight || !Number.isFinite(depMs)) return null;

  const origin = displayAirportIata(flight.origin) || flight.origin;
  const dest = displayAirportIata(flight.destination) || flight.destination;
  const depClock = formatAirportClock(depIso, flight.origin, hour12, flight.originCountry);
  const gate = hasRealGate(flight.gate) ? formatGateLabel(flight.gate) : '';
  const leaveMs = depMs - LEAVE_BEFORE_MIN * 60 * 1000;
  const leaveClock = formatAirportClock(
    new Date(leaveMs).toISOString(),
    flight.origin,
    hour12,
    flight.originCountry,
  );
  const temp = wx ? formatTempC(wx.temp, getPrefs().tempUnit) : '';

  return (
    <View style={[st.card, { borderLeftColor: accent }]}>
      <Text style={st.kicker}>Morning of</Text>
      <Text style={st.flight}>
        {String(flight.number || '').replace(/\s+/g, '').toUpperCase()}
        {origin && dest ? `  ${origin} → ${dest}` : ''}
      </Text>
      <Text style={st.line}>
        {depClock}
        {gate ? `  ·  ${gate}` : ''}
      </Text>
      {inbound ? (
        <Text style={[st.line, { color: inbound.color }]}>{inbound.label}</Text>
      ) : null}
      {wx ? (
        <View style={st.wxRow}>
          <WeatherGlyph icon={wx.icon} color={accent} size={15} />
          <Text style={st.line}>
            {temp}{wx.description ? `  ${wx.description}` : ''}
          </Text>
        </View>
      ) : null}
      <Text style={st.line}>Leave by {leaveClock}</Text>
      <Pressable
        onPress={() => onOpenDetails(flight)}
        style={({ pressed }) => [st.cta, { backgroundColor: accent }, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Open full details"
      >
        <Text style={st.ctaTxt}>Open full details</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: BG,
    borderRadius: 14,
    borderLeftWidth: 3,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  kicker: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  flight: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  line: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  wxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cta: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  ctaTxt: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
  },
});
