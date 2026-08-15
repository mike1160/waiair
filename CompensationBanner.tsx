import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Airplane,
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Clock,
  CurrencyEur,
  Link as LinkIcon,
  Scales,
  XCircle,
} from 'phosphor-react-native';
import { EU261_LIABILITY_GUIDE, EU261_STEPS, type Eu261Claim } from './lib/eu261';
import { haptics } from './lib/haptics';

const AMBER = '#FFB300';
const AMBER_BG = 'rgba(255, 179, 0, 0.12)';
const GREEN = '#16A34A';
const RED = '#DC2626';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  list: string;
};

export default function CompensationBanner({
  claim,
  theme,
}: {
  claim: Eu261Claim;
  theme: ThemeBits;
}) {
  const openUrl = async (url: string) => {
    haptics.light();
    try { await Linking.openURL(url); } catch { /* ignore */ }
  };

  const yes = claim.eligible;
  const km = claim.distanceKm != null ? Math.round(claim.distanceKm) : null;

  return (
    <View style={[styles.card, { borderColor: AMBER, backgroundColor: AMBER_BG }]}>
      <View style={styles.head}>
        <Scales size={18} color={AMBER} weight="fill" />
        <Text style={[styles.title, { color: theme.text }]}>EU261 compensation</Text>
      </View>

      <View style={[styles.section, { borderBottomColor: theme.border }]}>
        <View style={styles.row}>
          <Airplane size={15} color={theme.accent} />
          <Text style={[styles.label, { color: theme.secondary }]}>Am I eligible?</Text>
        </View>
        <View style={styles.yesNo}>
          {yes
            ? <CheckCircle size={18} color={GREEN} weight="fill" />
            : <XCircle size={18} color={RED} weight="fill" />}
          <Text style={[styles.yesNoTxt, { color: yes ? GREEN : RED }]}>
            {yes ? 'Yes' : 'No'}
          </Text>
        </View>
        <Text style={[styles.body, { color: theme.text }]}>{claim.reason}</Text>
      </View>

      <View style={[styles.section, { borderBottomColor: theme.border }]}>
        <View style={styles.row}>
          <CurrencyEur size={15} color={theme.accent} />
          <Text style={[styles.label, { color: theme.secondary }]}>Compensation amount</Text>
        </View>
        <Text style={[styles.amount, { color: theme.text }]}>€{claim.amount}</Text>
        <Text style={[styles.meta, { color: theme.muted }]}>
          {km != null
            ? `${km.toLocaleString('en-US')} km · ${km < 1500 ? '< 1,500 km → €250' : km <= 3500 ? '1,500–3,500 km → €400' : '> 3,500 km → €600'}`
            : '< 1,500 km → €250 · 1,500–3,500 → €400 · > 3,500 → €600'}
        </Text>
      </View>

      <View style={[styles.section, { borderBottomColor: theme.border }]}>
        <View style={styles.row}>
          <Scales size={15} color={theme.accent} />
          <Text style={[styles.label, { color: theme.secondary }]}>Airline liability</Text>
        </View>
        <Text style={[styles.amount, { color: theme.text }]}>{claim.liabilityPct}%</Text>
        <Text style={[styles.body, { color: theme.text }]}>{claim.liabilityNote}</Text>
        {EU261_LIABILITY_GUIDE.map(row => (
          <View key={row.label} style={styles.guideRow}>
            <Text style={[styles.guidePct, { color: theme.accent }]}>{row.pct}%</Text>
            <Text style={[styles.meta, { color: theme.muted, flex: 1 }]}>{row.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.section, { borderBottomColor: theme.border }]}>
        <View style={styles.row}>
          <ClipboardText size={15} color={theme.accent} />
          <Text style={[styles.label, { color: theme.secondary }]}>What to do</Text>
        </View>
        {EU261_STEPS.map((step, i) => (
          <Text key={step} style={[styles.step, { color: theme.text }]}>
            {i + 1}. {step}
          </Text>
        ))}
      </View>

      <View style={[styles.section, { borderBottomColor: theme.border }]}>
        <View style={styles.row}>
          <Clock size={15} color={theme.accent} />
          <Text style={[styles.label, { color: theme.secondary }]}>Claim deadline</Text>
        </View>
        <Text style={[styles.body, { color: theme.text }]}>
          2 years in most EU countries (check your national enforcement body).
        </Text>
      </View>

      {claim.airlineClaimUrl ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.list, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}
          onPress={() => openUrl(claim.airlineClaimUrl!)}
          accessibilityRole="link"
          accessibilityLabel={claim.airlineClaimLabel || 'Airline claim page'}
        >
          <LinkIcon size={14} color={theme.accent} />
          <Text style={[styles.btnGhostTxt, { color: theme.text }]}>
            {claim.airlineClaimLabel || 'Airline claim page'}
          </Text>
          <ArrowRight size={14} color={theme.accent} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.cta}
        onPress={() => openUrl(claim.url)}
        accessibilityRole="link"
        accessibilityLabel="Check your claim"
      >
        <Text style={styles.ctaTxt}>Check your claim</Text>
        <ArrowRight size={14} color="#fff" weight="bold" />
      </TouchableOpacity>
      <Text style={[styles.disclaimer, { color: theme.muted }]}>
        EU261/2004 · not legal advice · extraordinary circumstances can void a claim
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  section: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  yesNo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  yesNoTxt: { fontSize: 18, fontWeight: '800' },
  body: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  amount: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 2 },
  meta: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 6 },
  guidePct: { fontSize: 12, fontWeight: '800', width: 36 },
  step: { fontSize: 13, fontWeight: '600', lineHeight: 20, marginTop: 4 },
  btn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnGhostTxt: { fontSize: 13, fontWeight: '800', flex: 1 },
  cta: {
    marginTop: 8,
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  disclaimer: { fontSize: 10, fontWeight: '500', marginTop: 8, paddingHorizontal: 2 },
});
