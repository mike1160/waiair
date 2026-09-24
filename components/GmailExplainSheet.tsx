/**
 * "How does the Gmail scan work?" — the answer, in Settings, before anyone has to decide.
 *
 * Reading someone's mailbox is the biggest thing this app asks for, so what it does and does not look at is
 * written out plainly: only senders and subjects, never the body, and nothing kept but booking numbers and
 * flight dates. The list of what it reads is the same list the Gmail screen shows, so the two cannot drift.
 *
 * No new route: a sheet over Settings, next to the section it explains.
 */
import { Modal, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { t } from '../lib/i18n';
import { haptics } from '../lib/haptics';

export const PRIVACY_URL = 'https://waiair.app/privacy';

type Colors = {
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Only offered once a mailbox is actually connected. */
  gmailConnected: boolean;
  onDisconnect?: () => void;
};

/** A multi-line i18n value read as one bullet per line, so a translator writes prose, not markup. */
function lines(value: string): string[] {
  return String(value || '').split('\n').map(s => s.trim()).filter(Boolean);
}

function Bullet({ text, color, dot }: { text: string; color: string; dot: string }) {
  return (
    <View style={st.bullet}>
      <Text style={[st.dot, { color: dot }]}>•</Text>
      <Text style={[st.bulletTxt, { color }]}>{text}</Text>
    </View>
  );
}

export default function GmailExplainSheet({ visible, onClose, gmailConnected, onDisconnect }: Props) {
  const copy = t();
  const insets = useSafeAreaInsets();

  // What the scan looks for, named exactly as the Gmail results screen names it.
  const reads = [
    copy.gmailFlights,
    copy.gmailHotels,
    copy.gmailCars,
    copy.gmailExcursions,
    copy.gmailCabineUpgrade,
    copy.gmailExtraBaggage,
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[st.root, { backgroundColor: '#0D1B2E' }]}>
        <View style={[st.head, { paddingTop: insets.top + 8 }]}>
          <Text style={st.title}>{copy.gmailExplainTitle}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={copy.close}>
            <X size={22} color="#F4F7FB" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[st.body, { paddingBottom: 24 + insets.bottom }]}>
          <Text style={st.section}>{copy.gmailExplainReads}</Text>
          {reads.map(item => <Bullet key={item} text={item} color="#F4F7FB" dot="#2E7D52" />)}

          <Text style={[st.section, st.sectionGap]}>{copy.gmailExplainNotReads}</Text>
          {lines(copy.gmailExplainNotReadsItems).map(item => (
            <Bullet key={item} text={item} color="#F4F7FB" dot="#E5484D" />
          ))}

          <Text style={[st.section, st.sectionGap]}>{copy.gmailExplainHow}</Text>
          {lines(copy.gmailExplainHowItems).map(item => (
            <Bullet key={item} text={item} color="#C5D0E0" dot="#C5D0E0" />
          ))}

          <View style={st.actions}>
            {gmailConnected && onDisconnect ? (
              <Pressable
                onPress={() => { haptics.light(); onDisconnect(); }}
                style={({ pressed }) => [st.disconnect, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={copy.gmailExplainDisconnect}
              >
                <Text style={st.disconnectTxt}>{copy.gmailExplainDisconnect}</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => { haptics.light(); Linking.openURL(PRIVACY_URL).catch(() => {}); }}
              style={({ pressed }) => [st.privacy, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="link"
              accessibilityLabel={copy.gmailExplainPrivacy}
            >
              <Text style={st.privacyTxt}>{copy.gmailExplainPrivacy}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { flex: 1, color: '#F4F7FB', fontSize: 20, fontWeight: '800' },
  body: { paddingHorizontal: 20, gap: 6 },
  section: { color: '#D4AF37', fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionGap: { marginTop: 22 },
  bullet: { flexDirection: 'row', gap: 10, paddingVertical: 3 },
  dot: { fontSize: 15, lineHeight: 21 },
  bulletTxt: { flex: 1, fontSize: 15, lineHeight: 21 },
  actions: { marginTop: 28, gap: 10 },
  disconnect: {
    borderWidth: 1,
    borderColor: '#E5484D',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  disconnectTxt: { color: '#E5484D', fontSize: 15, fontWeight: '700' },
  privacy: { paddingVertical: 10, alignItems: 'center' },
  privacyTxt: { color: '#C5D0E0', fontSize: 14, fontWeight: '600' },
});
