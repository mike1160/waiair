import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/** Keep the screen on while `active` — uses activateKeepAwakeAsync (Expo 57). */
export function useStayAwake(tag: string, active: boolean) {
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [tag, active]);
}
