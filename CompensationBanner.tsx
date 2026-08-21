import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
import BrandLogoTileRow, { type BrandLogoTile } from './BrandLogoTileRow';
import { brandFields } from './lib/affiliateBrands';
import { AFFILIATE_CONFIG, compensationPicks, openAffiliateUrl } from './lib/affiliateConfig';
import { EU261_LIABILITY_GUIDE, EU261_STEPS, type Eu261Claim } from './lib/eu261';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';

const AMBER = '#FFB300';
const AMBER_BG = 'rgba(255, 179, 0, 0.12)';
const GREEN = '#16A34A';
const RED = '#DC2626';
const COMP_RED_BG = 'rgba(220,50,50,0.15)';
const COMP_RED_BORDER = 'rgba(220,50,50,0.4)';
const PULSE_ORANGE = '#FF8C00';

function PulseBorder({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const radius = (StyleSheet.flatten(style) || {}).borderRadius;
  const borderRadius = typeof radius === 'number' ? radius : 16;

  return (
    <Animated.View style={[style, { borderColor: 'transparent' }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            borderWidth: 1.5,
            borderColor: PULSE_ORANGE,
            opacity: pulse,
          },
        ]}
      />
      {children}
    </Animated.View>
  );
}

function ClaimButtons() {
  return (
    <View style={styles.claimRow}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          void Linking.openURL('https://airhelp.tpx.lu/pFLen7yJ');
        }}
        accessibilityRole="link"
        accessibilityLabel="AirHelp"
        style={styles.claimAirHelp}
      >
        <Text style={styles.claimTxt}>AirHelp →</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          void Linking.openURL(AFFILIATE_CONFIG.compensation.compensair);
        }}
        accessibilityRole="link"
        accessibilityLabel="Compensair"
        style={styles.claimCompensair}
      >
        <Text style={styles.claimTxt}>Compensair →</Text>
      </TouchableOpacity>
    </View>
  );
}

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  list: string;
};

function CompensationPartnerRow({ mutedColor }: { mutedColor: string }) {
  const tiles: BrandLogoTile[] = compensationPicks().map(pick => ({
    key: pick.key,
    label: pick.label,
    ...brandFields(pick.key),
    onPress: () => {
      haptics.light();
      void openAffiliateUrl(pick.url);
    },
  }));

  if (tiles.length === 0) return null;

  return <BrandLogoTileRow tiles={tiles} mutedColor={mutedColor} />;
}

export function AirHelpAffiliateCta({
  theme,
  hidePartners = false,
}: {
  url?: string;
  theme?: ThemeBits;
  hidePartners?: boolean;
}) {
  if (hidePartners) return null;
  return <CompensationPartnerRow mutedColor={theme?.muted || '#8896B0'} />;
}

export default function CompensationBanner({
  claim,
  theme,
  variant = 'full',
  hidePartners = false,
}: {
  claim: Eu261Claim;
  theme: ThemeBits;
  variant?: 'full' | 'detailTop';
  hidePartners?: boolean;
}) {
  const openUrl = async (url: string) => {
    haptics.light();
    try { await Linking.openURL(url); } catch { /* ignore */ }
  };

  if (variant === 'detailTop') {
    return (
      <PulseBorder style={styles.detailTop}>
        {claim.eligible ? (
          <Text style={[styles.detailAmount, { color: theme.text }]}>
            {t().entitledCompensation(claim.amount)}
          </Text>
        ) : (
          <Text style={[styles.detailAmount, { color: theme.text }]}>{claim.reason}</Text>
        )}
        <Text style={[styles.detailNote, { color: theme.secondary }]}>
          {t().eu261DepartureNote}
        </Text>
        <ClaimButtons />
        {hidePartners ? null : <CompensationPartnerRow mutedColor={theme.muted} />}
      </PulseBorder>
    );
  }

  const yes = claim.eligible;
  const km = claim.distanceKm != null ? Math.round(claim.distanceKm) : null;

  return (
    <PulseBorder style={[styles.card, { backgroundColor: AMBER_BG }]}>
      <View style={styles.head}>
        <Scales size={18} color={AMBER} weight="fill" />
        <Text style={[styles.title, { color: theme.text }]}>{t().eu261}</Text>
      </View>

      <View style={[styles.section, { borderBottomColor: theme.border }]}>
        <View style={styles.row}>
          <Airplane size={15} color={theme.accent} />
          <Text style={[styles.label, { color: theme.secondary }]}>{t().amIEligible}</Text>
        </View>
        <View style={styles.yesNo}>
          {yes
            ? <CheckCircle size={18} color={GREEN} weight="fill" />
            : <XCircle size={18} color={RED} weight="fill" />}
          <Text style={[styles.yesNoTxt, { color: yes ? GREEN : RED }]}>
            {yes ? t().yes : t().no}
          </Text>
        </View>
        <Text style={[styles.body, { color: theme.text }]}>{claim.reason}</Text>
      </View>

      <View style={[styles.section, { borderBottomColor: theme.border }]}>
        <View style={styles.row}>
          <CurrencyEur size={15} color={theme.accent} />
          <Text style={[styles.label, { color: theme.secondary }]}>{t().compensationAmount}</Text>
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
          <Text style={[styles.label, { color: theme.secondary }]}>{t().airlineLiability}</Text>
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
          <Text style={[styles.label, { color: theme.secondary }]}>{t().whatToDo}</Text>
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
          <Text style={[styles.label, { color: theme.secondary }]}>{t().claimDeadline}</Text>
        </View>
        <Text style={[styles.body, { color: theme.text }]}>
          {t().claimDeadlineBody}
        </Text>
      </View>

      {claim.airlineClaimUrl ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.list, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}
          onPress={() => openUrl(claim.airlineClaimUrl!)}
          accessibilityRole="link"
          accessibilityLabel={claim.airlineClaimLabel || t().airlineClaimPage}
        >
          <LinkIcon size={14} color={theme.accent} />
          <Text style={[styles.btnGhostTxt, { color: theme.text }]}>
            {claim.airlineClaimLabel || t().airlineClaimPage}
          </Text>
          <ArrowRight size={14} color={theme.accent} />
        </TouchableOpacity>
      ) : null}

      <ClaimButtons />
      {hidePartners ? null : <CompensationPartnerRow mutedColor={theme.muted} />}
      <Text style={[styles.disclaimer, { color: theme.muted }]}>
        {t().eu261Disclaimer}
      </Text>
    </PulseBorder>
  );
}

const styles = StyleSheet.create({
  detailTop: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: COMP_RED_BG,
    borderWidth: 0.5,
    borderColor: COMP_RED_BORDER,
  },
  detailAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 8,
  },
  detailNote: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    marginBottom: 12,
  },
  claimRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  claimAirHelp: {
    flex: 1,
    height: 40,
    marginRight: 4,
    backgroundColor: '#E8500A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimCompensair: {
    flex: 1,
    height: 40,
    marginLeft: 4,
    backgroundColor: 'transparent',
    borderColor: PULSE_ORANGE,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  detailBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: RED,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  detailBtnTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
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
