/**
 * Airport mode has no rounded corners. This turns a StyleSheet's radii to 0 without touching anything else,
 * so a screen's own stylesheet can be reused as-is. Returns new objects (stylesheets are frozen in dev).
 */

const RADIUS_KEY = /^border(?:TopLeft|TopRight|BottomLeft|BottomRight|TopStart|TopEnd|BottomStart|BottomEnd|StartStart|StartEnd|EndStart|EndEnd)?Radius$/;

export function squareStyle<T>(style: T): T {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style as Record<string, unknown>)) {
    if (RADIUS_KEY.test(k) && typeof v === 'number' && v !== 0) {
      out[k] = 0;
      changed = true;
    } else {
      out[k] = v;
    }
  }
  return (changed ? out : style) as T;
}

/** Every named style of a stylesheet with its radii set to 0. */
export function squareStyles<T extends Record<string, unknown>>(sheet: T): T {
  const out: Record<string, unknown> = {};
  for (const [name, style] of Object.entries(sheet)) out[name] = squareStyle(style);
  return out as T;
}
