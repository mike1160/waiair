import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, Pressable, Platform, ScrollView,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Star, X } from 'phosphor-react-native';
import {
  EMPTY_CREDIT_STATE,
  findMonthlyPackage,
  findYearlyPackage,
  getCreditPacks,
  getCurrentOffering,
  purchaseCredits,
  purchasePlan,
  refreshCredits,
  restorePurchases,
  signInForCreditsWith,
  subscribeCredits,
  type CreditPack,
  type CreditState,
  type ProPlan,
} from './lib/purchases';
import {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  isLineSignInConfigured,
  type CreditProvider,
} from './lib/creditAccount';
import { CREDIT_PACKS } from './lib/credits';
import LegalScreen from './LegalScreen';
import { t } from './lib/i18n';

const NAVY = '#0D1B2E';
const GOLD = '#C9A84C';
const MUTED = '#8896B0';
const WHITE = '#F8FAFC';

type Props = {
  visible: boolean;
  onClose: () => void;
  onProUnlocked: () => void;
  /** Credits bought in the pay-as-you-go section (number added). */
  onCreditsPurchased?: (added: number) => void;
  highlight?: string;
};

const FALLBACK_PRICES = { monthly: '€2.99', yearly: '€19.99' } as const;

function fallbackPlanUi(): Record<Exclude<ProPlan, 'lifetime'>, { label: string; price: string; period: string }> {
  const copy = t();
  return {
    monthly: { label: copy.monthly, price: FALLBACK_PRICES.monthly, period: copy.perMonth },
    yearly: { label: copy.yearly, price: FALLBACK_PRICES.yearly, period: copy.perYear },
  };
}

function fallbackCreditPacks(): CreditPack[] {
  return CREDIT_PACKS.map(p => ({
    productId: p.productId,
    credits: p.credits,
    priceString: p.fallbackPrice,
    pkg: null,
    product: null,
  }));
}

