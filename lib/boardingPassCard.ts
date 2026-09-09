/** Session-scoped boarding-pass card helpers (no React Native). */

export const BOARDING_PASS_SHIMMER_MS = 900;
/** Idle stub lift starts after the card shimmer finishes. */
export const BOOKING_STUB_LIFT_AFTER_MS = BOARDING_PASS_SHIMMER_MS + 1500;

let shimmerPlayedThisSession = false;
let stubLiftPlayedThisSession = false;

export function consumeBoardingPassShimmer(): boolean {
  if (shimmerPlayedThisSession) return false;
  shimmerPlayedThisSession = true;
  return true;
}

export function consumeBookingStubLift(): boolean {
  if (stubLiftPlayedThisSession) return false;
  stubLiftPlayedThisSession = true;
  return true;
}

export function resetBoardingPassShimmerForTests(): void {
  shimmerPlayedThisSession = false;
  stubLiftPlayedThisSession = false;
}

export function boardingPassShimmerPlayed(): boolean {
  return shimmerPlayedThisSession;
}

export function bookingStubLiftPlayed(): boolean {
  return stubLiftPlayedThisSession;
}

/** Hide with the horizon while the software keyboard is up; show again when height is 0. */
export function boardingPassCardVisible(keyboardVisible: boolean): boolean {
  return !keyboardVisible;
}
