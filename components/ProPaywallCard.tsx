import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BellSimple, ClockCounterClockwise, MapTrifold } from 'phosphor-react-native';
import { t } from '../lib/i18n';
import {
  findMonthlyPackage,
  findYearlyPackage,
  getCurrentOffering,
  purchasePlan,
  restorePurchases,
  type ProPlan,
} from '../lib/purchases';
import {
  FALLBACK_MONTHLY_LABEL,
  FALLBACK_YEARLY_LABEL,
  type SmartPaywallMoment,
} from '../lib/smartPaywall';

const GOLD = '#C9A227';
const NAVY = '#0B1C2C';

type Props = {
  moment: SmartPaywallMoment;
  city?: string;
  compact?: boolean;
  onDismiss: () => void;
  onProUnlocked: () => void;
};

function titleFor(moment: SmartPaywallMoment, city?: string): string {
  const copy = t();
  if (moment === 'landing') return copy.youMadeItTo(city || '');
  if (moment === 'search_quota') return copy.searchQuotaTitle;
  if (moment === 'live_map') return copy.liveMapPaywallTitle;
  if (moment === 'history') return copy.historyPaywallTitle;
  return copy.waiairProBrand;
}

export default function ProPaywallCard({
  moment,
  city,
  compact,
  onDismiss,
  onProUnlocked,
}: Props) {
  const copy = t();
  const [plan, setPlan] = useState<ProPlan>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [monthlyLabel, setMonthlyLabel] = useState(FALLBACK_MONTHLY_LABEL);
  const [yearlyLabel, setYearlyLabel] = useState(FALLBACK_YEARLY_LABEL);

  useEffect(() => {
    let alive = true;
    getCurrentOffering().then(offering => {
      if (!alive || !offering) return;
      const monthly = findMonthlyPackage(offering);
      const yearly = findYearlyPackage(offering);
      if (monthly?.product.priceString) setMonthlyLabel(monthly.product.priceString);
      if (yearly?.product.priceString) setYearlyLabel(yearly.product.priceString);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const buy = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await purchasePlan(plan);
      if (result.ok) {
        onProUnlocked();
        return;
      }
      if (!result.cancelled && result.message) setError(result.message);
    } catch {
      setError(copy.restorePurchase);
    } finally {
      setBusy(false);
    }
  }, [busy, plan, onProUnlocked, copy.restorePurchase]);

  const restore = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await restorePurchases();
      if (result.ok) {
        onProUnlocked();
        return;
      }
      if (result.message) setError(result.message);
    } catch {
      setError(copy.restorePurchase);
    } finally {
      setBusy(false);
    }
  }, [busy, onProUnlocked, copy.restorePurchase]);

  const features = [
    { Icon: MapTrifold, label: copy.featureLiveMapShort },
    { Icon: BellSimple, label: copy.featureGateAlertsShort },
    { Icon: ClockCounterClockwise, label: copy.featureHistoryShort },
  ];

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.title, compact && styles.titleCompact]}>{titleFor(moment, city)}</Text>
      <Text style={styles.sub}>{copy.trackUnlimitedPro}</Text>

      <View style={styles.features}>
        {features.map(({ Icon, label }) => (
          <View key={label} style={styles.featureChip}>
            <Icon size={14} color={GOLD} weight="bold" />
            <Text style={styles.featureTxt}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.plans}>
        <TouchableOpacity
          style={[styles.plan, plan === 'monthly' && styles.planOn]}
          onPress={() => setPlan('monthly')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={copy.monthlyA11y}
        >
          <Text style={styles.planName}>{copy.monthly}</Text>
          <Text style={styles.planPrice}>{monthlyLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.plan, plan === 'yearly' && styles.planOn]}
          onPress={() => setPlan('yearly')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={copy.yearlyA11y}
        >
          <View style={styles.bestBadge}>
            <Text style={styles.bestBadgeTxt}>{copy.bestValueBadge}</Text>
          </View>
          <Text style={styles.planName}>{copy.paywallAnnual}</Text>
          <Text style={styles.planPrice}>{yearlyLabel}</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.cta}
        onPress={() => { void buy(); }}
        disabled={busy}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={copy.startPro}
      >
        {busy ? (
          <ActivityIndicator color={NAVY} />
        ) : (
          <Text style={styles.ctaTxt}>{copy.startPro}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
        accessibilityRole="button"
        accessibilityLabel={copy.maybeLater}
      >
        <Text style={styles.later}>{copy.maybeLater}</Text>
      </TouchableOpacity>

      {!compact ? (
        <TouchableOpacity onPress={() => { void restore(); }} hitSlop={8}>
          <Text style={styles.restore}>{copy.restorePurchase}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  wrapCompact: { gap: 12 },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  titleCompact: { fontSize: 22 },
  sub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '500',
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  featureTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  plans: { flexDirection: 'row', gap: 10 },
  plan: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    gap: 4,
  },
  planOn: {
    borderColor: GOLD,
    backgroundColor: 'rgba(201,162,39,0.12)',
  },
  planName: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  planPrice: { color: '#fff', fontSize: 18, fontWeight: '800' },
  bestBadge: {
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 2,
  },
  bestBadgeTxt: { color: NAVY, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  err: { color: '#FCA5A5', fontSize: 13, textAlign: 'center' },
  cta: {
    backgroundColor: GOLD,
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { color: NAVY, fontSize: 17, fontWeight: '800' },
  later: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
  },
  restore: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
