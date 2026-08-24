import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

/** Height of the digit row — use as KeyboardAvoidingView offset so the field stays visible. */
export const FLIGHT_NUMBER_DIGIT_BAR_HEIGHT = 52;

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
const retainFocusRef = { current: false };
const focusedInputRef: { current: TextInput | null } = { current: null };

type OverlayState = { visible: boolean; keyboardHeight: number };
let overlayListener: ((state: OverlayState) => void) | null = null;
let lastKeyboardHeight = 0;

function setOverlay(state: OverlayState) {
  overlayListener?.(state);
}

function DigitBar() {
  return (
    <View
      style={st.bar}
      onTouchStart={() => {
        retainFocusRef.current = true;
      }}
    >
      <View style={st.digitRow}>
        {DIGITS.map(digit => (
          <Pressable
            key={digit}
            style={({ pressed }) => [st.digitKey, pressed && st.digitKeyPressed]}
            onPressIn={() => {
              retainFocusRef.current = true;
              handlersRef.current.insert(digit);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Digit ${digit}`}
          >
            <Text style={st.digitTxt}>{digit}</Text>
          </Pressable>
        ))}
        <Pressable
          style={({ pressed }) => [st.deleteKey, pressed && st.digitKeyPressed]}
          onPressIn={() => {
            retainFocusRef.current = true;
            handlersRef.current.delete();
          }}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Ionicons name="backspace-outline" size={18} color={YELLOW} />
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [st.doneKey, pressed && st.doneKeyPressed]}
        onPressIn={() => {
          retainFocusRef.current = false;
          handlersRef.current.done();
        }}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={st.doneTxt}>Done</Text>
      </Pressable>
    </View>
  );
}

/**
 * Overlay above the system keyboard (iOS + Android).
 * Do not use InputAccessoryView — it fails with Fabric and WKWebView.
 * Mount once at the app root, as the last child so it stacks above WebView.
 */
export function FlightNumberKeyboardAccessoryHost() {
  const [overlay, setOverlayState] = useState<OverlayState>({ visible: false, keyboardHeight: 0 });

  useEffect(() => {
    overlayListener = setOverlayState;
    return () => {
      overlayListener = null;
    };
  }, []);

  useEffect(() => {
    const showEvents = Platform.OS === 'ios'
      ? (['keyboardWillShow', 'keyboardDidShow'] as const)
      : (['keyboardDidShow'] as const);
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (ev: { endCoordinates: { height: number } }) => {
      lastKeyboardHeight = ev.endCoordinates.height;
      setOverlayState(prev => ({
        visible: prev.visible,
        keyboardHeight: lastKeyboardHeight,
      }));
    };
    const showSubs = showEvents.map(evt => Keyboard.addListener(evt, onShow));
    const hideSub = Keyboard.addListener(hideEvt, () => {
      if (retainFocusRef.current) return;
      setOverlayState({ visible: false, keyboardHeight: 0 });
    });
    return () => {
      showSubs.forEach(sub => sub.remove());
      hideSub.remove();
    };
  }, []);

  if (!overlay.visible || overlay.keyboardHeight <= 0) return null;

  return (
    <View pointerEvents="box-none" style={[st.host, { bottom: overlay.keyboardHeight }]}>
      <DigitBar />
    </View>
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
  const inputRef = useRef<TextInput>(null);

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
    focusedInputRef.current = inputRef.current;
    bindHandlers();
    setOverlay({ visible: true, keyboardHeight: lastKeyboardHeight });
  }, [bindHandlers]);

  const onBlur = useCallback(() => {
    if (retainFocusRef.current) {
      retainFocusRef.current = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => inputRef.current?.focus());
      });
      return;
    }
    if (focusedInputRef.current === inputRef.current) {
      focusedInputRef.current = null;
    }
    setOverlay({ visible: false, keyboardHeight: 0 });
  }, []);

  useEffect(() => {
    bindHandlers();
  }, [bindHandlers, value]);

  const inputProps: Pick<TextInputProps, 'onFocus' | 'onBlur'> = {
    onFocus,
    onBlur,
  };

  return { inputProps, inputRef };
}

const st = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 24,
  },
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
});
