/** 4.6 empty→tracked confirm: takeoff on a shared Horizon, never the 2.8 s overlay. */

export type HomeConfirmState =
  | 'idle'
  | 'takeoff'
  | 'dim'
  | 'greet'
  | 'mounted'
  | 'chip'
  | 'still';

export type HomeConfirmStep = { state: HomeConfirmState; delayMs: number };

export type HomeConfirmPlan = {
  start: HomeConfirmState;
  steps: HomeConfirmStep[];
};

/** Sequential durations. Sum stays under 1.6 s. */
export const HOME_CONFIRM_MS = {
  takeoff: 400,
  dim: 200,
  greet: 280,
  mounted: 360,
  chip: 240,
} as const;

export const HOME_CONFIRM_REDUCED_GREET_MS = 1000;
export const HOME_CONFIRM_DIM = 0.3;
export const HOME_CONFIRM_TAKEOFF_DEG = 15;
export const HOME_CONFIRM_LEGACY_OVERLAY_MS = 2800;

const MOTION_STEPS: HomeConfirmStep[] = [
  { state: 'dim', delayMs: HOME_CONFIRM_MS.takeoff },
  { state: 'greet', delayMs: HOME_CONFIRM_MS.dim },
  { state: 'mounted', delayMs: HOME_CONFIRM_MS.greet },
  { state: 'chip', delayMs: HOME_CONFIRM_MS.mounted },
  { state: 'still', delayMs: HOME_CONFIRM_MS.chip },
];

export function homeConfirmDurationMs(plan: HomeConfirmPlan): number {
  return plan.steps.reduce((sum, step) => sum + step.delayMs, 0);
}

export function homeConfirmPlan(input: {
  reduced: boolean;
  foreground: boolean;
}): HomeConfirmPlan {
  if (!input.foreground) {
    return { start: 'still', steps: [] };
  }
  if (input.reduced) {
    return {
      start: 'mounted',
      steps: [{ state: 'still', delayMs: HOME_CONFIRM_REDUCED_GREET_MS }],
    };
  }
  return { start: 'takeoff', steps: MOTION_STEPS };
}

export function homeConfirmOnBackground(state: HomeConfirmState): HomeConfirmState {
  if (state === 'idle') return 'idle';
  return 'still';
}

/** takeoff / dim / greet — tracked home is not mounted yet. */
export function homeConfirmBeforeMount(state: HomeConfirmState): boolean {
  return state === 'takeoff' || state === 'dim' || state === 'greet';
}

export function homeConfirmUseTrackedBand(state: HomeConfirmState): boolean {
  return state === 'mounted' || state === 'chip' || state === 'still';
}

export function homeConfirmLocksPlane(state: HomeConfirmState): boolean {
  return state !== 'idle' && state !== 'still';
}

export function homeConfirmShowGreet(state: HomeConfirmState): boolean {
  return state === 'greet' || state === 'mounted' || state === 'chip';
}

export function homeConfirmDim(state: HomeConfirmState): boolean {
  return state === 'dim' || homeConfirmShowGreet(state);
}

export function homeConfirmShowChip(state: HomeConfirmState, reduced = false): boolean {
  if (state === 'idle' || state === 'still') return true;
  if (state === 'chip') return true;
  if (reduced && state === 'mounted') return true;
  return false;
}

export function homeConfirmSlideCards(state: HomeConfirmState, reduced = false): boolean {
  if (reduced) return false;
  return state === 'mounted';
}

export function homeConfirmBlocksConsent(state: HomeConfirmState): boolean {
  return state !== 'idle' && state !== 'still';
}

/** 0→1 never uses the cream 2.8 s overlay. */
export function homeConfirmSkipLegacyOverlay(): boolean {
  return true;
}

export function logHomeConfirm(from: HomeConfirmState, to: HomeConfirmState): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && from !== to) {
    console.log(`[homeConfirm] ${from} → ${to}`);
  }
}
