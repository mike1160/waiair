/** Today's FIDS board window — pure, no React Native imports. */

/**
 * First row of today's board: the first flight at or after "now − 2 h". When every flight is older (a stale cache, the
 * OpenSky fallback that only knows landed flights, clocks read in the wrong zone), the newest page instead — the board
 * must never slice itself empty while it has flights (that showed an endless spinner).
 */
export function fidsBoardStart(firstRecentIndex: number, total: number, pageSize: number): number {
  if (!(total > 0)) return 0;
  if (firstRecentIndex >= 0 && firstRecentIndex < total) return firstRecentIndex;
  return Math.max(0, total - Math.max(1, pageSize));
}

/** True when the board has flights but none at or after "now − 2 h". */
export function fidsBoardAllPast(firstRecentIndex: number, total: number): boolean {
  return total > 0 && firstRecentIndex >= total;
}
