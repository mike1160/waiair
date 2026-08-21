import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight } from 'phosphor-react-native';
import { startLoopWhileActive } from './lib/appActivity';
import { type DetailCardTheme } from './lib/detailCardStyles';
import { showLandingGrab, type LandingCardPhase } from './lib/landingCards';
import {
  getImmigrationApp,
  immigrationOpenUrl,
} from './lib/immigrationApps';

export function shouldShowImmigrationTipCard(input: {
  type: 'arrival' | 'departure';
  status?: string;
  destIata?: string;
  landingPhase?: LandingCardPhase;
}): boolean {
  if (input.type !== 'arrival') return false;
  if (String(input.status || '').toLowerCase() === 'cancelled') return false;
  if (String(input.status || '').toLowerCase() !== 'landed') return false;
  if (!getImmigrationApp(String(input.destIata || ''))) return false;
  if (input.landingPhase !== undefined) {
    return showLandingGrab(input.landingPhase);
  }
  return true;
}

export default function ImmigrationTipCard({
  type,
  status,
  destIata,
  landingPhase,
}: {
  type: 'arrival' | 'departure';
  status?: string;
  destIata?: string;
  landingPhase?: LandingCardPhase;
  theme: DetailCardTheme;
}) {
  const app = useMemo(
    () => getImmigrationApp(String(destIata || '')),
    [destIata],
  );

  const visible = useMemo(
    () => shouldShowImmigrationTipCard({ type, status, destIata, landingPhase }),
    [type, status, destIata, landingPhase],
  );

  const pulse = useRef(new Animated.Value(0)).current;
  const run = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const stopPulse = startLoopWhileActive(() =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    const stopRun = startLoopWhileActive(() =>
      Animated.loop(
        Animated.timing(run, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ),
    );
    return () => {
      stopPulse();
      stopRun();
      pulse.setValue(0);
      run.setValue(0);
    };
  }, [visible, pulse, run]);

  if (!visible || !app) return null;

  const textOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const arrowX = run.interpolate({ inputRange: [0, 1], outputRange: [0, 7] });
  const arrowOpacity = run.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0.35, 1, 1, 0.35] });

  return (
    <Pressable
      onPress={() => { Linking.openURL(immigrationOpenUrl(app)).catch(() => {}); }}
      accessibilityRole="button"
      accessibilityLabel={app.description}
      style={({ pressed }) => [st.row, pressed && st.pressed]}
    >
      <Text style={st.flag}>{app.flagEmoji}</Text>
      <Animated.Text style={[st.label, { opacity: textOpacity }]} numberOfLines={1}>
        {app.description}
      </Animated.Text>
      <View style={st.arrowSlot}>
        <Animated.View style={{ transform: [{ translateX: arrowX }], opacity: arrowOpacity }}>
          <ArrowRight size={12} color="rgba(255,255,255,0.7)" weight="bold" />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    maxHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.72,
  },
  flag: {
    fontSize: 16,
    lineHeight: 20,
  },
  label: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  arrowSlot: {
    width: 20,
    height: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
