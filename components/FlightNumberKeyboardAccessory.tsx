import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInputProps,
  View,
} from 'react-native';

export const FLIGHT_NUMBER_KEYBOARD_ACCESSORY_ID = 'waiair-flight-number-digits';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
const YELLOW = '#F5C518';
const BG = '#0f1117';
const KEY_BG = '#1a1c23';
const KEY_BORDER = 'rgba(245, 197, 24, 0.35)';

type KeyboardHandlers = {
  insert: (char: string) => void;
  delete: () => void;
  done: () => void;
};

const noopHandlers: KeyboardHandlers = {
  insert: () => {},
  delete: () => {},
  done: () => {},
};

const handlersRef: { current: KeyboardHandlers } = { current: noopHandlers };

type AndroidOverlayState = { visible: boolean; keyboardHeight: number };
let androidOverlayListener: ((state: AndroidOverlayState) => void) | null = null;

function setAndroidOverlay(state: AndroidOverlayState) {
  androidOverlayListener?.(state);
}

function DigitBar({ compact }: { compact?: boolean }) {
  return (
    <View style={[st.bar, compact && st.barCompact]}>
      <View style={st.digitRow}>
        {DIGITS.map(digit => (
          <Pressable
            key={digit}
            style={({ pressed }) => [st.digitKey, pressed && st.digitKeyPressed]}
            onPress={() => handlersRef.current.insert(digit)}
            accessibilityRole="button"
            accessibilityLabel={`Digit ${digit}`}
          >
            <Text style={st.digitTxt}>{digit}</Text>
          </Pressable>
        ))}
        <Pressable
          style={({ pressed }) => [st.deleteKey, pressed && st.digitKeyPressed]}
          onPress={() => handlersRef.current.delete()}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Ionicons name="backspace-outline" size={18} color={YELLOW} />
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [st.doneKey, pressed && st.doneKeyPressed]}
        onPress={() => handlersRef.current.done()}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={st.doneTxt}>Done</Text>
      </Pressable>
    </View>
  );
}

/** Mount once per screen root (Quick home, My Flights add panel, etc.). */
export function FlightNumberKeyboardAccessoryHost() {
  const [android, setAndroid] = useState<AndroidOverlayState>({ visible: false, keyboardHeight: 0 });

  useEffect(() => {
    androidOverlayListener = setAndroid;
    return () => {
      androidOverlayListener = null;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const showSub = Keyboard.addListener('keyboardDidShow', ev => {
      setAndroid(prev => ({
        visible: prev.visible,
        keyboardHeight: ev.endCoordinates.height,
      }));
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroid({ visible: false, keyboardHeight: 0 });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={FLIGHT_NUMBER_KEYBOARD_ACCESSORY_ID}>
          <DigitBar />
        </InputAccessoryView>
      ) : null}
      {Platform.OS === 'android' && android.visible && android.keyboardHeight > 0 ? (
        <View pointerEvents="box-none" style={[st.androidHost, { bottom: android.keyboardHeight }]}>
          <DigitBar compact />
        </View>
      ) : null}
    </>
  );
}

type FlightNumberKeyboardOptions = {
  maxLength?: number;
  onDone?: () => void;
};

export function useFlightNumberKeyboard(
  value: string,
  onChangeText: (text: string) => void,
  options?: FlightNumberKeyboardOptions,
) {
  const maxLength = options?.maxLength ?? 7;
  const valueRef = useRef(value);
  valueRef.current = value;

  const bindHandlers = useCallback(() => {
    handlersRef.current = {
      insert: (char: string) => {
        const next = `${valueRef.current}${char}`.toUpperCase().slice(0, maxLength);
        onChangeText(next);
      },
      delete: () => {
        onChangeText(valueRef.current.slice(0, -1));
      },
      done: () => {
        Keyboard.dismiss();
        options?.onDone?.();
      },
    };
  }, [maxLength, onChangeText, options?.onDone]);

  const onFocus = useCallback(() => {
    bindHandlers();
    if (Platform.OS === 'android') {
      setAndroidOverlay({ visible: true, keyboardHeight: 0 });
    }
  }, [bindHandlers]);

  const onBlur = useCallback(() => {
    if (Platform.OS === 'android') {
      setAndroidOverlay({ visible: false, keyboardHeight: 0 });
    }
  }, []);

  useEffect(() => {
    bindHandlers();
  }, [bindHandlers, value]);

  const inputProps: Pick<TextInputProps, 'inputAccessoryViewID' | 'onFocus' | 'onBlur'> = {
    inputAccessoryViewID: Platform.OS === 'ios' ? FLIGHT_NUMBER_KEYBOARD_ACCESSORY_ID : undefined,
    onFocus,
    onBlur,
  };

  return { inputProps };
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: KEY_BORDER,
    paddingHorizontal: 6,
    paddingVertical: 7,
    gap: 6,
  },
  barCompact: {
    paddingVertical: 6,
  },
  digitRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  digitKey: {
    flex: 1,
    minWidth: 26,
    height: 36,
    borderRadius: 8,
    backgroundColor: KEY_BG,
    borderWidth: 1,
    borderColor: KEY_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitKeyPressed: {
    backgroundColor: 'rgba(245, 197, 24, 0.12)',
  },
  digitTxt: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deleteKey: {
    width: 40,
    height: 36,
    borderRadius: 8,
    backgroundColor: KEY_BG,
    borderWidth: 1,
    borderColor: KEY_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneKey: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneKeyPressed: {
    opacity: 0.88,
  },
  doneTxt: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  androidHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 8,
  },
});
