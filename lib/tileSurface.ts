/**
 * What a row of brand tiles sits on. The tiles were drawn for a navy panel (white circles, white labels);
 * on a light card those labels vanish, so a light panel tells its tiles which colours to use.
 * No provider means the navy look the tiles have always had — the globe and other dark surfaces keep it.
 */
import { createContext, useContext } from 'react';

export type TileSurface = {
  /** Colour of the label under each logo. */
  labelColor: string;
  /** Hairline around the white logo circle, so it still reads as a circle on a white card. */
  circleBorder?: string;
};

export const TileSurfaceContext = createContext<TileSurface | null>(null);

export function useTileSurface(): TileSurface | null {
  return useContext(TileSurfaceContext);
}
