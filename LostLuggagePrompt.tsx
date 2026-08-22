import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from './constants/theme';
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
    color: Theme.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 20,
  },
  hintCompact: { marginTop: 6 },
  wrap: {
    marginTop: 12,
    backgroundColor: Theme.card,
    borderRadius: Theme.cardRadius,
    padding: Theme.cardPadding,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,168,76,0.28)',
    gap: 10,
  },
  title: { color: Theme.text, fontSize: 14, fontWeight: '800' },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: Theme.gold,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  btnTxt: { color: Theme.background, fontSize: 13, fontWeight: '800' },
});
