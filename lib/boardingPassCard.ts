/** Session-scoped boarding-pass card helpers (no React Native). */

let shimmerPlayedThisSession = false;

export function consumeBoardingPassShimmer(): boolean {
  if (shimmerPlayedThisSession) return false;
  shimmerPlayedThisSession = true;
  return true;
}

export function resetBoardingPassShimmerForTests(): void {
  shimmerPlayedThisSession = false;
}

export function boardingPassShimmerPlayed(): boolean {
  return shimmerPlayedThisSession;
}

/** Hide with the horizon on search focus; show again on blur. */
export function boardingPassCardVisible(inputFocused: boolean): boolean {
  return !inputFocused;
}
