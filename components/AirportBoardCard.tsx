/**
 * The flight as a departures-board panel (airport mode). Square corners, 1px #222 rules, white on near-black,
 * yellow monospace times. Times, gate, terminal and status are split-flap FlipText, so a change turns over on screen.
 *
 * ┌─────────────────────────────────────┐
 * │  TG922                        THAI  │
 * │  BANGKOK → FRANKFURT                │
 * ├──────────────┬──────────┬───────────┤
 * │  GATE        │ TERMINAL │  STATUS   │
 * ├──────────────┴──────────┴───────────┤
 * │  DEPARTS              ARRIVES       │
 * └─────────────────────────────────────┘
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import FlipText from './FlipText';
import { t } from '../lib/i18n';
import { AIRPORT_BOARD, MONO } from '../lib/themes';
import { BOARD_STATUS_COLOR, boardStatusPulses, type BoardStatus } from '../lib/airportBoard';

// The panel's own colours come from the board table [P/1], so the card and the theme cannot drift apart.
const BG = AIRPORT_BOARD.bg;
const RULE = AIRPORT_BOARD.rule;
const WHITE = '#FFFFFF';

type Props = {
  flightNumber: string;
  airline: string;
  originCity: string;
  destCity: string;
  gate: string;
  terminal: string;
  status: BoardStatus;
  depClock: string;
  /** The scheduled time when a new one replaced it: shown struck through in grey. */
  depOriginal?: string;
  depSuffix: string;
  arrClock: string;
  arrOriginal?: string;
  arrSuffix: string;
};

function statusLabel(status: BoardStatus): string {
  const copy = t();
  switch (status) {
    case 'delayed': return copy.airport_delayed;
    case 'boarding': return copy.airport_boarding;
    case 'departed': return copy.airport_departed;
    case 'landed': return copy.airport_landed;
    case 'cancelled': return copy.airport_cancelled;
    default: return copy.airport_on_time;
  }
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label} numberOfLines={1}>{children.toUpperCase()}</Text>;
}

function Time({ clock, original, suffix, late }: { clock: string; original?: string; suffix: string; late: boolean }) {
  return (
    <View>
      {original ? <Text style={styles.struck}>{original}</Text> : null}
      <FlipText value={clock || '--:--'} style={[styles.time, late && { color: AIRPORT_BOARD.amber }]} />
      <Text style={styles.suffix} numberOfLines={1}>{suffix.toUpperCase()}</Text>
    </View>
  );
}

export default function AirportBoardCard(props: Props) {
  const copy = t();
  const pulse = useRef(new Animated.Value(1)).current;
  const pulses = boardStatusPulses(props.status);

  useEffect(() => {
    if (!pulses) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulses, pulse]);

  const statusColor = BOARD_STATUS_COLOR[props.status];
  const cancelled = props.status === 'cancelled';
  const late = props.status === 'delayed';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Text style={styles.flight} numberOfLines={1}>{props.flightNumber.replace(/\s+/g, '').toUpperCase()}</Text>
          {props.airline ? <Text style={styles.airline} numberOfLines={1}>{props.airline}</Text> : null}
        </View>
        <Text style={styles.route} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {`${props.originCity} → ${props.destCity}`.toUpperCase()}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={[styles.cell, styles.cellWide]}>
          <Label>{copy.airport_gate}</Label>
          <FlipText value={props.gate || '—'} style={[styles.value, { color: AIRPORT_BOARD.amber }]} />
        </View>
        <View style={[styles.cell, styles.cellRule]}>
          <Label>{copy.airport_terminal}</Label>
          <FlipText value={props.terminal || '—'} style={[styles.value, { color: WHITE }]} />
        </View>
        <View style={[styles.cell, styles.cellRule, styles.cellWide]}>
          <Label>{copy.airport_status}</Label>
          {/* The status turns over like the times when it changes (ON TIME → DELAYED); boarding also pulses. */}
          <Animated.View style={{ opacity: pulse }}>
            <FlipText
              value={statusLabel(props.status).toUpperCase()}
              style={[styles.status, { color: statusColor }, cancelled && styles.strike]}
            />
          </Animated.View>
        </View>
      </View>

      <View style={styles.times}>
        <View style={{ flex: 1 }}>
          <Label>{copy.airport_departs}</Label>
          <Time clock={props.depClock} original={props.depOriginal} suffix={props.depSuffix} late={late} />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Label>{copy.airport_arrives}</Label>
          <Time clock={props.arrClock} original={props.arrOriginal} suffix={props.arrSuffix} late={late} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 0,
    marginTop: 8,
  },
  head: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, gap: 4 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  flight: { fontFamily: MONO, fontWeight: '800', fontSize: 26, color: WHITE, letterSpacing: 2 },
  airline: { fontFamily: MONO, fontWeight: '700', fontSize: 13, color: AIRPORT_BOARD.soft, letterSpacing: 1 },
  route: { fontSize: 15, fontWeight: '700', color: WHITE, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: RULE },
  cell: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  cellWide: { flex: 1.25 },
  cellRule: { borderLeftWidth: 1, borderLeftColor: RULE },
  label: { fontFamily: MONO, fontSize: 10, fontWeight: '700', color: AIRPORT_BOARD.soft, letterSpacing: 1.5 },
  value: { fontFamily: MONO, fontSize: 20, fontWeight: '800' },
  status: { fontFamily: MONO, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  strike: { textDecorationLine: 'line-through' },
  times: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: RULE, paddingHorizontal: 14, paddingVertical: 12 },
  time: { fontFamily: MONO, fontSize: 30, fontWeight: '800', color: AIRPORT_BOARD.amber },
  struck: {
    fontFamily: MONO,
    fontSize: 13,
    color: AIRPORT_BOARD.soft,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  suffix: { fontFamily: MONO, fontSize: 10, color: AIRPORT_BOARD.soft, marginTop: 2, letterSpacing: 1 },
});