export default function ProPaywallScreen({
  visible, onClose, onProUnlocked, onCreditsPurchased,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [plan, setPlan] = useState<Exclude<ProPlan, 'lifetime'>>('yearly');
  const [prices, setPrices] = useState(fallbackPlanUi);
  const [packs, setPacks] = useState(fallbackCreditPacks);
  const [credits, setCredits] = useState<CreditState>(EMPTY_CREDIT_STATE);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const googleAvailable = isGoogleSignInConfigured();
  const lineAvailable = isLineSignInConfigured();
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);

  useEffect(() => {
    if (!visible) {
      setMsg('');
      setBusy(false);
      setBuyingPack(null);
      setLegal(null);
      return;
    }
    getCurrentOffering().then(offering => {
      if (!offering) return;
      const monthly = findMonthlyPackage(offering);
      const yearly = findYearlyPackage(offering);
      setPrices({
        monthly: {
          label: t().monthly,
          price: monthly?.product.priceString || FALLBACK_PRICES.monthly,
          period: t().perMonth,
        },
        yearly: {
          label: t().yearly,
          price: yearly?.product.priceString || FALLBACK_PRICES.yearly,
          period: t().perYear,
        },
      });
    }).catch(() => {});
    getCreditPacks().then(setPacks).catch(() => {});
    refreshCredits().then(setCredits).catch(() => {});
    isAppleSignInAvailable().then(setAppleAvailable).catch(() => {});
    return subscribeCredits(setCredits);
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

  const signIn = async (provider: CreditProvider) => {
    setBusy(true);
    setMsg('');
    try {
      await signInForCreditsWith(provider);
    } catch {
      setMsg(t().somethingWentWrong);
    } finally {
      setBusy(false);
    }
  };

  const buyCredits = async (productId: string) => {
    if (!credits.signedIn) {
      setMsg(t().creditsSignInPrompt);
      return;
    }
    setBusy(true);
    setBuyingPack(productId);
    setMsg('');
    try {
      const result = await purchaseCredits(productId);
      if (result.ok) {
        onCreditsPurchased?.(result.added);
        onClose();
        return;
      }
      if (result.needsSignIn) setMsg(t().creditsSignInPrompt);
      else if (!result.cancelled) setMsg(result.message);
    } finally {
      setBusy(false);
      setBuyingPack(null);
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
          accessibilityLabel={t().close}
        >
          <X size={18} color={MUTED} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.brand}>{t().waiairProBrand}</Text>
          <Text style={styles.tag}>
            {t().paywallTag}
          </Text>

          {/* Pay as you go — lower barrier, shown first */}
          <Text style={styles.sectionTitle}>{t().paywallPayAsYouGo}</Text>
          <Text style={styles.sectionSub}>{t().paywallCreditsSub}</Text>
          {credits.signedIn ? (
            credits.balance > 0 ? <Text style={styles.balance}>{t().creditsYouHave(credits.balance)}</Text> : null
          ) : (
            // Credits live on a signed-in account so they survive reinstalls and new phones.
            <View style={styles.signIn}>
              <Text style={styles.signInTxt}>{t().creditsSignInPrompt}</Text>
              {appleAvailable ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={14}
                  style={styles.providerBtn}
                  onPress={() => { if (!busy) void signIn('apple'); }}
                />
              ) : null}
              {googleAvailable ? (
                <TouchableOpacity
                  style={[styles.providerBtn, styles.googleBtn]}
                  onPress={() => { void signIn('google'); }}
                  disabled={busy}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t().creditsContinueWithGoogle}
                >
                  <Text style={styles.googleTxt}>{t().creditsContinueWithGoogle}</Text>
                </TouchableOpacity>
              ) : null}
              {lineAvailable ? (
                <TouchableOpacity
                  style={[styles.providerBtn, styles.lineBtn]}
                  onPress={() => { void signIn('line'); }}
                  disabled={busy}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t().creditsContinueWithLine}
                >
                  <Text style={styles.lineTxt}>{t().creditsContinueWithLine}</Text>
                </TouchableOpacity>
              ) : null}
              {!appleAvailable && !googleAvailable && !lineAvailable
                ? <Text style={styles.signInNote}>{t().creditsSignInUnavailable}</Text>
                : null}
            </View>
          )}
          {packs.map(pack => (
            <Pressable
              key={pack.productId}
              style={({ pressed }) => [
                styles.plan,
                styles.pack,
                !credits.signedIn && styles.packLocked,
                pressed && !busy && credits.signedIn && styles.planOn,
              ]}
              onPress={() => { if (!busy) void buyCredits(pack.productId); }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !credits.signedIn }}
              accessibilityLabel={`${t().creditsCount(pack.credits)}, ${pack.priceString}`}
            >
              <Text style={styles.packCredits}>{t().creditsCount(pack.credits)}</Text>
              {buyingPack === pack.productId
                ? <ActivityIndicator color={GOLD} />
                : <Text style={styles.packPrice}>{pack.priceString}</Text>}
            </Pressable>
          ))}

          {/* Unlimited — subscription */}
          <View style={styles.unlimitedHead}>
            <Text style={styles.sectionTitle}>{t().paywallUnlimited}</Text>
            <View style={styles.frequentBadge}>
              <Text style={styles.frequentTxt}>{t().paywallFrequentFlyers}</Text>
            </View>
          </View>

          <View style={styles.features}>
            {[
              t().featureUnlimited,
              t().featureRefresh,
              t().featureAlerts,
              t().featureHistory,
              t().featureAirports,
              t().featureBaggage,
              t().featureRadar,
              t().featureGmailScan,
            ].map(title => (
              <Text key={title} style={styles.featureTxt}>{title}</Text>
            ))}
          </View>

          <Pressable
            style={[styles.plan, styles.planBest, plan === 'yearly' && styles.planOn]}
            onPress={() => setPlan('yearly')}
            accessibilityRole="button"
            accessibilityState={{ selected: plan === 'yearly' }}
            accessibilityLabel={t().yearlyA11y}
          >
            <View style={styles.bestBadge}>
              <Star size={10} color={NAVY} weight="fill" />
              <Text style={styles.bestTxt}>{t().saveBestValue}</Text>
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
            accessibilityLabel={t().monthlyA11y}
          >
            <Text style={styles.planLabel}>{prices.monthly.label}</Text>
            <Text style={styles.planPrice}>
              {prices.monthly.price}{prices.monthly.period}
            </Text>
          </Pressable>

          {/* No free trial is configured in the stores — don't promise one. */}
          <Text style={styles.trial}>{t().cancelAnytime}</Text>
          <Text style={styles.cancel}>{t().noCommitment}</Text>

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}

          <TouchableOpacity
            style={[styles.primary, busy && { opacity: 0.7 }]}
            onPress={buy}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t().upgradeToPro}
          >
            {busy && !buyingPack
              ? <ActivityIndicator color={NAVY} />
              : <Text style={styles.primaryTxt}>{t().upgradeToPro}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={restore} disabled={busy} hitSlop={10} style={styles.restoreBtn}>
            <Text style={styles.restoreTxt}>{t().restorePurchase}</Text>
          </TouchableOpacity>

          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => setLegal('privacy')} hitSlop={8} accessibilityRole="link" accessibilityLabel={t().privacy}>
              <Text style={styles.legalTxt}>{t().privacy}</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => setLegal('terms')} hitSlop={8} accessibilityRole="link" accessibilityLabel={t().termsShort}>
              <Text style={styles.legalTxt}>{t().termsShort}</Text>
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
  sectionTitle: { color: WHITE, fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { color: MUTED, fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 12 },
  balance: { color: GOLD, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  signIn: { gap: 10, marginBottom: 14 },
  signInTxt: { color: WHITE, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  signInNote: { color: MUTED, fontSize: 12, fontWeight: '600' },
  providerBtn: { width: '100%', height: 48 },
  googleBtn: {
    borderRadius: 14,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleTxt: { color: NAVY, fontSize: 16, fontWeight: '700' },
  lineBtn: {
    borderRadius: 14,
    backgroundColor: '#06C755', // LINE brand green
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineTxt: { color: WHITE, fontSize: 16, fontWeight: '700' },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  packLocked: { opacity: 0.5 },
  packCredits: { color: WHITE, fontSize: 17, fontWeight: '800' },
  packPrice: { color: GOLD, fontSize: 17, fontWeight: '800' },
  unlimitedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 26,
    marginBottom: 14,
  },
  frequentBadge: {
    backgroundColor: 'rgba(201,168,76,0.16)',
    borderColor: GOLD,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 1,
  },
  frequentTxt: { color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
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
