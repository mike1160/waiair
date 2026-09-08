import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../lib/i18n';
import { BRANDS } from '../lib/brands';
import { haptics } from '../lib/haptics';

const BG = '#0D1B2E';
const GOLD = '#FFD700';
const TEXT = '#F8FAFC';
const MUTED = '#94A3B8';
const NAVY = '#0D1B2E';

type Props = {
  onAllow: () => void;
  onNotNow: () => void;
};

export default function AnalyticsConsentSheet({ onAllow, onNotNow }: Props) {
  const copy = t();
  return (
    <View style={st.root}>
      <Text style={st.brand}>{BRANDS.waiair}</Text>
      <Text style={st.title}>{copy.analyticsConsentTitle}</Text>
      <Text style={st.body}>{copy.analyticsConsentBody}</Text>
      <Pressable
        style={st.allow}
        onPress={() => { haptics.medium(); onAllow(); }}
        accessibilityRole="button"
        accessibilityLabel={copy.analyticsConsentAllow}
      >
        <Text style={st.allowTxt}>{copy.analyticsConsentAllow}</Text>
      </Pressable>
      <Pressable
        style={st.skip}
        onPress={() => { haptics.light(); onNotNow(); }}
        accessibilityRole="button"
        accessibilityLabel={copy.analyticsConsentNotNow}
      >
        <Text style={st.skipTxt}>{copy.analyticsConsentNotNow}</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  brand: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  title: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
  },
  body: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 32,
  },
  allow: {
    backgroundColor: GOLD,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  allowTxt: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
  },
  skip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipTxt: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '700',
  },
});
