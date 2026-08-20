import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Airplane, ArrowsLeftRight, Clock, MapPin } from 'phosphor-react-native';
import { haptics } from './lib/haptics';
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

export function parseRoutePair(raw: string): { from: string; to: string } | null {
  const q = String(raw || '').trim();
  if (!q) return null;
  const split = q.split(/\s*(?:→|->|–|—| to )\s*/i).map(s => s.trim()).filter(Boolean);
  if (split.length === 2) {
    const from = resolvePlaceToIata(split[0]);
    const to = resolvePlaceToIata(split[1]);
    if (from && to && from !== to) return { from, to };
  }
  const codes = q.toUpperCase().match(/^([A-Z]{3})\s+([A-Z]{3})$/);
  if (codes) {
    const from = resolvePlaceToIata(codes[1]);
    const to = resolvePlaceToIata(codes[2]);
    if (from && to && from !== to) return { from, to };
  }
  return null;
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
    const timer = setTimeout(async () => {
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
    return () => clearTimeout(timer);
  }, [q, flightLike]);

  const rows = useMemo(() => {
    if (q.length < 3) return [];
    const out: Row[] = [];
    const seen = new Set<string>();
    const add = (r: Row) => {
      if (seen.has(r.id) || out.length >= 6) return;
      seen.add(r.id);
      out.push(r);
    };
    const ql = q.toLowerCase();
    const compact = ql.replace(/\s+/g, '');
    const hasDigit = /\d/.test(q);

    const typedRoute = parseRoutePair(q);
    if (typedRoute) {
      add({
        id: `typed-${typedRoute.from}-${typedRoute.to}`,
        icon: 'route',
        title: routeLabel(typedRoute.from, typedRoute.to),
        subtitle: `${typedRoute.from} → ${typedRoute.to}`,
        route: typedRoute,
      });
    }

    for (const recent of recentSearches) {
      const recentRoute = parseRoutePair(recent);
      const recentHit = recent.toLowerCase().includes(ql)
        || ql.includes(recent.toLowerCase().slice(0, 3))
        || (recentRoute && (`${recentRoute.from}${recentRoute.to}${routeLabel(recentRoute.from, recentRoute.to)}`.toLowerCase().includes(compact) || `${recentRoute.from} → ${recentRoute.to}`.toLowerCase().includes(ql)));
      if (!recentHit) continue;
      if (recentRoute) {
        add({
          id: `recent-route-${recentRoute.from}-${recentRoute.to}`,
          icon: 'route',
          title: routeLabel(recentRoute.from, recentRoute.to),
          subtitle: `${recentRoute.from} → ${recentRoute.to}`,
          route: recentRoute,
        });
      } else {
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
        const blob = `${label} ${r.from} ${r.to} ${r.from}→${r.to}`.toLowerCase();
        if (blob.includes(ql) || blob.replace(/\s+/g, '').includes(compact) || airportRecByIata(r.from)?.city.toLowerCase().startsWith(ql)) {
          add({
            id: `pop-${r.from}-${r.to}`,
            icon: 'route',
            title: label,
            subtitle: `${r.from} → ${r.to}`,
            route: r,
          });
        }
      }
    }

    for (const f of boardFlights) {
      const blob = `${f.number} ${f.operatingNumber || ''} ${f.origin} ${f.destination}`.toLowerCase();
      if (!blob.includes(compact) && !blob.includes(ql)) continue;
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

  const onRow = (r: Row) => {
    haptics.light();
    Keyboard.dismiss();
    if (r.route) {
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

  if (q.length < 3 || rows.length === 0) return null;

  return (
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
        </View>
      ))}
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
});
