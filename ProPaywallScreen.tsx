import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import {
  AlarmClock as Alarm2, History, LayoutDashboard, X,
} from 'lucide-react-native';
import { purchasePro, restorePurchases } from './lib/purchases';

const NAVY = '#0A0F1E';
const GOLD = '#C9A84C';
const MUTED = '#8896B0';
const SURFACE = '#111827';

type Props = {
  visible: boolean;
  onClose: () => void;
  onProUnlocked: () => void;
};

const FEATURES = [
  { Icon: Alarm2, title: 'Wake-up alarm — notified before landing' },
  { Icon: History, title: 'Flight history — all past flights' },
  { Icon: LayoutDashboard, title: 'Multi-airport dashboard' },
] as const;

/**
 * Custom fallback paywall when RevenueCat remote Paywall UI is unavailable
 * (e.g. Expo Go preview mode, or no Paywall attached to the Offering yet).
 */
export default function ProPaywallScreen({ visible, onClose, onProUnlocked }: Props) {
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
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={12} accessibilityLabel="Close">
          <X size={20} color={MUTED} strokeWidth={2} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.header}>WaiAir Pro</Text>
          <Text style={styles.tagline}>Always one step ahead</Text>

          <View style={styles.features}>
            {FEATURES.map(({ Icon, title }) => (
              <View key={title} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Icon size={18} color={GOLD} strokeWidth={2} />
                </View>
                <Text style={styles.featureTxt}>{title}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.price}>€9.99 · One-time · Yours forever</Text>
          <Text style={styles.priceNote}>Launch price — increases after 500 users</Text>

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}

          <TouchableOpacity
            style={[styles.primary, busy && { opacity: 0.7 }]}
            onPress={buy}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={NAVY} />
              : <Text style={styles.primaryTxt}>Get WaiAir Pro</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondary, busy && { opacity: 0.7 }]}
            onPress={restore}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryTxt}>Restore purchase</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={8}>
            <Text style={styles.later}>Maybe later</Text>
          </TouchableOpacity>
        </ScrollView>
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
  close: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 20,
    right: 20,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    fontSize: 32,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: MUTED,
    fontWeight: '500',
    marginBottom: 36,
  },
  features: { width: '100%', gap: 14, marginBottom: 36 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTxt: {
    flex: 1,
    color: '#F0F4FF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    paddingTop: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0F4FF',
    textAlign: 'center',
  },
  priceNote: {
    fontSize: 12,
    color: MUTED,
    marginTop: 8,
    marginBottom: 28,
    textAlign: 'center',
  },
  msg: {
    color: '#F59E0B',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  primary: {
    width: '100%',
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryTxt: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
  },
  secondary: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MUTED,
    marginBottom: 18,
  },
  secondaryTxt: {
    color: '#F0F4FF',
    fontSize: 14,
    fontWeight: '700',
  },
  later: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
});
