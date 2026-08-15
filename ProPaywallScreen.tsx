import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, Pressable, Platform, ScrollView,
} from 'react-native';
import { Star, X } from 'phosphor-react-native';
import {
  findMonthlyPackage,
  findYearlyPackage,
  getCurrentOffering,
  purchasePlan,
  restorePurchases,
  type ProPlan,
} from './lib/purchases';
import LegalScreen from './LegalScreen';

const NAVY = '#0A0F1E';
const GOLD = '#C9A84C';
const MUTED = '#8896B0';
const WHITE = '#F8FAFC';

type Props = {
  visible: boolean;
  onClose: () => void;
  onProUnlocked: () => void;
  highlight?: string;
};

const FEATURES = [
  '♾️  Track unlimited flights',
  '⚡  Updates every 30 seconds',
  '🔔  Smart flight timeline alerts',
  '📊  Your flight history',
  '🌍  Follow multiple airports',
  '🎯  Baggage info before landing',
  '📡  Live aircraft on map',
];

const FALLBACK: Record<Exclude<ProPlan, 'lifetime'>, { label: string; price: string; period: string }> = {
  monthly: { label: 'Monthly', price: '€2.99', period: '/month' },
  yearly: { label: 'Yearly', price: '€19.99', period: '/year' },
};

export default function ProPaywallScreen({
  visible, onClose, onProUnlocked,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [plan, setPlan] = useState<Exclude<ProPlan, 'lifetime'>>('yearly');
  const [prices, setPrices] = useState(FALLBACK);
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);

  useEffect(() => {
    if (!visible) {
      setMsg('');
      setBusy(false);
      setLegal(null);
      return;
    }
    getCurrentOffering().then(offering => {
      if (!offering) return;
      const monthly = findMonthlyPackage(offering);
      const yearly = findYearlyPackage(offering);
      setPrices({
        monthly: {
          label: 'Monthly',
          price: monthly?.product.priceString || FALLBACK.monthly.price,
          period: '/month',
        },
        yearly: {
          label: 'Yearly',
          price: yearly?.product.priceString || FALLBACK.yearly.price,
          period: '/year',
        },
      });
    }).catch(() => {});
  }, [visible]);

  const buy = async () => {
    setBusy(true);
    setMsg('');
    try {
      const result = await purchasePlan(plan);
      if (result.ok) {
        onProUnlocked();
        onClose();
        return;
      }
      if (!result.cancelled) setMsg(result.message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setMsg('');
    try {
      const result = await restorePurchases();
      if (result.ok) {
        onProUnlocked();
        onClose();
        return;
      }
      setMsg(result.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.gradOrb} />
        <View style={styles.gradOrb2} />

        <TouchableOpacity
          style={styles.close}
          onPress={busy ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={18} color={MUTED} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.brand}>✈️ WaiAir Pro</Text>
          <Text style={styles.tag}>
            For people who fly often{'\n'}
            or pick others up.{'\n'}
            Everything automatic, always{'\n'}
            with you.
          </Text>

          <View style={styles.features}>
            {FEATURES.map(title => (
              <Text key={title} style={styles.featureTxt}>{title}</Text>
            ))}
          </View>

          <Pressable
            style={[styles.plan, styles.planBest, plan === 'yearly' && styles.planOn]}
            onPress={() => setPlan('yearly')}
            accessibilityRole="button"
            accessibilityState={{ selected: plan === 'yearly' }}
            accessibilityLabel="Yearly 19.99 euro, save 44 percent, best value"
          >
            <View style={styles.bestBadge}>
              <Star size={10} color={NAVY} weight="fill" />
              <Text style={styles.bestTxt}>Save 44% · Best value</Text>
            </View>
            <Text style={styles.planLabel}>⭐ {prices.yearly.label}</Text>
            <Text style={styles.planPrice}>
              {prices.yearly.price}{prices.yearly.period}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.plan, plan === 'monthly' && styles.planOn]}
            onPress={() => setPlan('monthly')}
            accessibilityRole="button"
            accessibilityState={{ selected: plan === 'monthly' }}
            accessibilityLabel="Monthly 2.99 euro"
          >
            <Text style={styles.planLabel}>{prices.monthly.label}</Text>
            <Text style={styles.planPrice}>
              {prices.monthly.price}{prices.monthly.period}
            </Text>
          </Pressable>

          <Text style={styles.trial}>7 day free trial · Cancel anytime</Text>
          <Text style={styles.cancel}>No commitment · No tricks</Text>

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}

          <TouchableOpacity
            style={[styles.primary, busy && { opacity: 0.7 }]}
            onPress={buy}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Start free trial"
          >
            {busy
              ? <ActivityIndicator color={NAVY} />
              : <Text style={styles.primaryTxt}>Start free trial</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={restore} disabled={busy} hitSlop={10} style={styles.restoreBtn}>
            <Text style={styles.restoreTxt}>Restore purchase</Text>
          </TouchableOpacity>

          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => setLegal('privacy')} hitSlop={8} accessibilityRole="link" accessibilityLabel="Privacy Policy">
              <Text style={styles.legalTxt}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => setLegal('terms')} hitSlop={8} accessibilityRole="link" accessibilityLabel="Terms">
              <Text style={styles.legalTxt}>Terms</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <LegalScreen
          visible={!!legal}
          kind={legal || 'privacy'}
          colors={{
            bg: NAVY,
            text: WHITE,
            secondary: MUTED,
            muted: MUTED,
            list: 'rgba(255,255,255,0.08)',
            accent: GOLD,
          }}
          onClose={() => setLegal(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NAVY,
    paddingTop: Platform.OS === 'ios' ? 54 : 28,
  },
  gradOrb: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(201,168,76,0.14)',
  },
  gradOrb2: {
    position: 'absolute',
    bottom: -60,
    left: -50,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(26,47,90,0.9)',
  },
  close: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 20,
    right: 18,
    zIndex: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: WHITE,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  tag: {
    fontSize: 16,
    color: MUTED,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 22,
    fontWeight: '500',
    lineHeight: 24,
  },
  features: { gap: 12, marginBottom: 24 },
  featureTxt: { color: WHITE, fontSize: 16, fontWeight: '600' },
  plan: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(17,24,39,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  planBest: {
    borderColor: GOLD,
    backgroundColor: 'rgba(201,168,76,0.12)',
    marginTop: 8,
  },
  planOn: { borderColor: GOLD, borderWidth: 2 },
  planLabel: { color: MUTED, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  planPrice: { color: WHITE, fontSize: 22, fontWeight: '800', marginTop: 4 },
  bestBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bestTxt: { color: NAVY, fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  trial: {
    textAlign: 'center',
    color: GOLD,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  cancel: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 16,
  },
  msg: { color: '#fca5a5', fontSize: 12, textAlign: 'center', marginBottom: 10, fontWeight: '600' },
  primary: {
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryTxt: { color: NAVY, fontSize: 16, fontWeight: '800' },
  restoreBtn: { alignItems: 'center', marginTop: 16 },
  restoreTxt: { color: MUTED, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  legalTxt: { color: MUTED, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  legalDot: { color: MUTED, fontSize: 12 },
});
