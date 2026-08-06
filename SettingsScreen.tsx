import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Platform, ScrollView,
} from 'react-native';
import { X, Sparkles, RotateCcw, Bell, ChevronRight } from 'lucide-react-native';
import { restorePurchases } from './lib/purchases';

type ThemeColors = {
  bg: string; card: string; text: string; secondary: string;
  muted: string; accent: string; border: string; list: string; gold: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  isPro: boolean;
  colors: ThemeColors;
  onOpenPaywall: () => void;
  onProUnlocked: () => void;
  onToast: (msg: string) => void;
};

export default function SettingsScreen({
  visible, onClose, isPro, colors: C, onOpenPaywall, onProUnlocked, onToast,
}: Props) {
  const [busy, setBusy] = useState(false);

  const restore = async () => {
    setBusy(true);
    try {
      const ok = await restorePurchases();
      if (ok) {
        onProUnlocked();
        onToast('WaiAir Pro restored');
      } else {
        onToast('No purchase found');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: C.bg }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: C.text }]}>Settings</Text>
          <TouchableOpacity style={[styles.close, { backgroundColor: C.list }]} onPress={onClose} hitSlop={8}>
            <X size={18} color={C.secondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.section, { color: C.muted }]}>WAI AIR PRO</Text>

          {isPro ? (
            <View style={[styles.card, { backgroundColor: C.card }]}>
              <Sparkles size={18} color={C.gold} strokeWidth={2} />
              <Text style={[styles.proActive, { color: C.gold }]}>WaiAir Pro — Active ✓</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
              onPress={() => { onClose(); onOpenPaywall(); }}
              activeOpacity={0.8}
            >
              <Sparkles size={18} color={C.gold} strokeWidth={2} />
              <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>Upgrade to Pro →</Text>
              <ChevronRight size={16} color={C.muted} strokeWidth={2} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card, opacity: busy ? 0.7 : 1 }]}
            onPress={restore}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy
              ? <ActivityIndicator color={C.accent} />
              : <RotateCcw size={18} color={C.accent} strokeWidth={2} />}
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>Restore purchase</Text>
          </TouchableOpacity>

          <Text style={[styles.section, { color: C.muted, marginTop: 24 }]}>SYSTEM</Text>
          <TouchableOpacity
            style={[styles.card, styles.cardBtn, { backgroundColor: C.card }]}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Bell size={18} color={C.accent} strokeWidth={2} />
            <Text style={[styles.rowTxt, { color: C.text, flex: 1 }]}>Notification settings</Text>
            <ChevronRight size={16} color={C.muted} strokeWidth={2} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Platform.OS === 'ios' ? 16 : 20 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800' },
  close: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  section: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    marginBottom: 10, marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  cardBtn: {},
  proActive: { fontSize: 15, fontWeight: '700' },
  rowTxt: { fontSize: 15, fontWeight: '600' },
});
