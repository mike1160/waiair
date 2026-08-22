import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getPreset, isModuleActive } from '../lib/modules';

export async function resolveFidsBoardActive(): Promise<boolean> {
  const preset = await getPreset();
  if (preset !== 'quick') return true;
  return isModuleActive('fids_board');
}

/** Reload when settings close or app returns to foreground. */
export function useFidsBoardMode(showSettings: boolean): boolean {
  const [fidsBoardActive, setFidsBoardActive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const reload = async () => {
      try {
        const active = await resolveFidsBoardActive();
        if (!cancelled) setFidsBoardActive(active);
      } catch {
        if (!cancelled) setFidsBoardActive(true);
      }
    };
    void reload();
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') void reload();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [showSettings]);

  return fidsBoardActive;
}
