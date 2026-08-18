import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BellSimple, X } from 'phosphor-react-native';
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

function TrackFlightMock({ accent }: { accent: string }) {
  return (
    <View style={mock.flightWrap}>
      <View style={mock.flightRow}>
        <View style={mock.flightLogo} />
        <View style={mock.flightMid}>
          <Text style={mock.flightNum}>TG 205</Text>
          <Text style={mock.flightRoute}>Bangkok → Hong Kong</Text>
          <View style={mock.statusPill}>
            <Text style={mock.statusTxt}>On Time</Text>
          </View>
        </View>
        <View style={[mock.bellBtn, { backgroundColor: `${accent}22`, borderColor: accent }]}>
          <BellSimple size={15} color={accent} weight="fill" />
          <Text style={[mock.bellTxt, { color: accent }]}>{t().track}</Text>
        </View>
      </View>
      <View style={[mock.bellHighlight, { borderColor: accent }]} pointerEvents="none" />
    </View>
  );
}

function StepRow({
  n,
  text,
  color,
  muted,
}: {
  n: number;
  text: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepBadge, { backgroundColor: muted }]}>
        <Text style={[styles.stepNum, { color }]}>{n}</Text>
      </View>
      <Text style={[styles.stepTxt, { color }]}>{text}</Text>
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
  const steps = [
    copy.addWidgetSheetStep1,
    copy.addWidgetSheetStep2,
    copy.addWidgetSheetStep3,
    copy.addWidgetSheetStep4,
  ];

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

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.lead, { color: C.secondary }]}>
            {copy.addWidgetSheetBody}
          </Text>

          <WidgetPreviewMock />

          <Text style={[styles.sectionTitle, { color: C.text }]}>
            {copy.addWidgetSheetBeforeTitle}
          </Text>

          <View style={[styles.stepsCard, { backgroundColor: C.card, borderColor: C.border }]}>
            {steps.map((step, i) => (
              <StepRow
                key={String(i)}
                n={i + 1}
                text={step}
                color={C.text}
                muted={`${C.accent}33`}
              />
            ))}
          </View>

          <TrackFlightMock accent={C.accent} />

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
        </ScrollView>
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
    marginBottom: 8,
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
  flightWrap: {
    alignSelf: 'stretch',
    marginTop: 4,
    marginBottom: 8,
    position: 'relative',
  },
  flightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  flightLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  flightMid: {
    flex: 1,
    gap: 2,
  },
  flightNum: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  flightRoute: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusTxt: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '700',
  },
  bellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  bellTxt: {
    fontSize: 12,
    fontWeight: '800',
  },
  bellHighlight: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 78,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
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
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 32,
  },
  lead: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 12,
    marginTop: 8,
  },
  stepsCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepTxt: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  note: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  doneBtn: {
    marginTop: 20,
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
