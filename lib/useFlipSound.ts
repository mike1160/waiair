/**
 * The split-flap "clack": one short 800 Hz tick (30 ms) per flipping character, airport mode only.
 * It never overrides the user's choice to be quiet: playsInSilentMode is off, so the iPhone's silent switch
 * mutes it, and it mixes with other audio instead of pausing someone's music or podcast.
 */
import { useCallback, useEffect } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useIsAirport } from './modeContext';

const TICK = require('../assets/sounds/flip_tick.wav');
const VOLUME = 0.15;

let audioModeSet = false;

async function ensureQuietAudioMode(): Promise<void> {
  if (audioModeSet) return;
  audioModeSet = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  } catch {
    audioModeSet = false;
  }
}

/** Returns a `tick()` to call once per flipped character; a no-op outside airport mode. */
export function useFlipSound(): () => void {
  const airport = useIsAirport();
  const player = useAudioPlayer(airport ? TICK : null);

  useEffect(() => {
    if (!airport) return;
    player.volume = VOLUME;
    void ensureQuietAudioMode();
  }, [airport, player]);

  return useCallback(() => {
    if (!airport) return;
    try {
      player.seekTo(0);
      player.play();
    } catch { /* a missed click is fine */ }
  }, [airport, player]);
}
