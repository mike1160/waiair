import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, Pressable, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { purchasePro, restorePurchases } from './lib/purchases';

const NAVY = '#0A0F1E';
const GOLD = '#C9A84C';
const MUTED = '#8896B0';
const SURFACE = '#111827';
const WHITE = '#F8FAFC';

type Props = {
  visible: boolean;
  onClose: () => void;
  onProUnlocked: () => void;
  /** Optional contextual headline (e.g. tracking limit) */
  highlight?: string;
};

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string }[] = [
  { icon: 'airplane', title: 'Unlimited flight tracking' },
  { icon: 'wallet-outline', title: 'Apple Wallet passes' },
  { icon: 'phone-portrait-outline', title: 'Home screen widget' },
  { icon: 'notifications-outline', title: 'Live Activities on lockscreen' },
  { icon: 'alarm-outline', title: 'Wake-up alarm before landing' },
  { icon: 'time-outline', title: 'Flight history' },
  { icon: 'git-compare-outline', title: 'Multi-airport dashboard' },
];

/**
 * Freemium Pro paywall — bottom sheet with monthly subscription via RevenueCat.
 */
export default function ProPaywallScreen({
  visible, onClose, onProUnlocked, highlight,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!visible) {
      setMsg('');
      setBusy(false);
    }
  }, [visible]);

  const buy = async () => {
    setBusy(true);
    setMsg('');
    try {
      const result = await purchasePro();
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.brandRow}>
            <Text style={styles.brand}>WaiAir</Text>
            <View style={styles.proPill}>
              <Text style={styles.proPillTxt}>Pro</Text>
            </View>
          </View>

          <Text style={styles.title}>Unlock WaiAir Pro</Text>
          <Text style={styles.subtitle}>
            Everything you need as a frequent traveller
          </Text>

          {highlight ? (
            <View style={styles.highlight}>
              <Ionicons name="lock-closed" size={14} color={GOLD} />
              <Text style={styles.highlightTxt}>{highlight}</Text>
            </View>
          ) : null}

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={GOLD} />
                <Ionicons name={f.icon} size={16} color={MUTED} style={{ marginLeft: 2 }} />
                <Text style={styles.featureTxt}>{f.title}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.price}>€2.99 / month</Text>
          <Text style={styles.priceNote}>Cancel anytime</Text>

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}

          <TouchableOpacity
            style={[styles.primary, busy && { opacity: 0.7 }]}
            onPress={buy}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryTxt}>Start Pro</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={restore}
            disabled={busy}
            hitSlop={10}
            style={styles.restoreBtn}
          >
            <Text style={styles.restoreTxt}>Restore purchase</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={8}>
            <Text style={styles.later}>Maybe later</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NAVY,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: MUTED,
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.4,
  },
  proPill: {
    backgroundColor: 'rgba(201,168,76,0.18)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: GOLD,
  },
  proPillTxt: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '500',
    marginBottom: 16,
    lineHeight: 20,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  highlightTxt: {
    flex: 1,
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
  },
  features: {
    gap: 12,
    marginBottom: 22,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureTxt: {
    flex: 1,
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: GOLD,
    textAlign: 'center',
  },
  priceNote: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  msg: {
    color: '#fca5a5',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  primary: {
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  primaryTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  restoreBtn: {
    alignItems: 'center',
    marginTop: 14,
  },
  restoreTxt: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  later: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
});
