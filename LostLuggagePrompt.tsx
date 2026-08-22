import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { runWhileAppActive } from './lib/appActivity';
import { t } from './lib/i18n';
import { lostLuggagePhase, lostLuggageUrl } from './lib/lostLuggage';

export default function LostLuggagePrompt({
  status,
  belt,
  airlineCode,
  landedAtMs,
  arrIso,
  destIata,
  destCountry,
  compact,
}: {
  status?: string;
  belt?: string;
  airlineCode?: string;
  landedAtMs?: number | null;
  arrIso?: string;
  destIata?: string;
  destCountry?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (String(status || '').toLowerCase() !== 'landed') return;
    return runWhileAppActive(() => {
      const id = setInterval(() => setNow(Date.now()), 30_000);
      return () => clearInterval(id);
    });
  }, [status]);

  const phase = lostLuggagePhase({ status, belt, landedAtMs, arrIso, destIata, destCountry, now });
  if (phase === 'hidden') return null;

  if (phase === 'hint') {
    return (
      <Text style={[styles.hint, compact && styles.hintCompact]}>
        {t().bagReportHint}
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t().stillWaitingBag}</Text>
      <Pressable
        onPress={() => { void Linking.openURL(lostLuggageUrl(airlineCode)); }}
        style={styles.btn}
        accessibilityRole="link"
        accessibilityLabel={t().reportLostBag}
      >
        <Text style={styles.btnTxt}>{t().reportLostBag}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 17,
  },
  hintCompact: { marginTop: 6 },
  wrap: {
    marginTop: 12,
    backgroundColor: '#0f1117',
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.28)',
    gap: 10,
  },
  title: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  btnTxt: { color: '#0A0F1E', fontSize: 13, fontWeight: '800' },
});
