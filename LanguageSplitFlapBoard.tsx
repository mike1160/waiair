import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check } from 'phosphor-react-native';
import type { LocalePref } from './lib/prefs';

const GOLD = '#C9A84C';
const BOARD_BG = '#060e1a';
const FLAP_BG = '#1a2f4a';
const FLIP_MS = 150;
const STAGGER_MS = 40;
const NAME_LEN = 8;
const CODE_LEN = 5;
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const LANGUAGES = [
  { flag: '🇬🇧', name: 'English', code: 'en', display: 'ENGLISH' },
  { flag: '🇳🇱', name: 'Nederlands', code: 'nl', display: 'NEDERLND' },
  { flag: '🇹🇭', name: 'ไทย', code: 'th', display: 'THAI' },
  { flag: '🇨🇳', name: '中文', code: 'zh', display: 'CHINESE' },
  { flag: '🇩🇪', name: 'Deutsch', code: 'de', display: 'DEUTSCH' },
  { flag: '🇷🇺', name: 'Русский', code: 'ru', display: 'RUSSKIY' },
  { flag: '🇯🇵', name: '日本語', code: 'ja', display: 'JAPANESE' },
  { flag: '🇰🇷', name: '한국어', code: 'ko', display: 'KOREAN' },
  { flag: '🇻🇳', name: 'Tiếng Việt', code: 'vi', display: 'VIET' },
  { flag: '🇮🇩', name: 'Indonesia', code: 'id', display: 'INDONSIA' },
  { flag: '🇪🇸', name: 'Español', code: 'es', display: 'ESPANOL ' },
] as const;

const BOARD_CODES: Record<(typeof LANGUAGES)[number]['code'], string> = {
  en: 'EN-GB',
  nl: 'NL-NL',
  th: 'TH-TH',
  zh: 'ZH-CN',
  de: 'DE-DE',
  ru: 'RU-RU',
  ja: 'JA-JP',
  ko: 'KO-KR',
  vi: 'VI-VN',
  id: 'ID-ID',
  es: 'ES-ES',
};

function padFlaps(value: string, length: number): string[] {
  return value.toUpperCase().padEnd(length, ' ').slice(0, length).split('');
}

function FlapTile({
  char,
  color,
  delayMs,
}: {
  char: string;
  color: string;
  delayMs: number;
}) {
  const rot = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(char);
  const shownRef = useRef(char);
  const gen = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      shownRef.current = char;
      setShown(char);
      return;
    }
    if (shownRef.current === char) return;

    const id = ++gen.current;
    let half: Animated.CompositeAnimation | undefined;
    let rest: Animated.CompositeAnimation | undefined;
    const timeout = setTimeout(() => {
      rot.stopAnimation();
      rot.setValue(0);
      half = Animated.timing(rot, {
        toValue: 1,
        duration: FLIP_MS / 2,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      });
      half.start(({ finished }) => {
        if (!finished || id !== gen.current) return;
        shownRef.current = char;
        setShown(char);
        rest = Animated.timing(rot, {
          toValue: 0,
          duration: FLIP_MS / 2,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        rest.start();
      });
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      half?.stop();
      rest?.stop();
    };
  }, [char, delayMs, rot]);

  const rotateX = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

  return (
    <View style={st.flap}>
      <Animated.View
        style={[
          st.flapFace,
          {
            transform: [{ perspective: 240 }, { rotateX }],
          },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[st.flapChar, { color }]}
        >
          {shown === ' ' ? '' : shown}
        </Text>
      </Animated.View>
      <View pointerEvents="none" style={st.flapSplit} />
    </View>
  );
}

function FlapRow({
  label,
  text,
  length,
  color,
}: {
  label: string;
  text: string;
  length: number;
  color: string;
}) {
  const chars = padFlaps(text, length);
  return (
    <View style={st.boardRow}>
      <Text allowFontScaling={false} style={st.rowLabel}>{label}</Text>
      <View style={st.flaps}>
        {chars.map((ch, i) => (
          <FlapTile key={`${label}-${i}`} char={ch} color={color} delayMs={i * STAGGER_MS} />
        ))}
      </View>
    </View>
  );
}

export default function LanguageSplitFlapBoard({
  locale,
  cardColor,
  textColor,
  onSelect,
}: {
  locale: LocalePref;
  cardColor: string;
  textColor: string;
  onSelect: (code: LocalePref) => void;
}) {
  const active = LANGUAGES.find(l => l.code === locale) ?? LANGUAGES[0];

  return (
    <View style={st.wrap}>
      <View style={st.board} accessibilityRole="text" accessibilityLabel={`${active.name}, ${BOARD_CODES[active.code]}`}>
        <FlapRow label="LANG" text={active.display} length={NAME_LEN} color={GOLD} />
        <FlapRow label="CODE" text={BOARD_CODES[active.code]} length={CODE_LEN} color="#FFFFFF" />
      </View>

      <View style={st.grid}>
        {LANGUAGES.map(lang => {
          const selected = lang.code === locale;
          return (
            <Pressable
              key={lang.code}
              style={({ pressed }) => [
                st.langRow,
                { backgroundColor: cardColor, opacity: pressed ? 0.88 : 1 },
                selected && st.langRowActive,
              ]}
              onPress={() => onSelect(lang.code)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={lang.name}
            >
              <Text allowFontScaling={false} style={st.flag}>{lang.flag}</Text>
              <Text style={[st.langName, { color: textColor }]} numberOfLines={1}>
                {lang.name}
              </Text>
              {selected ? <Check size={14} color={GOLD} weight="bold" /> : <View style={st.checkSlot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  board: {
    backgroundColor: BOARD_BG,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    width: 40,
    color: 'rgba(201,168,76,0.72)',
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  flaps: {
    flexDirection: 'row',
    gap: 3,
  },
  flap: {
    width: 18,
    height: 24,
    borderRadius: 3,
    backgroundColor: FLAP_BG,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flapFace: {
    width: 18,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  flapChar: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },
  flapSplit: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 11.5,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  grid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langRow: {
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: '48.5%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  langRowActive: {
    borderColor: GOLD,
    backgroundColor: 'rgba(201,168,76,0.14)',
  },
  flag: {
    fontSize: 16,
    lineHeight: 20,
  },
  langName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  checkSlot: {
    width: 14,
    height: 14,
  },
});
