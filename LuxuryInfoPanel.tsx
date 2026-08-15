import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  Briefcase,
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CurrencyEur,
  Snowflake,
  SunHorizon,
} from 'phosphor-react-native';
import {
  fetchFxSnapshot,
  fetchWeatherSnapshot,
  formatRate,
  localTimeSnapshot,
  type FxSnapshot,
  type LocalTimeSnapshot,
  type WeatherKind,
  type WeatherSnapshot,
} from './lib/destinationServices';
import { formatTempC, getPrefs, subscribePrefs } from './lib/prefs';
import CountryInfoCard from './CountryInfoCard';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
  list: string;
};

export function WeatherGlyph({ icon, color, size = 18 }: { icon: WeatherKind; color: string; size?: number }) {
  const props = { size, color } as const;
  if (icon === 'sun') return <SunHorizon {...props} />;
  if (icon === 'cloud') return <Cloud {...props} />;
  if (icon === 'rain') return <CloudRain {...props} />;
  if (icon === 'storm') return <CloudLightning {...props} />;
  if (icon === 'snow') return <Snowflake {...props} />;
  return <CloudFog {...props} />;
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <View style={st.card}>{children}</View>;
}

export default function LuxuryInfoPanel({
  originIata,
  destIata,
  originCity,
  destCity,
  destCountry,
  originLat,
  originLon,
  destLat,
  destLon,
  arrivalIso,
  status,
  baggage,
  terminal,
  theme,
}: {
  originIata?: string;
  destIata?: string;
  originCity?: string;
  destCity?: string;
  destCountry?: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  arrivalIso?: string;
  status?: string;
  baggage?: string;
  terminal?: string;
  premium?: boolean;
  theme: ThemeBits;
}) {
  const [originWx, setOriginWx] = useState<WeatherSnapshot | null>(null);
  const [destWx, setDestWx] = useState<WeatherSnapshot | null>(null);
  const [fx, setFx] = useState<FxSnapshot | null>(null);
  const [local, setLocal] = useState<LocalTimeSnapshot>(() =>
    localTimeSnapshot(destIata, destCountry, { iata: originIata, city: originCity }),
  );
  const [busy, setBusy] = useState(true);
  const [, setPrefTick] = useState(0);
  useEffect(() => subscribePrefs(() => setPrefTick(n => n + 1)), []);
  const tempUnit = getPrefs().tempUnit;

  useEffect(() => {
    const id = setInterval(() => setLocal(localTimeSnapshot(destIata, destCountry, { iata: originIata, city: originCity })), 30000);
    setLocal(localTimeSnapshot(destIata, destCountry, { iata: originIata, city: originCity }));
    return () => clearInterval(id);
  }, [destIata, destCountry, originIata, originCity]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    (async () => {
      const [o, d, rates] = await Promise.all([
        originLat != null && originLon != null
          ? fetchWeatherSnapshot(originLat, originLon, originCity || originIata || '')
          : Promise.resolve(null),
        destLat != null && destLon != null
          ? fetchWeatherSnapshot(destLat, destLon, destCity || destIata || '', arrivalIso)
          : Promise.resolve(null),
        fetchFxSnapshot(destCountry),
      ]);
      if (cancelled) return;
      setOriginWx(o);
      setDestWx(d);
      setFx(rates);
      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [originIata, destIata, destCountry, originLat, originLon, destLat, destLon, arrivalIso, originCity, destCity]);

  const belt = String(baggage || '').trim();
  const showBaggage = !!belt;
  const city = destCity || destWx?.city || destIata || 'destination';
  const usdDest = fx?.usdToDest ?? (fx?.eurToDest && fx.eurToDest > 0 && fx.destCode !== 'USD' ? null : null);

  return (
    <View style={st.wrap}>
      {originWx || destWx ? (
        <InfoCard>
          <View style={st.row}>
            {originWx ? (
              <View style={st.wxCol}>
                <WeatherGlyph icon={originWx.icon} color={theme.accent} />
                <Text style={[st.wxTxt, { color: theme.text }]}>
                  {originIata || 'DEP'} {formatTempC(originWx.temp, tempUnit)}
                </Text>
              </View>
            ) : <View style={st.wxCol} />}
            <Text style={[st.arrow, { color: theme.muted }]}>→</Text>
            {destWx ? (
              <View style={[st.wxCol, { alignItems: 'flex-end' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <WeatherGlyph icon={destWx.icon} color={theme.accent} />
                  <Text style={[st.wxTxt, { color: theme.text }]}>
                    {destIata || 'ARR'} {formatTempC(destWx.temp, tempUnit)}
                  </Text>
                </View>
              </View>
            ) : <View style={st.wxCol} />}
          </View>
          {destWx ? (
            <>
              <Text style={[st.sub, { color: theme.secondary }]}>
                {destWx.city || city} now: {formatTempC(destWx.temp, tempUnit)} · {destWx.description}
              </Text>
              <Text style={[st.sub, { color: theme.muted }]}>
                Feels like {formatTempC(destWx.feelsLike, tempUnit)} · Humidity {destWx.humidity}%
              </Text>
              {destWx.landingTemp != null ? (
                <Text style={[st.sub, { color: theme.muted }]}>
                  At landing: {formatTempC(destWx.landingTemp, tempUnit)} · {destWx.landingLabel || destWx.description}
                </Text>
              ) : null}
            </>
          ) : null}
        </InfoCard>
      ) : busy ? (
        <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 8 }} />
      ) : null}

      <InfoCard>
        <View style={st.head}>
          <Clock size={16} color={theme.accent} />
          <Text style={[st.title, { color: theme.text, flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">Local time {city}</Text>
        </View>
        <Text style={[st.hero, { color: theme.text }]} numberOfLines={1} allowFontScaling={false}>
          {city}: {local.time} · {local.utcOffset}
        </Text>
        <Text style={[st.sub, { color: theme.secondary }]} numberOfLines={1} ellipsizeMode="tail">{local.relative}</Text>
      </InfoCard>

      {fx?.eurToDest != null ? (
        <InfoCard>
          <View style={st.head}>
            <CurrencyEur size={16} color={theme.accent} />
            <Text style={[st.title, { color: theme.text }]}>Currency</Text>
          </View>
          <Text style={[st.body, { color: theme.text }]}>1 EUR = {formatRate(fx.eurToDest)} {fx.destCode}</Text>
          {usdDest != null ? (
            <Text style={[st.body, { color: theme.text, marginTop: 4 }]}>1 USD = {formatRate(usdDest)} {fx.destCode}</Text>
          ) : fx.destCode === 'USD' ? (
            <Text style={[st.sub, { color: theme.secondary }]}>1 EUR = {formatRate(fx.eurToDest)} USD</Text>
          ) : null}
        </InfoCard>
      ) : null}

      <CountryInfoCard
        country={destCountry}
        theme={{
          text: theme.text,
          secondary: theme.secondary,
          muted: theme.muted,
          accent: theme.accent,
          border: theme.border,
          card: theme.card,
          list: theme.list,
        }}
      />

      {showBaggage ? (
        <InfoCard>
          <View style={st.head}>
            <Briefcase size={16} color={theme.accent} />
            <Text style={[st.title, { color: theme.text }]}>Baggage</Text>
          </View>
          {belt ? (
            <>
              <Text style={[st.body, { color: theme.text }]}>
                {status === 'landed'
                  ? `🧳 Belt ${belt} · Collecting now`
                  : `🧳 Belt ${belt} expected`}
              </Text>
              {terminal ? (
                <Text style={[st.sub, { color: theme.secondary }]}>
                  Terminal {String(terminal).replace(/^terminal\s+/i, '')}
                </Text>
              ) : null}
            </>
          ) : null}
        </InfoCard>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 10, marginTop: 8, marginBottom: 8 },
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(136,150,176,0.08)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 13, fontWeight: '700' },
  hero: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  body: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  sub: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wxCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  wxTxt: { fontSize: 14, fontWeight: '700' },
  arrow: { fontSize: 14, fontWeight: '700', paddingHorizontal: 8 },
});
