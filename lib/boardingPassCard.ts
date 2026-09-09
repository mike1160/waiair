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

/** Hide with the horizon while the software keyboard is up; show again when height is 0. */
export function boardingPassCardVisible(keyboardVisible: boolean): boolean {
  return !keyboardVisible;
}
