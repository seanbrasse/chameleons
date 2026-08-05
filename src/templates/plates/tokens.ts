/**
 * This template's colour vocabulary. Six names, not `timeline`'s twenty-seven —
 * templates share a floor, not a design system (plan §6), so a design declares
 * whatever set it actually uses under whatever names suit it.
 *
 * Every value lives here; a lint rule fails on a colour literal anywhere else
 * under `src/`.
 */

export type PlatesPalette = {
  /** The page. */
  ground: string;
  /** Text. */
  figure: string;
  /** Secondary text. */
  quiet: string;
  /** Hairlines. */
  rule: string;
  /** Plate numbers and links. */
  mark: string;
  /** The tone behind an image. */
  frame: string;
};

export type PlatesTokens = { palette: PlatesPalette };

/**
 * Measured, not guessed, against `ground`: figure 16.68, quiet 5.99, mark 7.48;
 * on `frame` the same three are 14.55, 5.23 and 6.53. All pass AA at body size
 * with room to spare, which the design's one hard rule is what makes possible —
 * no text is ever set over an image, so there is no unknown backdrop to check.
 */
const palette: PlatesPalette = {
  ground: '#F7F7F5',
  figure: '#17171A',
  quiet: '#5E5E66',
  rule: '#DCDCD6',
  mark: '#1B44BE',
  frame: '#E8E8E3',
};

export const defaultTokens: PlatesTokens = { palette };

const CUSTOM_PROPERTY: Record<keyof PlatesPalette, string> = {
  ground: '--ground',
  figure: '--figure',
  quiet: '--quiet',
  rule: '--rule',
  mark: '--mark',
  frame: '--frame',
};

/** Injected per request from the snapshot, so the palette is there on first paint. */
export function stylesheet(tokens: PlatesTokens): string {
  const declarations = (Object.keys(CUSTOM_PROPERTY) as (keyof PlatesPalette)[])
    .map((key) => `${CUSTOM_PROPERTY[key]}:${tokens.palette[key]}`)
    .join(';');

  return `:root{${declarations}}`;
}
