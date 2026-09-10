import { useEffect } from 'react';
import { trackModuleUsed } from './analytics';
import type { ModuleId } from './modules';

/** Fire module_used when the module UI is shown. Session-once modules are handled in trackModuleUsed. */
export function useTrackModuleShown(module: ModuleId, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    void trackModuleUsed(module);
  }, [enabled, module]);
}
