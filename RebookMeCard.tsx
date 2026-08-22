import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AirlineLogo from './AirlineLogo';
import {
  aviasalesCurrency,
  fetchLatestFares,
  formatFare,
  openAviasalesBooking,
  type LatestFare,
} from './lib/aviasales';
import { t } from './lib/i18n';

const BG = '#0F1728';
const RED = '#F87171';
const GOLD = '#C9A84C';

function dayFromIso(raw?: string): string {
  const m = String(raw || '').match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function parseDay(raw?: string): Date {
  const m = String(raw || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function fareClock(fare: LatestFare): string {
  const m = String(fare.departureAt || '').match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '—';
}

function stopLabel(transfers: number): string {
  const copy = t();
  if (transfers <= 0) return copy.directFlight;
  if (transfers === 1) return copy.oneStop;
  return copy.nStops(transfers);
}

function openFare(fare: LatestFare) {
  void openAviasalesBooking(fare.origin, fare.destination, parseDay(fare.departDate)).catch(() => {});
}

export default function RebookMeCard({
  origin,
  destination,
  date,
}: {
  origin?: string;
  destination?: string;
  date?: string;
}) {
  const from = String(origin || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const to = String(destination || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const day = dayFromIso(date);
  const currency = aviasalesCurrency();
  const [rows, setRows] = useState<LatestFare[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (from.length !== 3 || to.length !== 3) return;
    let cancelled = false;
    setBusy(true);
    setRows(null);
    fetchLatestFares({
      origin: from,
      destination: to,
      currency: currency.code,
      departDate: day || undefined,
    })
      .then(list => {
        if (cancelled) return;
        const sameDay = day ? list.filter(r => r.departDate === day) : list;
        setRows(sameDay.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, [from, to, day, currency.code]);

  if (from.length !== 3 || to.length !== 3) return null;

  const searchMore = () => {
    void openAviasalesBooking(from, to, parseDay(day || date)).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t().rebookTitle}</Text>
      {busy && !rows ? (
        <View style={styles.loading}>
          <ActivityIndicator color={GOLD} />
          <Text style={styles.muted}>{t().rebookLoading}</Text>
        </View>
      ) : null}
      {rows && !rows.length ? (
        <Text style={styles.muted}>{t().rebookNoFares}</Text>
      ) : null}
      {rows?.map((fare, i) => (
        <Pressable
          key={`${fare.airline}-${fare.departDate}-${fare.price}-${i}`}
          onPress={() => openFare(fare)}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={`${fare.airline} ${fareClock(fare)} ${formatFare(fare.price, currency.symbol)}`}
        >
          <AirlineLogo iata={fare.airline} size={36} />
          <View style={styles.mid}>
            <Text style={styles.time}>{fareClock(fare)}</Text>
            <Text style={styles.stops}>{stopLabel(fare.transfers)}</Text>
          </View>
          <Text style={styles.price}>{formatFare(fare.price, currency.symbol)}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={searchMore}
        style={styles.more}
        accessibilityRole="button"
        accessibilityLabel={t().searchMoreOptions}
      >
        <Text style={styles.moreTxt}>{t().searchMoreOptions}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248,113,113,0.35)',
    borderLeftWidth: 4,
    borderLeftColor: RED,
  },
  title: { color: '#F8FAFC', fontSize: 15, fontWeight: '800', lineHeight: 20 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  muted: { color: '#94A3B8', fontSize: 13, fontWeight: '600', marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingVertical: 8,
  },
  mid: { flex: 1, minWidth: 0 },
  time: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  stops: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginTop: 2 },
  price: { color: GOLD, fontSize: 16, fontWeight: '800' },
  more: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  moreTxt: { color: GOLD, fontSize: 13, fontWeight: '800' },
});
