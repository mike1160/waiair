import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X } from 'phosphor-react-native';

type Kind = 'privacy' | 'terms';

type ThemeColors = {
  bg: string; text: string; secondary: string; muted: string; list: string; accent: string;
};

type Props = {
  visible: boolean;
  kind: Kind;
  colors: ThemeColors;
  onClose: () => void;
};

export const PRIVACY_BODY = `WaiAir Privacy Policy

Last updated: 15 August 2026

What we collect
• Flight searches you type in the app (flight number, airport, city).
• Tracked flights you save on this device (flight number, times, gate, status).
• Optional location, used only to pick the nearest airport.
• Push notification tokens so we can send boarding, gate and delay alerts you opted into.
• Anonymous usage analytics (screens opened, crashes) to keep the app reliable.

What we do not do
• We do not sell your data.
• We do not share personal flight data with advertisers.
• We do not build advertising profiles.

Notifications
Alerts are generated from the flights you track. Tokens are used solely to deliver those alerts. You can turn each alert type off in Settings, or disable notifications in system settings.

Analytics
Usage data is anonymous. It cannot be used to identify you and is not sold.

Account & deletion
WaiAir does not require an account. To delete local data: Settings → Clear cache, then untrack all flights. To remove the app and all on-device data, delete WaiAir from your device.

Third parties
Flight data is fetched via our proxy from aviation data providers. Purchases are processed by Apple, Google and RevenueCat. They process payment information under their own policies.

Contact
support@waiair.app
`;

export const TERMS_BODY = `WaiAir Terms of Service

Last updated: 15 August 2026

WaiAir provides live flight-board information and optional tracking alerts. Times, gates and statuses come from third-party aviation data and may be delayed or incorrect. Always confirm with your airline and airport.

WaiAir Pro
Subscriptions and lifetime unlocks are billed by Apple or Google. Prices shown in the app include local taxes where required. A 7-day free trial may apply to subscriptions. Cancel anytime in your store account settings. Restoring purchases unlocks Pro on devices signed in with the same store account.

Acceptable use
Do not misuse the app, scrape our APIs, or interfere with other users.

Liability
Flight information is provided “as is”. We are not responsible for missed flights, connections or other losses arising from delayed or inaccurate data.

Contact
support@waiair.app
`;

export default function LegalScreen({ visible, kind, colors: C, onClose }: Props) {
  const title = kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  const body = kind === 'privacy' ? PRIVACY_BODY : TERMS_BODY;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: C.bg }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: C.text }]}>{title}</Text>
          <TouchableOpacity
            style={[styles.close, { backgroundColor: C.list }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={18} color={C.muted} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.copy, { color: C.secondary }]}>{body}</Text>
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
  title: { fontSize: 20, fontWeight: '800' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  copy: { fontSize: 14, lineHeight: 22, fontWeight: '500' },
});
