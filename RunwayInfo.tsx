import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { GitFork } from 'phosphor-react-native';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  list: string;
};

type RunwayPayload = {
  ident: string;
  lengthM?: number | null;
};

function Compass({ degrees, color }: { degrees: number; color: string }) {
  const size = 36;
  const cx = size / 2;
  const cy = size / 2;
  const rad = ((degrees - 90) * Math.PI) / 180;
  const len = 12;
  const x2 = cx + Math.cos(rad) * len;
  const y2 = cy + Math.sin(rad) * len;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={15} stroke={color + '55'} strokeWidth={1.5} fill="none" />
      <Circle cx={cx} cy={cy} r={2} fill={color} />
      <Line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Polygon
        points={`${x2},${y2} ${x2 - 3},${y2 + 5} ${x2 + 3},${y2 + 5}`}
        fill={color}
        rotation={degrees}
        origin={`${x2}, ${y2}`}
      />
    </Svg>
  );
}

export default function RunwayInfo({
  airportIata,
  activeRunway,
  theme,
}: {
  airportIata: string;
  activeRunway?: string;
  theme: ThemeBits;
}) {
  const [runways, setRunways] = useState<RunwayPayload[]>([]);
  const [windDeg, setWindDeg] = useState<number | null>(null);

  useEffect(() => {
    const code = String(airportIata || '').toUpperCase();
    if (!code) { setRunways([]); return; }
    let cancelled = false;
    fetch(`${PROXY}/airports/${encodeURIComponent(code)}/runways`)
      .then(async r => {
        if (!r.ok) throw new Error('no');
        return r.json();
      })
      .then(json => {
        if (cancelled) return;
        const list = Array.isArray(json?.runways) ? json.runways : [];
        setRunways(list.filter((r: any) => r.ident).slice(0, 4));
        const deg = json?.wind?.direction?.degrees ?? json?.wind?.degrees ?? null;
        setWindDeg(typeof deg === 'number' ? deg : null);
      })
      .catch(() => {
        if (!cancelled) { setRunways([]); setWindDeg(null); }
      });
    return () => { cancelled = true; };
  }, [airportIata]);

  const primary =
    (activeRunway && runways.find(r => r.ident.includes(activeRunway))) ||
    runways[0];

  if (!primary) return null;

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.list }]}>
      <View style={styles.left}>
        <GitFork size={16} color={theme.accent} />
        <View>
          <Text style={[styles.label, { color: theme.muted }]}>Runway</Text>
          <Text style={[styles.ident, { color: theme.text }]}>{primary.ident}</Text>
          {primary.lengthM ? (
            <Text style={[styles.meta, { color: theme.secondary }]}>
              {Math.round(primary.lengthM)} m
            </Text>
          ) : null}
        </View>
      </View>
      {windDeg != null ? (
        <View style={styles.wind}>
          <Compass degrees={windDeg} color={theme.accent} />
          <Text style={[styles.windTxt, { color: theme.muted }]}>{Math.round(windDeg)}°</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  ident: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  meta: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  wind: { alignItems: 'center', gap: 2 },
  windTxt: { fontSize: 10, fontWeight: '700' },
});
