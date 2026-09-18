/**
 * Quick actions on the flight detail page: weather, briefing, immigration and transport, always visible.
 * Each button jumps to the section that already holds that content — no new screens, no accordion to open first.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CloudSun, IdentificationCard, Sun, Taxi } from 'phosphor-react-native';

export type QuickAction = 'weather' | 'briefing' | 'immigration' | 'transport';

type Props = {
  /** Only the actions whose content this flight actually has. */
  actions: QuickAction[];
  labels: Record<QuickAction, string>;
  theme: { text: string; accent: string; card: string; border: string };
  onPress: (action: QuickAction) => void;
};

function icon(action: QuickAction, color: string) {
  const props = { size: 16, color, weight: 'bold' as const };
  if (action === 'weather') return <CloudSun {...props} />;
  if (action === 'briefing') return <Sun {...props} />;
  if (action === 'immigration') return <IdentificationCard {...props} />;
  return <Taxi {...props} />;
}

export default function QuickActionsRow({ actions, labels, theme, onPress }: Props) {
  if (!actions.length) return null;
  return (
    <View style={styles.row}>
      {actions.map(action => (
        <Pressable
          key={action}
          onPress={() => onPress(action)}
          style={[styles.btn, { backgroundColor: theme.card, borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={labels[action]}
        >
          {icon(action, theme.accent)}
          <Text style={[styles.txt, { color: theme.text }]} numberOfLines={1}>{labels[action]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  txt: { fontSize: 13, fontWeight: '600' },
});
