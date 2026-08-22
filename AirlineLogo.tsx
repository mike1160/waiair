import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export const AIRLINE_LOGO_SIZE = 40;
const LOGO_RADIUS = 8;

const AIRLINE_HUES = ['#003366','#C8102E','#0B3D91','#E31837','#0033A0','#006644','#5C0F2E','#1B4E8C','#007A33','#0A1628'];

/** ICAO airline prefix → IATA for CDN logos (e.g. KLM → KL). */
const ICAO_TO_IATA: Record<string, string> = {
  THA: 'TG', SLK: 'MI', AXM: 'D7', MAS: 'MH', AWQ: 'QZ', LNI: 'JT', GIA: 'GA',
  TGW: 'TR', JSA: '3K', SEJ: '6E', AIC: 'AI', UAE: 'EK', ETD: 'EY', QTR: 'QR',
  SIA: 'SQ', PAL: 'PR', HVN: 'VN', CEB: '5J', BKP: 'PG', NOK: 'DD', AIQ: 'FD',
  KAL: 'KE', AAR: 'OZ', ANA: 'NH', JAL: 'JL', CAL: 'CI', CPA: 'CX', HDA: 'HX',
  CSN: 'CZ', CCA: 'CA', CES: 'MU', BAW: 'BA', AFR: 'AF', DLH: 'LH', KLM: 'KL',
  RYR: 'FR', EZY: 'U2', WZZ: 'W6', SAS: 'SK', FIN: 'AY', IBE: 'IB', TAP: 'TP',
  AUA: 'OS', SWR: 'LX', BEL: 'SN', IAW: 'AZ', QFA: 'QF', ANZ: 'NZ', VIR: 'VS',
  AAL: 'AA', UAL: 'UA', DAL: 'DL', ACA: 'AC', CXA: 'MF', CSC: '3U', NAX: 'DY',
  TRA: 'HV', TVF: 'TO',
};

type LogoSource = 'airhex' | 'avs' | 'kiwi' | 'none';

/** In-memory: which URL worked (or both failed) so remounts skip dead hosts. */
const sourceCache = new Map<string, LogoSource>();

let cacheMigrated = false;

function migrateLogoCache() {
  if (cacheMigrated) return;
  cacheMigrated = true;
  for (const [key, val] of [...sourceCache.entries()]) {
    if ((val as string) === 'airhex') sourceCache.delete(key);
    const iata = ICAO_TO_IATA[key];
    if (iata && iata !== key) sourceCache.delete(key);
  }
}

export function normalizeAirlineCode(raw?: string): string {
  const code = String(raw || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!code) return '';
  if (ICAO_TO_IATA[code]) return ICAO_TO_IATA[code];
  return code;
}

/** Drop cached host for one code or the whole session (e.g. after CDN fix). */
export function clearAirlineLogoCache(code?: string) {
  if (code) {
    const normalized = normalizeAirlineCode(code);
    sourceCache.delete(normalized);
    const raw = String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (raw !== normalized) sourceCache.delete(raw);
    return;
  }
  sourceCache.clear();
}

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
  return normalizeAirlineCode(
    String(number || '')
      .replace(/\s+/g, '')
      .replace(/[^A-Za-z0-9].*$/, ''),
  ).slice(0, 3);
}

function airhexUrl(code: string) {
  return `https://content.airhex.com/content/logos/airlines_${code}_100_100_s.png`;
}

function avsUrl(code: string) {
  return `https://pics.avs.io/60/60/${code}.png`;
}

function kiwiUrl(code: string) {
  return `https://images.kiwi.com/airlines/64/${code}.png`;
}

function initialSource(code: string, preferAirhex?: boolean): LogoSource {
  migrateLogoCache();
  if (code.length < 2) return 'none';
  const cached = sourceCache.get(code) as string | undefined;
  if (preferAirhex) {
    if (cached === 'avs' || cached === 'kiwi' || cached === 'none' || cached === 'airhex') return cached;
    return 'airhex';
  }
  if (cached === 'airhex') {
    sourceCache.delete(code);
    return 'avs';
  }
  if (cached === 'avs' || cached === 'kiwi' || cached === 'none') return cached;
  return 'avs';
}

export default function AirlineLogo({
  iata,
  name,
  initials,
  backgroundColor,
  size = AIRLINE_LOGO_SIZE,
  preferAirhex = false,
}: {
  iata?: string;
  name?: string;
  initials?: string;
  backgroundColor?: string;
  size?: number;
  variant?: 'default' | 'fids';
  isDark?: boolean;
  preferAirhex?: boolean;
}) {
  const code = normalizeAirlineCode(iata);
  const letters = initials || airlineInitials(code, name);
  const bg = backgroundColor || airlineColor(code);
  const [source, setSource] = useState<LogoSource>(() => initialSource(code, preferAirhex));

  useEffect(() => {
    setSource(initialSource(code, preferAirhex));
  }, [code, preferAirhex]);

  const failOver = () => {
    if (source === 'airhex') {
      sourceCache.set(code, 'avs');
      setSource('avs');
      return;
    }
    if (source === 'avs') {
      sourceCache.set(code, 'kiwi');
      setSource('kiwi');
      return;
    }
    sourceCache.set(code, 'none');
    setSource('none');
  };

  if (source === 'none' || !code) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: LOGO_RADIUS, backgroundColor: bg }]}>
        <Text style={[styles.txt, { fontSize: Math.max(10, Math.round(size * 0.32)) }]}>{letters}</Text>
      </View>
    );
  }

  const uri = source === 'airhex' ? airhexUrl(code) : source === 'avs' ? avsUrl(code) : kiwiUrl(code);

  return (
    <View
      style={{
        borderRadius: 8,
        backgroundColor: '#1A2744',
        padding: 4,
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
