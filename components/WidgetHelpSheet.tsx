import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'phosphor-react-native';
import { t } from '../lib/i18n';

type ThemeColors = {
  bg: string;
  card: string;
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
};

function WidgetPreviewMock() {
  return (
    <View style={mock.phone}>
      <View style={mock.screen}>
        <View style={mock.iconRow}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={mock.appIcon} />
          ))}
        </View>
        <View style={mock.widget}>
          <Text style={mock.widgetBrand}>✈️ WaiAir</Text>
          <View style={mock.widgetLine}>
            <Text style={mock.widgetNum}>CX 778</Text>
            <Text style={mock.widgetTime}>14:30</Text>
          </View>
          <Text style={mock.widgetAirline}>Cathay Pacific</Text>
          <Text style={mock.widgetStatus}>On Time · Gate B12</Text>
          <Text style={mock.widgetCountdown}>Boards in 12m</Text>
        </View>
        <View style={mock.iconRow}>
          {[0, 1, 2, 3].map(i => (
            <View key={`b-${i}`} style={mock.appIcon} />
          ))}
        </View>
        <View style={mock.plusHint}>
          <Text style={mock.plusTxt}>+</Text>
        </View>
      </View>
    </View>
  );
}

export default function WidgetHelpSheet({
  visible,
  onClose,
  colors: C,
}: {
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
}) {
  const copy = t();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: C.bg }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: C.text }]}>{copy.addWidgetSheetTitle}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.close, { backgroundColor: C.card }]}
            accessibilityRole="button"
            accessibilityLabel={copy.close}
          >
            <X size={18} color={C.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <WidgetPreviewMock />
          <Text style={[styles.steps, { color: C.text }]}>{copy.addWidgetSheetBody}</Text>
          {Platform.OS !== 'ios' ? (
            <Text style={[styles.note, { color: C.muted }]}>{copy.addWidgetSheetIosOnly}</Text>
          ) : null}
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: C.accent }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={copy.close}
          >
            <Text style={styles.doneTxt}>{copy.close}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const mock = StyleSheet.create({
  phone: {
    alignSelf: 'center',
    width: 220,
    height: 280,
    borderRadius: 28,
    backgroundColor: '#111827',
    padding: 10,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  screen: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    padding: 12,
    gap: 10,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  widget: {
    backgroundColor: '#0B1F3A',
    borderRadius: 14,
    padding: 10,
    gap: 3,
  },
  widgetBrand: {
    color: '#C9A84C',
    fontSize: 10,
    fontWeight: '800',
  },
  widgetLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  widgetNum: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  widgetTime: {
    color: '#C9A84C',
    fontSize: 14,
    fontWeight: '800',
  },
  widgetAirline: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  widgetStatus: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '700',
  },
  widgetCountdown: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  plusHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    paddingRight: 12,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  steps: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
  },
  note: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  doneBtn: {
    marginTop: 28,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
