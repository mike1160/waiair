/**
 * MODE button for the home screen header, next to the settings gear, and the sheet it opens:
 * Day, Night, Airport, Kids and Blackout. Switching is instant (the theme fades over) and persists through the
 * existing theme storage, so it survives a restart.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../lib/i18n';
import { haptics } from '../lib/haptics';
import { useMode } from '../lib/modeContext';
import { APP_MODES, MODE_EMOJI, type AppMode } from '../lib/modes';

function label(mode: AppMode): { title: string; hint: string } {
  const copy = t();
  switch (mode) {
    case 'day': return { title: copy.modeDay, hint: copy.modeDayHint };
    case 'night': return { title: copy.modeNight, hint: copy.modeNightHint };
    case 'airport': return { title: copy.modeAirport, hint: copy.modeAirportHint };
    case 'blackout': return { title: copy.modeBlackout, hint: copy.modeBlackoutHint };
    case 'vapor': return { title: copy.modeVapor, hint: copy.modeVaporHint };
    case 'arctic': return { title: copy.modeArctic, hint: copy.modeArcticHint };
    default: return { title: copy.modeKids, hint: copy.modeKidsHint };
  }
}

export default function ModeSwitcher({ tint, scrim }: { tint: string; scrim?: string }) {
  const { mode, C, setMode } = useMode();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const square = !!C.square;

  const pick = (next: AppMode) => {
    haptics.light();
    setOpen(false);
    if (next !== mode) setMode(next);
  };

  return (
    <>
      <Pressable
        onPress={() => { haptics.light(); setOpen(true); }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`${t().modeTitle}: ${label(mode).title}`}
        style={[styles.btn, { borderColor: tint, borderRadius: square ? 0 : 999, backgroundColor: scrim || 'transparent' }]}
      >
        <Text style={styles.emoji}>{MODE_EMOJI[mode]}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t().close} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: C.card,
              borderColor: C.border,
              paddingBottom: insets.bottom + 18,
              borderTopLeftRadius: square ? 0 : 22,
              borderTopRightRadius: square ? 0 : 22,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: C.muted }]} />
          <Text style={[styles.title, { color: C.text, fontFamily: C.mono }]}>
            {square ? t().modeTitle.toUpperCase() : t().modeTitle}
          </Text>
          {APP_MODES.map(m => {
            const on = m === mode;
            const { title, hint } = label(m);
            return (
              <Pressable
                key={m}
                onPress={() => pick(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={title}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderColor: on ? C.accent : C.border,
                    backgroundColor: on ? C.accentDim : 'transparent',
                    borderRadius: square ? 0 : 14,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.rowEmoji}>{MODE_EMOJI[m]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: C.text }]}>{title}</Text>
                  <Text style={[styles.rowHint, { color: C.muted }]}>{hint}</Text>
                </View>
                {on ? <Check size={18} color={C.accent} weight="bold" /> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 6,
  },
  emoji: { fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, opacity: 0.5, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowEmoji: { fontSize: 24 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowHint: { fontSize: 12, marginTop: 1 },
});
