import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  formatCurrencyAmount,
  localTimeSnapshot,
  xeCurrencyCalculatorUrl,
  type FxSnapshot,
  type LocalTimeSnapshot,
  type WeatherKind,
  type WeatherSnapshot,
} from './lib/destinationServices';
import { runWhileAppActive } from './lib/appActivity';
import { formatTempC, getPrefs, subscribePrefs } from './lib/prefs';
import { EMPTY_CLOCK, formatAirportClock } from './lib/flightTimes';
import { Theme } from './constants/theme';
import CountryInfoCard from './CountryInfoCard';
import { t } from './lib/i18n';
import { cleanBaggageBelt } from './lib/baggageBelt';
import LostLuggagePrompt from './LostLuggagePrompt';
import { showLandingBaggage, type LandingCardPhase } from './lib/landingCards';
import { fxPctAboveAverage, getFxAverage, isFavorableFxRate } from './lib/fxRateHistory';
import { haptics } from './lib/haptics';

const FX_FLAGS: Record<string, string> = {
  EUR: '🇪🇺',
  USD: '🇺🇸',
  GBP: '🇬🇧',
  QAR: '🇶🇦',
  AED: '🇦🇪',
  SGD: '🇸🇬',
  THB: '🇹🇭',
  MYR: '🇲🇾',
  IDR: '🇮🇩',
  JPY: '🇯🇵',
  CHF: '🇨🇭',
  AUD: '🇦🇺',
  CAD: '🇨🇦',
};

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
  return <View style={st.block}>{children}</View>;
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
  airlineCode,
  landedAtMs,
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
  airlineCode?: string;
  landedAtMs?: number | null;
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
  const [convertAmount, setConvertAmount] = useState('100');
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
  const showLocalFx = !!(fx?.localCode && fx.localToDest != null && fx.localCode !== fx.destCode && fx.localCode !== 'USD' && fx.localCode !== 'EUR');
  const showEurFx = fx?.eurToDest != null && fx.destCode !== 'EUR';
  const showUsdFx = fx?.usdToDest != null && fx.destCode !== 'USD';
  const fxAlert = showUsdFx && fxAvg != null && fx!.usdToDest != null
    && isFavorableFxRate(fx!.usdToDest!, fxAvg);
  const arrClock = arrivalIso
    ? formatAirportClock(arrivalIso, destIata, getPrefs().timeFormat === '12h', destCountry)
    : EMPTY_CLOCK;
  const showArrClock = !!(arrClock && arrClock !== EMPTY_CLOCK);
  const landed = String(status || '').toLowerCase() === 'landed';
  const amountNum = Number.parseFloat(convertAmount.replace(',', '.'));
  const hasAmount = Number.isFinite(amountNum) && amountNum >= 0;

  const fxRows = useMemo(() => {
    if (!fx) return [];
    const rows: { code: string; flag: string; rate: number }[] = [];
    if (showLocalFx && fx.localToDest != null && fx.localCode) {
      rows.push({
        code: fx.localCode,
        flag: FX_FLAGS[fx.localCode] || '💱',
        rate: fx.localToDest,
      });
    }
    if (showEurFx && fx.eurToDest != null) {
      rows.push({ code: 'EUR', flag: FX_FLAGS.EUR, rate: fx.eurToDest });
    }
    if (showUsdFx && fx.usdToDest != null) {
      rows.push({ code: 'USD', flag: FX_FLAGS.USD, rate: fx.usdToDest });
    }
    return rows;
  }, [fx, showLocalFx, showEurFx, showUsdFx]);

  const fxLinkFrom = fxRows.find(r => r.code === 'EUR')?.code
    ?? fxRows.find(r => r.code === 'USD')?.code
    ?? fxRows[0]?.code
    ?? 'USD';
  const fxLinkAmount = hasAmount ? amountNum : 100;

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

      {showLocalFx || showEurFx || showUsdFx ? (
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
          <Text style={[st.convertLabel, { color: theme.secondary }]}>{t().convert}</Text>
          <TextInput
            value={convertAmount}
            onChangeText={setConvertAmount}
            keyboardType="decimal-pad"
            placeholder="100"
            placeholderTextColor={theme.muted}
            style={[st.convertInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.list }]}
            accessibilityLabel={t().convert}
          />
          {fxRows.length > 0 ? (
            <View style={[st.fxTable, { borderColor: theme.border, backgroundColor: theme.list }]}>
              <View style={[st.fxTableHead, { borderBottomColor: theme.border }]}>
                <Text style={[st.fxTableHeadCell, st.fxColFrom, { color: theme.muted }]}>{t().fxTableFrom}</Text>
                <Text style={[st.fxTableHeadCell, st.fxColRate, { color: theme.muted }]}>{t().fxTableRate}</Text>
                <Text style={[st.fxTableHeadCell, st.fxColGet, { color: theme.muted }]}>{t().fxTableYouGet}</Text>
              </View>
              {fxRows.map((row, i) => {
                const converted = hasAmount ? amountNum * row.rate : null;
                return (
                  <View
                    key={row.code}
                    style={[
                      st.fxTableRow,
                      i < fxRows.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <View style={[st.fxColFrom, st.fxFromCell]}>
                      <Text style={st.fxFlag}>{row.flag}</Text>
                      <Text style={[st.fxCode, { color: theme.text }]}>{row.code}</Text>
                    </View>
                    <Text style={[st.fxRateCell, st.fxColRate, { color: theme.secondary }]} numberOfLines={2}>
                      1 {row.code} = {formatRate(row.rate)} {fx!.destCode}
                    </Text>
                    <Text style={[st.fxGetCell, st.fxColGet, { color: theme.text }]} numberOfLines={1}>
                      {converted != null
                        ? `${formatCurrencyAmount(converted)} ${fx!.destCode}`
                        : `— ${fx!.destCode}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          <Text style={[st.fxNote, { color: theme.muted }]}>{t().fxRatesNote}</Text>
          <Text style={[st.fxDisclaimer, { color: theme.muted }]}>{t().fxDisclaimer}</Text>
          <Pressable
            onPress={() => {
              haptics.light();
              void Linking.openURL(xeCurrencyCalculatorUrl(fxLinkFrom, fx!.destCode, fxLinkAmount));
            }}
            style={({ pressed }) => [st.fxLinkBtn, pressed && { opacity: 0.82 }]}
            accessibilityRole="link"
            accessibilityLabel={t().fxOpenCalculator}
          >
            <Text style={[st.fxLinkTxt, { color: theme.accent }]}>{t().fxOpenCalculator}</Text>
          </Pressable>
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
          <Text style={[st.baggageHero, { color: theme.text }]}>
            {`🧳 ${t().baggageBeltColon(belt)}`}
          </Text>
          <LostLuggagePrompt
            status={status}
            belt={belt}
            airlineCode={airlineCode}
            landedAtMs={landedAtMs}
            arrIso={arrivalIso}
            destIata={destIata}
            destCountry={destCountry}
            compact
          />
        </InfoCard>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: Theme.gap, marginTop: 8, marginBottom: 8 },
  block: { paddingVertical: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 13, fontWeight: '700' },
  hero: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  baggageHero: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
  arriveLine: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  body: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  convertLabel: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  convertInput: {
    marginTop: 6,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  fxTable: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fxTableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fxTableHeadCell: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fxTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  fxColFrom: { flex: 0.85 },
  fxColRate: { flex: 1.15 },
  fxColGet: { flex: 1, textAlign: 'right' },
  fxFromCell: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fxFlag: { fontSize: 16 },
  fxCode: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  fxRateCell: { fontSize: 11, fontWeight: '600', lineHeight: 15 },
  fxGetCell: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  fxNote: { fontSize: 11, fontWeight: '600', marginTop: 8 },
  fxDisclaimer: { fontSize: 10, fontWeight: '500', lineHeight: 14, marginTop: 4 },
  fxLinkBtn: { marginTop: 6, alignSelf: 'flex-start' },
  fxLinkTxt: { fontSize: 13, fontWeight: '700' },
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
