import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export const AIRLINE_LOGO_SIZE = 40;
const LOGO_RADIUS = 8;

const AIRLINE_HUES = ['#003366','#C8102E','#0B3D91','#E31837','#0033A0','#006644','#5C0F2E','#1B4E8C','#007A33','#0A1628'];

type LogoSource = 'airhex' | 'kiwi' | 'none';

/** In-memory: which URL worked (or both failed) so remounts skip dead hosts. */
const sourceCache = new Map<string, LogoSource>();

export function airlineColor(code: string): string {
  const s = String(code || 'XX').replace(/[^A-Za-z]/g, '').toUpperCase() || 'XX';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return AIRLINE_HUES[h % AIRLINE_HUES.length];
}

export function airlineInitials(code: string, name?: string): string {
  const c = String(code || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if (c.length >= 2) return c.slice(0, 2);
  const parts = String(name || '').split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (c || 'FL').slice(0, 2);
}

export function airlineCodeFromFlight(number?: string): string {
  return String(number || '')
    .replace(/\s+/g, '')
    .replace(/[^A-Za-z].*$/, '')
    .toUpperCase()
    .slice(0, 3);
}

function cleanIata(iata?: string): string {
  return String(iata || '').replace(/[^A-Za-z]/g, '').toUpperCase();
}

function airhexUrl(code: string) {
  return `https://content.airhex.com/content/logos/airlines_${code}_100_100_s.png`;
}

function kiwiUrl(code: string) {
  return `https://images.kiwi.com/airlines/64/${code}.png`;
}

function initialSource(code: string): LogoSource {
  if (code.length < 2) return 'none';
  return sourceCache.get(code) ?? 'airhex';
}

export default function AirlineLogo({
  iata,
  name,
  initials,
  backgroundColor,
  size = AIRLINE_LOGO_SIZE,
}: {
  iata?: string;
  name?: string;
  initials?: string;
  backgroundColor?: string;
  size?: number;
}) {
  const code = cleanIata(iata);
  const letters = initials || airlineInitials(code, name);
  const bg = backgroundColor || airlineColor(code);
  const [source, setSource] = useState<LogoSource>(() => initialSource(code));

  useEffect(() => {
    setSource(initialSource(code));
  }, [code]);

  const failOver = () => {
    if (source === 'airhex') {
      sourceCache.set(code, 'kiwi');
      setSource('kiwi');
      return;
    }
    sourceCache.set(code, 'none');
    setSource('none');
  };

  if (source === 'none' || !code) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Text style={[styles.txt, { fontSize: Math.max(10, Math.round(size * 0.32)) }]}>{letters}</Text>
      </View>
    );
  }

  const uri = source === 'airhex' ? airhexUrl(code) : kiwiUrl(code);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: LOGO_RADIUS,
        backgroundColor: '#fff',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Image
        key={uri}
        source={{ uri }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={failOver}
        onLoad={() => { sourceCache.set(code, source); }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txt: { color: '#fff', fontWeight: '800', letterSpacing: 0.3 },
});
