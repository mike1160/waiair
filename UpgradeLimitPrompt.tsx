import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { t } from './lib/i18n';

const NAVY = '#0A0F1E';
const GOLD = '#C9A84C';
const MUTED = '#8896B0';
const WHITE = '#F8FAFC';

type Props = {
  visible: boolean;
  onUpgrade: () => void;
  onNotNow: () => void;
};

export default function UpgradeLimitPrompt({ visible, onUpgrade, onNotNow }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onNotNow}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{t().youreTracking3}</Text>
          <Text style={styles.body}>{t().freePlanIncludes3}</Text>
          <Text style={styles.bodySpaced}>
            {t().upgradeProPitch}
          </Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.primary}
              onPress={onUpgrade}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t().upgradeA11y}
            >
              <Text style={styles.primaryTxt}>{t().upgradePrice}</Text>
            </TouchableOpacity>
            <Pressable
              style={styles.secondary}
              onPress={onNotNow}
              accessibilityRole="button"
              accessibilityLabel={t().notNow}
              hitSlop={12}
            >
              <Text style={styles.secondaryTxt}>{t().notNow}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,15,30,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: NAVY,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  title: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  body: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
  },
  bodySpaced: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 14,
  },
  row: {
    marginTop: 22,
    gap: 10,
  },
  primary: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryTxt: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '800',
  },
  secondary: {
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    alignItems: 'center',
  },
  secondaryTxt: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '700',
  },
});
