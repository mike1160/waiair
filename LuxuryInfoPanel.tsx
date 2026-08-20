import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
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
import { runWhileAppActive } from './lib/appActivity';
import { formatTempC, getPrefs, subscribePrefs } from './lib/prefs';
import { EMPTY_CLOCK, formatAirportClock } from './lib/flightTimes';
import CountryInfoCard from './CountryInfoCard';
import { t } from './lib/i18n';
import { cleanBaggageBelt } from './lib/baggageBelt';
import { showLandingBaggage, type LandingCardPhase } from './lib/landingCards';
import { fxPctAboveAverage, getFxAverage, isFavorableFxRate } from './lib/fxRateHistory';

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
  destDisplayName,
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
  originCountry,
  landingPhase,
  theme,
}: {
  originIata?: string;
  destIata?: string;
  destDisplayName?: string;
  originCity?: string;
  destCity?: string;
  originCountry?: string;
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
  landingPhase?: LandingCardPhase;
  theme: ThemeBits;
}) {
  const [originWx, setOriginWx] = useState<WeatherSnapshot | null>(null);
  const [destWx, setDestWx] = useState<WeatherSnapshot | null>(null);
  const [fx, setFx] = useState<FxSnapshot | null>(null);
  const [local, setLocal] = useState<LocalTimeSnapshot>(() =>
    localTimeSnapshot(destIata, destCountry, { iata: originIata, city: originCity }),
  );
  const [busy, setBusy] = useState(true);
  const [fxAvg, setFxAvg] = useState<number | null>(null);
  const [, setPrefTick] = useState(0);
  useEffect(() => subscribePrefs(() => setPrefTick(n => n + 1)), []);
  const tempUnit = getPrefs().tempUnit;

  useEffect(() => {
    return runWhileAppActive(() => {
      setLocal(localTimeSnapshot(destIata, destCountry, { iata: originIata, city: originCity }));
      const id = setInterval(() => setLocal(localTimeSnapshot(destIata, destCountry, { iata: originIata, city: originCity })), 30000);
      return () => clearInterval(id);
    });
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
          ? fetchWeatherSnapshot(destLat, destLon, destCity || destIata || '', arrivalIso, destIata, destCountry)
          : Promise.resolve(null),
        fetchFxSnapshot(originIata, originCountry, destIata, destCountry),
      ]);
      if (cancelled) return;
      setOriginWx(o);
      setDestWx(d);
      setFx(rates);
      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [originIata, destIata, originCountry, destCountry, originLat, originLon, destLat, destLon, arrivalIso, originCity, destCity]);

  useEffect(() => {
    let cancelled = false;
    if (!fx?.destCode || fx.usdToDest == null) {
      setFxAvg(null);
      return;
    }
    getFxAverage(fx.destCode).then(avg => {
      if (!cancelled) setFxAvg(avg);
    }).catch(() => {
      if (!cancelled) setFxAvg(null);
    });
    return () => { cancelled = true; };
  }, [fx?.destCode, fx?.usdToDest]);

  const belt = cleanBaggageBelt(baggage);
  const phase = landingPhase ?? (status === 'landed' ? 'immediate' : 'none');
  const showBaggage = showLandingBaggage(phase, !!belt);
  const city = destDisplayName || destCity || destWx?.city || destIata || '';
  const showLocalFx = !!(fx?.localCode && fx.localToDest != null && fx.localCode !== fx.destCode && fx.localCode !== 'USD');
  const showUsdFx = fx?.usdToDest != null;
  const fxAlert = showUsdFx && fxAvg != null && fx!.usdToDest != null
    && isFavorableFxRate(fx!.usdToDest!, fxAvg);
  const arrClock = arrivalIso
    ? formatAirportClock(arrivalIso, destIata, getPrefs().timeFormat === '12h', destCountry)
    : EMPTY_CLOCK;
  const showArrClock = !!(arrClock && arrClock !== EMPTY_CLOCK);
  const landed = String(status || '').toLowerCase() === 'landed';

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
          <Text style={[st.title, { color: theme.text, flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">{t().localTimeCity(city)}</Text>
        </View>
        <Text style={[st.hero, { color: theme.text }]} numberOfLines={1} allowFontScaling={false}>
          {city}: {local.time} · {local.utcOffset}
        </Text>
        <Text style={[st.sub, { color: theme.secondary }]} numberOfLines={1} ellipsizeMode="tail">{local.relative}</Text>
        {showArrClock ? (
          <Text
            style={[st.arriveLine, { color: theme.accent }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {landed ? t().flightArrivedAtLocal(arrClock) : t().flightArrivesAtLocal(arrClock)}
          </Text>
        ) : null}
      </InfoCard>

      {showLocalFx || showUsdFx ? (
        <InfoCard>
          {fxAlert ? (
            <View style={[st.fxBanner, { borderColor: theme.accent, backgroundColor: `${theme.accent}18` }]}>
              <Text style={[st.fxBannerTitle, { color: theme.accent }]}>
                {`💱 ${t().fxGoodTimeExchange}`}
              </Text>
              <Text style={[st.fxBannerBody, { color: theme.text }]}>
                {t().fxStrongerThanUsual(fx!.destCode, fxPctAboveAverage(fx!.usdToDest!, fxAvg!))}
              </Text>
              <Text style={[st.fxBannerSub, { color: theme.secondary }]}>
                {t().fxUsdVsAvg(formatRate(fx!.usdToDest), formatRate(fxAvg), fx!.destCode)}
              </Text>
            </View>
          ) : null}
          <View style={st.head}>
            <CurrencyEur size={16} color={theme.accent} />
            <Text style={[st.title, { color: theme.text }]}>{t().currency}</Text>
          </View>
          {showLocalFx ? (
            <Text style={[st.body, { color: theme.text }]}>
              {t().localRate(formatRate(fx!.localToDest), fx!.localCode!, fx!.destCode)}
            </Text>
          ) : null}
          {showUsdFx ? (
            <Text style={[st.body, { color: theme.text, marginTop: showLocalFx ? 4 : 0 }]}>
              {t().usdRate(formatRate(fx!.usdToDest), fx!.destCode)}
            </Text>
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
          <Text style={[st.body, { color: theme.text }]}>
            {`🧳 ${t().baggageBeltColon(belt)}`}
          </Text>
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
  arriveLine: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  body: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  sub: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wxCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  wxTxt: { fontSize: 14, fontWeight: '700' },
  arrow: { fontSize: 14, fontWeight: '700', paddingHorizontal: 8 },
  fxBanner: { borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth },
  fxBannerTitle: { fontSize: 13, fontWeight: '800' },
  fxBannerBody: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  fxBannerSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
});
