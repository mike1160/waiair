import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from './constants/theme';
import { minutesUntilDeparture, isStillOnGround } from './boardingCountdown';
import { formatGateLabel, hasRealGate } from './GateBadge';
import { WeatherGlyph } from './LuxuryInfoPanel';
import { usableAirportCode } from './lib/airportCode';
import { airportRecByIata, displayAirportIata } from './lib/airportsDb';
import { taxiMinutes, fetchWeatherSnapshot, type WeatherSnapshot } from './lib/destinationServices';
import {
  flightClockUtcMs,
  formatAirportClock,
  resolveDepartureIso,
  type FlightClockFields,
} from './lib/flightTimes';
import {
  aircraftFlightsFromJson,
  parseAircraftFlightItem,
  pickInboundAircraftFlight,
  type InboundAircraftFlight,
} from './lib/inboundAircraft';
import { isInternationalFlight } from './lib/homeNow';
import { leaveAtUtcMs } from './lib/leaveTime';
import { fetchJsonRetry } from './lib/net';
import { formatTempC, getPrefs } from './lib/prefs';
import { t } from './lib/i18n';
import { runWhileAppActive } from './lib/appActivity';
import { useTrackModuleShown } from './lib/useTrackModuleShown';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const WINDOW_MIN = 12 * 60;

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
  if (s.includes('board')) return Theme.statusGreen;
  if (s.includes('delay')) return Theme.statusAmber;
  if (s.includes('cancel')) return Theme.statusRed;
  return Theme.statusBlue;
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

async function fetchInbound(f: MorningFlight, depIso: string): Promise<InboundBits | null> {
  const reg = String(f.aircraftReg || '').replace(/\s+/g, '').toUpperCase();
  const origin = usableAirportCode(f.origin);
  if (!reg || !origin || !depIso) return null;
  const json = await fetchJsonRetry(`${PROXY}/aircraft/reg/${encodeURIComponent(reg)}/flights`);
  const candidates = aircraftFlightsFromJson(json)
    .map(parseAircraftFlightItem)
    .filter((row): row is InboundAircraftFlight => !!row);
  const best = pickInboundAircraftFlight(candidates, {
    originIata: origin,
    originCountry: f.originCountry,
    ourNumber: f.number,
    depIso,
  });
  if (!best) return null;
  if (best.delayed) return { label: t().inboundBriefDelayed, color: Theme.statusAmber };
  if (best.landed) return { label: t().inboundBriefLanded, color: Theme.statusGreen };
  return { label: t().inboundBriefOnTime, color: Theme.statusBlue };
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
  const accent = flight ? accentFor(flight.status) : Theme.statusBlue;
  const hour12 = getPrefs().timeFormat === '12h';

  useEffect(() => {
    if (!flight || !Number.isFinite(depMs)) {
      setInbound(null);
      return;
    }
    let cancelled = false;
    fetchInbound(flight, depIso)
      .then(next => { if (!cancelled) setInbound(next); })
      .catch(() => { if (!cancelled) setInbound(null); });
    return () => { cancelled = true; };
  }, [flight?.id, flight?.aircraftReg, flight?.origin, flight?.number, depIso]);

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

  useTrackModuleShown('morning_briefing', !!flight && Number.isFinite(depMs));

  if (!flight || !Number.isFinite(depMs)) return null;

  const origin = displayAirportIata(flight.origin) || flight.origin;
  const dest = displayAirportIata(flight.destination) || flight.destination;
  const depClock = formatAirportClock(depIso, flight.origin, hour12, flight.originCountry);
  const gate = hasRealGate(flight.gate) ? formatGateLabel(flight.gate) : '';
  const leaveMs = leaveAtUtcMs(depMs, {
    international: isInternationalFlight(flight),
    tight: getPrefs().airportTiming === 'tight',
    travelMin: taxiMinutes(flight.origin),
  }).leaveAt;
  const leaveClock = formatAirportClock(
    new Date(leaveMs).toISOString(),
    flight.origin,
    hour12,
    flight.originCountry,
  );
  const temp = wx ? formatTempC(wx.temp, getPrefs().tempUnit) : '';

  return (
    <View style={[st.card, { borderLeftColor: accent }]}>
      <Text style={st.kicker}>{t().departureBriefing}</Text>
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
      <Text style={st.line}>{t().leaveBy(leaveClock)}</Text>
      <Pressable
        onPress={() => onOpenDetails(flight)}
        style={({ pressed }) => [st.cta, { backgroundColor: accent }, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={t().openFullDetails}
      >
        <Text style={st.ctaTxt}>{t().openFullDetails}</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: Theme.card,
    borderRadius: Theme.cardRadius,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: 'rgba(170,190,220,0.18)',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    padding: Theme.cardPadding,
    gap: 3,
  },
  kicker: {
    color: Theme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  flight: {
    color: Theme.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  line: {
    color: Theme.textMuted,
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
    color: Theme.text,
    fontSize: 13,
    fontWeight: '800',
  },
});
