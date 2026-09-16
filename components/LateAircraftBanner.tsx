import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../lib/i18n';

const AMBER = '#F59E0B';
const AMBER_BG = 'rgba(245,158,11,0.14)';

type Props = {
  isPro: boolean;
  delayMin: number;
  onPressFree?: () => void;
};

export default function LateAircraftBanner({ isPro, delayMin, onPressFree }: Props) {
  const copy = t();
  if (isPro) {
    return (
      <View style={styles.wrap} accessibilityRole="text">
        <Text style={styles.txt}>{copy.lateAircraftBanner(delayMin)}</Text>
      </View>
    );
  }
  return (
    <Pressable
      style={styles.wrap}
      onPress={onPressFree}
      accessibilityRole="button"
      accessibilityLabel={copy.lateAircraftBannerFree}
    >
      <Text style={styles.txt}>{copy.lateAircraftBannerFree}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: AMBER_BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  txt: {
    color: AMBER,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
