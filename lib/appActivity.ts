import { useEffect, useState } from 'react';
import { Animated, AppState, InteractionManager, type AppStateStatus } from 'react-native';

export function isAppForeground(status: AppStateStatus = AppState.currentState): boolean {
  return status === 'active';
}

/** Re-render when the app leaves or returns to the foreground. */
export function useAppForeground(): boolean {
  const [active, setActive] = useState(() => isAppForeground());
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      setActive(isAppForeground(next));
    });
    setActive(isAppForeground());
    return () => sub.remove();
  }, []);
  return active;
}

type Cancelable = { cancel?: () => void };

/**
 * Start an Animated.loop only while the app is foregrounded.
 * Stops immediately on background/inactive so native animations cannot crash on resume.
 */
export function startLoopWhileActive(create: () => Animated.CompositeAnimation): () => void {
  let loop: Animated.CompositeAnimation | null = null;
  let task: Cancelable | null = null;

  const stop = () => {
    try { task?.cancel?.(); } catch { /* ignore */ }
    task = null;
    try { loop?.stop(); } catch (e) {
      console.warn('[cleanup error]', e);
    }
    loop = null;
  };

  const start = () => {
    stop();
    task = InteractionManager.runAfterInteractions(() => {
      task = null;
      if (!isAppForeground()) return;
      try {
        loop = create();
        loop.start();
      } catch (e) {
        console.warn('[animation] start error', e);
      }
    });
  };

  if (isAppForeground()) start();
  const sub = AppState.addEventListener('change', next => {
    if (isAppForeground(next)) start();
    else stop();
  });

  return () => {
    try { sub.remove(); } catch (e) {
      console.warn('[cleanup error]', e);
    }
    stop();
  };
}

/** Run a timer only while foregrounded. `begin` must return a stop function (e.g. clearInterval). */
export function runWhileAppActive(begin: () => () => void): () => void {
  let stopInner: (() => void) | null = null;

  const stop = () => {
    try { stopInner?.(); } catch (e) {
      console.warn('[cleanup error]', e);
    }
    stopInner = null;
  };

  const start = () => {
    stop();
    if (!isAppForeground()) return;
    try {
      stopInner = begin();
    } catch (e) {
      console.warn('[timer] start error', e);
    }
  };

  if (isAppForeground()) start();
  const sub = AppState.addEventListener('change', next => {
    if (isAppForeground(next)) start();
    else stop();
  });

  return () => {
    try { sub.remove(); } catch (e) {
      console.warn('[cleanup error]', e);
    }
    stop();
  };
}
