/**
 * The chime two of the [P/1] themes answer a moment with: Eagle when the flight leaves the ground, Cockpit
 * when boarding is called. Built on the split-flap tick's pattern (lib/useFlipSound.ts) — the same asset
 * handling, the same audio mode, the same promise that the silent switch wins.
 *
 * Which moment counts is decided in lib/themeChime.ts, where it can be unit-tested; this watches the status
 * the home screen already resolved and plays the file. On every other theme the hook loads no asset and does
 * nothing, so the four themes that were here before behave exactly as they did.
 */
import { useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { useMode } from './modeContext.ts';
import { ensureQuietAudioMode } from './useFlipSound.ts';
import { shouldChime, themeHasChime } from './themeChime.ts';

const CHIME = require('../assets/sounds/airport_chime.caf');
/** Softer than a notification: it marks a moment, it does not demand anything. */
const VOLUME = 0.4;

/**
 * Watches one status. Pass whatever the screen is already showing — the resolved overlay status of the
 * flight being followed — or null when no flight is being followed.
 */
export function useThemeChime(status: string | null | undefined): void {
  const { themeId } = useMode();
  const armed = themeHasChime(themeId);
  const player = useAudioPlayer(armed ? CHIME : null);
  /** The status the last render saw. Null until the first one, which is why a cold launch stays quiet. */
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!armed) return;
    player.volume = VOLUME;
    void ensureQuietAudioMode();
  }, [armed, player]);

  /* A theme change is not a flight event: forget what was seen so switching to Cockpit mid-boarding is quiet. */
  useEffect(() => {
    seen.current = null;
  }, [themeId]);

  useEffect(() => {
    const next = String(status || '') || null;
    const prev = seen.current;
    seen.current = next;
    if (!armed || !shouldChime(themeId, prev, next)) return;
    try {
      player.seekTo(0);
      player.play();
    } catch { /* a missed chime is not worth an error */ }
  }, [armed, themeId, status, player]);
}
