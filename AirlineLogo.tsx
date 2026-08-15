import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const failed = new Set<string>();

function airhexUrl(code: string) {
  return `https://content.airhex.com/content/logos/airlines_${code}_200_200_r.png`;
}

export default function AirlineLogo({
  iata,
  initials,
  backgroundColor,
  size = 36,
}: {
  iata?: string;
  initials: string;
  backgroundColor: string;
  size?: number;
}) {
  const code = String(iata || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  const [ok, setOk] = useState(!!code && !failed.has(code));

  if (!ok || !code) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor }]}>
        <Text style={[styles.txt, { fontSize: Math.max(10, Math.round(size * 0.32)) }]}>{initials}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: airhexUrl(code) }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff' }}
      onError={() => {
        failed.add(code);
        setOk(false);
      }}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txt: { color: '#fff', fontWeight: '800', letterSpacing: 0.3 },
});
