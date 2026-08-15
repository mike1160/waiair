import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight, Scales } from 'phosphor-react-native';
import type { Eu261Claim } from './lib/eu261';
import { haptics } from './lib/haptics';

const AMBER = '#FFB300';
const AMBER_BG = 'rgba(255, 179, 0, 0.15)';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
};

export default function CompensationBanner({
  claim,
  theme,
}: {
  claim: Eu261Claim;
  theme: ThemeBits;
}) {
  const openClaim = async () => {
    haptics.light();
    try {
      await Linking.openURL(claim.url);
    } catch { /* ignore */ }
  };

  const cancelled = claim.kind === 'cancelled';
  const cta = cancelled ? 'Check your rights' : 'Check your claim for free';

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {cancelled ? (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.emoji} accessibilityLabel="Alert">🚨</Text>
              <Text style={[styles.title, { color: theme.text }]}>Flight Cancelled</Text>
            </View>
            <Text style={[styles.lead, { color: theme.text }]}>You are entitled to:</Text>
            <Text style={[styles.bullet, { color: theme.text }]}>• Full refund OR rebooking</Text>
            <Text style={[styles.bullet, { color: theme.text }]}>• Up to €{claim.amount} compensation</Text>
            <Text style={[styles.bullet, { color: theme.text }]}>• Care (meals, hotel if overnight)</Text>
          </>
        ) : (
          <>
            <View style={styles.titleRow}>
              <Scales size={18} color={AMBER} weight="fill" />
              <Text style={[styles.title, { color: theme.text }]}>
                You may be entitled to compensation
              </Text>
            </View>
            <Text style={[styles.meta, { color: theme.secondary }]}>
              EU261 applies · Up to €{claim.amount}
            </Text>
          </>
        )}
        <TouchableOpacity
          style={styles.btn}
          onPress={openClaim}
          accessibilityRole="link"
          accessibilityLabel={cta}
        >
          <Text style={styles.btnTxt}>{cta}</Text>
          <ArrowRight size={14} color="#fff" weight="bold" />
        </TouchableOpacity>
      </View>
      <Text style={[styles.disclaimer, { color: theme.muted }]}>
        EU261/2004 regulation. Subject to airline eligibility.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  card: {
    backgroundColor: AMBER_BG,
    borderColor: AMBER,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.2, lineHeight: 20 },
  emoji: { fontSize: 16, lineHeight: 20 },
  lead: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  bullet: { fontSize: 13, fontWeight: '600', lineHeight: 20 },
  meta: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  btn: {
    marginTop: 12,
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  disclaimer: { fontSize: 10, fontWeight: '500', marginTop: 8, paddingHorizontal: 2 },
});
