import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Airplane, ArrowsLeftRight, Clock, MapPin, MagnifyingGlass } from 'phosphor-react-native';
import { haptics } from './lib/haptics';
import BookThisFlightButton from './BookThisFlightButton';
import {
  airportRecByIata,
  formatRouteHint,
  matchPlaces,
  POPULAR_ROUTES,
  resolvePlaceToIata,
} from './lib/airportsDb';
import { formatFlightNumber } from './lib/flightIdent';
import { shiftDateKey } from './lib/boardFilter';
import { t } from './lib/i18n';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export type BoardFlightHit = {
  number: string;
  operatingNumber?: string;
  origin: string;
  destination: string;
  scheduledTime?: string;
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

type Row = {
  id: string;
  icon: 'pin' | 'plane' | 'route' | 'recent';
  title: string;
  subtitle?: string;
  apply?: string;
  flightNumber?: string;
  origin?: string;
  destination?: string;
  date?: string;
  route?: { from: string; to: string };
};

function clock(iso?: string): string {
  const m = String(iso || '').match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

function dayWord(iso: string | undefined, todayKey: string): string {
  const d = String(iso || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!d) return '';
  if (d === todayKey) return t().today;
  if (d === shiftDateKey(todayKey, 1)) return t().tomorrow;
  if (d === shiftDateKey(todayKey, -1)) return t().yesterday;
  return d;
}

function routeLabel(from: string, to: string): string {
  const a = airportRecByIata(from);
  const b = airportRecByIata(to);
  return `${a?.city || from} → ${b?.city || to}`;
}

export default function SmartSearchPanel({
  query,
  recentSearches,
  boardFlights,
  todayKey,
  theme,
  onApplyQuery,
  onSelectFlightNumber,
  onSearchRoute,
  routeBusy,
}: {
  query: string;
  recentSearches: string[];
  boardFlights: BoardFlightHit[];
  todayKey: string;
  theme: ThemeBits;
  onApplyQuery: (q: string) => void;
  onSelectFlightNumber: (n: string) => void;
  onSearchRoute: (fromIata: string, toIata: string, offset: -1 | 0 | 1) => void;
  routeBusy?: boolean;
}) {
  const q = query.trim();
  const [routeOpen, setRouteOpen] = useState(false);
  const [fromTxt, setFromTxt] = useState('');
  const [toTxt, setToTxt] = useState('');
  const [dateOff, setDateOff] = useState< -1 | 0 | 1 >(0);
  const [focusField, setFocusField] = useState<'from' | 'to' | null>(null);
  const [apiHits, setApiHits] = useState<{ flightNumber: string; airline: string; from?: string; to?: string }[]>([]);
  const seq = useRef(0);

  const flightLike = /^[A-Z]{1,3}\s?\d{0,4}[A-Z]?$/i.test(q.replace(/\s+/g, ' ').trim()) && /[A-Z]{1,3}/i.test(q);

  useEffect(() => {
    const term = q.replace(/\s+/g, '');
    if (!flightLike || term.length < 3) {
      setApiHits([]);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${PROXY}/flights/number/${encodeURIComponent(term)}/autocomplete`);
        if (id !== seq.current) return;
        if (!res.ok) { setApiHits([]); return; }
        const data = await res.json();
        setApiHits((Array.isArray(data) ? data : []).slice(0, 4));
      } catch {
        if (id === seq.current) setApiHits([]);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q, flightLike]);

  const rows = useMemo(() => {
    if (q.length < 2) return [];
    const out: Row[] = [];
    const seen = new Set<string>();
    const add = (r: Row) => {
      if (seen.has(r.id) || out.length >= 6) return;
      seen.add(r.id);
      out.push(r);
    };
    const ql = q.toLowerCase();
    const hasDigit = /\d/.test(q);

    for (const recent of recentSearches) {
      if (recent.toLowerCase().includes(ql) || ql.includes(recent.toLowerCase().slice(0, 3))) {
        add({ id: `recent-${recent}`, icon: 'recent', title: recent, apply: recent });
      }
    }

    if (!hasDigit) {
      for (const hit of matchPlaces(q, 6)) {
        add({
          id: hit.kind === 'country' ? `c-${hit.label}` : `a-${hit.iata || hit.label}`,
          icon: 'pin',
          title: hit.label,
          subtitle: hit.sublabel,
          apply: hit.iata || hit.iatas[0] || hit.label,
        });
      }

      for (const r of POPULAR_ROUTES) {
        const label = routeLabel(r.from, r.to);
        const blob = `${label} ${r.from} ${r.to}`.toLowerCase();
        if (blob.includes(ql) || airportRecByIata(r.from)?.city.toLowerCase().startsWith(ql)) {
          add({
            id: `pop-${r.from}-${r.to}`,
            icon: 'route',
            title: label,
            subtitle: 'meest gezocht',
            route: r,
          });
        }
      }
    }

    for (const f of boardFlights) {
      const blob = `${f.number} ${f.operatingNumber || ''} ${f.origin} ${f.destination}`.toLowerCase();
      if (!blob.includes(ql.replace(/\s+/g, '')) && !blob.includes(ql)) continue;
      const when = [dayWord(f.scheduledTime, todayKey), clock(f.scheduledTime)].filter(Boolean).join(' ');
      const route = formatRouteHint(f.origin, f.destination);
      add({
        id: `flt-${f.number}-${f.scheduledTime}`,
        icon: 'plane',
        title: [formatFlightNumber(f), route].filter(Boolean).join('  '),
        subtitle: when,
        flightNumber: f.number,
        origin: f.origin,
        destination: f.destination,
        date: String(f.scheduledTime || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1],
      });
    }

    for (const h of apiHits) {
      add({
        id: `api-${h.flightNumber}`,
        icon: 'plane',
        title: h.flightNumber,
        subtitle: [h.airline, formatRouteHint(h.from, h.to)].filter(Boolean).join(' · '),
        flightNumber: h.flightNumber,
        origin: h.from,
        destination: h.to,
      });
    }

    return out.slice(0, 6);
  }, [q, recentSearches, boardFlights, todayKey, apiHits]);

  const fieldHits = matchPlaces(focusField === 'from' ? fromTxt : toTxt, 5)
    .filter(h => h.iatas.length > 0);

  const runRoute = () => {
    const from = resolvePlaceToIata(fromTxt);
    const to = resolvePlaceToIata(toTxt);
    if (!from || !to || from === to) return;
    haptics.light();
    onSearchRoute(from, to, dateOff);
  };

  const onRow = (r: Row) => {
    haptics.light();
    Keyboard.dismiss();
    if (r.route) {
      setRouteOpen(true);
      setFromTxt(r.route.from);
      setToTxt(r.route.to);
      onSearchRoute(r.route.from, r.route.to, 0);
      return;
    }
    if (r.flightNumber) {
      onSelectFlightNumber(r.flightNumber);
      return;
    }
    const next = r.apply || r.title;
    if (next) onApplyQuery(next);
  };

  return (
    <View>
      {q.length >= 2 && rows.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={[styles.drop, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          {rows.map((r, i) => (
            <View
              key={r.id}
              collapsable={false}
              style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : undefined}
            >
              <Pressable
                onPress={() => onRow(r)}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={r.title}
              >
                {r.icon === 'plane' ? (
                  <Airplane size={15} color={theme.accent} />
                ) : r.icon === 'route' ? (
                  <ArrowsLeftRight size={15} color={theme.accent} />
                ) : r.icon === 'recent' ? (
                  <Clock size={15} color={theme.accent} />
                ) : (
                  <MapPin size={15} color={theme.accent} />
                )}
                <View style={{ flex: 1, minWidth: 0 }} pointerEvents="none">
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{r.title}</Text>
                  {r.subtitle ? (
                    <Text style={[styles.sub, { color: theme.secondary }]} numberOfLines={1}>{r.subtitle}</Text>
                  ) : null}
                </View>
              </Pressable>
              {r.flightNumber ? (
                <BookThisFlightButton
                  compact
                  origin={r.origin}
                  destination={r.destination}
                  date={r.date}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => { haptics.light(); setRouteOpen(v => !v); }}
        style={styles.routeToggle}
        accessibilityRole="button"
        accessibilityLabel={t().searchByRoute}
      >
        <Text style={[styles.routeToggleTxt, { color: theme.accent }]}>🔀 {t().searchByRoute}</Text>
      </TouchableOpacity>

      {routeOpen ? (
        <View style={[styles.routeBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.fieldLbl, { color: theme.muted }]}>{t().from}</Text>
          <TextInput
            value={fromTxt}
            onChangeText={setFromTxt}
            onFocus={() => setFocusField('from')}
            placeholder={t().fromPlaceholder}
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.list }]}
          />
          <Text style={[styles.fieldLbl, { color: theme.muted }]}>{t().to}</Text>
          <TextInput
            value={toTxt}
            onChangeText={setToTxt}
            onFocus={() => setFocusField('to')}
            placeholder={t().toPlaceholder}
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.list }]}
          />
          {focusField && fieldHits.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              {fieldHits.map(h => (
                <Pressable
                  key={h.iata}
                  onPress={() => {
                    const code = h.iata || h.iatas[0] || '';
                    if (focusField === 'from') setFromTxt(code);
                    else setToTxt(code);
                    setFocusField(null);
                  }}
                  style={styles.miniRow}
                >
                  <MapPin size={13} color={theme.accent} />
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{h.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={[styles.fieldLbl, { color: theme.muted }]}>{t().date}</Text>
          <View style={styles.dateRow}>
            {([-1, 0, 1] as const).map(off => {
              const label = off === -1 ? t().yesterday : off === 1 ? t().tomorrow : t().today;
              const on = dateOff === off;
              return (
                <TouchableOpacity
                  key={off}
                  onPress={() => setDateOff(off)}
                  style={[
                    styles.dateBtn,
                    { borderColor: theme.border, backgroundColor: theme.list, flex: 1 },
                    on && { borderColor: theme.accent, backgroundColor: theme.accent + '22' },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                >
                  <Text style={{ color: on ? theme.accent : theme.text, fontWeight: '700', fontSize: 13 }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={runRoute}
            disabled={routeBusy || !resolvePlaceToIata(fromTxt) || !resolvePlaceToIata(toTxt) || resolvePlaceToIata(fromTxt) === resolvePlaceToIata(toTxt)}
            style={[styles.searchBtn, { backgroundColor: theme.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t().searchFlights}
          >
            {routeBusy ? (
              <ActivityIndicator color="#0A0E1A" />
            ) : (
              <>
                <MagnifyingGlass size={16} color="#0A0E1A" />
                <Text style={styles.searchBtnTxt}>{t().searchFlights}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  drop: {
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 30,
    elevation: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  title: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  routeToggle: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 6,
  },
  routeToggleTxt: { fontSize: 13, fontWeight: '700' },
  routeBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  fieldLbl: { fontSize: 11, fontWeight: '700', marginBottom: 4, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  searchBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchBtnTxt: { color: '#0A0E1A', fontSize: 15, fontWeight: '800' },
});
