/**
 * WaiAir Briefing [T/1]: three questions under the hub, and the answer to whichever one was tapped.
 *
 * Not a chatbot. There is no assistant here, no logo, no badge, no history, no thread — the app simply
 * turns out to know things, and offers the two or three worth knowing at this point in the trip. Most
 * answers are already on the device and appear instantly (lib/briefingAnswers.ts); the few that are not
 * cost one request, and none of them is fetched until a chip is actually pressed.
 *
 * One answer at a time. A new question replaces the old one rather than stacking, because a column of
 * past answers is a transcript, and a transcript is the thing this is deliberately not.
 *
 * The free-text field sits at the bottom, small and last, for the question the chips did not think of.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { haptics } from '../lib/haptics';
import { t } from '../lib/i18n';
import { briefingChips, type BriefingChip } from '../lib/briefingQuestions';
import { askBriefing, type BriefingFacts } from '../lib/briefingClient';
import type { FlightPhase } from '../lib/flightPhase';

/**
 * [W/12] How much answer the card shows before it starts scrolling.
 *
 * The answer used to be clipped at four lines by `numberOfLines`, which was fine when the three chips were
 * all this had to render and wrong for the free-text field, where a full answer is the point. Ten lines is
 * about as much as can sit on the hub without pushing everything else off it; the rest scrolls.
 */
const ANSWER_LINE_HEIGHT = 21;
const ANSWER_MAX_LINES = 10;

/**
 * When a wait stops looking like a wait and starts looking like a hang [W/12].
 *
 * The deadline is 15 seconds now, up from 8, so a slow answer can sit behind a spinner long enough for
 * someone to assume the app has given up. After this, the line says so instead of repeating itself.
 */
const SLOW_ANSWER_MS = 5000;

type Colors = {
  text: string;
  muted: string;
  accent: string;
  card: string;
  border: string;
};

/**
 * Hands the screen a way to measure the field's bottom edge in window coordinates [W/5]. A function rather
 * than a number, because the keyboard height often arrives after the focus event and the screen then has to
 * measure again — see lib/keyboardScroll.ts.
 */
export type MeasureInputBottom = (report: (bottomY: number) => void) => void;

type Props = {
  phase: FlightPhase | null | undefined;
  delayMinutes?: number;
  weatherAlert?: boolean;
  /** The journey, for the questions the proxy answers. Nothing else is ever sent. */
  facts: BriefingFacts;
  /**
   * The answers the app already has. Returns the sentence, or null when this device cannot answer after
   * all — in which case the question is asked out like any other.
   */
  answerLocally: (chip: BriefingChip) => string | null;
  colors: Colors;
  /** [W/5] The field took focus: the screen scrolls it clear of the keyboard. */
  onInputFocus?: (measure: MeasureInputBottom) => void;
  /** [W/5] The field lost focus, so there is nothing left to keep visible. */
  onInputBlur?: () => void;
};

type Answer = { text: string; error?: boolean } | null;

export default function BriefingPanel({
  phase, delayMinutes = 0, weatherAlert, facts, answerLocally, colors, onInputFocus, onInputBlur,
}: Props) {
  const copy = t();
  const chips = useMemo(
    () => briefingChips(phase, { delayMinutes, weatherAlert }),
    [phase, delayMinutes, weatherAlert],
  );
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer>(null);
  const [draft, setDraft] = useState('');
  /** Only the newest question may write an answer: a slow one must not overwrite a fresh one. */
  const asked = useRef(0);
  const inputRef = useRef<TextInput | null>(null);

  /**
   * [W/5] Where the field's bottom edge is on screen. Window coordinates, so the screen can compare it with
   * the keyboard without either of them knowing how the other is laid out.
   */
  /** [W/12] Past SLOW_ANSWER_MS the loading line acknowledges the wait rather than repeating itself. */
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_ANSWER_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  const measureInputBottom: MeasureInputBottom = report => {
    const node = inputRef.current;
    if (!node) return;
    node.measureInWindow((_x, y, _w, height) => {
      if (Number.isFinite(y) && Number.isFinite(height)) report(y + height);
    });
  };

  if (!chips.length) return null;

  const run = async (question: string, local: string | null) => {
    if (local) {
      // Already known: no spinner, no request, no wait.
      setAnswer({ text: local });
      return;
    }
    const seq = ++asked.current;
    setBusy(true);
    setAnswer(null);
    const out = await askBriefing(facts, question);
    if (seq !== asked.current) return;
    setBusy(false);
    if (out.ok) setAnswer({ text: out.answer });
    else setAnswer({ text: copy.briefingError, error: true });
  };

  const onChip = (chip: BriefingChip) => {
    haptics.light();
    const label = (copy as unknown as Record<string, string>)[chip.labelKey] || '';
    void run(label, chip.source === 'deterministic' ? answerLocally(chip) : null);
  };

  const onSubmit = () => {
    const question = draft.trim();
    if (!question || busy) return;
    haptics.light();
    setDraft('');
    void run(question, null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {chips.map(chip => (
          <Pressable
            key={chip.topic}
            onPress={() => onChip(chip)}
            disabled={busy}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityHint={copy.briefingTapToAsk}
          >
            <Text style={[styles.chipTxt, { color: colors.text }]} numberOfLines={1}>
              {(copy as unknown as Record<string, string>)[chip.labelKey] || chip.topic}
            </Text>
          </Pressable>
        ))}
      </View>

      {busy ? (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.loading, { color: colors.muted }]}>
            {slow ? copy.briefingLoadingSlow : copy.briefingLoading}
          </Text>
        </View>
      ) : answer ? (
        <View style={[styles.card, styles.answerCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {/* [W/12] Capped and scrollable, not clipped: a complete answer is the point of this field. */}
          <ScrollView
            style={styles.answerScroll}
            contentContainerStyle={styles.answerContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <Text style={[styles.answer, { color: answer.error ? colors.muted : colors.text }]}>
              {answer.text}
            </Text>
          </ScrollView>
        </View>
      ) : null}

      {/* Last, and quiet: for the question the three chips did not happen to be. */}
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={onSubmit}
        onFocus={() => onInputFocus?.(measureInputBottom)}
        onBlur={() => onInputBlur?.()}
        returnKeyType="send"
        placeholder={copy.briefingAskAnything}
        placeholderTextColor={colors.muted}
        editable={!busy}
        autoCorrect={false}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipTxt: { fontSize: 13, fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  /* [W/12] A tall answer reads from the top; centring it looked deliberate only while it was four lines. */
  answerCard: { alignItems: 'flex-start' },
  loading: { fontSize: 14 },
  /* No flex here: inside a ScrollView it collapses the text. The scroll view carries the width instead. */
  answer: { fontSize: 15, lineHeight: ANSWER_LINE_HEIGHT },
  answerScroll: { flex: 1, maxHeight: ANSWER_MAX_LINES * ANSWER_LINE_HEIGHT },
  answerContent: { flexGrow: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
});
